import fs from 'fs';
import path from 'path';

let fetch;
try { fetch = (await import('node-fetch')).default; } catch { fetch = global.fetch; }

const API_KEY = process.env.THESPORTSDB_API_KEY || '';
const TEAM_ID_FCSM = process.env.TEAM_ID_FCSM || '133708';
const LEAGUE_ID = process.env.LEAGUE_ID || '4401';
const SEASON = process.env.SEASON || '2026-2027';

const out = 'dist';
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync('favicon.svg')) fs.copyFileSync('favicon.svg', path.join(out, 'favicon.svg'));
if (fs.existsSync('favicon-32.svg')) fs.copyFileSync('favicon-32.svg', path.join(out, 'favicon-32.svg'));

const ep = p => `https://www.thesportsdb.com/api/v1/json/${API_KEY}/${p}`;

async function getJson(url) {
  if (!API_KEY) { console.warn('⚠️  THESPORTSDB_API_KEY absent — mode dégradé'); return null; }
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) { console.error(`HTTP ${r.status} for ${url}`); return null; }
    const text = await r.text();
    if (!text || text.trim() === '') { console.warn(`Réponse vide pour ${url}`); return null; }
    try { return JSON.parse(text); } catch (e) { console.warn(`JSON invalide pour ${url}: ${text.slice(0,100)}`); return null; }
  } catch (e) { console.error(`Erreur fetch ${url}: ${e.message}`); return null; }
}

function parseForm(events, teamName) {
  if (!events || !events.length) return [];
  return events.slice(0, 5).map(ev => {
    const hs = Number(ev.intHomeScore), as = Number(ev.intAwayScore);
    const isHome = ev.strHomeTeam === teamName;
    const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) {
      return { letter: '?', score: '?-?', opponent: opp, date: ev.dateEvent || '' };
    }
    const letter = isHome ? (hs > as ? 'V' : hs === as ? 'N' : 'D') : (as > hs ? 'V' : hs === as ? 'N' : 'D');
    return { letter, score: `${hs}-${as}`, opponent: opp, date: ev.dateEvent || '' };
  });
}

function calcFormStr(events, teamName) {
  return parseForm(events, teamName).map(r => r.letter).join(' ') || '—';
}

function eventLineHtml(ev, teamName) {
  if (!ev || !ev.strHomeTeam) return '<li>—</li>';
  const hs = Number(ev.intHomeScore), as = Number(ev.intAwayScore);
  const isHome = ev.strHomeTeam === teamName;
  const opp = isHome ? ev.strAwayTeam : ev.strHomeTeam;
  const dateOnly = ev.dateEvent ? fmtDateOnly(ev.dateEvent) : '—';
  if (!Number.isFinite(hs) || !Number.isFinite(as)) {
    return `<li><span class="form-badge form-badge--unknown">?</span> ${dateOnly} — ${ev.strHomeTeam} vs ${ev.strAwayTeam}</li>`;
  }
  const letter = isHome ? (hs > as ? 'V' : hs === as ? 'N' : 'D') : (as > hs ? 'V' : hs === as ? 'N' : 'D');
  const cls = letter === 'V' ? 'win' : letter === 'N' ? 'draw' : 'loss';
  const label = letter === 'V' ? 'Victoire' : letter === 'N' ? 'Nul' : 'Défaite';
  return `<li><span class="form-badge form-badge--${cls}" title="${label}">${letter}</span> ${dateOnly} — ${isHome ? `FCSM ${hs}-${as} ${opp}` : `${opp} ${as}-${hs} FCSM`}</li>`;
}

function buildIso(dateEvent, strTime) {
  if (!dateEvent) return '';
  const time = strTime ? strTime.slice(0, 5) : '12:00';
  return `${dateEvent}T${time}:00Z`;
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
    const iso = buildIso(dateEvent, strTime);
    const d = new Date(iso);
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return dateEvent; }
}

/* ── Fetch ──────────────────────────────────────────────────────────── */
const [teamData, lastData, seasonData, nextTeamData, tableData] = await Promise.all([
  getJson(ep(`lookupteam.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventslast.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventsseason.php?id=${TEAM_ID_FCSM}&s=${SEASON}`)),
  getJson(ep(`eventsnext.php?id=${TEAM_ID_FCSM}`)),   // fallback toujours chargé
  getJson(ep(`lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`)),
]);

const team = teamData?.teams?.[0] || {};
const teamName = team.strTeam || 'FC Sochaux-Montbéliard';
const lastEvents = lastData?.results || lastData?.events || [];
const tableRows = tableData?.table || tableData?.teams || [];

