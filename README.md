# 💰 UHQ Wallet Addon

> **Free Addon by [Bloume SAS](https://bloume.fr)**  
> Système de solde par compte proxy pour [UHQ Panel OS](https://github.com/BloumeSAS/UHQ-Panel-OS).

---

## Fonctionnalités

- 💳 **Solde par compte** — chaque compte proxy a son propre portefeuille
- ➕ **Crédit / Débit** — l'admin ajoute ou retire des fonds en un clic
- 📊 **Widget Dashboard** — 3 KPIs en temps réel sur le tableau de bord
- 📋 **Widget SubUsers** — tableau des soldes dans la page sous-utilisateurs
- 🔐 **Authentification JWT** — intégration transparente avec le panel
- 💾 **Backup automatique** — inclus dans les sauvegardes du panel
- 🔄 **Mises à jour détectées** — notification dans le panel à chaque nouvelle version
- 🌍 **i18n** — français et anglais inclus

---

## Prérequis

| Outil | Version minimale |
|---|---|
| Node.js | 20+ |
| UHQ Panel OS | 2.0.0+ |

---

## Installation rapide

```bash
git clone https://github.com/BloumeSAS/UHQ-Addon-Wallet
cd UHQ-Addon-Wallet

# Installer les dépendances
npm run install:all

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Build + démarrage
npm run build
npm start
```

Accès : **http://localhost:3001**

Dans UHQ Panel OS → **Extensions** → entrer `http://localhost:3001`.

---

## Développement

```bash
# Terminal 1 — API NestJS avec hot reload
npm run dev:api     # port 3001

# Terminal 2 — Frontend React (Vite)
npm run dev:web     # port 5174, proxy → 3001
```

---

## Docker

### 🚀 CI/CD & Image Docker Publique (GitHub Actions)

Ce dépôt est configuré pour générer automatiquement une image Docker publique via GitHub Actions et la publier sur **GitHub Packages (GHCR)**.

#### Étapes pour initialiser le dépôt et publier l'image :

1. **Initialiser git et lier votre dépôt GitHub** :
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/BloumeSAS/UHQ-Addon-Wallet.git
   ```

2. **Pousser sur GitHub** pour déclencher le workflow :
   ```bash
   git push -u origin main
   ```

Le workflow défini dans `.github/workflows/publish.yml` va automatiquement builder l'image multi-stage et la publier sur `ghcr.io/bloumesas/uhq-addon-wallet:latest` (ou le nom de votre propre organisation/utilisateur).

*Note : Si votre dépôt GitHub est privé et que vous souhaitez rendre l'image publique, rendez-vous dans les paramètres de votre profil GitHub → **Packages**, sélectionnez le package `uhq-addon-wallet` et changez sa visibilité en **Public** dans les réglages de connexion.*

### 💻 Utilisation Locale

Pour lancer l'addon localement avec Docker Compose (qui va compiler l'image à partir du Dockerfile local) :

```bash
docker compose up -d --build
```

### ☁️ Déploiement Coolify

1. Créez un nouveau service **Docker Compose** dans Coolify.
2. Collez le contenu de `docker-compose.coolify.yml`.
3. Configurez les variables d'environnement dans Coolify :

| Variable | Description |
|---|---|
| `PANEL_URL` | URL du panel (`https://panel.domaine.com`) |
| `PANEL_API_KEY` | Clé API du panel (Paramètres → Clé API) |
| `DOMAIN` | Domaine de l'addon (`wallet.domaine.com`) |

4. Configurez le volume persistant : `wallet_data` → `/app/data`
5. Déployez, puis connectez l'addon dans le panel principal : `https://wallet.domaine.com`

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port d'écoute |
| `PANEL_URL` | `http://localhost:8000` | URL du panel |
| `DB_PATH` | `./wallet-data.json` | Fichier de données |
| `PANEL_API_KEY` | *(vide)* | Clé API pour le backup |
| `NODE_ENV` | `development` | Environnement |

---

## Backup

Les données (wallets + transactions) sont **automatiquement incluses** dans chaque backup UHQ Panel OS. Aucune configuration supplémentaire requise sauf définir `PANEL_API_KEY`.

---

## Structure

```
wallet/
├── api/              NestJS — port 3001
│   └── src/
│       ├── wallet/   Logique + store JSON
│       ├── backup/   Endpoints export/import
│       └── manifest/ Sert uhq-manifest.json
├── web/              React + Vite
│   └── src/
│       ├── pages/    MyBalance · AdminBalances
│       └── widgets/  DashboardWidget · BalancesWidget
├── uhq-manifest.json
├── Dockerfile
├── docker-compose.yml
└── docker-compose.coolify.yml
```

---

## Licence

MIT — © 2026 [Bloume SAS](https://bloume.fr)

---

<div align="center">
  <b>Free Addon by <a href="https://bloume.fr">Bloume SAS</a></b><br>
  <sub>Made for UHQ Panel OS · Open Source · MIT License</sub>
</div>
