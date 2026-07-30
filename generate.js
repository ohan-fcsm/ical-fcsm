import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const API_KEY = process.env.THESPORTSDB_API_KEY || '';
const TEAM_ID_FCSM = process.env.TEAM_ID_FCSM || '133708';
const LEAGUE_ID = process.env.LEAGUE_ID || '4401';
const SEASON = process.env.SEASON || '2026-2027';

const out = path.join('dist');
fs.mkdirSync(out, { recursive: true });

// Copie du favicon dans dist/
if (fs.existsSync('favicon.svg')) {
  fs.copyFileSync('favicon.svg', path.join(out, 'favicon.svg'));
}

const ep = (p) => `https://www.thesportsdb.com/api/v1/json/${API_KEY}/${p}`;
const urls = {
  team:       ep(`lookupteam.php?id=${TEAM_ID_FCSM}`),
  last:       ep(`eventslast.php?id=${TEAM_ID_FCSM}`),
  nextLeague: ep(`eventsnextleague.php?id=${LEAGUE_ID}`),
  table:      ep(`lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`),
};

async function getJson(url) {
  if (!API_KEY) return null;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

function calcForm(events, teamName) {
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

const [teamData, lastData, nextData, tableData] = await Promise.all([
  getJson(urls.team),
  getJson(urls.last),
  getJson(urls.nextLeague),
  getJson(urls.table),
]);

const team        = teamData?.teams?.[0] || {};
const teamName    = team.strTeam || 'FCSM';
const lastEvents  = lastData?.results || lastData?.events || [];
const nextEvents  = nextData?.events || [];
const tableRows   = tableData?.table || tableData?.teams || [];

const nextMatch  = nextEvents.find(ev => ev.strHomeTeam === teamName || ev.strAwayTeam === teamName) || nextEvents[0] || null;
const oppName    = nextMatch ? (nextMatch.strHomeTeam === teamName ? nextMatch.strAwayTeam : nextMatch.strHomeTeam) : 'Adversaire';
const teamRow    = tableRows.find(r => r.strTeam === teamName || r.nameTeam === teamName) || {};
const oppRow     = tableRows.find(r => r.strTeam === oppName  || r.nameTeam === oppName)  || {};

const oppId = nextMatch
  ? (nextMatch.strAwayTeam === oppName ? nextMatch.idAwayTeam : nextMatch.idHomeTeam)
  : null;

let oppLastEvents = [];
if (oppId && API_KEY) {
  const od = await getJson(ep(`eventslast.php?id=${oppId}`));
  oppLastEvents = od?.results || od?.events || [];
}

const formFCSM = calcForm(lastEvents, teamName);
const formOpp  = calcForm(oppLastEvents, oppName);

const fill = (template, vars) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? '—'), template);

const vars = {
  NEXT_MATCH_DATE:      nextMatch?.dateEvent || '—',
  NEXT_MATCH_TIME:      nextMatch?.strTime || '—',
  NEXT_MATCH_HOME_TEAM: nextMatch?.strHomeTeam || '—',
  NEXT_MATCH_AWAY_TEAM: nextMatch?.strAwayTeam || '—',
  NEXT_MATCH_STATUS:    nextMatch?.strStatus || nextMatch?.strProgress || '—',
  NEXT_MATCH_VENUE:     nextMatch?.strVenue || '—',
  TEAM_RANK_FCSM:       teamRow?.intRank || teamRow?.rank || '—',
  TEAM_POINTS_FCSM:     teamRow?.intPoints || '—',
  TEAM_RANK_OPPONENT:   oppRow?.intRank || oppRow?.rank || '—',
  TEAM_POINTS_OPPONENT: oppRow?.intPoints || '—',
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

const srcHtml = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), fill(srcHtml, vars), 'utf8');
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify(
  { teamName, oppName, teamRow, oppRow, nextMatch, lastEvents, oppLastEvents, formFCSM, formOpp }, null, 2
), 'utf8');

// Génération ICS
const icsLines = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//FCSM//Calendar//FR',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
];

const fcsmMatches = nextEvents.filter(ev => ev.strHomeTeam === teamName || ev.strAwayTeam === teamName);
for (const ev of fcsmMatches) {
  const dateStr = (ev.dateEvent || '').replace(/-/g, '');
  const timeStr = (ev.strTime || '120000').replace(/:/g, '').slice(0, 6);
  const dt = `${dateStr}T${timeStr}Z`;
  const opp = ev.strHomeTeam === teamName ? ev.strAwayTeam : ev.strHomeTeam;
  const evOppRow = tableRows.find(r => r.strTeam === opp || r.nameTeam === opp) || {};
  const rankFCSM = teamRow?.intRank ? `(${teamRow.intRank})` : '';
  const rankOpp  = evOppRow?.intRank ? `(${evOppRow.intRank})` : '';
  const evForm   = calcForm(oppLastEvents, opp);
  icsLines.push('BEGIN:VEVENT');
  icsLines.push(`UID:fcsm-${ev.idEvent || dt}@ical-fcsm`);
  icsLines.push(`DTSTART:${dt}`);
  icsLines.push(`SUMMARY:FCSM ${rankFCSM} - ${opp} ${rankOpp}`);
  icsLines.push(`DESCRIPTION:Forme FCSM : ${formFCSM} | Forme ${opp} : ${evForm}`);
  icsLines.push(`LOCATION:${ev.strVenue || ''}`);
  icsLines.push('END:VEVENT');
}
icsLines.push('END:VCALENDAR');
fs.writeFileSync(path.join(out, 'fcsm.ics'), icsLines.join('\r\n'), 'utf8');

console.log('dist/ generated', {
  teamName, oppName, formFCSM, formOpp,
  events: fcsmMatches.length,
});
