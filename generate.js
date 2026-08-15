import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

let fetch;
try { fetch = (await import('node-fetch')).default; } catch { fetch = global.fetch; }

const API_KEY = process.env.THESPORTSDB_API_KEY || '';
const TEAM_ID_FCSM = process.env.TEAM_ID_FCSM || '133708';
const LEAGUE_ID = process.env.LEAGUE_ID || '4401';
const SEASON = process.env.SEASON || '2026-2027';
const TEAM_NAME_FALLBACK = 'FC Sochaux-Montbéliard';
const TEAM_DISPLAY_NAME = 'FC Sochaux';
// Secours neutre : logo de la compétition, jamais le logo éditorial du site.
const FCSM_BADGE_LOCAL = 'https://r2.thesportsdb.com/images/media/league/badge/aofb771742983333.png';

const out = 'dist';
const SRC_BADGES = 'badges';
const DST_BADGES = path.join(out, 'badges');
fs.mkdirSync(out,        { recursive: true });
fs.mkdirSync(SRC_BADGES, { recursive: true });
fs.mkdirSync(DST_BADGES, { recursive: true });
if (fs.existsSync('favicon.svg'))    fs.copyFileSync('favicon.svg',    path.join(out, 'favicon.svg'));
if (fs.existsSync('favicon-32.svg')) fs.copyFileSync('favicon-32.svg', path.join(out, 'favicon-32.svg'));
if (fs.existsSync('logo.jpg'))       fs.copyFileSync('logo.jpg',       path.join(out, 'logo.jpg'));
if (fs.existsSync('logo-512.png'))   fs.copyFileSync('logo-512.png',   path.join(out, 'logo-512.png'));
if (fs.existsSync('thesportsdb.html')) fs.copyFileSync('thesportsdb.html', path.join(out, 'thesportsdb.html'));

const ep = p => `https://www.thesportsdb.com/api/v1/json/${API_KEY}/${p}`;

async function getJson(url) {
  if (!API_KEY) { console.warn('⚠️  THESPORTSDB_API_KEY absent'); return null; }
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) { console.error(`HTTP ${r.status} for ${url}`); return null; }
    const text = await r.text();
    if (!text || text.trim() === '') return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) { console.error(`Fetch error: ${e.message}`); return null; }
}

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normTeam(s) {
  return (s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* ── Alias : ramène toutes les variantes vers une clé canonique ── */
const TEAM_NAME_ALIASES = {
  'as saint-etienne':  'as saint-etienne',
  'saint-etienne':     'as saint-etienne',
  'st etienne':        'as saint-etienne',
  'st-etienne':        'as saint-etienne',
  'saint etienne':     'as saint-etienne',
  'as saint etienne':  'as saint-etienne',
  'red star':          'red star fc',
  'red star 93':       'red star fc',
  'red star paris':    'red star fc',
  'en avant guingamp': 'en avant guingamp',
  'guingamp':          'en avant guingamp',
  'ea guingamp':       'en avant guingamp',
  'e a guingamp':      'en avant guingamp',
  'e.a. guingamp':     'en avant guingamp',
  'en avant de guingamp': 'en avant guingamp',
  'fc sochaux-montbeliard': 'fc sochaux-montbeliard',
  'fc sochaux':             'fc sochaux-montbeliard',
  'sochaux':                'fc sochaux-montbeliard',
  'fcsm':                   'fc sochaux-montbeliard',
};

function canonicalTeamKey(name) {
  const n = normTeam(name);
  return TEAM_NAME_ALIASES[n] || n;
}

function displayTeamName(name) {
  return canonicalTeamKey(name) === canonicalTeamKey(TEAM_NAME_FALLBACK)
    ? TEAM_DISPLAY_NAME
    : name;
}

async function ensureBadge(remoteUrl, slug) {
  if (!remoteUrl || !slug) return '';
  const srcFile = path.join(SRC_BADGES, `${slug}.png`);
  const dstFile = path.join(DST_BADGES, `${slug}.png`);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, dstFile);
    return `./badges/${slug}.png`;
  }
  try {
    const r = await fetch(remoteUrl, { headers: { 'User-Agent': 'fcsm-calendar-build/1.0' } });
    if (!r.ok) { console.warn(`Badge HTTP ${r.status}: ${remoteUrl}`); return ''; }
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(srcFile, buf);
    fs.copyFileSync(srcFile, dstFile);
    console.log(`🖼  Badge downloaded: badges/${slug}.png`);
    return `./badges/${slug}.png`;
  } catch (e) {
    console.warn(`Badge error (${slug}): ${e.message}`);
    return '';
  }
}

async function getPublicJson(url) {
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn(`Public API error: ${e.message}`);
    return null;
  }
}

/* ── IDs TheSportsDB ── */
const TEAM_IDS = {
  'Red Star FC':             '135467',
  'AS Saint-Étienne':        '133717',
  'EN Avant Guingamp':       '134244',
  'Clermont Foot 63':        '134713',
  'FC Nantes':               '133861',
  'FC Annecy':               '139928',
  'Dijon FCO':               '133696',
  'Grenoble Foot 38':        '133847',
  'Stade Lavallois MFC':     '134708',
  'AS Nancy Lorraine':       '133710',
  'FC Metz':                 '133883',
  'US Boulogne CO':          '133849',
  'Montpellier Hérault SC':  '133709',
  'USL Dunkerque':           '138821',
  'Rodez Aveyron Football':  '137652',
  'Pau FC':                  '138309',
  'Stade de Reims':          '133934',
};

