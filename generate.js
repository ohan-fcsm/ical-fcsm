import fs from 'fs';
import path from 'path';

let fetch;
try { fetch = (await import('node-fetch')).default; } catch { fetch = global.fetch; }

const API_KEY = process.env.THESPORTSDB_API_KEY || '';
const TEAM_ID_FCSM = process.env.TEAM_ID_FCSM || '133708';
const LEAGUE_ID = process.env.LEAGUE_ID || '4401';
const SEASON = process.env.SEASON || '2026-2027';

const out = path.join('dist');
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync('favicon.svg')) fs.copyFileSync('favicon.svg', path.join(out, 'favicon.svg'));
if (fs.existsSync('favicon-32.svg')) fs.copyFileSync('favicon-32.svg', path.join(out, 'favicon-32.svg'));

const ep = p => `https://www.thesportsdb.com/api/v1/json/${API_KEY}/${p}`;

async function getJson(url) {
  if (!API_KEY) {
    console.warn('⚠️  THESPORTSDB_API_KEY absent — mode dégradé (placeholders)');
    return null;
  }
  try {
    const r = await fetch(url);
    if (!r.ok) { console.error(`HTTP ${r.status} for ${url}`); return null; }
    return r.json();
  } catch (e) {
    console.error(`fetch error: ${e.message}`);
    return null;
  }
}

function calcForm(events, teamName) {
  if (!events || !events.length) return '—';
  return events.slice(0, 5).map(ev => {
    const hs = Number(ev.intHomeScore);
    const as = Number(ev.intAwayScore);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) return 'A';
    const isHome = ev.strHomeTeam === teamName;
    return isHome ? (hs > as ? 'V' : hs === as ? 'N' : 'D') : (as > hs ? 'V' : hs === as ? 'N' : 'D');
  }).join(' ');
}

function eventLine(ev) {
  if (!ev || !ev.strHomeTeam) return '—';
  return `${ev.dateEvent || ''} ${ev.strTime || ''} — ${ev.strHomeTeam} ${ev.intHomeScore ?? ''}-${ev.intAwayScore ?? ''} ${ev.strAwayTeam} (${ev.strStatus || ev.strProgress || ''})`;
}

function buildIso(dateEvent, strTime) {
  if (!dateEvent) return '';
  const time = strTime ? strTime.slice(0, 5) : '12:00';
  return `${dateEvent}T${time}:00Z`;
}

// Fetch all data (null-safe)
const [teamData, lastData, nextTeamData, nextLeagueData, tableData] = await Promise.all([
  getJson(ep(`lookupteam.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventslast.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventsnext.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventsnextleague.php?id=${LEAGUE_ID}`)),
  getJson(ep(`lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`)),
]);

const team = teamData?.teams?.[0] || {};
const teamName = team.strTeam || 'FC Sochaux-Montbéliard';
const lastEvents = lastData?.results || lastData?.events || [];
const tableRows = tableData?.table || tableData?.teams || [];
const leagueEvents = (nextLeagueData?.events || []).filter(ev => ev.strHomeTeam === teamName || ev.strAwayTeam === teamName);
const teamLigue2Events = (nextTeamData?.events || []).filter(ev => String(ev.idLeague) === String(LEAGUE_ID) || (ev.strLeague || '').toLowerCase().includes('ligue 2'));
const ligue2Ready = leagueEvents.length > 0 || teamLigue2Events.length > 0;
const nextEvents = leagueEvents.length > 0 ? leagueEvents : teamLigue2Events.length > 0 ? teamLigue2Events : (nextTeamData?.events || []);
const nextMatch = nextEvents[0] || null;
const oppName = nextMatch ? (nextMatch.strHomeTeam === teamName ? nextMatch.strAwayTeam : nextMatch.strHomeTeam) : 'Adversaire';
const teamRow = tableRows.find(r => r.strTeam === teamName || r.nameTeam === teamName) || {};
const oppRow = tableRows.find(r => r.strTeam === oppName || r.nameTeam === oppName) || {};

