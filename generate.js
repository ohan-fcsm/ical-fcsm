import fs from 'fs';
import path from 'path';

let fetch;
try { fetch = (await import('node-fetch')).default; } catch { fetch = global.fetch; }

const API_KEY = process.env.THESPORTSDB_API_KEY || '';
const TEAM_ID_FCSM = process.env.TEAM_ID_FCSM || '133708';
const LEAGUE_ID = process.env.LEAGUE_ID || '4401';
const SEASON = process.env.SEASON || '2026-2027';
const TEAM_NAME_FALLBACK = 'FC Sochaux-Montbéliard';

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

/* ── Alias : ramène toutes les variantes ASSE vers une clé canonique ── */
const TEAM_NAME_ALIASES = {
  'as saint-etienne':  'as saint-etienne',
  'saint-etienne':     'as saint-etienne',
  'st etienne':        'as saint-etienne',
  'st-etienne':        'as saint-etienne',
  'saint etienne':     'as saint-etienne',
  'as saint etienne':  'as saint-etienne',
};

function canonicalTeamKey(name) {
  const n = normTeam(name);
  return TEAM_NAME_ALIASES[n] || n;
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

/* ── IDs TheSportsDB ── */
const TEAM_IDS = {
  'AS Saint-Étienne':        '133717',
  // Red Star FC : badge géré via BADGE_OVERRIDES (red-star-fc.png déjà en cache)
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
    'https://r2.thesportsdb.com/images/media/team/badge/xzqxpr1678808060.png',
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

/**
 * Construit la partie DESCRIPTION ICS relative aux précédentes confrontations.
 */
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

/**
 * buildH2hHtml : génère le HTML du bloc "Matchs précédents vs [adversaire]"
 */
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

  return `${bilanHtml}<ul class="h2h-matches">${matchesHtml}</ul>`;
}

/* ── Date de build (heure Europe/Paris) ── */
function buildTimestamp() {
  const now = new Date();
  const opts = { timeZone: 'Europe/Paris', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('fr-FR', opts).format(now);
}
const LAST_UPDATED = buildTimestamp();

/**
 * Retourne la date "aujourd'hui" côté Paris, mais avancée au lendemain
 * si l'heure locale Paris est >= 22h — afin que les matchs du soir (20h45)
 * soient considérés comme "passés" lors du build nocturne.
 */
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
  // Après 22h heure Paris, les matchs du jour sont terminés → on avance à J+1
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
    const isHome = normTeam(ev.strHomeTeam) === normTeam(teamName);
    const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) return { letter: '?', score: '?-?', opponent: opp, date: ev.dateEvent || '' };
    const letter = isHome ? (hs > as ? 'V' : hs === as ? 'N' : 'D') : (as > hs ? 'V' : hs === as ? 'N' : 'D');
    return { letter, score: `${hs}-${as}`, opponent: opp, date: ev.dateEvent || '' };
  });
}

function calcFormStr(events, teamName) { return parseForm(events, teamName).map(r => r.letter).join(' ') || '—'; }

function teamBadgeImg(name, logos, size = 20) {
  const url = logos[canonicalTeamKey(name)];
  if (!url) return '';
  return `<img src="${url}" alt="${name}" width="${size}" height="${size}" style="border-radius:3px;object-fit:contain;vertical-align:middle;flex-shrink:0">`;
}

function eventLineHtml(ev, teamName, logos) {
  if (!ev || !ev.strHomeTeam) return '<li>—</li>';
  const hs = Number(ev.intHomeScore), as = Number(ev.intAwayScore);
  const isHome = normTeam(ev.strHomeTeam) === normTeam(teamName);
  const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
  const self = isHome ? ev.strHomeTeam : ev.strAwayTeam;
  const dateOnly = ev.dateEvent ? fmtDateOnly(ev.dateEvent) : '—';
  const oppBadge = teamBadgeImg(opp, logos, 16);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) {
    return `<li><span class="form-badge form-badge--unknown">?</span> ${dateOnly} — ${teamBadgeImg(ev.strHomeTeam, logos, 16)} ${ev.strHomeTeam} vs ${teamBadgeImg(ev.strAwayTeam, logos, 16)} ${ev.strAwayTeam}</li>`;
  }
  const letter = isHome ? (hs > as ? 'V' : hs === as ? 'N' : 'D') : (as > hs ? 'V' : hs === as ? 'N' : 'D');
  const cls = letter === 'V' ? 'win' : letter === 'N' ? 'draw' : 'loss';
  const scoreStr = isHome
    ? `${teamBadgeImg(self, logos, 16)} ${self} ${hs}-${as} ${oppBadge} ${opp}`
    : `${oppBadge} ${opp} ${as}-${hs} ${teamBadgeImg(self, logos, 16)} ${self}`;
  return `<li><span class="form-badge form-badge--${cls}">${letter}</span> ${dateOnly} — ${scoreStr}</li>`;
}