/* ── Badges forcés (indépendants de la clé API) ── */
async function ensureBadgeWithFallbacks(urls, slug) {
  if (!slug || !urls || !urls.length) return '';
  const srcFile = path.join(SRC_BADGES, `${slug}.png`);
  const dstFile = path.join(DST_BADGES, `${slug}.png`);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, dstFile);
    return `./badges/${slug}.png`;
  }
  for (const remoteUrl of urls) {
    if (!remoteUrl) continue;
    try {
      const r = await fetch(remoteUrl, { headers: { 'User-Agent': 'fcsm-calendar-build/1.0' } });
      if (!r.ok) { console.warn(`Badge HTTP ${r.status}: ${remoteUrl}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(srcFile, buf);
      fs.copyFileSync(srcFile, dstFile);
      console.log(`🖼  Badge downloaded: badges/${slug}.png (via ${remoteUrl})`);
      return `./badges/${slug}.png`;
    } catch (e) {
      console.warn(`Badge error (${slug}): ${e.message}`);
    }
  }
  return '';
}

const BADGE_OVERRIDES = {
  'fc sochaux-montbeliard': [
    'https://r2.thesportsdb.com/images/media/team/badge/ymsdjh1766618296.png',
  ],
  'as saint-etienne': [
    'https://r2.thesportsdb.com/images/media/team/badge/spvrqr1420745995.png',
    'https://www.thesportsdb.com/images/media/team/badge/spvrqr1420745995.png',
  ],
  'fc nantes': [
    'https://r2.thesportsdb.com/images/media/team/badge/mla9x61678808018.png',
  ],
  'dijon fco': [
    'https://r2.thesportsdb.com/images/media/team/badge/viin5f1547898121.png',
  ],
  'montpellier herault sc': [
    'https://r2.thesportsdb.com/images/media/team/badge/8wn9x31750879448.png',
  ],
  'stade de reims': [
    'https://r2.thesportsdb.com/images/media/team/badge/xcrw1b1592925946.png',
  ],
  'red star fc': [
    'https://r2.thesportsdb.com/images/media/team/badge/so4unb1658758422.png',
    'https://www.thesportsdb.com/images/media/team/badge/so4unb1658758422.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Logo_Red_Star_FC_2014.svg/512px-Logo_Red_Star_FC_2014.svg.png',
    'https://upload.wikimedia.org/wikipedia/fr/thumb/7/7e/Logo_Red_Star_FC_2014.svg/512px-Logo_Red_Star_FC_2014.svg.png',
  ],
};

/* ── Données Head-to-Head ── */
const HEAD2HEAD_DATA = fs.existsSync('head2head.json')
  ? JSON.parse(fs.readFileSync('head2head.json', 'utf8'))
  : {};

function h2hKey(teamName) {
  return slugify(canonicalTeamKey(teamName));
}

function buildH2hDescription(oppName) {
  const key = h2hKey(oppName);
  const data = HEAD2HEAD_DATA[key];
  if (!data) return '';
  const { totalPlayed, fcsmWins, draws, fcsmLosses, goalsFor, goalsAgainst, note, lastMatches } = data;
  const bilan = `Précédentes confrontations vs ${data.opponent || oppName} : ${totalPlayed} matchs — ${fcsmWins}V ${draws}N ${fcsmLosses}D (${goalsFor}-${goalsAgainst})`;
  const noteStr = note ? `📝 ${note}` : '';
  const lastStr = (lastMatches || []).slice(0, 3).map(m => {
    const isHome = normTeam(m.home) === normTeam('FC Sochaux-Montbéliard');
    const result = isHome
      ? (m.scoreHome > m.scoreAway ? 'V' : m.scoreHome === m.scoreAway ? 'N' : 'D')
      : (m.scoreAway > m.scoreHome ? 'V' : m.scoreHome === m.scoreAway ? 'N' : 'D');
    const score = isHome ? `${m.scoreHome}-${m.scoreAway}` : `${m.scoreAway}-${m.scoreHome}`;
    const where = isHome ? '(dom.)' : '(ext.)';
    return `  • ${m.date} ${where} ${result} ${score} [${m.competition}]`;
  }).join('\\n');
  return [bilan, noteStr, lastStr ? `Dernières confrontations :\\n${lastStr}` : ''].filter(Boolean).join('\\n');
}

function buildH2hHtml(oppName, logos) {
  const key = h2hKey(oppName);
  const data = HEAD2HEAD_DATA[key];
  if (!data) {
    return `<p class="no-matches">Aucune donnée historique disponible pour cet adversaire.</p>`;
  }
  const { totalPlayed, fcsmWins, draws, fcsmLosses, goalsFor, goalsAgainst, note, lastMatches } = data;
  const bilanHtml = `
<div class="h2h-stats">
  <div class="h2h-stat"><span class="h2h-val h2h-win">${fcsmWins}</span><span class="h2h-lbl">Victoires</span></div>
  <div class="h2h-stat"><span class="h2h-val h2h-draw">${draws}</span><span class="h2h-lbl">Nuls</span></div>
  <div class="h2h-stat"><span class="h2h-val h2h-loss">${fcsmLosses}</span><span class="h2h-lbl">Défaites</span></div>
  <div class="h2h-stat"><span class="h2h-val">${goalsFor}-${goalsAgainst}</span><span class="h2h-lbl">Buts (pour-contre)</span></div>
  <div class="h2h-stat"><span class="h2h-val">${totalPlayed}</span><span class="h2h-lbl">Matchs joués</span></div>
</div>
${note ? `<p class="h2h-note">📝 ${note}</p>` : ''}`;
  const matchesHtml = (lastMatches || []).map(m => {
    const isHome = normTeam(m.home) === normTeam('FC Sochaux-Montbéliard');
    const result = isHome
      ? (m.scoreHome > m.scoreAway ? 'V' : m.scoreHome === m.scoreAway ? 'N' : 'D')
      : (m.scoreAway > m.scoreHome ? 'V' : m.scoreHome === m.scoreAway ? 'N' : 'D');
    const cls = result === 'V' ? 'win' : result === 'N' ? 'draw' : 'loss';
    const homeBadge = teamBadgeImg(m.home, logos, 16);
    const awayBadge = teamBadgeImg(m.away, logos, 16);
    const dateStr = fmtDateOnly(m.date);
    return `<li>
  <span class="form-badge form-badge--${cls}">${result}</span>
  <span class="h2h-match-date">${dateStr}</span>
  <span class="h2h-match-teams">${homeBadge} ${m.home} ${m.scoreHome}–${m.scoreAway} ${awayBadge} ${m.away}</span>
  <span class="h2h-match-comp">${m.competition}</span>
</li>`;
  }).join('\n');
  return bilanHtml;
}

/* ── Date de build (heure Europe/Paris) ── */
function buildTimestamp() {
  const now = new Date();
  const opts = { timeZone: 'Europe/Paris', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('fr-FR', opts).format(now);
}
const LAST_UPDATED = buildTimestamp();

function getTodayParis() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const d = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const hour = parseInt(d.hour, 10);
  const dateStr = `${d.year}-${d.month}-${d.day}`;
  if (hour >= 22) {
    const next = new Date(dateStr + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  return dateStr;
}
const today = getTodayParis();

function parseForm(events, teamName) {
  if (!events || !events.length) return [];
  return events.slice(0, 5).map(ev => {
    const hs = Number(ev.intHomeScore), as = Number(ev.intAwayScore);
    const isHome = canonicalTeamKey(ev.strHomeTeam) === canonicalTeamKey(teamName);
    const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) return { letter: '?', score: '?-?', opponent: opp, date: ev.dateEvent || '' };
    const letter = isHome ? (hs > as ? 'V' : hs === as ? 'N' : 'D') : (as > hs ? 'V' : hs === as ? 'N' : 'D');
    return { letter, score: `${hs}-${as}`, opponent: opp, date: ev.dateEvent || '' };
  });
}

function calcFormStr(events, teamName) { return parseForm(events, teamName).map(r => r.letter).join(' ') || '—'; }

function teamBadgeImg(name, logos, size = 20) {
  const key = canonicalTeamKey(name);
  const url = logos[key] || (key === canonicalTeamKey(TEAM_NAME_FALLBACK) ? FCSM_BADGE_LOCAL : '');
  if (!url) return '';
  return `<img src="${url}" alt="${name}" width="${size}" height="${size}" style="border-radius:3px;object-fit:contain;vertical-align:middle;flex-shrink:0">`;
}

function eventLineHtml(ev, teamName, logos) {
  if (!ev || !ev.strHomeTeam) return '<li>—</li>';
  const hs = Number(ev.intHomeScore), as = Number(ev.intAwayScore);
  const isHome = canonicalTeamKey(ev.strHomeTeam) === canonicalTeamKey(teamName);
  const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
  const self = isHome ? ev.strHomeTeam : ev.strAwayTeam;
  const oppDisplay = displayTeamName(opp);
  const selfDisplay = displayTeamName(self);
  const dateOnly = ev.dateEvent ? fmtDateOnly(ev.dateEvent) : '—';
  const oppBadge = teamBadgeImg(opp, logos, 16);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) {
    return `<li><span class="form-badge form-badge--unknown">?</span> ${dateOnly} — ${teamBadgeImg(ev.strHomeTeam, logos, 16)} ${ev.strHomeTeam} vs ${teamBadgeImg(ev.strAwayTeam, logos, 16)} ${ev.strAwayTeam}</li>`;
  }
  const letter = isHome ? (hs > as ? 'V' : hs === as ? 'N' : 'D') : (as > hs ? 'V' : hs === as ? 'N' : 'D');
  const cls = letter === 'V' ? 'win' : letter === 'N' ? 'draw' : 'loss';
  const scoreStr = isHome
    ? `${teamBadgeImg(self, logos, 16)} ${selfDisplay} ${hs}-${as} ${oppBadge} ${oppDisplay}`
    : `${oppBadge} ${oppDisplay} ${as}-${hs} ${teamBadgeImg(self, logos, 16)} ${selfDisplay}`;
  return `<li><span class="form-badge form-badge--${cls}">${letter}</span> ${dateOnly} — ${scoreStr}</li>`;
}

function parisOffsetMinutes(dateEvent) {
  const d = new Date(dateEvent + 'T12:00:00Z');
  const month = d.getUTCMonth() + 1;
  if (month >= 4 && month <= 10) return 120;
  return 60;
}

function buildIso(dateEvent, strTime) {
  if (!dateEvent) return '';
  const timeLocal = strTime ? strTime.slice(0, 5) : '20:45';
  const offsetMin = parisOffsetMinutes(dateEvent);
  const [h, m] = timeLocal.split(':').map(Number);
  const totalMinLocal = h * 60 + m;
  const totalMinUTC   = totalMinLocal - offsetMin;
  const hUtc = Math.floor(((totalMinUTC % 1440) + 1440) % 1440 / 60);
  const mUtc = ((totalMinUTC % 1440) + 1440) % 1440 % 60;
  let d = new Date(dateEvent + 'T12:00:00Z');
  if (totalMinUTC < 0) d = new Date(d.getTime() - 86400000);
  const datePart = d.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = String(hUtc).padStart(2,'0') + String(mUtc).padStart(2,'0') + '00';
  return `${datePart}T${timePart}Z`;
}

function buildIsoHtml(dateEvent, strTime) {
  if (!dateEvent) return '';
  const timeLocal = strTime ? strTime.slice(0, 5) : '20:45';
  const offsetMin = parisOffsetMinutes(dateEvent);
  const [h, m] = timeLocal.split(':').map(Number);
  const totalMinLocal = h * 60 + m;
  const totalMinUTC   = totalMinLocal - offsetMin;
  const hUtc = Math.floor(((totalMinUTC % 1440) + 1440) % 1440 / 60);
  const mUtc = ((totalMinUTC % 1440) + 1440) % 1440 % 60;
  let d = new Date(dateEvent + 'T12:00:00Z');
  if (totalMinUTC < 0) d = new Date(d.getTime() - 86400000);
  const datePart = d.toISOString().slice(0, 10);
  const timePart = String(hUtc).padStart(2,'0') + ':' + String(mUtc).padStart(2,'0') + ':00';
  return `${datePart}T${timePart}Z`;
}

function fmtTime(strTime) {
  return strTime ? strTime.slice(0, 5) : '—';
}

function displayLeague(name) { return String(name || '').toLowerCase().includes('ligue 2') ? 'Ligue 2 BKT' : (name || '—'); }
function formatPoints(value) { const points = Number(value); return Number.isFinite(points) ? `${points} point${points === 1 ? '' : 's'}` : '—'; }

function fmtDateOnly(dateEvent) {
  if (!dateEvent) return '—';
  try {
    const d = new Date(dateEvent + 'T12:00:00Z');
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return dateEvent; }
}

function fmtDate(dateEvent, strTime) {
  return fmtDateOnly(dateEvent);
}

/* ══════════════════════════════════════════════════════════════
   CLASSEMENT HARDCODÉ — Ligue 2 2026-2027
   Après J1 (8 août 2026) — scores réels intégrés.
   FCSM : 0-3 vs ASSE → 18e, 0 pt.
   Utilisé comme fallback si l'API retourne < 18 équipes.

   MISE À JOUR : ce bloc doit être mis à jour manuellement
   après chaque journée jusqu'à ce que TheSportsDB propose
   un classement complet (≥ 18 équipes) via son API.
   ══════════════════════════════════════════════════════════════ */
const LIGUE2_TABLE_HARDCODED = [
  { strTeam: 'AS Saint-Étienne',        intRank: 1,  intPlayed: 1, intWin: 1, intDraw: 0, intLoss: 0, intGoalsFor: 3, intGoalsAgainst: 0, intGoalDifference: 3,  intPoints: 3 },
  { strTeam: 'USL Dunkerque',           intRank: 2,  intPlayed: 1, intWin: 1, intDraw: 0, intLoss: 0, intGoalsFor: 4, intGoalsAgainst: 2, intGoalDifference: 2,  intPoints: 3 },
  { strTeam: 'Rodez Aveyron Football',  intRank: 3,  intPlayed: 1, intWin: 1, intDraw: 0, intLoss: 0, intGoalsFor: 3, intGoalsAgainst: 1, intGoalDifference: 2,  intPoints: 3 },
  { strTeam: 'FC Metz',                 intRank: 4,  intPlayed: 1, intWin: 1, intDraw: 0, intLoss: 0, intGoalsFor: 2, intGoalsAgainst: 1, intGoalDifference: 1,  intPoints: 3 },
  { strTeam: 'FC Annecy',               intRank: 5,  intPlayed: 1, intWin: 1, intDraw: 0, intLoss: 0, intGoalsFor: 1, intGoalsAgainst: 0, intGoalDifference: 1,  intPoints: 3 },
  { strTeam: 'Red Star FC',             intRank: 6,  intPlayed: 1, intWin: 1, intDraw: 0, intLoss: 0, intGoalsFor: 1, intGoalsAgainst: 0, intGoalDifference: 1,  intPoints: 3 },
  { strTeam: 'Dijon FCO',               intRank: 7,  intPlayed: 1, intWin: 0, intDraw: 1, intLoss: 0, intGoalsFor: 1, intGoalsAgainst: 1, intGoalDifference: 0,  intPoints: 1 },
  { strTeam: 'Montpellier Hérault SC',  intRank: 8,  intPlayed: 1, intWin: 0, intDraw: 1, intLoss: 0, intGoalsFor: 1, intGoalsAgainst: 1, intGoalDifference: 0,  intPoints: 1 },
  { strTeam: 'AS Nancy Lorraine',       intRank: 9,  intPlayed: 1, intWin: 0, intDraw: 1, intLoss: 0, intGoalsFor: 0, intGoalsAgainst: 0, intGoalDifference: 0,  intPoints: 1 },
  { strTeam: 'US Boulogne CO',          intRank: 10, intPlayed: 1, intWin: 0, intDraw: 1, intLoss: 0, intGoalsFor: 0, intGoalsAgainst: 0, intGoalDifference: 0,  intPoints: 1 },
  { strTeam: 'Clermont Foot 63',        intRank: 11, intPlayed: 1, intWin: 0, intDraw: 1, intLoss: 0, intGoalsFor: 0, intGoalsAgainst: 0, intGoalDifference: 0,  intPoints: 1 },
  { strTeam: 'Stade de Reims',          intRank: 12, intPlayed: 1, intWin: 0, intDraw: 1, intLoss: 0, intGoalsFor: 0, intGoalsAgainst: 0, intGoalDifference: 0,  intPoints: 1 },
  { strTeam: 'EN Avant Guingamp',       intRank: 13, intPlayed: 1, intWin: 0, intDraw: 0, intLoss: 1, intGoalsFor: 1, intGoalsAgainst: 2, intGoalDifference: -1, intPoints: 0 },
  { strTeam: 'FC Nantes',               intRank: 14, intPlayed: 1, intWin: 0, intDraw: 0, intLoss: 1, intGoalsFor: 0, intGoalsAgainst: 1, intGoalDifference: -1, intPoints: 0 },
  { strTeam: 'Pau FC',                  intRank: 15, intPlayed: 1, intWin: 0, intDraw: 0, intLoss: 1, intGoalsFor: 0, intGoalsAgainst: 1, intGoalDifference: -1, intPoints: 0 },
  { strTeam: 'Grenoble Foot 38',        intRank: 16, intPlayed: 1, intWin: 0, intDraw: 0, intLoss: 1, intGoalsFor: 2, intGoalsAgainst: 4, intGoalDifference: -2, intPoints: 0 },
  { strTeam: 'Stade Lavallois MFC',     intRank: 17, intPlayed: 1, intWin: 0, intDraw: 0, intLoss: 1, intGoalsFor: 1, intGoalsAgainst: 3, intGoalDifference: -2, intPoints: 0 },
  // J1 : FCSM 0-3 AS Saint-Étienne (08/08/2026) → 18e, 0 pt, -3 diff
  { strTeam: 'FC Sochaux-Montbéliard',  intRank: 18, intPlayed: 1, intWin: 0, intDraw: 0, intLoss: 1, intGoalsFor: 0, intGoalsAgainst: 3, intGoalDifference: -3, intPoints: 0 },
];

const [teamData, lastData, seasonData, nextTeamData, tableData] = await Promise.all([
  getJson(ep(`lookupteam.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventslast.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventsseason.php?id=${TEAM_ID_FCSM}&s=${SEASON}`)),
  getJson(ep(`eventsnext.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`)),
]);

const team = teamData?.teams?.[0] || {};
const teamName = team.strTeam || TEAM_NAME_FALLBACK;
const teamBadgeUrls = BADGE_OVERRIDES[canonicalTeamKey(teamName)] || [team.strTeamBadge || team.strBadge || ''];
const teamBadgeRemote = teamBadgeUrls[0] || '';

/* ── Classement : API prioritaire, fallback J1 à durée de validité limitée ──
   Le classement hardcodé reflète uniquement la situation après J1.
   Il ne doit jamais survivre à la fin de J2 si l'API reste incomplète.
── */
const LIGUE2_TABLE_HARDCODED_ROUND = 1;
const LIGUE2_TABLE_HARDCODED_VALID_UNTIL = '2026-08-14T22:45:00+02:00'; // fin estimée de J2
const apiTableRows = tableData?.table || tableData?.teams || [];
const apiTableComplete = apiTableRows.length >= 18;
const apiCompletedRound = [...(lastData?.results || lastData?.events || []), ...(seasonData?.events || [])]
  .filter(ev =>
    Number(ev.intRound) > 0 &&
    (String(ev.idLeague) === String(LEAGUE_ID) || (ev.strLeague || '').toLowerCase().includes('ligue 2')) &&
    ev.intHomeScore != null && ev.intHomeScore !== '' && ev.intAwayScore != null && ev.intAwayScore !== ''
  )
  .reduce((latest, ev) => Math.max(latest, Number(ev.intRound)), 0);
const hardcodedTableStillValid =
  apiCompletedRound <= LIGUE2_TABLE_HARDCODED_ROUND &&
  Date.now() < Date.parse(LIGUE2_TABLE_HARDCODED_VALID_UNTIL);
const tableSource = apiTableComplete
  ? 'api'
  : hardcodedTableStillValid
    ? 'hardcoded-J1'
    : 'unavailable';
const tableRows = tableSource === 'api'
  ? apiTableRows
  : tableSource === 'hardcoded-J1'
    ? LIGUE2_TABLE_HARDCODED
    : [];

if (tableSource === 'api') {
  console.log(`📋 Classement API : ${apiTableRows.length} équipes`);
} else if (tableSource === 'hardcoded-J1') {
  console.log(`📋 Classement API incomplet (${apiTableRows.length} équipes < 18) → fallback hardcodé J1 utilisé jusqu'à la fin de J2`);
} else {
  console.warn(`📋 Classement API incomplet (${apiTableRows.length} équipes < 18), J${apiCompletedRound || 2} détectée ou délai J2 expiré → classement momentanément indisponible`);
}

const calendarTeamsBadges = await Promise.all(
  Object.entries(TEAM_IDS).map(async ([name, id]) => {
    const overrideUrls = BADGE_OVERRIDES[canonicalTeamKey(name)];
    if (overrideUrls) {
      console.log(`🏠 Badge override: ${name}`);
      return { name, id, badgeUrls: overrideUrls, badgeUrl: overrideUrls[0] };
    }
    const d = await getJson(ep(`lookupteam.php?id=${id}`));
    const badgeUrl = d?.teams?.[0]?.strTeamBadge || d?.teams?.[0]?.strBadge || '';
    return { name, id, badgeUrls: [badgeUrl], badgeUrl };
  })
);

const FCSM = teamName;

/* ── Matchs de préparation (scores définitifs) ── */
const FRIENDLY_SCHEDULE = [
  { dateEvent:'2026-07-26', strTime:'15:00:00', strHomeTeam:'Grenoble Foot 38', strAwayTeam:FCSM, intHomeScore:0, intAwayScore:1, strLeague:'Amical', strVenue:'Stade des Alpes', _friendly:true },
  { dateEvent:'2026-08-01', strTime:'15:00:00', strHomeTeam:FCSM, strAwayTeam:'AJ Auxerre',       intHomeScore:1, intAwayScore:1, strLeague:'Amical', strVenue:'Stade Auguste Bonal', _friendly:true },
];

const LIGUE2_SCHEDULE = [
  /* J1  */ { dateEvent:'2026-08-08', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'AS Saint-Étienne',         idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133717',  strLeague:'French Ligue 2', intRound:'1',  strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:true, _confirmedSource:'LFP', _broadcaster:'beIN SPORTS', _channel:'beIN SPORTS 1', _channelExact:'beIN SPORTS 1' },
  /* J2  */ { dateEvent:'2026-08-14', strTime:'20:45:00', strHomeTeam:'Red Star FC',              strAwayTeam:FCSM,                        idHomeTeam:'135467',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'2',  strVenue:'Stade Bauer',                _hardcoded:true, _confirmed:true, _confirmedSource:'LFP', _broadcaster:'beIN SPORTS', _channel:'beIN SPORTS MAX', _channelExact:null },
  /* J3  */ { dateEvent:'2026-08-21', strTime:'20:00:00', strHomeTeam:FCSM,                       strAwayTeam:'EN Avant Guingamp',        idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'134244',  strLeague:'French Ligue 2', intRound:'3',  strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:true,  _confirmedSource:'LFP', _broadcaster:'beIN SPORTS', _channel:'beIN SPORTS MAX 4 à 8', _channelExact:null },
  /* J4  */ { dateEvent:'2026-08-28', strTime:'20:45:00', strHomeTeam:'Clermont Foot 63',         strAwayTeam:FCSM,                        idHomeTeam:'134713',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'4',  strVenue:'Stade Gabriel Montpied',     _hardcoded:true, _confirmed:false },
  /* J5  */ { dateEvent:'2026-09-04', strTime:'20:00:00', strHomeTeam:'Pau FC',                   strAwayTeam:FCSM,                        idHomeTeam:'138309',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'5',  strVenue:'Nouste Camp',                _hardcoded:true, _confirmed:true,  _confirmedSource:'LFP', _broadcaster:'beIN SPORTS', _channel:'beIN SPORTS MAX 4 à 8', _channelExact:null },
  /* J6  */ { dateEvent:'2026-09-12', strTime:'14:00:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Nantes',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133861',  strLeague:'French Ligue 2', intRound:'6',  strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:true,  _confirmedSource:'LFP', _broadcaster:'beIN SPORTS', _channel:'beIN SPORTS 1', _channelExact:'beIN SPORTS 1' },
  /* J7  */ { dateEvent:'2026-09-18', strTime:'20:00:00', strHomeTeam:'Stade Lavallois MFC',      strAwayTeam:FCSM,                        idHomeTeam:'134708',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'7',  strVenue:'Stade Francis Le Basser',    _hardcoded:true, _confirmed:true,  _confirmedSource:'LFP', _broadcaster:'beIN SPORTS', _channel:'beIN SPORTS MAX 4 à 9', _channelExact:null },
  /* J8  */ { dateEvent:'2026-10-09', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'US Boulogne CO',           idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133849',  strLeague:'French Ligue 2', intRound:'8',  strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J9  */ { dateEvent:'2026-10-16', strTime:'20:45:00', strHomeTeam:'FC Metz',                  strAwayTeam:FCSM,                        idHomeTeam:'133883',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'9',  strVenue:'Stade Saint-Symphorien',     _hardcoded:true, _confirmed:false },
  /* J10 */ { dateEvent:'2026-10-23', strTime:'20:45:00', strHomeTeam:'FC Annecy',                strAwayTeam:FCSM,                        idHomeTeam:'139928',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'10', strVenue:'Parc des Sports',            _hardcoded:true, _confirmed:false },
  /* J11 */ { dateEvent:'2026-10-30', strTime:'20:45:00', strHomeTeam:'Stade de Reims',           strAwayTeam:FCSM,                        idHomeTeam:'133934',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'11', strVenue:'Stade Auguste Delaune',      _hardcoded:true, _confirmed:false },
  /* J12 */ { dateEvent:'2026-11-06', strTime:'20:45:00', strHomeTeam:'AS Nancy Lorraine',        strAwayTeam:FCSM,                        idHomeTeam:'133710',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'12', strVenue:'Stade Marcel Picot',         _hardcoded:true, _confirmed:false },
  /* J13 */ { dateEvent:'2026-11-20', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'USL Dunkerque',            idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'138821',  strLeague:'French Ligue 2', intRound:'13', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J14 */ { dateEvent:'2026-12-04', strTime:'20:45:00', strHomeTeam:'Dijon FCO',                strAwayTeam:FCSM,                        idHomeTeam:'133696',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'14', strVenue:'Stade Gaston Gérard',        _hardcoded:true, _confirmed:false },
  /* J15 */ { dateEvent:'2026-12-11', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Montpellier Hérault SC',   idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133709',  strLeague:'French Ligue 2', intRound:'15', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J16 */ { dateEvent:'2027-01-02', strTime:'20:45:00', strHomeTeam:'Grenoble Foot 38',         strAwayTeam:FCSM,                        idHomeTeam:'133847',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'16', strVenue:'Stade des Alpes',            _hardcoded:true, _confirmed:false },
  /* J17 */ { dateEvent:'2027-01-15', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Rodez Aveyron Football',   idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'137652',  strLeague:'French Ligue 2', intRound:'17', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J18 */ { dateEvent:'2027-01-22', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'US Boulogne CO',           idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133849',  strLeague:'French Ligue 2', intRound:'18', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J19 */ { dateEvent:'2027-01-29', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Pau FC',                   idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'138309',  strLeague:'French Ligue 2', intRound:'19', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J20 */ { dateEvent:'2027-02-05', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Annecy',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'139928',  strLeague:'French Ligue 2', intRound:'20', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J21 */ { dateEvent:'2027-02-12', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Dijon FCO',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133696',  strLeague:'French Ligue 2', intRound:'21', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J22 */ { dateEvent:'2027-02-19', strTime:'20:45:00', strHomeTeam:'AS Saint-Étienne',         strAwayTeam:FCSM,                        idHomeTeam:'133717',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'22', strVenue:'Stade Geoffroy-Guichard',    _hardcoded:true, _confirmed:false },
  /* J23 */ { dateEvent:'2027-02-26', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Stade de Reims',           idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133934',  strLeague:'French Ligue 2', intRound:'23', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J24 */ { dateEvent:'2027-03-05', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Metz',                  idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133883',  strLeague:'French Ligue 2', intRound:'24', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J25 */ { dateEvent:'2027-03-12', strTime:'20:45:00', strHomeTeam:'Rodez Aveyron Football',   strAwayTeam:FCSM,                        idHomeTeam:'137652',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'25', strVenue:'Stade Paul Lignon',          _hardcoded:true, _confirmed:false },
  /* J26 */ { dateEvent:'2027-03-19', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'AS Nancy Lorraine',        idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133710',  strLeague:'French Ligue 2', intRound:'26', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J27 */ { dateEvent:'2027-04-02', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Nantes',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133861',  strLeague:'French Ligue 2', intRound:'27', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J28 */ { dateEvent:'2027-04-09', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Red Star FC',              idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'135467',  strLeague:'French Ligue 2', intRound:'28', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J29 */ { dateEvent:'2027-04-16', strTime:'20:45:00', strHomeTeam:'Montpellier Hérault SC',   strAwayTeam:FCSM,                        idHomeTeam:'133709',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'29', strVenue:'Stade de la Mosson',         _hardcoded:true, _confirmed:false },
  /* J30 */ { dateEvent:'2027-04-23', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Stade Lavallois MFC',      idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'134708',  strLeague:'French Ligue 2', intRound:'30', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J31 */ { dateEvent:'2027-04-30', strTime:'20:45:00', strHomeTeam:'USL Dunkerque',            strAwayTeam:FCSM,                        idHomeTeam:'138821',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'31', strVenue:'Stade Marcel Tribut',        _hardcoded:true, _confirmed:false },
  /* J32 */ { dateEvent:'2027-05-07', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Clermont Foot 63',         idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'134713',  strLeague:'French Ligue 2', intRound:'32', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J33 */ { dateEvent:'2027-05-14', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Grenoble Foot 38',         idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133847',  strLeague:'French Ligue 2', intRound:'33', strVenue:'Stade Auguste Bonal',        _hardcoded:true, _confirmed:false },
  /* J34 */ { dateEvent:'2027-05-22', strTime:'20:45:00', strHomeTeam:'EN Avant Guingamp',        strAwayTeam:FCSM,                        idHomeTeam:'134244',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'34', strVenue:'Stade du Roudourou',         _hardcoded:true, _confirmed:false },
];

// Seule une programmation précise publiée par la LFP peut passer à true.
// Les autres dates du calendrier général restent explicitement indicatives.
for (const fixture of LIGUE2_SCHEDULE) {
  if (fixture._confirmed !== true) {
    fixture._confirmed = false;
    fixture._confirmedSource = null;
    fixture._broadcaster = null;
    fixture._channel = null;
    fixture._channelExact = null;
  }
}

const seasonEvents = seasonData?.events || [];
const nextApiEvents = nextTeamData?.events || [];

/* ══════════════════════════════════════════════════════════════
   FONCTIONS ANTI-DOUBLONS — NE PAS MODIFIER
   ──────────────────────────────────────────────────────────────
   icsMatchKey : clé de déduplication unique par match.
     - Ligue 2 : "ligue2-J{round}-{home}-{away}"  (stable même si date change)
     - Autres   : "{date}-{home}-{away}"
   Quatre niveaux de protection appliqués lors du build :
     FIX 0 — lastEvents   : déduplique les résultats API bruts contre
             LIGUE2_PAST_HARDCODED avant toute fusion (élimine le cas
             où l'API et le hardcode décrivent le même match)
     FIX 1 — teamAllNext  : déduplique les matchs à venir
     FIX 2 — seasonPast   : déduplique les résultats passés
     FIX 3 — allEventsForIcs : retire de teamAllNext les matchs
             déjà présents dans seasonPast (évite le doublon ICS
             quand un match passé reste dans la liste "next")
   ══════════════════════════════════════════════════════════════ */
function icsMatchKey(ev) {
  const home = canonicalTeamKey(ev.strHomeTeam);
  const away = canonicalTeamKey(ev.strAwayTeam);
  if (ev.intRound && (ev.strLeague || '').toLowerCase().includes('ligue 2')) {
    return `ligue2-J${ev.intRound}-${home}-${away}`;
  }
  return `${ev.dateEvent}-${home}-${away}`;
}

// TheSportsDB idEvent est prioritaire lorsqu'il est disponible.
// La clé calendrier reste le fallback pour les lignes LFP hardcodées.
function eventDedupKey(ev) {
  const idEvent = String(ev?.idEvent || '').trim();
  return idEvent ? `thesportsdb:${idEvent}` : icsMatchKey(ev);
}

function isSameFriendly(a, b) {
  if (a.dateEvent !== b.dateEvent) return false;
  const ah = canonicalTeamKey(a.strHomeTeam), aa = canonicalTeamKey(a.strAwayTeam);
  const bh = canonicalTeamKey(b.strHomeTeam), ba = canonicalTeamKey(b.strAwayTeam);
  const contains = (x, y) => x.includes(y) || y.includes(x);
  return (ah === bh || contains(ah, bh)) && (aa === ba || contains(aa, ba));
}

function isSameMatch(a, b) {
  const aId = String(a.idEvent || '').trim();
  const bId = String(b.idEvent || '').trim();
  if (aId && bId) return aId === bId;

  const ah = canonicalTeamKey(a.strHomeTeam), aa = canonicalTeamKey(a.strAwayTeam);
  const bh = canonicalTeamKey(b.strHomeTeam), ba = canonicalTeamKey(b.strAwayTeam);
  const teamsMatch = (ah === bh && aa === ba) || (ah === ba && aa === bh);
  if (!teamsMatch) return false;
  // Si les deux ont un intRound Ligue 2 → comparaison par journée (robuste au changement de date)
  if (a.intRound && b.intRound &&
      (a.strLeague || '').toLowerCase().includes('ligue 2') &&
      (b.strLeague || '').toLowerCase().includes('ligue 2')) {
    return String(a.intRound) === String(b.intRound);
  }
  // Sinon : comparaison par date exacte (±2j tolérance)
  if (!a.dateEvent || !b.dateEvent) return teamsMatch;
  const da = new Date(a.dateEvent + 'T12:00:00Z').getTime();
  const db = new Date(b.dateEvent + 'T12:00:00Z').getTime();
  return Math.abs(da - db) <= 2 * 86400000;
}

// La programmation LFP est la référence : on préserve l'identifiant et les
// libellés API, mais les informations de programmation viennent de la LFP.
function mergeOfficialFixture(apiMatch, officialMatch) {
  Object.assign(apiMatch, {
    dateEvent: officialMatch.dateEvent,
    strTime: officialMatch.strTime,
    _confirmed: officialMatch._confirmed === true,
    _confirmedSource: officialMatch._confirmedSource || null,
    _broadcaster: officialMatch._broadcaster ?? null,
    _channel: officialMatch._channel ?? null,
    _channelExact: officialMatch._channelExact ?? null,
  });
  if (officialMatch.idHomeTeam && !apiMatch.idHomeTeam) apiMatch.idHomeTeam = officialMatch.idHomeTeam;
  if (officialMatch.idAwayTeam && !apiMatch.idAwayTeam) apiMatch.idAwayTeam = officialMatch.idAwayTeam;
  console.log(`🔀 Fusion API/LFP J${officialMatch.intRound}: ${apiMatch.strHomeTeam} - ${apiMatch.strAwayTeam} → ${apiMatch.dateEvent} ${apiMatch.strTime}`);
  return apiMatch;
}

function isMatchFinishedForNext(ev, nowMs = Date.now()) {
  if (!ev?.dateEvent) return false;

  const status = `${ev.strStatus || ''} ${ev.strProgress || ''}`.trim();
  if (/match finished|finished|full[ -]?time|\bft\b|after extra time|penalties|abandoned|cancelled|canceled/i.test(status)) {
    return true;
  }

  const kickoffMs = Date.parse(buildIsoHtml(ev.dateEvent, ev.strTime));
  if (!Number.isFinite(kickoffMs)) return false;

  const FALLBACK_MATCH_DURATION_MS = 150 * 60 * 1000;
  return nowMs >= kickoffMs + FALLBACK_MATCH_DURATION_MS;
}

/* ── LIGUE2_PAST_HARDCODED — déclaré ICI, avant FIX 0 qui en dépend ──────
   IMPORTANT : cette constante DOIT rester avant le bloc FIX 0 ci-dessous.
   La déplacer après provoque une ReferenceError (temporal dead zone)
   qui désactive silencieusement le filtre anti-doublons.
   ──────────────────────────────────────────────────────────────────────── */
const LIGUE2_PAST_HARDCODED = [
  {
    dateEvent:'2026-08-08', strTime:'20:45:00',
    strHomeTeam:'FC Sochaux-Montbéliard', strAwayTeam:'AS Saint-Étienne',
    intHomeScore:0, intAwayScore:3,
    strLeague:'French Ligue 2', intRound:'1',
    strVenue:'Stade Auguste Bonal', idLeague: LEAGUE_ID,
    _broadcast:'beIN SPORTS', _broadcastSource:'LFP',
  },
];

// Résultats confirmés nécessaires à la forme de l'adversaire tant que l'API
// ne renvoie pas encore sa saison complète.
const LIGUE2_OPPONENT_PAST_HARDCODED = [
  {
    dateEvent:'2026-08-08', strTime:'20:45:00',
    strHomeTeam:'Red Star FC', strAwayTeam:'FC Nantes',
    intHomeScore:1, intAwayScore:0,
    strLeague:'French Ligue 2', intRound:'1',
    strVenue:'Stade Bauer', idLeague: LEAGUE_ID,
  },
];

// ── FIX 0 : déduplique lastEvents contre LIGUE2_PAST_HARDCODED ──────────────
// Évite qu'un match hardcodé et retourné simultanément par l'API
// ne se retrouve en double dans seasonPast.
const rawLastEvents = lastData?.results || lastData?.events || [];
const hardcodedPastKeys = new Set(
  LIGUE2_PAST_HARDCODED
    .filter(ev => ev.dateEvent < today)
    .map(ev => icsMatchKey(ev))
);
const lastEvents = rawLastEvents.filter(ev => {
  const k = icsMatchKey(ev);
  if (hardcodedPastKeys.has(k)) {
    console.log(`⚠️  FIX 0 — lastEvents doublon API/hardcoded écarté : ${k}`);
    return false;
  }
  return true;
});

let teamAllNext, seasonPast, seasonSource;

if (seasonEvents.length > 0) {
  seasonSource = 'eventsseason';
  teamAllNext = seasonEvents.filter(ev => ev.dateEvent >= today).sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
  seasonPast  = seasonEvents.filter(ev => ev.dateEvent < today).sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
} else if (nextApiEvents.length > 0) {
  seasonSource = 'eventsnext';
  teamAllNext = [...nextApiEvents].sort((a,b) => (a.dateEvent||'').localeCompare(b.dateEvent||''));
  seasonPast  = [...lastEvents].sort((a,b) => (a.dateEvent||'').localeCompare(b.dateEvent||''));
} else {
  seasonSource = 'hardcoded';
  teamAllNext = LIGUE2_SCHEDULE.filter(ev => ev.dateEvent >= today).sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
  seasonPast  = [...lastEvents].sort((a,b) => (a.dateEvent||'').localeCompare(b.dateEvent||''));
}

/* ── Injection des amicaux dans l'historique ── */
for (const fev of FRIENDLY_SCHEDULE) {
  if (fev.dateEvent >= today) continue;
  const already = seasonPast.find(ev => isSameFriendly(ev, fev));
  if (!already) seasonPast.push(fev);
}
seasonPast.sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));

/* ── Injection des résultats passés hardcodés si absents de l'API ── */
for (const hev of LIGUE2_PAST_HARDCODED) {
  if (hev.dateEvent >= today) continue;
  const already = seasonPast.find(ev => isSameMatch(ev, hev));
  if (!already) {
    seasonPast.push(hev);
    console.log(`📥 Résultat hardcodé injecté : J${hev.intRound} ${hev.dateEvent}`);
  } else {
    // Le calendrier/résultat LFP est la référence : il corrige une éventuelle
    // inversion provenant de l'API tout en conservant son identifiant d'événement.
    const idEvent = already.idEvent;
    Object.assign(already, hev);
    if (idEvent) already.idEvent = idEvent;
    console.log(`✅ Résultat LFP prioritaire : J${hev.intRound} ${hev.dateEvent}`);
  }
}

// ── FIX 2 : déduplication de seasonPast par icsMatchKey ──────────────────
{
  const seen = new Set();
  const deduped = [];
  for (const ev of seasonPast) {
    const k = eventDedupKey(ev);
    if (seen.has(k)) {
      console.log(`⚠️  HTML doublon (past) ignoré : ${k}`);
      continue;
    }
    seen.add(k);
    deduped.push(ev);
  }
  seasonPast = deduped;
}
seasonPast.sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));

for (const hev of LIGUE2_SCHEDULE.filter(ev => ev.dateEvent >= today)) {
  const apiMatch = teamAllNext.find(ev => isSameMatch(ev, hev));
  if (!apiMatch) {
    teamAllNext.push({ ...hev, _hardcoded: true });
  } else {
    // Une programmation officielle LFP confirmée remplace le créneau API.
    // Le calendrier général reste indicatif tant qu'il n'est pas explicitement confirmé.
    if (hev._confirmed === true) {
      mergeOfficialFixture(apiMatch, hev);
      console.log(`✅ Programmation LFP confirmée pour J${hev.intRound} : ${apiMatch.dateEvent} ${apiMatch.strTime}`);
    } else {
      if (!apiMatch.dateEvent) apiMatch.dateEvent = hev.dateEvent;
      if ((!apiMatch.strTime || apiMatch.strTime === '00:00:00') && hev.strTime) apiMatch.strTime = hev.strTime;
      apiMatch._confirmed = false;
      delete apiMatch._confirmedSource;
      console.log(`🗓 Créneau indicatif API conservé pour J${hev.intRound} : ${apiMatch.dateEvent} ${apiMatch.strTime || ''}`);
    }
    if (hev._confirmed !== true) {
      if (hev.idHomeTeam && !apiMatch.idHomeTeam) apiMatch.idHomeTeam = hev.idHomeTeam;
      if (hev.idAwayTeam && !apiMatch.idAwayTeam) apiMatch.idAwayTeam = hev.idAwayTeam;
      apiMatch._broadcaster = hev._broadcaster ?? null;
      apiMatch._channel = hev._channel ?? null;
      apiMatch._channelExact = hev._channelExact ?? null;
    }
  }
}
teamAllNext.sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
if (seasonSource !== 'hardcoded') seasonSource += '+hardcoded';

// ── FIX 1 : déduplication de teamAllNext par icsMatchKey ──────────────────
{
  const seen = new Set();
  const deduped = [];
  for (const ev of teamAllNext) {
    const k = eventDedupKey(ev);
    if (seen.has(k)) {
      console.log(`⚠️  HTML doublon (upcoming) ignoré : ${k}`);
      continue;
    }
    seen.add(k);
    deduped.push(ev);
  }
  teamAllNext = deduped;
}

// TheSportsDB peut conserver un résultat terminé dans eventsnext.php. Il ne
// doit jamais devenir le prochain match, même si sa date est encore renvoyée.
{
  const before = teamAllNext.length;
  teamAllNext = teamAllNext.filter(ev => !isMatchFinishedForNext(ev));
  const removed = before - teamAllNext.length;
  if (removed) console.log(`⏭ ${removed} match(s) terminé(s) retiré(s) de la liste des prochains matchs`);
}

const isLigue2 = ev =>
  String(ev.idLeague) === String(LEAGUE_ID) ||
  (ev.strLeague || '').toLowerCase().includes('ligue 2');

const teamLigue2Events = teamAllNext.filter(isLigue2);
const ligue2Ready = teamLigue2Events.length > 0;
const nextMatch = (ligue2Ready ? teamLigue2Events : teamAllNext)[0] || null;

function assertBuildIntegrity() {
  const upcomingLigue2Keys = new Set();
  for (const ev of teamAllNext.filter(isLigue2)) {
    const key = icsMatchKey(ev);
    if (upcomingLigue2Keys.has(key)) throw new Error(`Doublon Ligue 2 dans les prochains matchs : ${key}`);
    upcomingLigue2Keys.add(key);
  }

  if (nextMatch && isMatchFinishedForNext(nextMatch)) {
    throw new Error(`Le prochain match est déjà terminé : ${eventDedupKey(nextMatch)}`);
  }

  const j3 = teamAllNext.find(ev => String(ev.intRound) === '3' && isSameMatch(ev, LIGUE2_SCHEDULE[2]));
  if (!j3 || j3.strTime !== '20:00:00' || j3._confirmed !== true || j3._confirmedSource !== 'LFP') {
    throw new Error('J3 FCSM - Guingamp doit être confirmée LFP à 20h00');
  }

  if (teamAllNext.some(ev => isSameMatch(ev, LIGUE2_SCHEDULE[1]))) {
    throw new Error('Red Star - Sochaux J2 ne doit pas figurer parmi les prochains matchs');
  }

  for (const ev of teamAllNext) {
    if (seasonPast.some(past => isSameMatch(past, ev))) {
      throw new Error(`Match présent à la fois dans le passé et à venir : ${eventDedupKey(ev)}`);
    }
  }
}

assertBuildIntegrity();

const oppName = nextMatch
  ? (normTeam(nextMatch.strHomeTeam) === normTeam(teamName) ? nextMatch.strAwayTeam : nextMatch.strHomeTeam)
  : 'Adversaire';

/* ── Recherche dans le classement avec double fallback ──
   1. Recherche par teamName (nom venant de l'API)
   2. Fallback sur TEAM_NAME_FALLBACK si l'API renvoie un nom différent
── */
const teamRow = tableRows.find(r => normTeam(r.strTeam || r.nameTeam) === normTeam(teamName))
  || tableRows.find(r => normTeam(r.strTeam || r.nameTeam) === normTeam(TEAM_NAME_FALLBACK))
  || {};
const oppRow  = tableRows.find(r => canonicalTeamKey(r.strTeam || r.nameTeam) === canonicalTeamKey(oppName))
  || tableRows.find(r => normTeam(r.strTeam || r.nameTeam) === normTeam(oppName))
  || {};

console.log(`🏆 teamRow trouvé: "${teamRow?.strTeam || 'AUCUN'}" (rank: ${teamRow?.intRank || '—'}, pts: ${teamRow?.intPoints || '—'})`);
console.log(`🏆 oppRow trouvé:  "${oppRow?.strTeam || 'AUCUN'}" (rank: ${oppRow?.intRank || '—'}, pts: ${oppRow?.intPoints || '—'})`);

let oppSeasonEvents = [];
let oppBadgeRemote = '';
if (nextMatch && API_KEY) {
  const isOppAway = normTeam(nextMatch.strAwayTeam) === normTeam(oppName);
  const oppIdFromEvent = isOppAway ? nextMatch.idAwayTeam : nextMatch.idHomeTeam;
  const oppIdFromMap = Object.entries(TEAM_IDS).find(([k]) => normTeam(k) === normTeam(oppName))?.[1];
  const oppId = oppIdFromEvent || oppIdFromMap;
  const knownOpp = calendarTeamsBadges.find(t => normTeam(t.name) === normTeam(oppName));
  if (knownOpp) oppBadgeRemote = knownOpp.badgeUrl;
  const overrideBadgeUrls = BADGE_OVERRIDES[canonicalTeamKey(oppName)];
  if (overrideBadgeUrls) oppBadgeRemote = overrideBadgeUrls[0];
  if (oppId) {
    // La saison de l'adversaire est la source prioritaire : elle inclut son dernier match de Ligue 2.
    const od = await getJson(ep(`eventsseason.php?id=${oppId}&s=${SEASON}`));
    oppSeasonEvents = od?.events || [];
    if (!oppSeasonEvents.length) {
      const odLast = await getJson(ep(`eventslast.php?id=${oppId}`));
      oppSeasonEvents = odLast?.results || odLast?.events || [];
    }
    if (!oppBadgeRemote) {
      const od2 = await getJson(ep(`lookupteam.php?id=${oppId}`));
      oppBadgeRemote = od2?.teams?.[0]?.strTeamBadge || '';
    }
  } else {
    console.warn(`⚠️  Pas d'ID pour: "${oppName}"`);
  }
} else if (nextMatch && !API_KEY) {
  const knownOpp = calendarTeamsBadges.find(t => normTeam(t.name) === normTeam(oppName));
  if (knownOpp) oppBadgeRemote = knownOpp.badgeUrl;
  const overrideBadgeUrls = BADGE_OVERRIDES[canonicalTeamKey(oppName)];
  if (overrideBadgeUrls) oppBadgeRemote = overrideBadgeUrls[0];
}

const allBadgesToEnsure = [
  { name: teamName, urls: BADGE_OVERRIDES[canonicalTeamKey(teamName)] || [teamBadgeRemote] },
  ...calendarTeamsBadges.map(t => ({ name: t.name, urls: t.badgeUrls })),
];
if (oppBadgeRemote && !allBadgesToEnsure.find(t => normTeam(t.name) === normTeam(oppName))) {
  const overrideUrls = BADGE_OVERRIDES[canonicalTeamKey(oppName)];
  allBadgesToEnsure.push({ name: oppName, urls: overrideUrls || [oppBadgeRemote] });
}

const logoResults = await Promise.all(
  allBadgesToEnsure.map(async ({ name, urls }) => {
    const key = canonicalTeamKey(name);
    const slug = slugify(key);
    const localUrl = await ensureBadgeWithFallbacks(urls, slug);
    return [key, localUrl];
  })
);
const logos = Object.fromEntries(logoResults.filter(([, url]) => url));
console.log(`🎨 Logos dispos: ${Object.keys(logos).length}/${allBadgesToEnsure.length}`);

/* ── "5 derniers matchs" : uniquement Ligue 2 saison en cours ── */
const ligue2PastFromSchedule = LIGUE2_PAST_HARDCODED
  .filter(ev => ev.dateEvent < today)
  .sort((a, b) => b.dateEvent.localeCompare(a.dateEvent));

const ligue2PastFromSeason = [
  ...LIGUE2_PAST_HARDCODED.filter(ev => ev.dateEvent < today),
  ...seasonPast.filter(ev => isLigue2(ev) && !LIGUE2_PAST_HARDCODED.some(ref => isSameMatch(ev, ref)))
].sort((a, b) => b.dateEvent.localeCompare(a.dateEvent));

const last5Ligue2FCSM = (ligue2PastFromSeason.length > 0 ? ligue2PastFromSeason : ligue2PastFromSchedule).slice(0, 5);

const opponentKnownResults = LIGUE2_OPPONENT_PAST_HARDCODED.filter(ev =>
  ev.dateEvent < today &&
  (canonicalTeamKey(ev.strHomeTeam) === canonicalTeamKey(oppName) || canonicalTeamKey(ev.strAwayTeam) === canonicalTeamKey(oppName))
);
const last5Ligue2Opp = [
  ...opponentKnownResults,
  ...oppSeasonEvents.filter(ev =>
    isLigue2(ev) && (ev.dateEvent || '') < today && !opponentKnownResults.some(ref => isSameMatch(ev, ref))
  ),
]
  .sort((a, b) => (b.dateEvent || '').localeCompare(a.dateEvent || ''))
  .slice(0, 5);

const formFCSM = calcFormStr(last5Ligue2FCSM, teamName);
const nextMatchFcsmHome = nextMatch ? canonicalTeamKey(nextMatch.strHomeTeam) === canonicalTeamKey(teamName) : true;
const compactStanding = (rank, points) => {
  if (!rank || rank === '—') return '(—, —)';
  const value = Number(points) || 0;
  return `(${rank}e, ${value}${value > 1 ? 'pts' : 'pt'})`;
};
const fcsmStanding = compactStanding(teamRow?.intRank, teamRow?.intPoints);
const oppStanding = compactStanding(oppRow?.intRank, oppRow?.intPoints);
const formOpp  = calcFormStr(last5Ligue2Opp, oppName);
const homeFormEvents = nextMatchFcsmHome ? last5Ligue2FCSM : last5Ligue2Opp;
const awayFormEvents = nextMatchFcsmHome ? last5Ligue2Opp : last5Ligue2FCSM;
const homeFormTeam = nextMatchFcsmHome ? teamName : oppName;
const awayFormTeam = nextMatchFcsmHome ? oppName : teamName;
const ligue2Banner = ligue2Ready ? '' : '<div class="banner-warning">La Ligue 2 2026-2027 démarre le 8 août — les prochains matchs sont des amicaux</div>';
const round = nextMatch?.intRound ? `J${nextMatch.intRound}` : '—';
const nextMatchIso = buildIsoHtml(nextMatch?.dateEvent, nextMatch?.strTime);
const nextMatchUnconfirmed = !isDateTimeConfirmed(nextMatch);

function badgeTag(name, size = 28) {
  const key = canonicalTeamKey(name);
  const url = logos[key] || (key === canonicalTeamKey(TEAM_NAME_FALLBACK) ? FCSM_BADGE_LOCAL : '');
  if (!url) return '';
  return `<img src="${url}" alt="${name}" width="${size}" height="${size}" style="border-radius:4px;object-fit:contain;vertical-align:middle;flex-shrink:0">`;
}

const nextMatchHomeName = nextMatch?.strHomeTeam || teamName;
const nextMatchAwayName = nextMatch?.strAwayTeam || oppName;
const homeBigBadge = badgeTag(nextMatchHomeName, 28);
const awayBigBadge = badgeTag(nextMatchAwayName, 28);

const fcsmBigBadge = badgeTag(teamName, 28);
const oppBigBadge  = badgeTag(oppName,  28);

function formBadgesSummary(events, tName) {
  const items = parseForm(events, tName).slice(0, 5);
  const badges = items.map(r => {
    const cls = r.letter === 'V' ? 'win' : r.letter === 'N' ? 'draw' : 'loss';
    return `<span class="form-badge form-badge--${cls}">${r.letter}</span>`;
  });
  while (badges.length < 5) badges.push('<span class="form-badge form-badge--unknown">—</span>');
  return badges.join(' ');
}

// Le statut dépend exclusivement des métadonnées explicites de programmation LFP.
function isDateTimeConfirmed(ev) {
  return ev?._confirmed === true;
}

function unconfirmedHourglass(ev) {
  return isDateTimeConfirmed(ev) ? '' : ' ⏳';
}

function unconfirmedHourglassHtml(ev) {
  return isDateTimeConfirmed(ev)
    ? ''
    : '<span class="match-status-icon" title="Date et heure en attente de confirmation officielle" aria-label="Date et heure en attente de confirmation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3c0 5 3 5 4 9s-4 4-4 9m8-18c0 5-3 5-4 9s4 4 4 9"/><path d="M9.5 16.5h5"/></svg></span>';
}

function broadcastHtml(ev) {
  if (!ev?._channel && !ev?._broadcaster) return '';
  const label = ev._channel || ev._broadcaster;
  return `<span class="match-card-meta-item match-broadcast">📺 <strong>${label}</strong></span>`;
}

const STADIUM_COORDINATES = {
  'Stade Auguste Bonal': [47.5072, 6.8024],
  'Stade Bauer': [48.9058, 2.3430],
  'Stade Gabriel Montpied': [45.7640, 3.1060],
  'Nouste Camp': [43.3230, -0.3450],
  'Stade Francis Le Basser': [48.0770, -0.7660],
  'Parc des Sports': [45.8990, 6.1150],
  'Stade Saint-Symphorien': [49.1090, 6.1770],
  'Stade Auguste Delaune': [49.2470, 4.0240],
  'Stade Marcel Picot': [48.6950, 6.1840],
  'Stade Gaston Gérard': [47.3230, 5.0660],
  'Stade des Alpes': [45.1880, 5.7450],
  'Stade Geoffroy-Guichard': [45.4600, 4.3900],
  'Stade Paul Lignon': [44.3510, 2.5760],
  'Stade Marcel Tribut': [51.0350, 2.3770],
  'Stade de la Mosson': [43.6220, 3.8120],
  'Stade du Roudourou': [48.5630, -3.1430],
};

function weatherLabel(code) {
  if ([0].includes(code)) return ['☀️', 'Ensoleillé'];
  if ([1, 2].includes(code)) return ['🌤', 'Éclaircies'];
  if ([3].includes(code)) return ['☁️', 'Couvert'];
  if ([45, 48].includes(code)) return ['🌫', 'Brouillard'];
  if ([51, 53, 55, 56, 57].includes(code)) return ['🌦', 'Bruine'];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['🌧', 'Pluie'];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['❄️', 'Neige'];
  if ([95, 96, 99].includes(code)) return ['⛈', 'Orage'];
  return ['🌡', 'Météo'];
}

async function nextMatchWeatherHtml(ev) {
  if (!ev || !isDateTimeConfirmed(ev) || !ev.dateEvent || !ev.strTime) return '';
  const coordinates = STADIUM_COORDINATES[ev.strVenue];
  if (!coordinates) return '';
  const matchHour = `${ev.dateEvent}T${ev.strTime.slice(0, 2)}:00`;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates[0]}&longitude=${coordinates[1]}&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&timezone=Europe%2FParis`;
  const weather = await getPublicJson(url);
  const index = weather?.hourly?.time?.indexOf(matchHour);
  if (index == null || index < 0) return '';
  const { temperature_2m: temperatures, apparent_temperature: feelsLike, precipitation_probability: rainProbability, weather_code: codes, wind_speed_10m: wind } = weather.hourly;
  const [icon, condition] = weatherLabel(Number(codes?.[index]));
  const temperature = Math.round(Number(temperatures?.[index]));
  const apparent = Math.round(Number(feelsLike?.[index]));
  const rain = Number(rainProbability?.[index]);
  const windSpeed = Math.round(Number(wind?.[index]));
  if (!Number.isFinite(temperature)) return '';
  const feels = Number.isFinite(apparent) && apparent !== temperature ? ` · ressenti ${apparent}°C` : '';
  const precipitation = Number.isFinite(rain) ? ` · pluie ${rain}%` : '';
  const windPart = Number.isFinite(windSpeed) ? ` · vent ${windSpeed} km/h` : '';
  return `<span class="match-card-meta-item match-weather" title="Prévision au coup d’envoi">${icon} <strong>${temperature}°C</strong> · ${condition}${feels}${precipitation}${windPart}</span>`;
}

const nextMatchWeather = await nextMatchWeatherHtml(nextMatch);

/* ── Bloc "Calendrier complet" : 5 prochains + bouton Voir plus ── */
function buildUpcomingRows(events) {
  if (!events || events.length === 0) return '<p class="no-matches">Aucun match à venir disponible pour le moment.</p>';
  const VISIBLE = 5;
  const rows = events.map((ev, i) => {
    const isHome = canonicalTeamKey(ev.strHomeTeam) === canonicalTeamKey(teamName);
    const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
    const oppDisplay = displayTeamName(opp);
    const dateLabel = fmtDate(ev.dateEvent, ev.strTime);
    const time = fmtTime(ev.strTime);
    const league = displayLeague(ev.strLeague);
    const roundLabel = ev.intRound ? `J${ev.intRound}` : '';
    const homeBadge = teamBadgeImg(ev.strHomeTeam, logos, 22);
    const awayBadge = teamBadgeImg(ev.strAwayTeam, logos, 22);
    const teamsHtml = isHome
      ? `${homeBadge} <strong>${TEAM_DISPLAY_NAME}</strong> vs ${awayBadge} ${oppDisplay}`
      : `${homeBadge} ${oppDisplay} vs ${awayBadge} <strong>${TEAM_DISPLAY_NAME}</strong>`;
    const hourglass = unconfirmedHourglassHtml(ev);
    const broadcast = broadcastHtml(ev);
    const timeDisplay = `<span style="color:var(--muted)">${time}</span>`;
    const hiddenClass = i >= VISIBLE ? ' upcoming-row--hidden' : '';
    return `<div class="upcoming-row${i === 0 ? ' upcoming-row--next' : ''}${hiddenClass}" data-index="${i}">
  <div class="upcoming-date"><span class="upcoming-date-main">${dateLabel}</span>${timeDisplay}</div>
  <div class="upcoming-match"><span class="upcoming-teams">${teamsHtml}</span><span class="upcoming-venue">${ev.strVenue || ''}</span></div>
  <div class="upcoming-meta"><span class="match-league">🏆 ${league}</span>${roundLabel ? `<span class="match-round">${roundLabel}</span>` : ''}${broadcast}${hourglass}</div>
</div>`;
  });
  const hiddenCount = events.length - VISIBLE;
  const seeMoreBtn = events.length > VISIBLE
    ? `<button class="btn-see-more" onclick="toggleMatchList(this, ${events.length})" data-sect="upcoming">
  <span class="btn-see-more-label">Voir les ${hiddenCount} matchs suivants ▾</span>
</button>`
    : '';
  return `<div class="upcoming-list">${rows.join('\n')}${seeMoreBtn}</div>`;
}

// Le prochain match est déjà mis en avant dans la carte principale.
const upcomingHtml = buildUpcomingRows(teamAllNext.filter(ev => ev !== nextMatch));

/* ── Bloc "Résultats Ligue 2 — Saison 2026-27" ── */
function buildPastL2Html(pastEvents, teamName, logos) {
  // Déduplication défensive dans buildPastL2Html (quatrième niveau de protection)
  const seen = new Set();
  const l2Past = pastEvents
    .filter(ev => {
      if (!isLigue2(ev) || ev.dateEvent >= today) return false;
      const k = eventDedupKey(ev);
      if (seen.has(k)) {
        console.log(`⚠️  HTML doublon (buildPastL2Html) ignoré : ${k}`);
        return false;
      }
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.dateEvent.localeCompare(a.dateEvent));
  if (!l2Past.length) {
    return '<p class="no-matches">Aucun résultat de Ligue 2 pour le moment — la saison vient de commencer.</p>';
  }
  const rows = l2Past.map(ev => {
    return eventLineHtml(ev, teamName, logos);
  });
  return `<ul class="past-l2-list">${rows.join('\n')}</ul>`;
}

const pastL2Html = buildPastL2Html(seasonPast, teamName, logos);

/* ── Bloc H2H HTML ── */
const h2hHtml = buildH2hHtml(oppName, logos);

const escapeXml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

function socialPreviewBadgePath(name) {
  const localUrl = logos[canonicalTeamKey(name)];
  if (!localUrl?.startsWith('./')) return null;
  const localPath = path.join(out, localUrl.slice(2));
  return fs.existsSync(localPath) ? localPath : null;
}

async function buildSocialPreview(ev) {
  const width = 1200;
  const height = 630;
  const home = displayTeamName(ev?.strHomeTeam || 'FC Sochaux');
  const away = displayTeamName(ev?.strAwayTeam || 'Adversaire');
  const date = ev?.dateEvent ? fmtDateOnly(ev.dateEvent) : 'Date à confirmer';
  const time = ev?.strTime ? fmtTime(ev.strTime) : 'Heure à confirmer';
  const homeStanding = nextMatchFcsmHome ? fcsmStanding : oppStanding;
  const awayStanding = nextMatchFcsmHome ? oppStanding : fcsmStanding;
  const venue = ev?.strVenue || 'Stade à confirmer';
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#F4F7FB"/>
  <rect x="38" y="34" width="1124" height="562" rx="34" fill="#FFFFFF"/>
  <rect x="38" y="34" width="1124" height="106" rx="34" fill="#0D2B5E"/>
  <rect x="38" y="106" width="1124" height="34" fill="#0D2B5E"/>
  <text x="600" y="99" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF">PROCHAIN MATCH · LIGUE 2 BKT</text>
  <text x="600" y="178" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0D2B5E">${escapeXml(date)} · ${escapeXml(time)}</text>
  <text x="310" y="414" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#0D2B5E">${escapeXml(home)}</text>
  <text x="310" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="#6B7A99">${escapeXml(homeStanding)}</text>
  <text x="890" y="414" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#0D2B5E">${escapeXml(away)}</text>
  <text x="890" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="#6B7A99">${escapeXml(awayStanding)}</text>
  <text x="600" y="334" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="#6B7A99">VS</text>
  <line x1="92" y1="492" x2="1108" y2="492" stroke="#E5EAF3" stroke-width="2"/>
  <text x="600" y="535" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="#0D2B5E">STADE · ${escapeXml(venue)}</text>
  <text x="600" y="573" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#6B7A99">ohan-fcsm.github.io/ical-fcsm · @CalendrierFCSM sur Facebook et X</text>
</svg>`;

  const overlays = [{ input: Buffer.from(svg), left: 0, top: 0 }];
  const badgePositions = [
    [socialPreviewBadgePath(ev?.strHomeTeam), 245],
    [socialPreviewBadgePath(ev?.strAwayTeam), 825],
  ];
  for (const [badgePath, left] of badgePositions) {
    if (!badgePath) continue;
    overlays.push({ input: await sharp(badgePath).resize(130, 130, { fit: 'contain' }).png().toBuffer(), left, top: 215 });
  }
  await sharp({ create: { width, height, channels: 4, background: '#F4F7FB' } })
    .composite(overlays)
    .png()
    .toFile(path.join(out, 'next-match.png'));
}

await buildSocialPreview(nextMatch);

const vars = {
  NEXT_MATCH_DATE:       fmtDateOnly(nextMatch?.dateEvent),
  NEXT_MATCH_TIME:       (nextMatch?.strTime ? fmtTime(nextMatch.strTime) : '—') + (nextMatchUnconfirmed ? ' ⏳' : ''),
  NEXT_MATCH_HOME_TEAM:  displayTeamName(nextMatch?.strHomeTeam) || '—',
  NEXT_MATCH_AWAY_TEAM:  displayTeamName(nextMatch?.strAwayTeam) || '—',
  NEXT_MATCH_HOME_BADGE: homeBigBadge,
  NEXT_MATCH_AWAY_BADGE: awayBigBadge,
  NEXT_MATCH_HOME_STANDING: nextMatchFcsmHome ? fcsmStanding : oppStanding,
  NEXT_MATCH_AWAY_STANDING: nextMatchFcsmHome ? oppStanding : fcsmStanding,
  NEXT_MATCH_STATUS:     nextMatch?.strStatus || nextMatch?.strProgress || '—',
  NEXT_MATCH_VENUE:      nextMatch?.strVenue     || '—',
  NEXT_MATCH_BROADCAST:  broadcastHtml(nextMatch),
  NEXT_MATCH_WEATHER:    nextMatchWeather,
  NEXT_MATCH_LEAGUE:     displayLeague(nextMatch?.strLeague),
  NEXT_MATCH_ROUND:      round,
  NEXT_MATCH_ISO:        nextMatchIso,
  LIGUE2_STATUS_BANNER:  ligue2Banner,
  TEAM_RANK_FCSM:        String(teamRow?.intRank  || teamRow?.rank  || '—'),
  TEAM_POINTS_FCSM:      formatPoints(teamRow?.intPoints),
  TEAM_RANK_OPPONENT:    String(oppRow?.intRank   || oppRow?.rank   || '—'),
  TEAM_POINTS_OPPONENT:  formatPoints(oppRow?.intPoints),
  FCSM_BADGE:            fcsmBigBadge,
  OPP_BADGE:             oppBigBadge,
  OPP_NAME:              oppName,
  LAST_5_FCSM_FORM:      formBadgesSummary(last5Ligue2FCSM, teamName),
  NEXT_MATCH_HOME_FORM:  formBadgesSummary(homeFormEvents, homeFormTeam),
  NEXT_MATCH_AWAY_FORM:  formBadgesSummary(awayFormEvents, awayFormTeam),
  LAST_5_FCSM_1:         eventLineHtml(last5Ligue2FCSM[0], teamName, logos),
  LAST_5_FCSM_2:         eventLineHtml(last5Ligue2FCSM[1], teamName, logos),
  LAST_5_FCSM_3:         eventLineHtml(last5Ligue2FCSM[2], teamName, logos),
  LAST_5_FCSM_4:         eventLineHtml(last5Ligue2FCSM[3], teamName, logos),
  LAST_5_FCSM_5:         eventLineHtml(last5Ligue2FCSM[4], teamName, logos),
  LAST_5_OPPONENT_FORM:  formBadgesSummary(last5Ligue2Opp, oppName),
  LAST_5_OPPONENT_1:     eventLineHtml(last5Ligue2Opp[0], oppName, logos),
  LAST_5_OPPONENT_2:     eventLineHtml(last5Ligue2Opp[1], oppName, logos),
  LAST_5_OPPONENT_3:     eventLineHtml(last5Ligue2Opp[2], oppName, logos),
  LAST_5_OPPONENT_4:     eventLineHtml(last5Ligue2Opp[3], oppName, logos),
  LAST_5_OPPONENT_5:     eventLineHtml(last5Ligue2Opp[4], oppName, logos),
  UPCOMING_MATCHES:      upcomingHtml,
  PAST_MATCHES_L2:       pastL2Html,
  HEAD2HEAD_MATCHES:     h2hHtml,
  LAST_UPDATED:          LAST_UPDATED,
  OG_TITLE:              `⚽ ${displayTeamName(nextMatch?.strHomeTeam || 'FC Sochaux')} – ${displayTeamName(nextMatch?.strAwayTeam || 'Adversaire')}`,
  OG_DESCRIPTION:        `Rendez-vous ${fmtDateOnly(nextMatch?.dateEvent)} à ${nextMatch?.strTime ? fmtTime(nextMatch.strTime) : 'heure à confirmer'} · ${nextMatch?.strVenue || 'Stade à confirmer'}. Retrouvez le calendrier et toutes les infos du FC Sochaux.`,
  OG_IMAGE_VERSION:      Date.now(),
};

const fill = (template, vs) => Object.entries(vs).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? '—'), template);
const srcHtml = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), fill(srcHtml, vars), 'utf8');
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify({
  teamName, seasonSource, oppName, nextMatch, nextMatchIso, ligue2Ready,
  formFCSM, formOpp, oppSeasonEventsCount: oppSeasonEvents.length,
  totalUpcoming: teamAllNext.length,
  hardcodedCount: teamAllNext.filter(e=>e._hardcoded).length,
  logosCount: Object.keys(logos).length,
  lastUpdated: LAST_UPDATED,
  tableSource,
  apiTableRows: apiTableRows.length,
  apiCompletedRound,
  tableValidThroughRound: tableSource === 'hardcoded-J1' ? LIGUE2_TABLE_HARDCODED_ROUND : null,
  fcsmRank: teamRow?.intRank || '—',
  fcsmPoints: teamRow?.intPoints || '—',
  sampleNext: teamAllNext.slice(0, 6).map(e => ({ date: e.dateEvent, time: e.strTime, home: e.strHomeTeam, away: e.strAwayTeam, league: e.strLeague, confirmed: isDateTimeConfirmed(e), confirmedSource: e._confirmedSource || null, broadcaster: e._broadcaster || null, channel: e._channel || null, channelExact: e._channelExact || null })),
}, null, 2), 'utf8');

/* ══════════════════════════════════════════════════════════════
   GÉNÉRATION DU FICHIER ICS
   ══════════════════════════════════════════════════════════════ */

function hasScore(ev) {
  return ev.intHomeScore != null && ev.intHomeScore !== '' &&
         ev.intAwayScore != null && ev.intAwayScore !== '';
}

function fcsmResult(ev, tName) {
  const hs = Number(ev.intHomeScore);
  const as = Number(ev.intAwayScore);
  const isHome = canonicalTeamKey(ev.strHomeTeam) === canonicalTeamKey(tName);
  const fcsmScore = isHome ? hs : as;
  const oppScore  = isHome ? as : hs;
  const result = fcsmScore > oppScore ? 'V' : fcsmScore === oppScore ? 'N' : 'D';
  return { result, fcsmScore, oppScore };
}

function icsTeamName(name) {
  return displayTeamName(name);
}

function buildIcsSummary(ev, tName, tRow, oRow, isNextMatch) {
  const isHome = canonicalTeamKey(ev.strHomeTeam) === canonicalTeamKey(tName);
  const roundLabel  = ev.intRound  ? ` J${ev.intRound}`   : '';
  const leagueLabel = ev.strLeague ? ` [${displayLeague(ev.strLeague)}]` : '';

  if (hasScore(ev)) {
    const { result, fcsmScore, oppScore } = fcsmResult(ev, tName);
    const emoji = result === 'V' ? '✅' : result === 'N' ? '➖' : '❌';
    const homeName = icsTeamName(ev.strHomeTeam);
    const awayName = icsTeamName(ev.strAwayTeam);
    return `${emoji} ${homeName} ${ev.intHomeScore}-${ev.intAwayScore} ${awayName}${roundLabel}${leagueLabel}`;
  }

  const rankFor = name => canonicalTeamKey(name) === canonicalTeamKey(tName)
    ? tRow?.intRank
    : oRow?.intRank;
  const label = name => {
    const rank = isNextMatch ? rankFor(name) : null;
    return `${icsTeamName(name)}${rank ? ` (${rank}e)` : ''}`;
  };
  return `${label(ev.strHomeTeam)} - ${label(ev.strAwayTeam)}${roundLabel}${leagueLabel}${unconfirmedHourglass(ev)}`;
}

function buildIcsDescription(ev, tName, tRow, oRow, fFCSM, fOpp, isNextMatch) {
  const isHome = canonicalTeamKey(ev.strHomeTeam) === canonicalTeamKey(tName);
  const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
  const venue     = ev.strVenue   ? `📍 ${ev.strVenue}`    : '';
  const league    = ev.strLeague  ? `🏆 ${ev.strLeague}`   : '';
  const roundStr  = ev.intRound   ? `J${ev.intRound}`      : '';
  const broadcast = ev._channel || ev._broadcaster
    ? `📺 Diffusion : ${ev._channel || ev._broadcaster}`
    : '';
  const headerParts = [venue, league, roundStr, broadcast].filter(Boolean).join(' | ');

  if (hasScore(ev)) {
    const { result, fcsmScore, oppScore } = fcsmResult(ev, tName);
    const emoji = result === 'V' ? '✅' : result === 'N' ? '➖' : '❌';
    const resultLabel = result === 'V' ? 'Victoire' : result === 'N' ? 'Nul' : 'Défaite';
    const scoreStr = isHome
      ? `${TEAM_DISPLAY_NAME} ${fcsmScore} - ${oppScore} ${opp}`
      : `${opp} ${oppScore} - ${fcsmScore} ${TEAM_DISPLAY_NAME}`;
    const parts = [
      headerParts,
      `⚽ Score final : ${scoreStr}`,
      `Résultat : ${resultLabel} ${emoji}`,
    ].filter(Boolean);
    return parts.join('\\n');
  }

  const confirmationNote = isDateTimeConfirmed(ev)
    ? ''
    : '⏳ Date et heure en attente de confirmation officielle LFP';

  // Classements et formes ne concernent que le prochain rendez-vous.
  if (!isNextMatch) return [headerParts, confirmationNote].filter(Boolean).join('\\n');

  const rankFCSM = tRow?.intRank ? ` (${tRow.intRank}e)` : '';
  const rankOpp  = oRow?.intRank ? ` (${oRow.intRank}e)` : '';
  const formeFCSM = `${TEAM_DISPLAY_NAME}${rankFCSM} — Forme : ${fFCSM || '—'}`;
  const formeOpp  = `${displayTeamName(opp)}${rankOpp} — Forme : ${fOpp || '—'}`;
  const h2hPart   = buildH2hDescription(opp);

  const parts = [
    headerParts,
    confirmationNote,
    '---',
    formeFCSM,
    formeOpp,
    h2hPart ? '---' : '',
    h2hPart,
  ].filter(Boolean);
  return parts.join('\\n');
}

// ── FIX 3 : allEventsForIcs — exclure de teamAllNext les matchs déjà dans seasonPast ──
// Un match dont la date est passée peut se retrouver dans seasonPast (avec score API)
// ET rester dans teamAllNext (hardcodé sans score) → doublon ICS.
{
  const before = teamAllNext.length;
  teamAllNext = teamAllNext.filter(ev => {
    const pastMatch = seasonPast.find(past => isSameMatch(past, ev));
    if (pastMatch) {
      console.log(`⚠️  ICS doublon (past/next overlap) ignoré dans teamAllNext : ${eventDedupKey(ev)}`);
      return false;
    }
    return true;
  });
  if (teamAllNext.length < before) {
    console.log(`🔧 Fix 3 : ${before - teamAllNext.length} match(s) retirés de teamAllNext (déjà dans seasonPast)`);
  }
}

const allEventsForIcs = [...seasonPast, ...teamAllNext];
const icsLines = [
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FCSM//Calendar//FR',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH',
  'X-WR-CALNAME:FC Sochaux — Tous les matchs',
  'X-WR-CALDESC:Matchs FC Sochaux toutes compétitions',
  `X-WR-LASTUPDATED:${new Date().toISOString()}`,
];
const seenUids = new Set();
for (const ev of allEventsForIcs) {
  if (!ev?.dateEvent) continue;
  const matchKey = eventDedupKey(ev);
  if (seenUids.has(matchKey)) {
    console.log(`⚠️  ICS doublon ignoré : ${matchKey}`);
    continue;
  }
  seenUids.add(matchKey);

  const isoStr = buildIso(ev.dateEvent, ev.strTime);
  const uid = `fcsm-${ev.idEvent || matchKey}@ical-fcsm`;

  const isNextIcsEvent = Boolean(nextMatch && isSameMatch(ev, nextMatch));
  const summary = buildIcsSummary(ev, teamName, teamRow, oppRow, isNextIcsEvent);
  const description = buildIcsDescription(ev, teamName, teamRow, oppRow, formFCSM, formOpp, isNextIcsEvent);

  icsLines.push(
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${isoStr}`,
    `SUMMARY:${summary}`, `DESCRIPTION:${description}`,
    `LOCATION:${ev.strVenue || ''}`,
  );
  if (hasScore(ev)) icsLines.push(`X-SCORE:${ev.intHomeScore}-${ev.intAwayScore}`);
  icsLines.push('END:VEVENT');
}
icsLines.push('END:VCALENDAR');
fs.writeFileSync(path.join(out, 'fcsm.ics'), icsLines.join('\r\n'), 'utf8');

console.log('✅ Build OK', {
  seasonSource,
  nextMatch: nextMatch ? `${nextMatch.dateEvent} ${nextMatch.strTime} ${nextMatch.strHomeTeam} - ${nextMatch.strAwayTeam}` : null,
  upcoming: teamAllNext.length,
  past: seasonPast.length,
  tableSource,
  apiCompletedRound,
  logos: Object.keys(logos).length,
  lastUpdated: LAST_UPDATED,
});
