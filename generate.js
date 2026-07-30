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
const SRC_BADGES = 'badges';          /* dossier versionné dans le repo */
const DST_BADGES = path.join(out, 'badges'); /* copié dans dist/ au build  */
fs.mkdirSync(out,        { recursive: true });
fs.mkdirSync(SRC_BADGES, { recursive: true });
fs.mkdirSync(DST_BADGES, { recursive: true });
if (fs.existsSync('favicon.svg'))    fs.copyFileSync('favicon.svg',    path.join(out, 'favicon.svg'));
if (fs.existsSync('favicon-32.svg')) fs.copyFileSync('favicon-32.svg', path.join(out, 'favicon-32.svg'));

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

/* Télécharge remoteUrl, sauve dans badges/{slug}.png ET dist/badges/{slug}.png.
   Si le fichier existe déjà en local, le copie simplement sans re-télécharger. */
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

/* ── IDs TheSportsDB — toutes les équipes du calendrier ────────────────── */
const TEAM_IDS = {
  'AS Saint-Étienne': '133717',
  'Red Star FC':      '134795',
  'EA Guingamp':      '133716',
  'Clermont Foot':    '134030',
  'FC Nantes':        '133704',
  'AJ Auxerre':       '134102',
};

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
  const url = logos[normTeam(name)];
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

function buildIso(dateEvent, strTime) {
  if (!dateEvent) return '';
  return `${dateEvent}T${strTime ? strTime.slice(0, 5) : '12:00'}:00Z`;
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
    const d = new Date(buildIso(dateEvent, strTime));
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return dateEvent; }
}

/* ── Fetch API principale ──────────────────────────────────────────────── */
const [teamData, lastData, seasonData, nextTeamData, tableData] = await Promise.all([
  getJson(ep(`lookupteam.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventslast.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventsseason.php?id=${TEAM_ID_FCSM}&s=${SEASON}`)),
  getJson(ep(`eventsnext.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`)),
]);

const team = teamData?.teams?.[0] || {};
const teamName = team.strTeam || TEAM_NAME_FALLBACK;
const teamBadgeRemote = team.strTeamBadge || team.strBadge || '';
const lastEvents = lastData?.results || lastData?.events || [];
const tableRows = tableData?.table || tableData?.teams || [];
const today = new Date().toISOString().slice(0, 10);

/* ── Fetch badges de tous les adversaires du calendrier via lookupteam ──── */
const calendarTeamsBadges = await Promise.all(
  Object.entries(TEAM_IDS).map(async ([name, id]) => {
    const d = await getJson(ep(`lookupteam.php?id=${id}`));
    const badgeUrl = d?.teams?.[0]?.strTeamBadge || d?.teams?.[0]?.strBadge || '';
    return { name, id, badgeUrl };
  })
);
console.log('🔍 Badges API:', calendarTeamsBadges.map(t => `${t.name}=${t.badgeUrl?'✓':'✗'}`).join(', '));

/* ── Calendrier hardcodé ──────────────────────────────────────────────── */
const LIGUE2_SCHEDULE = [
  { dateEvent: '2026-08-01', strTime: '18:00:00', strHomeTeam: teamName,        strAwayTeam: 'AJ Auxerre',       idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['AJ Auxerre'],        strLeague: 'Amical',         intRound: null, strVenue: 'Stade Auguste Bonal' },
  { dateEvent: '2026-08-08', strTime: '20:45:00', strHomeTeam: teamName,        strAwayTeam: 'AS Saint-Étienne', idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['AS Saint-Étienne'], strLeague: 'French Ligue 2', intRound: '1',  strVenue: 'Stade Auguste Bonal' },
  { dateEvent: '2026-08-14', strTime: '20:45:00', strHomeTeam: 'Red Star FC',   strAwayTeam: teamName,           idHomeTeam: TEAM_IDS['Red Star FC'], idAwayTeam: TEAM_ID_FCSM,  strLeague: 'French Ligue 2', intRound: '2',  strVenue: '' },
  { dateEvent: '2026-08-21', strTime: '20:00:00', strHomeTeam: teamName,        strAwayTeam: 'EA Guingamp',      idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['EA Guingamp'],      strLeague: 'French Ligue 2', intRound: '3',  strVenue: 'Stade Auguste Bonal' },
  { dateEvent: '2026-08-28', strTime: '20:00:00', strHomeTeam: 'Clermont Foot', strAwayTeam: teamName,           idHomeTeam: TEAM_IDS['Clermont Foot'], idAwayTeam: TEAM_ID_FCSM, strLeague: 'French Ligue 2', intRound: '4',  strVenue: '' },
  { dateEvent: '2026-09-11', strTime: '20:00:00', strHomeTeam: teamName,        strAwayTeam: 'FC Nantes',        idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['FC Nantes'],        strLeague: 'French Ligue 2', intRound: '6',  strVenue: 'Stade Auguste Bonal' },
];