/**
 * buildIso : convertit une date+heure locale Paris en timestamp UTC compact pour le ICS.
 * Format retourné : YYYYMMDDTHHmmssZ  (requis par la norme iCalendar RFC 5545)
 */
function parisOffsetMinutes(dateEvent) {
  const d = new Date(dateEvent + 'T12:00:00Z');
  const month = d.getUTCMonth() + 1;
  if (month >= 4 && month <= 10) return 120; // CEST
  return 60; // CET
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

/**
 * buildIsoHtml : même conversion Paris→UTC mais retourne le format ISO 8601 standard
 * avec tirets et deux-points, lisible par new Date() en JavaScript.
 * Format retourné : YYYY-MM-DDTHH:mm:ssZ  (utilisé pour NEXT_MATCH_ISO / countdown)
 */
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
  const datePart = d.toISOString().slice(0, 10); // YYYY-MM-DD
  const timePart = String(hUtc).padStart(2,'0') + ':' + String(mUtc).padStart(2,'0') + ':00';
  return `${datePart}T${timePart}Z`;
}

/**
 * fmtTime : affiche l'heure locale Paris à partir de strTime (déjà en heure Paris).
 */
function fmtTime(strTime) {
  return strTime ? strTime.slice(0, 5) : '—';
}

function fmtDateOnly(dateEvent) {
  if (!dateEvent) return '—';
  try {
    const d = new Date(dateEvent + 'T12:00:00Z');
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return dateEvent; }
}

function fmtDate(dateEvent, strTime) {
  if (!dateEvent) return '—';
  try {
    const d = new Date(dateEvent + 'T12:00:00Z');
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return dateEvent; }
}

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
const lastEvents = lastData?.results || lastData?.events || [];
const tableRows = tableData?.table || tableData?.teams || [];

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

/* ── Red Star FC : ajouté manuellement depuis BADGE_OVERRIDES (non présent dans TEAM_IDS) ── */
const redStarOverride = BADGE_OVERRIDES['red star fc'];
if (redStarOverride && !calendarTeamsBadges.find(t => normTeam(t.name) === 'red star fc')) {
  calendarTeamsBadges.push({ name: 'Red Star FC', id: '135467', badgeUrls: redStarOverride, badgeUrl: redStarOverride[0] });
}

const FCSM = teamName;

/* ── Matchs de préparation (scores définitifs) ── */
const FRIENDLY_SCHEDULE = [
  { dateEvent:'2026-07-26', strTime:'15:00:00', strHomeTeam:'Grenoble Foot 38', strAwayTeam:FCSM, intHomeScore:0, intAwayScore:1, strLeague:'Amical', strVenue:'Stade des Alpes', _friendly:true },
  { dateEvent:'2026-08-01', strTime:'15:00:00', strHomeTeam:FCSM, strAwayTeam:'AJ Auxerre',       intHomeScore:1, intAwayScore:1, strLeague:'Amical', strVenue:'Stade Auguste Bonal', _friendly:true },
];

