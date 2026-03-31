# TrustFeed — Digital Ocean Deployment Guide

## Prerequisites

1. A [Digital Ocean](https://www.digitalocean.com/) account
2. Install the DO CLI: `brew install doctl` (macOS) or `scoop install doctl` (Windows)
3. Authenticate: `doctl auth init`
4. Push both apps to GitHub repos (or use a monorepo with component paths)

---

## Architecture on Digital Ocean

```
┌─────────────────────────────────────────────┐
│           DO App Platform (nyc)             │
│                                             │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ TrustFeed Core  │  │ TrustFeed Survey │  │
│  │  (App #1)       │  │  (App #2)        │  │
│  │                 │  │                  │  │
│  │  core-frontend  │  │  survey-frontend │  │
│  │  (nginx:80)     │  │  (nginx:80)      │  │
│  │       │         │  │       │          │  │
│  │  core-api       │  │  survey-api      │  │
│  │  (FastAPI:8000) │  │  (Express:3000)  │  │
│  │                 │  │       │          │  │
│  └─────────────────┘  │  MySQL 8 (db)    │  │
│                       │  (managed, no PII)│  │
│                       └──────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Step 1 — Push Code to GitHub

### Option A: Two separate repos

```bash
# Repo 1: TrustFeed Core
cd AugmentedDoing
git init && git add . && git commit -m "initial"
gh repo create trustfeed-core --public --push

# Repo 2: TrustFeed Survey
cd ../SurveyApp
git init && git add . && git commit -m "initial"
gh repo create trustfeed-survey --public --push
```

### Option B: Monorepo (update source_dir in app.yaml)

If using a single repo, add `source_dir: AugmentedDoing` and `source_dir: SurveyApp` to the respective app specs.

---

## Step 2 — Update GitHub Repo References

Edit the `<your-github-username>` placeholders in:

- `AugmentedDoing/.do/app.yaml`
- `SurveyApp/.do/app.yaml`

Replace with your actual GitHub username and repo name.

---

## Step 3 — Deploy TrustFeed Survey (with database)

```bash
cd SurveyApp

# Create the app (provisions MySQL, API, and frontend)
doctl apps create --spec .do/app.yaml --wait

# Get the app ID
doctl apps list

# Initialize the database schema
# 1. Get the DB connection string:
doctl databases list
doctl databases connection <db-id> --format Host,Port,User,Password,Database

# 2. Run init.sql against the managed DB:
mysql -h <host> -P <port> -u <user> -p<password> --ssl-mode=REQUIRED < db/init.sql
```

### Set the Pexels API Key (optional, for dynamic content)

```bash
doctl apps update <app-id> --spec .do/app.yaml
# Or set it in the DO dashboard: Apps > trustfeed-survey > Settings > survey-api > Environment Variables
```

---

## Step 4 — Deploy TrustFeed Core

```bash
cd AugmentedDoing

doctl apps create --spec .do/app.yaml --wait
```

Once deployed, note the app URL (e.g., `https://trustfeed-core-xxxxx.ondigitalocean.app`) and update the `CORS_ORIGINS` env var if needed.

---

## Step 5 — Verify Deployment

```bash
# Survey app health
curl https://<survey-app-url>/health
curl https://<survey-app-url>/api/health

# Core app health
curl https://<core-app-url>/health
curl https://<core-app-url>/api/health
```

---

## Environment Variables Reference

### TrustFeed Survey — survey-api

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | MySQL host (auto from DO) | `${db.HOSTNAME}` |
| `DB_PORT` | MySQL port (auto from DO) | `${db.PORT}` |
| `DB_USER` | MySQL user (auto from DO) | `${db.USERNAME}` |
| `DB_PASSWORD` | MySQL password (auto from DO) | `${db.PASSWORD}` |
| `DB_NAME` | Database name (auto from DO) | `${db.DATABASE}` |
| `DB_SSL` | Enable SSL for managed DB | `true` |
| `API_PORT` | Express listen port | `3000` |
| `PEXELS_API_KEY` | Pexels API key (optional) | `your-key` |

### TrustFeed Core — core-api

| Variable | Description | Example |
|---|---|---|
| `MOCK_MODE` | Run in simulation mode | `true` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://trustfeed-core-xxx.ondigitalocean.app` |

---

## Local Docker Testing (before deploying)

### Survey App (full stack)

```bash
cd SurveyApp
docker compose up --build
# Frontend: http://localhost:8080
# API:      http://localhost:3000/api/health
# MySQL:    localhost:3306
```

### Core App

```bash
cd AugmentedDoing

# Build and run backend
docker build -t trustfeed-core-api -f backend/Dockerfile backend/
docker run -p 8000:8000 -e MOCK_MODE=true trustfeed-core-api

# Build and run frontend
docker build -t trustfeed-core-frontend .
docker run -p 4200:80 trustfeed-core-frontend
```

---

## Estimated Costs (DO App Platform)

| Resource | Tier | ~Monthly |
|---|---|---|
| survey-frontend | basic-xxs (512MB) | $5 |
| survey-api | basic-xxs (512MB) | $5 |
| MySQL 8 (managed) | db-s-1vcpu-1gb | $15 |
| core-frontend | basic-xxs (512MB) | $5 |
| core-api | basic-xs (1GB) | $10 |
| **Total** | | **~$40/mo** |

---

## Updating After Deployment

With `deploy_on_push: true`, simply push to `main`:

```bash
git add . && git commit -m "update" && git push
```

Digital Ocean will automatically rebuild and redeploy.

---

## Troubleshooting

- **DB connection fails**: Ensure `DB_SSL=true` is set; DO managed MySQL requires SSL.
- **CORS errors on Core**: Update `CORS_ORIGINS` env var to match the actual app URL.
- **nginx 502**: The API container may still be starting; check the health check logs.
- **Build fails**: Check that `.dockerignore` is excluding `node_modules` and `.angular`.
