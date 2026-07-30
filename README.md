# FCSM — Calendrier intelligent

Projet 100 % GitHub :
- GitHub Pages pour l'hébergement
- GitHub Actions pour la génération automatique (toutes les 12 heures)
- TheSportsDB pour les données sportives

## Fichiers sources
- `index.html` — template HTML
- `generate.js` — script de génération
- `package.json` — dépendances Node.js
- `.github/workflows/build.yml` — workflow GitHub Actions

## Fichiers générés (dans `dist/`)
- `index.html` — page HTML finale avec données injectées
- `fcsm.ics` — flux ICS dynamique
- `data.json` — données brutes TheSportsDB

## Configuration
Ajouter dans **Settings → Secrets → Actions** :
- `THESPORTSDB_API_KEY` — ta clé API TheSportsDB

Activer **GitHub Pages** dans Settings → Pages → Source : **GitHub Actions**.

## IDs utilisés
| Variable | Valeur |
|---|---|
| `TEAM_ID_FCSM` | `133708` |
| `LEAGUE_ID` | `4401` |
| `SEASON` | `2026-2027` |