/* ── Construction de teamAllNext ───────────────────────────────────────── */
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

/* Déduplication robuste :
   - clé = date + les deux équipes normées triées (insensible à l'ordre)
   - un match hardcodé est considéré doublon si, même date, l'API retourne
     un match dont les deux équipes se "contiennent" mutuellement (ex: "Auxerre" ⊆ "AJ Auxerre") */
function dedupKey(homeTeam, awayTeam, date) {
  return `${date}|${[normTeam(homeTeam), normTeam(awayTeam)].sort().join('|')}`;
}
function isSameMatch(a, b) {
  if (a.dateEvent !== b.dateEvent) return false;
  const ah = normTeam(a.strHomeTeam), aa = normTeam(a.strAwayTeam);
  const bh = normTeam(b.strHomeTeam), ba = normTeam(b.strAwayTeam);
  /* correspondance stricte */
  if (ah === bh && aa === ba) return true;
  /* correspondance souple : l'un contient l'autre (gère "Auxerre" vs "AJ Auxerre") */
  const containsTeam = (x, y) => x.includes(y) || y.includes(x);
  return containsTeam(ah, bh) && containsTeam(aa, ba);
}

/* Merger les matchs hardcodés manquants */
for (const hev of LIGUE2_SCHEDULE.filter(ev => ev.dateEvent >= today)) {
  const alreadyPresent = teamAllNext.some(ev => isSameMatch(ev, hev));
  if (!alreadyPresent) teamAllNext.push(hev);
}
teamAllNext.sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
if (seasonSource !== 'hardcoded') seasonSource += '+hardcoded';

console.log(`📊 Source: ${seasonSource} | teamAllNext=${teamAllNext.length}`);

/* ── Prochain match Ligue 2 ────────────────────────────────────────── */
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

/* ── 5 derniers matchs adversaire ─────────────────────────────────────── */
let oppLastEvents = [];
let oppBadgeRemote = '';
if (nextMatch && API_KEY) {
  const isOppAway = normTeam(nextMatch.strAwayTeam) === normTeam(oppName);
  const oppIdFromEvent = isOppAway ? nextMatch.idAwayTeam : nextMatch.idHomeTeam;
  const oppIdFromMap = Object.entries(TEAM_IDS).find(([k]) => normTeam(k) === normTeam(oppName))?.[1];
  const oppId = oppIdFromEvent || oppIdFromMap;
  /* Badge déjà fetché dans calendarTeamsBadges si c'est un adversaire connu */
  const knownOpp = calendarTeamsBadges.find(t => normTeam(t.name) === normTeam(oppName));
  if (knownOpp) oppBadgeRemote = knownOpp.badgeUrl;
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
}

/* ── Téléchargement / copie de tous les badges ───────────────────────── */
const allBadgesToEnsure = [
  { name: teamName, remoteUrl: teamBadgeRemote },
  ...calendarTeamsBadges.map(t => ({ name: t.name, remoteUrl: t.badgeUrl })),
];
/* Ajouter l'adversaire si pas déjà dans la liste */
if (oppBadgeRemote && !allBadgesToEnsure.find(t => normTeam(t.name) === normTeam(oppName))) {
  allBadgesToEnsure.push({ name: oppName, remoteUrl: oppBadgeRemote });
}

const logoResults = await Promise.all(
  allBadgesToEnsure.map(async ({ name, remoteUrl }) => {
    const slug = slugify(name);
    const localUrl = await ensureBadge(remoteUrl, slug);
    return [normTeam(name), localUrl];
  })
);
const logos = Object.fromEntries(logoResults.filter(([, url]) => url));
console.log(`🎨 Logos dispos: ${Object.keys(logos).length}/${allBadgesToEnsure.length}`);

/* ── Rendu HTML ─────────────────────────────────────────────────────── */
const formFCSM = calcFormStr(lastEvents, teamName);
const formOpp  = calcFormStr(oppLastEvents, oppName);
const ligue2Banner = ligue2Ready ? '' : '<div class="banner-warning">La Ligue 2 2026-2027 démarre le 8 Août - les prochains matchs sont des Amicaux</div>';
const round = nextMatch?.intRound ? `J${nextMatch.intRound}` : '—';
const nextMatchIso = buildIso(nextMatch?.dateEvent, nextMatch?.strTime);

function badgeTag(name, size = 28) {
  const url = logos[normTeam(name)];
  if (!url) return '';
  return `<img src="${url}" alt="${name}" width="${size}" height="${size}" style="border-radius:4px;object-fit:contain;vertical-align:middle;flex-shrink:0">`;
}

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

