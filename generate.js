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
const badgesDir = path.join(out, 'badges');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(badgesDir, { recursive: true });
if (fs.existsSync('favicon.svg')) fs.copyFileSync('favicon.svg', path.join(out, 'favicon.svg'));
if (fs.existsSync('favicon-32.svg')) fs.copyFileSync('favicon-32.svg', path.join(out, 'favicon-32.svg'));

const ep = p => `https://www.thesportsdb.com/api/v1/json/${API_KEY}/${p}`;

async function getJson(url) {
  if (!API_KEY) { console.warn('⚠️  THESPORTSDB_API_KEY absent'); return null; }
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) { console.error(`HTTP ${r.status} for ${url}`); return null; }
    const text = await r.text();
    if (!text || text.trim() === '') { console.warn(`Réponse vide pour ${url}`); return null; }
    try { return JSON.parse(text); } catch (e) { console.warn(`JSON invalide: ${text.slice(0,100)}`); return null; }
  } catch (e) { console.error(`Erreur fetch: ${e.message}`); return null; }
}

/* Télécharge un badge depuis une URL distante, le sauve dans dist/badges/{slug}.png
   Retourne le chemin local relatif "./badges/{slug}.png" ou '' en cas d'échec */
async function downloadBadge(remoteUrl, slug) {
  if (!remoteUrl) return '';
  const localPath = path.join(badgesDir, `${slug}.png`);
  try {
    const r = await fetch(remoteUrl, { headers: { 'User-Agent': 'fcsm-calendar-build/1.0' } });
    if (!r.ok) { console.warn(`Badge HTTP ${r.status} : ${remoteUrl}`); return ''; }
    const buf = await r.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buf));
    console.log(`🖼  Badge saved: badges/${slug}.png`);
    return `./badges/${slug}.png`;
  } catch (e) {
    console.warn(`Badge fetch error (${slug}): ${e.message}`);
    return '';
  }
}

function slugify(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

/* ── IDs TheSportsDB des adversaires ─────────────────────────────────────── */
const TEAM_IDS = {
  'AS Saint-Étienne': '133717',
  'Red Star FC':      '134795',
  'EA Guingamp':      '133716',
  'Clermont Foot':    '134030',
  'FC Nantes':        '133704',
  'AJ Auxerre':       '134102',
};

function normTeam(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }

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
    return `<li><span class="form-badge form-badge--unknown">?</span> ${dateOnly} — ${oppBadge} ${ev.strHomeTeam} vs ${ev.strAwayTeam}</li>`;
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

/* ── Fetch API ─────────────────────────────────────────────────────────── */
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

/* ── Calendrier hardcodé ───────────────────────────────────────────────── */
const LIGUE2_SCHEDULE = [
  { dateEvent: '2026-08-01', strTime: '18:00:00', strHomeTeam: teamName,        strAwayTeam: 'AJ Auxerre',       idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['AJ Auxerre'],        strLeague: 'Amical',         intRound: null, strVenue: 'Stade Auguste Bonal' },
  { dateEvent: '2026-08-08', strTime: '20:45:00', strHomeTeam: teamName,        strAwayTeam: 'AS Saint-Étienne', idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['AS Saint-Étienne'], strLeague: 'French Ligue 2', intRound: '1',  strVenue: 'Stade Auguste Bonal' },
  { dateEvent: '2026-08-14', strTime: '20:45:00', strHomeTeam: 'Red Star FC',   strAwayTeam: teamName,           idHomeTeam: TEAM_IDS['Red Star FC'], idAwayTeam: TEAM_ID_FCSM,  strLeague: 'French Ligue 2', intRound: '2',  strVenue: '' },
  { dateEvent: '2026-08-21', strTime: '20:00:00', strHomeTeam: teamName,        strAwayTeam: 'EA Guingamp',      idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['EA Guingamp'],      strLeague: 'French Ligue 2', intRound: '3',  strVenue: 'Stade Auguste Bonal' },
  { dateEvent: '2026-08-28', strTime: '20:00:00', strHomeTeam: 'Clermont Foot', strAwayTeam: teamName,           idHomeTeam: TEAM_IDS['Clermont Foot'], idAwayTeam: TEAM_ID_FCSM, strLeague: 'French Ligue 2', intRound: '4',  strVenue: '' },
  { dateEvent: '2026-09-11', strTime: '20:00:00', strHomeTeam: teamName,        strAwayTeam: 'FC Nantes',        idHomeTeam: TEAM_ID_FCSM, idAwayTeam: TEAM_IDS['FC Nantes'],        strLeague: 'French Ligue 2', intRound: '6',  strVenue: 'Stade Auguste Bonal' },
];

/* ── Construction de teamAllNext ─────────────────────────────────────────── */
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
  console.warn('⚠️  API vide — calendrier hardcodé utilisé');
  teamAllNext = LIGUE2_SCHEDULE.filter(ev => ev.dateEvent >= today).sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
  seasonPast  = [...lastEvents].sort((a,b) => (a.dateEvent||'').localeCompare(b.dateEvent||''));
}

