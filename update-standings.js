/**
 * update-standings.js
 * Lit le classement actuel FCSM depuis TheSportsDB et l'enregistre
 * dans standings-history.json, indexé par numéro de journée.
 * Exécuté après chaque soirée de match par GitHub Actions.
 */
import fs from 'fs';

let fetch;
try { fetch = (await import('node-fetch')).default; } catch { fetch = global.fetch; }

const API_KEY     = process.env.THESPORTSDB_API_KEY || '';
const TEAM_ID     = process.env.TEAM_ID_FCSM        || '133708';
const LEAGUE_ID   = process.env.LEAGUE_ID           || '4401';
const SEASON      = process.env.SEASON              || '2026-2027';
const TEAM_NAME   = 'FC Sochaux-Montbéliard';
const HISTORY_FILE = 'standings-history.json';

function normTeam(s) {
  return (s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

async function getJson(url) {
  if (!API_KEY) { console.warn('⚠️  Pas de clé API'); return null; }
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) { console.error(`HTTP ${r.status}`); return null; }
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch (e) { console.error(e.message); return null; }
}

const ep = p => `https://www.thesportsdb.com/api/v1/json/${API_KEY}/${p}`;

// 1. Récupérer les matchs joués cette saison pour détecter la dernière journée
const seasonData = await getJson(ep(`eventsseason.php?id=${TEAM_ID}&s=${SEASON}`));
const today = new Date().toISOString().slice(0, 10);
const played = (seasonData?.events || [])
  .filter(ev => ev.dateEvent <= today &&
    ev.intHomeScore != null && ev.intHomeScore !== '' &&
    (String(ev.idLeague) === String(LEAGUE_ID) || (ev.strLeague || '').toLowerCase().includes('ligue 2')))
  .sort((a, b) => a.dateEvent.localeCompare(b.dateEvent));

if (!played.length) {
  console.log('Aucun match Ligue 2 joué pour le moment — rien à faire.');
  process.exit(0);
}

// 2. Récupérer le classement actuel
const tableData = await getJson(ep(`lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`));
const tableRows = tableData?.table || tableData?.teams || [];
const fcsmRow = tableRows.find(r => normTeam(r.strTeam || r.nameTeam) === normTeam(TEAM_NAME));

if (!fcsmRow) {
  console.warn('⚠️  FCSM non trouvé dans le classement — API pas encore à jour.');
  process.exit(0);
}

// 3. Déterminer la dernière journée jouée
const lastMatch = played[played.length - 1];
const round = lastMatch.intRound ? String(lastMatch.intRound) : String(played.length);

// 4. Lire l'historique existant
const history = fs.existsSync(HISTORY_FILE)
  ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
  : {};

// 5. Écrire l'entrée pour cette journée
history[round] = {
  date:         lastMatch.dateEvent,
  rank:         Number(fcsmRow.intRank)   || null,
  points:       Number(fcsmRow.intPoints) || null,
  played:       Number(fcsmRow.intPlayed) || played.length,
  won:          Number(fcsmRow.intWin)    || null,
  drawn:        Number(fcsmRow.intDraw)   || null,
  lost:         Number(fcsmRow.intLoss)   || null,
  goalsFor:     Number(fcsmRow.intGoalsFor)     || null,
  goalsAgainst: Number(fcsmRow.intGoalsAgainst) || null,
};

fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
console.log(`✅ Classement J${round} sauvegardé :`, history[round]);