function buildUpcomingRows(events) {
  if (!events || events.length === 0) return '<p class="no-matches">Aucun match à venir disponible pour le moment.</p>';
  return events.map((ev, i) => {
    const isHome = normTeam(ev.strHomeTeam) === normTeam(teamName);
    const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
    const dateLabel = fmtDate(ev.dateEvent, ev.strTime);
    const time = ev.strTime ? ev.strTime.slice(0, 5) : '—';
    const league = ev.strLeague || '—';
    const roundLabel = ev.intRound ? `J${ev.intRound}` : '';
    const homeBadge = teamBadgeImg(ev.strHomeTeam, logos, 22);
    const awayBadge = teamBadgeImg(ev.strAwayTeam, logos, 22);
    const teamsHtml = isHome
      ? `${homeBadge} <strong>FCSM</strong> vs ${awayBadge} ${opp}`
      : `${homeBadge} ${opp} vs ${awayBadge} <strong>FCSM</strong>`;
    return `<div class="upcoming-row${i === 0 ? ' upcoming-row--next' : ''}">
  <div class="upcoming-date"><span class="upcoming-date-main">${dateLabel}</span><span class="upcoming-date-time">${time}</span></div>
  <div class="upcoming-match"><span class="upcoming-teams">${teamsHtml}</span><span class="upcoming-venue">${ev.strVenue || ''}</span></div>
  <div class="upcoming-meta"><span class="match-league">🏆 ${league}</span>${roundLabel ? `<span class="match-round">${roundLabel}</span>` : ''}</div>
</div>`;
  }).join('\n');
}

const upcomingHtml = buildUpcomingRows(teamAllNext);

const vars = {
  NEXT_MATCH_DATE:       nextMatch?.dateEvent   || '—',
  NEXT_MATCH_TIME:       nextMatch?.strTime      || '—',
  NEXT_MATCH_HOME_TEAM:  nextMatch?.strHomeTeam  || '—',
  NEXT_MATCH_AWAY_TEAM:  nextMatch?.strAwayTeam  || '—',
  NEXT_MATCH_HOME_BADGE: fcsmBigBadge,
  NEXT_MATCH_AWAY_BADGE: oppBigBadge,
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
};

const fill = (template, vs) => Object.entries(vs).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? '—'), template);
const srcHtml = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), fill(srcHtml, vars), 'utf8');
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify({
  teamName, seasonSource, oppName, nextMatch, nextMatchIso, ligue2Ready,
  formFCSM, formOpp, oppLastEventsCount: oppLastEvents.length,
  totalUpcoming: teamAllNext.length,
  logosCount: Object.keys(logos).length,
  sampleNext: teamAllNext.slice(0, 6).map(e => ({ date: e.dateEvent, home: e.strHomeTeam, away: e.strAwayTeam, league: e.strLeague })),
}, null, 2), 'utf8');

/* ICS */
const allEventsForIcs = [...seasonPast, ...teamAllNext];
const icsLines = [
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FCSM//Calendar//FR',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH',
  'X-WR-CALNAME:FCSM — Tous les matchs',
  'X-WR-CALDESC:Matchs FC Sochaux-Montbéliard toutes compétitions',
];
const seenUids = new Set();
for (const ev of allEventsForIcs) {
  if (!ev?.dateEvent) continue;
  const dateStr = ev.dateEvent.replace(/-/g, '');
  const timeStr = (ev.strTime || '120000').replace(/:/g, '').slice(0, 6);
  const dt = `${dateStr}T${timeStr}Z`;
  const uid = `fcsm-${ev.idEvent || (dateStr + normTeam(ev.strHomeTeam) + normTeam(ev.strAwayTeam))}@ical-fcsm`;
  if (seenUids.has(uid)) continue;
  seenUids.add(uid);
  const isHome = normTeam(ev.strHomeTeam) === normTeam(teamName);
  const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
  const rankFCSM = teamRow?.intRank ? `(${teamRow.intRank})` : '';
  const roundLabel = ev.intRound ? ` J${ev.intRound}` : '';
  const leagueLabel = ev.strLeague ? ` [${ev.strLeague}]` : '';
  const summary = isHome
    ? `FCSM ${rankFCSM} - ${opp}${roundLabel}${leagueLabel}`
    : `${opp} - FCSM ${rankFCSM}${roundLabel}${leagueLabel}`;
  icsLines.push(
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${dt}`,
    `SUMMARY:${summary}`, `DESCRIPTION:Forme FCSM : ${formFCSM}`,
    `LOCATION:${ev.strVenue || ''}`,
  );
  if (ev.intHomeScore != null && ev.intHomeScore !== '') icsLines.push(`X-SCORE:${ev.intHomeScore}-${ev.intAwayScore}`);
  icsLines.push('END:VEVENT');
}
icsLines.push('END:VCALENDAR');
fs.writeFileSync(path.join(out, 'fcsm.ics'), icsLines.join('\r\n'), 'utf8');

console.log('✅ Build OK', { seasonSource, upcoming: teamAllNext.length, logos: Object.keys(logos).length, apiKey: API_KEY ? '✓' : '✗' });
