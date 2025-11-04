# StreamV7

Plateforme de streaming type Netflix avec back-end Express et front-end Next.js (App Router). L’application propose une gestion complète des contenus (films, séries, catégories), un lecteur HLS sécurisé, un historique de lecture, un panneau d’administration et une API JSON sécurisée.

## Build de production

```bash
npm run build
npm run start
```

Le build Next.js est compilé puis servi via le serveur Express sur le même port.

## Prérequis

- Node.js 18+
- npm ou yarn
- `zip` installé pour le script de sauvegarde

## Installation

```bash
npm install
```

## Lancer le projet en développement

```bash
npm run dev
```

Le serveur Express et l’application Next.js sont servis sur http://localhost:3000.

### Comptes par défaut

- **Admin** : `admin` / `Admin123!`
- **Utilisateur** : `user` / `User123!`

## Scripts utiles

### Seeder

```bash
npm run seed
```

- Génère 3 catégories, 8 films, 2 séries (6 épisodes chacune)
- Crée les utilisateurs de test (admin + user) avec mots de passe bcryptés
- Écrit tous les fichiers JSON via écriture atomique + verrous

### Vérification du catalogue

```bash
npm run lint:catalog
```

- Valide tous les fichiers JSON via Zod

### Sauvegarde des données

```bash
npm run backup
```

- Archive le dossier `data` vers `backups/backup-YYYYMMDD-HHMM.zip`

## Docker

Un fichier `docker-compose.yml` permet de lancer le projet dans un conteneur avec un volume monté sur `./data` et le port 3000 exposé.

```bash
docker-compose up --build
```

## Sécurité

- Authentification par sessions signées (cookie HTTP-only, expiration 7 jours)
- Mots de passe stockés en bcrypt
- Protection CSRF sur toutes les requêtes sensibles
- Rate limit sur les actions admin (10 requêtes/minute)
- Validation Zod + sanitisation DOMPurify côté client
- Helmet & CORS restreint

## Player

- HLS.js (support HLS, DASH, MP4)
- Nettoyage strict lors du changement d’épisode (pause, reset, destruction + remount)
- Auto-play de l’épisode suivant et synchronisation de l’historique

## Historique & recommandations

- Sauvegarde de la progression dans `data/users/history/<username>.json`
- Rangée “Continuer la lecture” dynamique sur la page d’accueil
- Comptabilisation des vues côté serveur (TTL 24h)

## Tests & Qualité

- TypeScript (strict) côté front et schémas Zod partagés
- Scripts automatisés (`seed`, `backup`, `lint:catalog`)

## Structure principale

```
app/                # Pages Next.js (App Router)
components/         # Composants client réutilisables
lib/                # Schémas Zod, helpers API
scripts/            # Seed, backup, lint du catalogue
server.js           # Serveur Express + API + Next
data/               # Données JSON (utilisateurs, catalogue)
```
