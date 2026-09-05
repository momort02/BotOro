# Discord Bot Oracle

Bot Discord minimal en TypeScript, pret a etre deploye sur Oracle Cloud Free Tier.

## Prerequis

- Node.js 22 ou plus recent pour le developpement local
- Un bot cree dans le [Discord Developer Portal](https://discord.com/developers/applications)
- Docker sur la VM Oracle pour le deploiement
- L intent privilegie `Message Content` active dans le Developer Portal

## Configuration Discord

1. Cree une application, puis un bot dans le Developer Portal.
2. Copie le token du bot.
3. Recupere l Application ID : c est `DISCORD_CLIENT_ID`.
4. Invite le bot avec les scopes `bot` et `applications.commands`, ainsi que la permission `Send Messages`.
5. Pour le developpement, recupere aussi l ID du serveur de test comme `DISCORD_GUILD_ID`.

Pour trouver cet ID, active le mode developpeur dans Discord, puis clic droit sur le serveur et choisis `Copier l identifiant du serveur`. Renseigne-le dans `.env` et redemarre le bot. Les commandes de niveau sont volontairement utilisables uniquement dans un serveur, jamais en message prive.

Le token est un secret : ne le commits jamais et regenere-le s il a ete expose.

## Systeme de niveaux

Chaque membre gagne entre 15 et 25 XP lorsqu il envoie un message, avec un cooldown d une minute. Les donnees sont separees par serveur et conservees dans la base SQLite `data/levels.sqlite`.

- `/rank` : affiche son niveau et son XP
- `/leaderboard` : affiche les dix meilleurs membres

Le bot peut publier automatiquement le classement dans un salon chaque jour a midi. Ajoute dans `.env` :

```env
LEADERBOARD_CHANNEL_ID=identifiant_du_salon
LEADERBOARD_TIMEZONE=Europe/Paris
```

Le bot doit avoir `View Channel` et `Send Messages` dans ce salon. Le fuseau `Europe/Paris` gere automatiquement les changements d heure ete/hiver.

## Moderation des mots

Configure les mots ou expressions a bloquer dans `.env` :

```env
MODERATION_BLOCKED_WORDS=mot1,mot2,expression interdite
```

Lorsqu un message contient un terme configure, le bot le supprime, envoie un avertissement temporaire de cinq secondes et n attribue pas d XP. Il doit avoir `Manage Messages` dans les salons a moderer.

Dans le Developer Portal, active `Message Content Intent` dans les intents privilegies du bot. En production Docker, monte le dossier `data` pour conserver les niveaux lors d une recreation du conteneur :

```bash
sudo docker run -d \
  --name discord-bot \
  --restart unless-stopped \
  --env-file .env \
  -v discord-bot-data:/app/data \
  discord-bot-oracle
```

## Developpement local

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Remplis ensuite `.env`. La commande `/ping` apparait rapidement si `DISCORD_GUILD_ID` est renseigne. Sans cet ID, Discord synchronise la commande globalement, ce qui peut prendre plus de temps.

Pour verifier uniquement le code :

```powershell
npm run build
```

## Deploiement Oracle Cloud Free Tier

Sur une VM Oracle Linux ou Ubuntu :

```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable --now docker
```

Copie le projet sur la VM, puis :

```bash
cp .env.example .env
nano .env
sudo docker build -t discord-bot-oracle .
sudo docker run -d \
  --name discord-bot \
  --restart unless-stopped \
  --env-file .env \
  discord-bot-oracle
```

Consulter les logs :

```bash
sudo docker logs -f discord-bot
```

La VM n a pas besoin d ouvrir de port entrant : le bot maintient une connexion sortante vers Discord.

## Structure

- `src/index.ts` : connexion Discord, synchronisation et routage des commandes
- `src/commands/ping.ts` : commande de test `/ping`
- `Dockerfile` : image de production multi-etape
- `.env.example` : variables necessaires
