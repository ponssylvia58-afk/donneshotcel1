const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};

function reply(statusCode, payload, origin, allowedOrigin) {
  const headers = { ...jsonHeaders };
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "";

  // Configure ALLOWED_ORIGIN with the exact origin of the external website.
  // Example: https://www.example.com (no path and no trailing slash).
  if (!allowedOrigin) {
    return reply(503, { error: "API_NOT_CONFIGURED" }, origin, "");
  }

  if (origin !== allowedOrigin) {
    return reply(403, { error: "ORIGIN_NOT_ALLOWED" }, origin, allowedOrigin);
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...jsonHeaders,
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "METHOD_NOT_ALLOWED" }, origin, allowedOrigin);
  }

  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return reply(415, { error: "JSON_REQUIRED" }, origin, allowedOrigin);
  }

  if (!event.body || event.body.length > 12_000) {
    return reply(413, { error: "INVALID_REQUEST_SIZE" }, origin, allowedOrigin);
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return reply(400, { error: "INVALID_JSON" }, origin, allowedOrigin);
  }

  // Honeypot: normal visitors should leave this field empty.
  if (data.website) {
    return reply(200, { success: true }, origin, allowedOrigin);
  }

  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";

  if (!name || !email || !message) {
    return reply(400, { error: "NAME_EMAIL_MESSAGE_REQUIRED" }, origin, allowedOrigin);
  }
  if (name.length > 100 || email.length > 254 || message.length > 3000) {
    return reply(400, { error: "FIELD_TOO_LONG" }, origin, allowedOrigin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply(400, { error: "INVALID_EMAIL" }, origin, allowedOrigin);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return reply(503, { error: "TELEGRAM_NOT_CONFIGURED" }, origin, allowedOrigin);
  }

  // Do not collect or transmit passwords, payment details, IP addresses, or precise location.
  const text = [
    "📩 Nouveau message du formulaire",
    `Nom : ${name}`,
    `E-mail : ${email}`,
    "",
    "Message :",
    message,
  ].join("\n");

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );

    if (!telegramResponse.ok) {
      // Avoid logging tokens or submitted form contents.
      console.error("Telegram API returned a non-success status:", telegramResponse.status);
      return reply(502, { error: "NOTIFICATION_FAILED" }, origin, allowedOrigin);
    }

    return reply(200, { success: true }, origin, allowedOrigin);
  } catch {
    console.error("Telegram request failed.");
    return reply(502, { error: "NOTIFICATION_FAILED" }, origin, allowedOrigin);
  }
};