{
  const existingKeys = new Set(teamAllNext.map(e => `${e.dateEvent}|${normTeam(e.strHomeTeam)}|${normTeam(e.strAwayTeam)}`));
  for (const hev of LIGUE2_SCHEDULE.filter(ev => ev.dateEvent >= today)) {
    const key = `${hev.dateEvent}|${normTeam(hev.strHomeTeam)}|${normTeam(hev.strAwayTeam)}`;
    if (!existingKeys.has(key)) { teamAllNext.push(hev); existingKeys.add(key); }
  }
  teamAllNext.sort((a,b) => a.dateEvent.localeCompare(b.dateEvent));
  if (seasonSource !== 'hardcoded') seasonSource += '+hardcoded';
}

console.log(`📊 Source: ${seasonSource} | teamAllNext=${teamAllNext.length}`);

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

/* ── 5 derniers matchs adversaire ────────────────────────────────────────── */
let oppLastEvents = [];
let oppBadgeRemote = '';
let oppId = null;
if (nextMatch && API_KEY) {
  const isOppAway = normTeam(nextMatch.strAwayTeam) === normTeam(oppName);
  const oppIdFromEvent = isOppAway ? nextMatch.idAwayTeam : nextMatch.idHomeTeam;
  const oppIdFromMap = Object.entries(TEAM_IDS).find(([k]) => normTeam(k) === normTeam(oppName))?.[1];
  oppId = oppIdFromEvent || oppIdFromMap;
  if (oppId) {
    const [od, oppTeamData] = await Promise.all([
      getJson(ep(`eventslast.php?id=${oppId}`)),
      getJson(ep(`lookupteam.php?id=${oppId}`)),
    ]);
    oppLastEvents = od?.results || od?.events || [];
    oppBadgeRemote = oppTeamData?.teams?.[0]?.strTeamBadge || oppTeamData?.teams?.[0]?.strBadge || '';
  } else {
    console.warn(`⚠️  Pas d'ID pour: "${oppName}"`);
  }
}

/* ── URLs distantes de fallback pour les badges du calendrier ──────────── */
const BADGE_REMOTE = {
  'AS Saint-Étienne': 'https://www.thesportsdb.com/images/media/team/badge/xvuuqq1420220879.png',
  'AJ Auxerre':       'https://www.thesportsdb.com/images/media/team/badge/0xr8vf1728467454.png',
  'Red Star FC':      'https://www.thesportsdb.com/images/media/team/badge/uswvqx1420575276.png',
  'EA Guingamp':      'https://www.thesportsdb.com/images/media/team/badge/xvqyry1420575418.png',
  'Clermont Foot':    'https://www.thesportsdb.com/images/media/team/badge/qsrsys1420221175.png',
  'FC Nantes':        'https://www.thesportsdb.com/images/media/team/badge/ttqrry1534163416.png',
};

/* ── Téléchargement de tous les badges en parallèle ─────────────────────── */
const allTeamsToDownload = [
  { name: teamName, remoteUrl: teamBadgeRemote },
  { name: oppName,  remoteUrl: oppBadgeRemote  },
  ...Object.entries(BADGE_REMOTE).map(([name, remoteUrl]) => ({ name, remoteUrl })),
];

const logoResults = await Promise.all(
  allTeamsToDownload.map(async ({ name, remoteUrl }) => {
    const slug = slugify(name);
    const localUrl = await downloadBadge(remoteUrl, slug);
    return [normTeam(name), localUrl];
  })
);

const logos = Object.fromEntries(logoResults.filter(([, url]) => url));

const formFCSM = calcFormStr(lastEvents, teamName);
const formOpp  = calcFormStr(oppLastEvents, oppName);
const ligue2Banner = ligue2Ready ? '' : '<div class="banner-warning">La Ligue 2 2026-2027 démarre le 8 Août - les prochains matchs sont des Amicaux</div>';
const round = nextMatch?.intRound ? `J${nextMatch.intRound}` : '—';
const nextMatchIso = buildIso(nextMatch?.dateEvent, nextMatch?.strTime);

const fcsmLocalBadge = logos[normTeam(teamName)] || '';
const oppLocalBadge  = logos[normTeam(oppName)]  || '';

function badgeTag(localUrl, name, size = 28) {
  if (!localUrl) return '';
  return `<img src="${localUrl}" alt="${name}" width="${size}" height="${size}" style="border-radius:4px;object-fit:contain;vertical-align:middle;flex-shrink:0">`;
}

const fcsmBigBadge = badgeTag(fcsmLocalBadge, teamName, 28);
const oppBigBadge  = badgeTag(oppLocalBadge,  oppName,  28);

function formBadgesSummary(events, tName) {
  const items = parseForm(events, tName);
  if (!items.length) return '—';
  return items.map(r => { const cls = r.letter === 'V' ? 'win' : r.letter === 'N' ? 'draw' : 'loss'; return `<span class="form-badge form-badge--${cls}">${r.letter}</span>`; }).join(' ');
}