const today = new Date().toISOString().slice(0, 10);

/* eventsseason → tous les matchs de la saison */
const seasonEvents = seasonData?.events || [];
const seasonSource = seasonEvents.length > 0 ? 'eventsseason' : 'eventsnext';

let teamAllNext, seasonPast;
if (seasonEvents.length > 0) {
  teamAllNext = seasonEvents
    .filter(ev => ev.dateEvent && ev.dateEvent >= today)
    .sort((a, b) => a.dateEvent.localeCompare(b.dateEvent));
  seasonPast = seasonEvents
    .filter(ev => ev.dateEvent && ev.dateEvent < today)
    .sort((a, b) => a.dateEvent.localeCompare(b.dateEvent));
} else {
  // Fallback : eventsnext (5 prochains) — eventsseason indisponible pour cette saison
  console.warn('⚠️  eventsseason vide, fallback sur eventsnext');
  teamAllNext = (nextTeamData?.events || []).sort((a, b) => (a.dateEvent||'').localeCompare(b.dateEvent||''));
  seasonPast = lastEvents.slice().sort((a, b) => (a.dateEvent||'').localeCompare(b.dateEvent||''));
}

console.log(`📊 Source: ${seasonSource} | seasonEvents=${seasonEvents.length} | teamAllNext=${teamAllNext.length}`);

/* Prochain match : priorité Ligue 2, sinon premier dispo */
const teamLigue2Events = teamAllNext.filter(ev =>
  String(ev.idLeague) === String(LEAGUE_ID) || (ev.strLeague || '').toLowerCase().includes('ligue 2')
);
const ligue2Ready = teamLigue2Events.length > 0;
const nextEvents = ligue2Ready ? teamLigue2Events : teamAllNext;
const nextMatch = nextEvents[0] || null;
const oppName = nextMatch ? (nextMatch.strHomeTeam === teamName ? nextMatch.strAwayTeam : nextMatch.strHomeTeam) : 'Adversaire';
const teamRow = tableRows.find(r => r.strTeam === teamName || r.nameTeam === teamName) || {};
const oppRow = tableRows.find(r => r.strTeam === oppName || r.nameTeam === oppName) || {};

let oppLastEvents = [];
if (nextMatch && API_KEY) {
  const oppId = nextMatch.strAwayTeam === oppName ? nextMatch.idAwayTeam : nextMatch.idHomeTeam;
  if (oppId) { const od = await getJson(ep(`eventslast.php?id=${oppId}`)); oppLastEvents = od?.results || od?.events || []; }
}

const formFCSM = calcFormStr(lastEvents, teamName);
const formOpp  = calcFormStr(oppLastEvents, oppName);
const ligue2Banner = ligue2Ready ? '' : '<div class="banner-warning">La Ligue 2 2026-2027 démarre le 8 Août - les prochains matchs sont des Amicaux</div>';
const round = nextMatch?.intRound ? `J${nextMatch.intRound}` : '—';
const nextMatchIso = buildIso(nextMatch?.dateEvent, nextMatch?.strTime);

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
    const opp = ev.strHomeTeam === teamName ? ev.strAwayTeam : ev.strHomeTeam;
    const isHome = ev.strHomeTeam === teamName;
    const dateLabel = fmtDate(ev.dateEvent, ev.strTime);
    const time = ev.strTime ? ev.strTime.slice(0,5) : '—';
    const league = ev.strLeague || '—';
    const roundLabel = ev.intRound ? `J${ev.intRound}` : '';
    const isFirst = i === 0;
    return `<div class="upcoming-row${isFirst ? ' upcoming-row--next' : ''}">
  <div class="upcoming-date">
    <span class="upcoming-date-main">${dateLabel}</span>
    <span class="upcoming-date-time">${time}</span>
  </div>
  <div class="upcoming-match">
    <span class="upcoming-teams">${isHome ? `<strong>FCSM</strong> vs ${opp}` : `${opp} vs <strong>FCSM</strong>`}</span>
    <span class="upcoming-venue">${ev.strVenue || ''}</span>
  </div>
  <div class="upcoming-meta">
    <span class="match-league">🏆 ${league}</span>
    ${roundLabel ? `<span class="match-round">${roundLabel}</span>` : ''}
  </div>
</div>`;
  }).join('\n');
}

const upcomingHtml = buildUpcomingRows(teamAllNext);