let oppLastEvents = [];
if (nextMatch && API_KEY) {
  const oppId = nextMatch.strAwayTeam === oppName ? nextMatch.idAwayTeam : nextMatch.idHomeTeam;
  if (oppId) {
    const od = await getJson(ep(`eventslast.php?id=${oppId}`));
    oppLastEvents = od?.results || od?.events || [];
  }
}

const formFCSM = calcForm(lastEvents, teamName);
const formOpp = calcForm(oppLastEvents, oppName);
const ligue2Banner = ligue2Ready ? '' : '<div class="banner-warning">⚠️ Calendrier Ligue 2 2026-2027 pas encore disponible — match amical affiché.</div>';
const round = nextMatch?.intRound ? `J${nextMatch.intRound}` : '—';
const nextMatchIso = buildIso(nextMatch?.dateEvent, nextMatch?.strTime);

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
  LAST_5_FCSM_FORM:     formFCSM,
  LAST_5_FCSM_1:        eventLine(lastEvents[0]),
  LAST_5_FCSM_2:        eventLine(lastEvents[1]),
  LAST_5_FCSM_3:        eventLine(lastEvents[2]),
  LAST_5_FCSM_4:        eventLine(lastEvents[3]),
  LAST_5_FCSM_5:        eventLine(lastEvents[4]),
  LAST_5_OPPONENT_FORM: formOpp,
  LAST_5_OPPONENT_1:    eventLine(oppLastEvents[0]),
  LAST_5_OPPONENT_2:    eventLine(oppLastEvents[1]),
  LAST_5_OPPONENT_3:    eventLine(oppLastEvents[2]),
  LAST_5_OPPONENT_4:    eventLine(oppLastEvents[3]),
  LAST_5_OPPONENT_5:    eventLine(oppLastEvents[4]),
};

const fill = (template, vs) =>
  Object.entries(vs).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? '—'), template);

const srcHtml = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), fill(srcHtml, vars), 'utf8');
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify({
  teamName, oppName, teamRow, oppRow, nextMatch, nextMatchIso,
  nextEvents, ligue2Ready, lastEvents, oppLastEvents, formFCSM, formOpp
}, null, 2), 'utf8');

// ICS
const icsLines = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'PRODID:-//FCSM//Calendar//FR',
  'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'
];
for (const ev of nextEvents) {
  const dateStr = (ev.dateEvent || '').replace(/-/g, '');
  const timeStr = (ev.strTime || '120000').replace(/:/g, '').slice(0, 6);
  const dt = `${dateStr}T${timeStr}Z`;
  const opp = ev.strHomeTeam === teamName ? ev.strAwayTeam : ev.strHomeTeam;
  const evOppRow = tableRows.find(r => r.strTeam === opp || r.nameTeam === opp) || {};
  const rankFCSM = teamRow?.intRank ? `(${teamRow.intRank})` : '';
  const rankOpp = evOppRow?.intRank ? `(${evOppRow.intRank})` : '';
  const evForm = calcForm(oppLastEvents, opp);
  const roundLabel = ev.intRound ? ` J${ev.intRound}` : '';
  icsLines.push('BEGIN:VEVENT');
  icsLines.push(`UID:fcsm-${ev.idEvent || dt}@ical-fcsm`);
  icsLines.push(`DTSTART:${dt}`);
  icsLines.push(`SUMMARY:FCSM ${rankFCSM} - ${opp} ${rankOpp}${roundLabel}`);
  icsLines.push(`DESCRIPTION:Forme FCSM : ${formFCSM} | Forme ${opp} : ${evForm}`);
  icsLines.push(`LOCATION:${ev.strVenue || ''}`);
  icsLines.push('END:VEVENT');
}
icsLines.push('END:VCALENDAR');
fs.writeFileSync(path.join(out, 'fcsm.ics'), icsLines.join('\r\n'), 'utf8');

console.log('✅ dist/ generated', {
  teamName, oppName, formFCSM, formOpp,
  ligue2Ready, nextMatchIso,
  leagueEvents: leagueEvents.length,
  teamLigue2Events: teamLigue2Events.length,
  totalNextEvents: nextEvents.length,
  apiKey: API_KEY ? '✓ présente' : '✗ absente (mode dégradé)',
});