function buildUpcomingRows(events) {
  if (!events || events.length === 0) return '<p class="no-matches">Aucun match à venir disponible pour le moment.</p>';
  return events.map((ev, i) => {
    const isHome = normTeam(ev.strHomeTeam) === normTeam(teamName);
    const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
    const dateLabel = fmtDate(ev.dateEvent, ev.strTime);
    const time = ev.strTime ? ev.strTime.slice(0,5) : '—';
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
  NEXT_MATCH_DATE:      nextMatch?.dateEvent   || '—',
  NEXT_MATCH_TIME:      nextMatch?.strTime      || '—',
  NEXT_MATCH_HOME_TEAM: nextMatch?.strHomeTeam  || '—',
  NEXT_MATCH_AWAY_TEAM: nextMatch?.strAwayTeam  || '—',
  NEXT_MATCH_HOME_BADGE: fcsmBigBadge,
  NEXT_MATCH_AWAY_BADGE: oppBigBadge,
  NEXT_MATCH_STATUS:    nextMatch?.strStatus || nextMatch?.strProgress || '—',
  NEXT_MATCH_VENUE:     nextMatch?.strVenue     || '—',
  NEXT_MATCH_LEAGUE:    nextMatch?.strLeague    || '—',
  NEXT_MATCH_ROUND:     round,
  NEXT_MATCH_ISO:       nextMatchIso,
  LIGUE2_STATUS_BANNER: ligue2Banner,
  TEAM_RANK_FCSM:       String(teamRow?.intRank  || teamRow?.rank  || '—'),
  TEAM_POINTS_FCSM:     String(teamRow?.intPoints || '—'),
  TEAM_RANK_OPPONENT:   String(oppRow?.intRank   || oppRow?.rank   || '—'),
  TEAM_POINTS_OPPONENT: String(oppRow?.intPoints  || '—'),
  FCSM_BADGE:           fcsmBigBadge,
  OPP_BADGE:            oppBigBadge,
  OPP_NAME:             oppName,
  LAST_5_FCSM_FORM:     formBadgesSummary(lastEvents, teamName),
  LAST_5_FCSM_1:        eventLineHtml(lastEvents[0], teamName, logos),
  LAST_5_FCSM_2:        eventLineHtml(lastEvents[1], teamName, logos),
  LAST_5_FCSM_3:        eventLineHtml(lastEvents[2], teamName, logos),
  LAST_5_FCSM_4:        eventLineHtml(lastEvents[3], teamName, logos),
  LAST_5_FCSM_5:        eventLineHtml(lastEvents[4], teamName, logos),
  LAST_5_OPPONENT_FORM: formBadgesSummary(oppLastEvents, oppName),
  LAST_5_OPPONENT_1:    eventLineHtml(oppLastEvents[0], oppName, logos),
  LAST_5_OPPONENT_2:    eventLineHtml(oppLastEvents[1], oppName, logos),
  LAST_5_OPPONENT_3:    eventLineHtml(oppLastEvents[2], oppName, logos),
  LAST_5_OPPONENT_4:    eventLineHtml(oppLastEvents[3], oppName, logos),
  LAST_5_OPPONENT_5:    eventLineHtml(oppLastEvents[4], oppName, logos),
  UPCOMING_MATCHES:     upcomingHtml,
};

const fill = (template, vs) => Object.entries(vs).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? '—'), template);
const srcHtml = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), fill(srcHtml, vars), 'utf8');
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify({
  teamName, seasonSource, oppName, nextMatch, nextMatchIso, ligue2Ready,
  formFCSM, formOpp, oppLastEventsCount: oppLastEvents.length,
  totalUpcoming: teamAllNext.length,
  badgesDownloaded: Object.keys(logos).length,
  sampleNext: teamAllNext.slice(0,6).map(e => ({ date: e.dateEvent, home: e.strHomeTeam, away: e.strAwayTeam, league: e.strLeague })),
}, null, 2), 'utf8');

/* ICS */
const allEventsForIcs = [...seasonPast, ...teamAllNext];
const icsLines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FCSM//Calendar//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:FCSM — Tous les matchs','X-WR-CALDESC:Matchs FC Sochaux-Montbéliard toutes compétitions'];
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
  const summary = isHome ? `FCSM ${rankFCSM} - ${opp}${roundLabel}${leagueLabel}` : `${opp} - FCSM ${rankFCSM}${roundLabel}${leagueLabel}`;
  icsLines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${dt}`, `SUMMARY:${summary}`, `DESCRIPTION:Forme FCSM : ${formFCSM}`, `LOCATION:${ev.strVenue || ''}`);
  if (ev.intHomeScore != null && ev.intHomeScore !== '') icsLines.push(`X-SCORE:${ev.intHomeScore}-${ev.intAwayScore}`);
  icsLines.push('END:VEVENT');
}
icsLines.push('END:VCALENDAR');
fs.writeFileSync(path.join(out, 'fcsm.ics'), icsLines.join('\r\n'), 'utf8');

console.log('✅ dist/ generated', { seasonSource, totalUpcoming: teamAllNext.length, oppLastEvents: oppLastEvents.length, badgesDownloaded: Object.keys(logos).length, apiKey: API_KEY ? '✓' : '✗' });