const vars = {
  NEXT_MATCH_DATE:      nextMatch?.dateEvent   || '—',
  NEXT_MATCH_TIME:      nextMatch?.strTime      || '—',
  NEXT_MATCH_HOME_TEAM: nextMatch?.strHomeTeam  || '—',
  NEXT_MATCH_AWAY_TEAM: nextMatch?.strAwayTeam  || '—',
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
  LAST_5_FCSM_FORM:     formBadgesSummary(lastEvents, teamName),
  LAST_5_FCSM_1:        eventLineHtml(lastEvents[0], teamName),
  LAST_5_FCSM_2:        eventLineHtml(lastEvents[1], teamName),
  LAST_5_FCSM_3:        eventLineHtml(lastEvents[2], teamName),
  LAST_5_FCSM_4:        eventLineHtml(lastEvents[3], teamName),
  LAST_5_FCSM_5:        eventLineHtml(lastEvents[4], teamName),
  LAST_5_OPPONENT_FORM: formBadgesSummary(oppLastEvents, oppName),
  LAST_5_OPPONENT_1:    eventLineHtml(oppLastEvents[0], oppName),
  LAST_5_OPPONENT_2:    eventLineHtml(oppLastEvents[1], oppName),
  LAST_5_OPPONENT_3:    eventLineHtml(oppLastEvents[2], oppName),
  LAST_5_OPPONENT_4:    eventLineHtml(oppLastEvents[3], oppName),
  LAST_5_OPPONENT_5:    eventLineHtml(oppLastEvents[4], oppName),
  UPCOMING_MATCHES:     upcomingHtml,
};

const fill = (template, vs) => Object.entries(vs).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? '—'), template);
const srcHtml = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), fill(srcHtml, vars), 'utf8');
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify({
  teamName, oppName, teamRow, oppRow, nextMatch, nextMatchIso, nextEvents,
  ligue2Ready, lastEvents, oppLastEvents, formFCSM, formOpp,
  seasonSource, totalUpcoming: teamAllNext.length, totalSeason: seasonEvents.length,
  sampleNext: teamAllNext.slice(0,3).map(e => ({ date: e.dateEvent, home: e.strHomeTeam, away: e.strAwayTeam, league: e.strLeague })),
}, null, 2), 'utf8');

/* ICS : tous les matchs connus */
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
  const uid = `fcsm-${ev.idEvent || dt}-${ev.strHomeTeam || ''}`;
  if (seenUids.has(uid)) continue;
  seenUids.add(uid);
  const opp = ev.strHomeTeam === teamName ? ev.strAwayTeam : ev.strHomeTeam;
  const evOppRow = tableRows.find(r => r.strTeam === opp || r.nameTeam === opp) || {};
  const rankFCSM = teamRow?.intRank ? `(${teamRow.intRank})` : '';
  const rankOpp = evOppRow?.intRank ? `(${evOppRow.intRank})` : '';
  const roundLabel = ev.intRound ? ` J${ev.intRound}` : '';
  const leagueLabel = ev.strLeague ? ` [${ev.strLeague}]` : '';
  const isHome = ev.strHomeTeam === teamName;
  const summary = isHome
    ? `FCSM ${rankFCSM} - ${opp} ${rankOpp}${roundLabel}${leagueLabel}`
    : `${opp} ${rankOpp} - FCSM ${rankFCSM}${roundLabel}${leagueLabel}`;
  icsLines.push('BEGIN:VEVENT');
  icsLines.push(`UID:${uid}@ical-fcsm`);
  icsLines.push(`DTSTART:${dt}`);
  icsLines.push(`SUMMARY:${summary}`);
  icsLines.push(`DESCRIPTION:Forme FCSM : ${formFCSM} | Forme ${opp} : ${calcFormStr(oppLastEvents, opp)}`);
  icsLines.push(`LOCATION:${ev.strVenue || ''}`);
  if (ev.intHomeScore !== null && ev.intHomeScore !== undefined && ev.intHomeScore !== '') {
    icsLines.push(`X-SCORE:${ev.intHomeScore}-${ev.intAwayScore}`);
  }
  icsLines.push('END:VEVENT');
}
icsLines.push('END:VCALENDAR');
fs.writeFileSync(path.join(out, 'fcsm.ics'), icsLines.join('\r\n'), 'utf8');

console.log('✅ dist/ generated', {
  seasonSource, totalUpcoming: teamAllNext.length, totalSeason: seasonEvents.length,
  totalIcsEvents: allEventsForIcs.length, ligue2Ready, nextMatchIso,
  apiKey: API_KEY ? '✓ présente' : '✗ absente (mode dégradé)',
});
