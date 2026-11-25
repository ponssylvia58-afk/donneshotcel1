# Netlify API `/api/webhook` — notifications de formulaire

Cette version remplace l'ancienne fonction. Elle transmet uniquement `name`, `email` et `message` à Telegram.
Elle ne collecte/transmet aucun mot de passe, adresse IP ou géolocalisation.

## Fichiers à mettre dans le dépôt GitHub

- `netlify.toml`
- `netlify/functions/telegram.js`

Conservez le reste de votre site externe ou de votre dépôt. Ne publiez jamais de token dans GitHub.

## Variables Netlify

Dans Project configuration → Environment variables, ajoutez/vérifiez :

- `TELEGRAM_BOT_TOKEN` : token de BotFather (secret).
- `TELEGRAM_CHAT_ID` : identifiant du chat Telegram.
- `ALLOWED_ORIGIN` : origine exacte du site web qui appellera l'API, par exemple `https://www.monsite.fr`.
  Ne mettez ni chemin (`/contact`) ni slash final.

Les variables doivent être disponibles au scope **Functions**. Après toute modification, faites un nouveau déploiement.

## URL

Après déploiement, l'endpoint est :

`https://VOTRE-SITE.netlify.app/api/webhook`

Il accepte `POST` JSON et `OPTIONS` (pré-vérification CORS).

## Exemple JavaScript côté site externe

```js
const response = await fetch("https://VOTRE-SITE.netlify.app/api/webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: document.querySelector("#name").value,
    email: document.querySelector("#email").value,
    message: document.querySelector("#message").value,
    website: "" // champ piège caché, laisser vide pour les vrais visiteurs
  })
});

const result = await response.json();
if (!response.ok) throw new Error(result.error || "Envoi impossible");
```

Ajoutez un champ caché `website` à votre formulaire (un honeypot) et laissez-le vide pour les visiteurs normaux.

## Déploiement avec GitHub

1. Décompressez l'archive.
2. Dans le dépôt GitHub relié à Netlify, remplacez `netlify.toml` et `netlify/functions/telegram.js` par ces versions.
3. Faites Commit changes sur la branche `main`.
4. Netlify détectera le push et lancera un déploiement.
5. Vérifiez que le déploiement est **Published**.
6. Testez ensuite depuis la page du site externe.

## Important : limites de sécurité

CORS limite les appels depuis les navigateurs aux pages ayant l'origine autorisée, mais ce n'est pas une authentification et n'empêche pas les appels directs par des scripts. Avant un usage public important, ajoutez une protection anti-robot (par exemple CAPTCHA/Turnstile) et une limitation de débit côté serveur. N'envoyez jamais de mots de passe, données bancaires ou autres informations sensibles à ce webhook.