// IMPORTANT : strTime est en heure locale Paris (Europe/Paris).
// La conversion UTC est faite dans buildIso() via parisOffsetMinutes().
// Ne pas mettre les heures en UTC ici — toujours en heure France.
const LIGUE2_SCHEDULE = [
  /* J1  */ { dateEvent:'2026-08-08', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'AS Saint-Étienne',         idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133717',  strLeague:'French Ligue 2', intRound:'1',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J2  */ { dateEvent:'2026-08-15', strTime:'20:45:00', strHomeTeam:'Red Star FC',              strAwayTeam:FCSM,                        idHomeTeam:'135467',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'2',  strVenue:'Stade Bauer',                _hardcoded:true },
  /* J3  */ { dateEvent:'2026-08-21', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'EN Avant Guingamp',        idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'134244',  strLeague:'French Ligue 2', intRound:'3',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J4  */ { dateEvent:'2026-08-28', strTime:'20:45:00', strHomeTeam:'Clermont Foot 63',         strAwayTeam:FCSM,                        idHomeTeam:'134713',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'4',  strVenue:'Stade Gabriel Montpied',     _hardcoded:true },
  /* J5  */ { dateEvent:'2026-09-04', strTime:'20:45:00', strHomeTeam:'Pau FC',                   strAwayTeam:FCSM,                        idHomeTeam:'138309',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'5',  strVenue:'Nouste Camp',                _hardcoded:true },
  /* J6  */ { dateEvent:'2026-09-11', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Nantes',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133861',  strLeague:'French Ligue 2', intRound:'6',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J7  */ { dateEvent:'2026-09-18', strTime:'20:45:00', strHomeTeam:'Stade Lavallois MFC',      strAwayTeam:FCSM,                        idHomeTeam:'134708',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'7',  strVenue:'Stade Francis Le Basser',    _hardcoded:true },
  /* J8  */ { dateEvent:'2026-10-09', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'US Boulogne CO',           idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133849',  strLeague:'French Ligue 2', intRound:'8',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J9  */ { dateEvent:'2026-10-16', strTime:'20:45:00', strHomeTeam:'FC Metz',                  strAwayTeam:FCSM,                        idHomeTeam:'133883',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'9',  strVenue:'Stade Saint-Symphorien',     _hardcoded:true },
  /* J10 */ { dateEvent:'2026-10-23', strTime:'20:45:00', strHomeTeam:'FC Annecy',                strAwayTeam:FCSM,                        idHomeTeam:'139928',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'10', strVenue:'Parc des Sports',            _hardcoded:true },
  /* J11 */ { dateEvent:'2026-10-30', strTime:'20:45:00', strHomeTeam:'Stade de Reims',           strAwayTeam:FCSM,                        idHomeTeam:'133934',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'11', strVenue:'Stade Auguste Delaune',      _hardcoded:true },
  /* J12 */ { dateEvent:'2026-11-06', strTime:'20:45:00', strHomeTeam:'AS Nancy Lorraine',        strAwayTeam:FCSM,                        idHomeTeam:'133710',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'12', strVenue:'Stade Marcel Picot',         _hardcoded:true },
  /* J13 */ { dateEvent:'2026-11-20', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'USL Dunkerque',            idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'138821',  strLeague:'French Ligue 2', intRound:'13', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J14 */ { dateEvent:'2026-12-04', strTime:'20:45:00', strHomeTeam:'Dijon FCO',                strAwayTeam:FCSM,                        idHomeTeam:'133696',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'14', strVenue:'Stade Gaston Gérard',        _hardcoded:true },
  /* J15 */ { dateEvent:'2026-12-11', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Montpellier Hérault SC',   idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133709',  strLeague:'French Ligue 2', intRound:'15', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J16 */ { dateEvent:'2027-01-02', strTime:'20:45:00', strHomeTeam:'Grenoble Foot 38',         strAwayTeam:FCSM,                        idHomeTeam:'133847',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'16', strVenue:'Stade des Alpes',            _hardcoded:true },
  /* J17 */ { dateEvent:'2027-01-15', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Rodez Aveyron Football',   idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'137652',  strLeague:'French Ligue 2', intRound:'17', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J18 */ { dateEvent:'2027-01-22', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'US Boulogne CO',           idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133849',  strLeague:'French Ligue 2', intRound:'18', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J19 */ { dateEvent:'2027-01-29', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Pau FC',                   idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'138309',  strLeague:'French Ligue 2', intRound:'19', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J20 */ { dateEvent:'2027-02-05', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Annecy',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'139928',  strLeague:'French Ligue 2', intRound:'20', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J21 */ { dateEvent:'2027-02-12', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Dijon FCO',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133696',  strLeague:'French Ligue 2', intRound:'21', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J22 */ { dateEvent:'2027-02-19', strTime:'20:45:00', strHomeTeam:'AS Saint-Étienne',         strAwayTeam:FCSM,                        idHomeTeam:'133717',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'22', strVenue:'Stade Geoffroy-Guichard',    _hardcoded:true },
  /* J23 */ { dateEvent:'2027-02-26', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Stade de Reims',           idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133934',  strLeague:'French Ligue 2', intRound:'23', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J24 */ { dateEvent:'2027-03-05', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Metz',                  idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133883',  strLeague:'French Ligue 2', intRound:'24', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J25 */ { dateEvent:'2027-03-12', strTime:'20:45:00', strHomeTeam:'Rodez Aveyron Football',   strAwayTeam:FCSM,                        idHomeTeam:'137652',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'25', strVenue:'Stade Paul Lignon',          _hardcoded:true },
  /* J26 */ { dateEvent:'2027-03-19', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'AS Nancy Lorraine',        idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133710',  strLeague:'French Ligue 2', intRound:'26', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J27 */ { dateEvent:'2027-04-02', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Nantes',                idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133861',  strLeague:'French Ligue 2', intRound:'27', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J28 */ { dateEvent:'2027-04-09', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Red Star FC',              idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'135467',  strLeague:'French Ligue 2', intRound:'28', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J29 */ { dateEvent:'2027-04-16', strTime:'20:45:00', strHomeTeam:'Montpellier Hérault SC',   strAwayTeam:FCSM,                        idHomeTeam:'133709',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'29', strVenue:'Stade de la Mosson',         _hardcoded:true },
  /* J30 */ { dateEvent:'2027-04-23', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Stade Lavallois MFC',      idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'134708',  strLeague:'French Ligue 2', intRound:'30', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J31 */ { dateEvent:'2027-04-30', strTime:'20:45:00', strHomeTeam:'USL Dunkerque',            strAwayTeam:FCSM,                        idHomeTeam:'138821',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'31', strVenue:'Stade Marcel Tribut',        _hardcoded:true },
  /* J32 */ { dateEvent:'2027-05-07', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Clermont Foot 63',         idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'134713',  strLeague:'French Ligue 2', intRound:'32', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J33 */ { dateEvent:'2027-05-14', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Grenoble Foot 38',         idHomeTeam:TEAM_ID_FCSM,  idAwayTeam:'133847',  strLeague:'French Ligue 2', intRound:'33', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J34 */ { dateEvent:'2027-05-22', strTime:'20:45:00', strHomeTeam:'EN Avant Guingamp',        strAwayTeam:FCSM,                        idHomeTeam:'134244',      idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'34', strVenue:'Stade du Roudourou',         _hardcoded:true },
];

const seasonEvents = seasonData?.events || [];
const nextApiEvents = nextTeamData?.events || [];
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

/* ── Injection des amicaux dans l'historique (si pas déjà présents via l'API) ── */
function isSameFriendly(a, b) {
  if (a.dateEvent !== b.dateEvent) return false;
  const ah = normTeam(a.strHomeTeam), aa = normTeam(a.strAwayTeam);
  const bh = normTeam(b.strHomeTeam), ba = normTeam(b.strAwayTeam);
  const contains = (x, y) => x.includes(y) || y.includes(x);
  return (ah === bh || contains(ah, bh)) && (aa === ba || contains(aa, ba));
}
for (const fev of FRIENDLY_SCHEDULE) {
  if (fev.dateEvent >= today) continue;
  const already = seasonPast.find(ev => isSameFriendly(ev, fev));
  if (!already) seasonPast.push(fev);
}
seasonPast.sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));

function isSameMatch(a, b) {
  // Même équipes (quelle que soit la date) + même journée si disponible
  const ah = normTeam(a.strHomeTeam), aa = normTeam(a.strAwayTeam);
  const bh = normTeam(b.strHomeTeam), ba = normTeam(b.strAwayTeam);
  const teamsMatch = ah === bh && aa === ba;
  // Si même journée de championnat, on déduplique même si dates légèrement différentes
  if (teamsMatch && a.intRound && b.intRound) return String(a.intRound) === String(b.intRound);
  // Sinon on compare aussi la date (à 2 jours près pour robustesse)
  if (!teamsMatch) return false;
  if (!a.dateEvent || !b.dateEvent) return teamsMatch;
  const da = new Date(a.dateEvent + 'T12:00:00Z').getTime();
  const db = new Date(b.dateEvent + 'T12:00:00Z').getTime();
  return Math.abs(da - db) <= 2 * 86400000; // ±2 jours
}

for (const hev of LIGUE2_SCHEDULE.filter(ev => ev.dateEvent >= today)) {
  const apiMatch = teamAllNext.find(ev => isSameMatch(ev, hev));
  if (!apiMatch) {
    teamAllNext.push({ ...hev, _hardcoded: true });
  } else {
    // FIX: forcer la date du calendrier LFP officiel (au cas où l'API renvoie une mauvaise date)
    apiMatch.dateEvent = hev.dateEvent;
    if (hev.strTime && hev.strTime !== '00:00:00') {
      apiMatch.strTime = hev.strTime;
    }
    if (hev.idHomeTeam && !apiMatch.idHomeTeam) apiMatch.idHomeTeam = hev.idHomeTeam;
    if (hev.idAwayTeam && !apiMatch.idAwayTeam) apiMatch.idAwayTeam = hev.idAwayTeam;
    console.log(`🕐 Heure/date forcée (LFP) pour J${hev.intRound} ${hev.dateEvent} : ${hev.strTime}`);
  }
}
teamAllNext.sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
if (seasonSource !== 'hardcoded') seasonSource += '+hardcoded';

const isLigue2 = ev =>
  String(ev.idLeague) === String(LEAGUE_ID) ||
  (ev.strLeague || '').toLowerCase().includes('ligue 2');

const teamLigue2Events = teamAllNext.filter(isLigue2);
const ligue2Ready = teamLigue2Events.length > 0;
const nextMatch = (ligue2Ready ? teamLigue2Events : teamAllNext)[0] || null;
const oppName = nextMatch
  ? (normTeam(nextMatch.strHomeTeam) === normTeam(teamName) ? nextMatch.strAwayTeam : nextMatch.strHomeTeam)
  : 'Adversaire';

const teamRow = tableRows.find(r => normTeam(r.strTeam || r.nameTeam) === normTeam(teamName)) || {};
const oppRow  = tableRows.find(r => normTeam(r.strTeam || r.nameTeam) === normTeam(oppName))  || {};

let oppLastEvents = [];
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
    const od = await getJson(ep(`eventslast.php?id=${oppId}`));
    oppLastEvents = od?.results || od?.events || [];
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

const formFCSM = calcFormStr(lastEvents, teamName);
const formOpp  = calcFormStr(oppLastEvents, oppName);
const ligue2Banner = ligue2Ready ? '' : '<div class="banner-warning">La Ligue 2 2026-2027 démarre le 8 août — les prochains matchs sont des amicaux</div>';
const round = nextMatch?.intRound ? `J${nextMatch.intRound}` : '—';
// buildIsoHtml : format ISO 8601 standard (avec tirets/deux-points) pour new Date() JS
const nextMatchIso = buildIsoHtml(nextMatch?.dateEvent, nextMatch?.strTime);
const nextMatchUnconfirmed = nextMatch?._hardcoded === true;

function badgeTag(name, size = 28) {
  const url = logos[canonicalTeamKey(name)];
  if (!url) return '';
  return `<img src="${url}" alt="${name}" width="${size}" height="${size}" style="border-radius:4px;object-fit:contain;vertical-align:middle;flex-shrink:0">`;
}

/* ── Badges domicile/extérieur basés sur le vrai match (pas FCSM=home par défaut) ── */
const nextMatchHomeName = nextMatch?.strHomeTeam || teamName;
const nextMatchAwayName = nextMatch?.strAwayTeam || oppName;
const homeBigBadge = badgeTag(nextMatchHomeName, 28);
const awayBigBadge = badgeTag(nextMatchAwayName, 28);

const fcsmBigBadge = badgeTag(teamName, 28);
const oppBigBadge  = badgeTag(oppName,  28);

function formBadgesSummary(events, tName) {
  const items = parseForm(events, tName);
  if (!items.length) return '—';
  return items.map(r => {
    const cls = r.letter === 'V' ? 'win' : r.letter === 'N' ? 'draw' : 'loss';
    return `<span class="form-badge form-badge--${cls}">${r.letter}</span>`;
  }).join(' ');
}

const UNCONFIRMED_PILL = `<span title="Date et heure à confirmer" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;color:#B98900;background:rgba(255,207,33,.15);border:1px solid rgba(255,207,33,.5);border-radius:999px;padding:2px 8px;white-space:nowrap;flex-shrink:0">⏳ À confirmer</span>`;

/* ── Bloc "Calendrier complet" : 5 prochains + bouton Voir plus ── */
function buildUpcomingRows(events) {
  if (!events || events.length === 0) return '<p class="no-matches">Aucun match à venir disponible pour le moment.</p>';
  // On affiche les 5 premiers directement, le reste est masqué
  const VISIBLE = 5;
  const rows = events.map((ev, i) => {
    const isHome = normTeam(ev.strHomeTeam) === normTeam(teamName);
    const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
    const dateLabel = fmtDate(ev.dateEvent, ev.strTime);
    const time = fmtTime(ev.strTime);
    const league = ev.strLeague || '—';
    const roundLabel = ev.intRound ? `J${ev.intRound}` : '';
    const homeBadge = teamBadgeImg(ev.strHomeTeam, logos, 22);
    const awayBadge = teamBadgeImg(ev.strAwayTeam, logos, 22);
    const teamsHtml = isHome
      ? `${homeBadge} <strong>FCSM</strong> vs ${awayBadge} ${opp}`
      : `${homeBadge} ${opp} vs ${awayBadge} <strong>FCSM</strong>`;
    const unconfirmedPill = ev._hardcoded ? UNCONFIRMED_PILL : '';
    const timeDisplay = `<span style="color:var(--muted)">${time}</span>`;
    // Au-delà du 5e match affiché : masqué jusqu'au clic sur "Voir plus"
    const hiddenClass = i >= VISIBLE ? ' upcoming-row--hidden' : '';
    return `<div class="upcoming-row${i === 0 ? ' upcoming-row--next' : ''}${hiddenClass}" data-index="${i}">
  <div class="upcoming-date"><span class="upcoming-date-main">${dateLabel}</span>${timeDisplay}</div>
  <div class="upcoming-match"><span class="upcoming-teams">${teamsHtml}</span><span class="upcoming-venue">${ev.strVenue || ''}</span></div>
  <div class="upcoming-meta"><span class="match-league">🏆 ${league}</span>${roundLabel ? `<span class="match-round">${roundLabel}</span>` : ''}${unconfirmedPill}</div>
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

const upcomingHtml = buildUpcomingRows(teamAllNext);

/* ── Bloc "Résultats Ligue 2 — Saison 2026-27" ── */
function buildPastL2Html(pastEvents, teamName, logos) {
  // Filtre uniquement les matchs de Ligue 2 passés
  const l2Past = pastEvents
    .filter(ev => isLigue2(ev) && ev.dateEvent < today)
    .sort((a, b) => b.dateEvent.localeCompare(a.dateEvent)); // plus récent en premier
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

const vars = {
  NEXT_MATCH_DATE:       nextMatch?.dateEvent   || '—',
  NEXT_MATCH_TIME:       (nextMatch?.strTime ? fmtTime(nextMatch.strTime) : '—') + (nextMatchUnconfirmed ? ' ⏳' : ''),
  NEXT_MATCH_HOME_TEAM:  nextMatch?.strHomeTeam  || '—',
  NEXT_MATCH_AWAY_TEAM:  nextMatch?.strAwayTeam  || '—',
  NEXT_MATCH_HOME_BADGE: homeBigBadge,
  NEXT_MATCH_AWAY_BADGE: awayBigBadge,
  NEXT_MATCH_STATUS:     nextMatch?.strStatus || nextMatch?.strProgress || '—',
  NEXT_MATCH_VENUE:      nextMatch?.strVenue     || '—',
  NEXT_MATCH_LEAGUE:     nextMatch?.strLeague    || '—',
  NEXT_MATCH_ROUND:      round,
  NEXT_MATCH_ISO:        nextMatchIso,
  LIGUE2_STATUS_BANNER:  ligue2Banner,
  TEAM_RANK_FCSM:        String(teamRow?.intRank  || teamRow?.rank  || '—'),
  TEAM_POINTS_FCSM:      String(teamRow?.intPoints || '—'),
  TEAM_RANK_OPPONENT:    String(oppRow?.intRank   || oppRow?.rank   || '—'),
  TEAM_POINTS_OPPONENT:  String(oppRow?.intPoints  || '—'),
  FCSM_BADGE:            fcsmBigBadge,
  OPP_BADGE:             oppBigBadge,
  OPP_NAME:              oppName,
  LAST_5_FCSM_FORM:      formBadgesSummary(lastEvents, teamName),
  LAST_5_FCSM_1:         eventLineHtml(lastEvents[0], teamName, logos),
  LAST_5_FCSM_2:         eventLineHtml(lastEvents[1], teamName, logos),
  LAST_5_FCSM_3:         eventLineHtml(lastEvents[2], teamName, logos),
  LAST_5_FCSM_4:         eventLineHtml(lastEvents[3], teamName, logos),
  LAST_5_FCSM_5:         eventLineHtml(lastEvents[4], teamName, logos),
  LAST_5_OPPONENT_FORM:  formBadgesSummary(oppLastEvents, oppName),
  LAST_5_OPPONENT_1:     eventLineHtml(oppLastEvents[0], oppName, logos),
  LAST_5_OPPONENT_2:     eventLineHtml(oppLastEvents[1], oppName, logos),
  LAST_5_OPPONENT_3:     eventLineHtml(oppLastEvents[2], oppName, logos),
  LAST_5_OPPONENT_4:     eventLineHtml(oppLastEvents[3], oppName, logos),
  LAST_5_OPPONENT_5:     eventLineHtml(oppLastEvents[4], oppName, logos),
  UPCOMING_MATCHES:      upcomingHtml,
  PAST_MATCHES_L2:       pastL2Html,
  HEAD2HEAD_MATCHES:     h2hHtml,
  LAST_UPDATED:          LAST_UPDATED,
};

const fill = (template, vs) => Object.entries(vs).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? '—'), template);
const srcHtml = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), fill(srcHtml, vars), 'utf8');
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify({
  teamName, seasonSource, oppName, nextMatch, nextMatchIso, ligue2Ready,
  formFCSM, formOpp, oppLastEventsCount: oppLastEvents.length,
  totalUpcoming: teamAllNext.length,
  hardcodedCount: teamAllNext.filter(e=>e._hardcoded).length,
  logosCount: Object.keys(logos).length,
  lastUpdated: LAST_UPDATED,
  sampleNext: teamAllNext.slice(0, 6).map(e => ({ date: e.dateEvent, home: e.strHomeTeam, away: e.strAwayTeam, league: e.strLeague, confirmed: !e._hardcoded })),
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
  const isHome = normTeam(ev.strHomeTeam) === normTeam(tName);
  const fcsmScore = isHome ? hs : as;
  const oppScore  = isHome ? as : hs;
  const result = fcsmScore > oppScore ? 'V' : fcsmScore === oppScore ? 'N' : 'D';
  return { result, fcsmScore, oppScore };
}

function buildIcsSummary(ev, tName, tRow) {
  const isHome    = normTeam(ev.strHomeTeam) === normTeam(tName);
  const opp       = isHome ? ev.strAwayTeam : ev.strHomeTeam;
  const rankFCSM  = tRow?.intRank ? `(${tRow.intRank})` : '';
  const roundLabel  = ev.intRound  ? ` J${ev.intRound}`   : '';
  const leagueLabel = ev.strLeague ? ` [${ev.strLeague}]` : '';

  if (hasScore(ev)) {
    const { result, fcsmScore, oppScore } = fcsmResult(ev, tName);
    const emoji = result === 'V' ? '✅' : result === 'N' ? '➖' : '❌';
    const scoreStr = isHome ? `${fcsmScore}-${oppScore}` : `${oppScore}-${fcsmScore}`;
    const title = isHome
      ? `${emoji} FCSM ${scoreStr} ${opp}`
      : `${emoji} ${opp} ${scoreStr} FCSM`;
    return `${title}${roundLabel}${leagueLabel}`;
  }

  const unconfirmedLabel = ev._hardcoded ? ' ⏳' : '';
  return isHome
    ? `FCSM ${rankFCSM} - ${opp}${roundLabel}${leagueLabel}${unconfirmedLabel}`
    : `${opp} - FCSM ${rankFCSM}${roundLabel}${leagueLabel}${unconfirmedLabel}`;
}

function buildIcsDescription(ev, tName, tRow, oRow, fFCSM, fOpp) {
  const isHome    = normTeam(ev.strHomeTeam) === normTeam(tName);
  const opp       = isHome ? ev.strAwayTeam : ev.strHomeTeam;
  const venue     = ev.strVenue   ? `📍 ${ev.strVenue}`    : '';
  const league    = ev.strLeague  ? `🏆 ${ev.strLeague}`   : '';
  const roundStr  = ev.intRound   ? `J${ev.intRound}`      : '';
  const headerParts = [venue, league, roundStr].filter(Boolean).join(' | ');

  if (hasScore(ev)) {
    const { result, fcsmScore, oppScore } = fcsmResult(ev, tName);
    const emoji = result === 'V' ? '✅' : result === 'N' ? '➖' : '❌';
    const resultLabel = result === 'V' ? 'Victoire' : result === 'N' ? 'Nul' : 'Défaite';
    const scoreStr = isHome
      ? `FCSM ${fcsmScore} - ${oppScore} ${opp}`
      : `${opp} ${oppScore} - ${fcsmScore} FCSM`;
    const parts = [
      headerParts,
      `⚽ Score final : ${scoreStr}`,
      `Résultat : ${resultLabel} ${emoji}`,
    ].filter(Boolean);
    return parts.join('\\n');
  }

  const rankFCSM = tRow?.intRank ? ` (${tRow.intRank}e)` : '';
  const rankOpp  = oRow?.intRank ? ` (${oRow.intRank}e)` : '';
  const unconfirmedPart = ev._hardcoded
    ? '⏳ Date et heure à confirmer — source : calendrier LFP officiel'
    : '';
  const formeFCSM = `FCSM${rankFCSM} — Forme : ${fFCSM || '—'}`;
  const formeOpp  = `${opp}${rankOpp} — Forme : ${fOpp || '—'}`;
  const h2hPart   = buildH2hDescription(opp);

  const parts = [
    headerParts,
    unconfirmedPart,
    '---',
    formeFCSM,
    formeOpp,
    h2hPart ? '---' : '',
    h2hPart,
  ].filter(Boolean);
  return parts.join('\\n');
}

/* ── ICS : déduplication robuste (par journée OU par équipes+date) ── */
function icsMatchKey(ev) {
  const home = normTeam(ev.strHomeTeam);
  const away = normTeam(ev.strAwayTeam);
  // Si journée disponible : clé = round+home+away (indépendante de la date)
  if (ev.intRound && (ev.strLeague || '').toLowerCase().includes('ligue 2')) {
    return `ligue2-J${ev.intRound}-${home}-${away}`;
  }
  // Sinon : clé = date+home+away
  return `${ev.dateEvent}-${home}-${away}`;
}

const allEventsForIcs = [...seasonPast, ...teamAllNext];
const icsLines = [
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FCSM//Calendar//FR',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH',
  'X-WR-CALNAME:FCSM — Tous les matchs',
  'X-WR-CALDESC:Matchs FC Sochaux-Montbéliard toutes compétitions',
  `X-WR-LASTUPDATED:${new Date().toISOString()}`,
];
const seenUids = new Set();
for (const ev of allEventsForIcs) {
  if (!ev?.dateEvent) continue;
  const matchKey = icsMatchKey(ev);
  if (seenUids.has(matchKey)) {
    console.log(`⚠️  ICS doublon ignoré : ${matchKey}`);
    continue;
  }
  seenUids.add(matchKey);

  const isoStr = buildIso(ev.dateEvent, ev.strTime);
  const uid = `fcsm-${ev.idEvent || matchKey}@ical-fcsm`;

  const summary     = buildIcsSummary(ev, teamName, teamRow);
  const description = buildIcsDescription(ev, teamName, teamRow, oppRow, formFCSM, formOpp);

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

console.log('✅ Build OK', { seasonSource, upcoming: teamAllNext.length, logos: Object.keys(logos).length, lastUpdated: LAST_UPDATED, apiKey: API_KEY ? '✓' : '✗' });
