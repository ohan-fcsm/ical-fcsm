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
  'Red Star FC':             '135467',
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
/* Les URLs sont des candidates par ordre de priorité ; ensureBadge tente la 1ʳᵉ qui répond. */
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
    'https://upload.wikimedia.org/wikipedia/fr/d/d4/AS_Saint-%C3%89tienne_logo.svg',
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
};

/* ── Date de build (heure Europe/Paris) ── */
function buildTimestamp() {
  const now = new Date();
  const opts = { timeZone: 'Europe/Paris', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('fr-FR', opts).format(now);
}
const LAST_UPDATED = buildTimestamp();

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

const [teamData, lastData, seasonData, nextTeamData, tableData] = await Promise.all([
  getJson(ep(`lookupteam.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventslast.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`eventsseason.php?id=${TEAM_ID_FCSM}&s=${SEASON}`)),
  getJson(ep(`eventsnext.php?id=${TEAM_ID_FCSM}`)),
  getJson(ep(`lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`)),
]);

const team = teamData?.teams?.[0] || {};
const teamName = team.strTeam || TEAM_NAME_FALLBACK;
/* override en priorité pour ne pas dépendre de la clé API */
const teamBadgeUrls = BADGE_OVERRIDES[normTeam(teamName)] || [team.strTeamBadge || team.strBadge || ''];
const teamBadgeRemote = teamBadgeUrls[0] || '';
const lastEvents = lastData?.results || lastData?.events || [];
const tableRows = tableData?.table || tableData?.teams || [];
const today = new Date().toISOString().slice(0, 10);

const calendarTeamsBadges = await Promise.all(
  Object.entries(TEAM_IDS).map(async ([name, id]) => {
    const overrideUrls = BADGE_OVERRIDES[normTeam(name)];
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
const LIGUE2_SCHEDULE = [
  /* J1  */ { dateEvent:'2026-08-08', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'AS Saint-Étienne',         idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'1',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J2  */ { dateEvent:'2026-08-15', strTime:'20:45:00', strHomeTeam:'Red Star FC',              strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'2',  strVenue:'Stade Bauer',                _hardcoded:true },
  /* J3  */ { dateEvent:'2026-08-21', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'EN Avant Guingamp',        idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'3',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J4  */ { dateEvent:'2026-08-28', strTime:'20:45:00', strHomeTeam:'Clermont Foot 63',         strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'4',  strVenue:'Stade Gabriel Montpied',     _hardcoded:true },
  /* J5  */ { dateEvent:'2026-09-04', strTime:'20:45:00', strHomeTeam:'Pau FC',                   strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'5',  strVenue:'Nouste Camp',                _hardcoded:true },
  /* J6  */ { dateEvent:'2026-09-11', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Nantes',                idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'6',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J7  */ { dateEvent:'2026-09-18', strTime:'20:45:00', strHomeTeam:'Stade Lavallois MFC',      strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'7',  strVenue:'Stade Francis Le Basser',    _hardcoded:true },
  /* J8  */ { dateEvent:'2026-10-09', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'US Boulogne CO',           idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'8',  strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J9  */ { dateEvent:'2026-10-16', strTime:'20:45:00', strHomeTeam:'FC Metz',                  strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'9',  strVenue:'Stade Saint-Symphorien',     _hardcoded:true },
  /* J10 */ { dateEvent:'2026-10-23', strTime:'20:45:00', strHomeTeam:'FC Annecy',                strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'10', strVenue:'Parc des Sports',            _hardcoded:true },
  /* J11 */ { dateEvent:'2026-10-30', strTime:'20:45:00', strHomeTeam:'Stade de Reims',           strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'11', strVenue:'Stade Auguste Delaune',      _hardcoded:true },
  /* J12 */ { dateEvent:'2026-11-06', strTime:'20:45:00', strHomeTeam:'AS Nancy Lorraine',        strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'12', strVenue:'Stade Marcel Picot',         _hardcoded:true },
  /* J13 */ { dateEvent:'2026-11-20', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'USL Dunkerque',            idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'13', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J14 */ { dateEvent:'2026-12-04', strTime:'20:45:00', strHomeTeam:'Dijon FCO',                strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'14', strVenue:'Stade Gaston Gérard',        _hardcoded:true },
  /* J15 */ { dateEvent:'2026-12-11', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Montpellier Hérault SC',   idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'15', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J16 */ { dateEvent:'2027-01-02', strTime:'20:45:00', strHomeTeam:'Grenoble Foot 38',         strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'16', strVenue:'Stade des Alpes',            _hardcoded:true },
  /* J17 */ { dateEvent:'2027-01-15', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Rodez Aveyron Football',   idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'17', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J18 */ { dateEvent:'2027-01-22', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'US Boulogne CO',           idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'18', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J19 */ { dateEvent:'2027-01-29', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Pau FC',                   idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'19', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J20 */ { dateEvent:'2027-02-05', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Annecy',                idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'20', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J21 */ { dateEvent:'2027-02-12', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Dijon FCO',                idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'21', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J22 */ { dateEvent:'2027-02-19', strTime:'20:45:00', strHomeTeam:'AS Saint-Étienne',         strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'22', strVenue:'Stade Geoffroy-Guichard',    _hardcoded:true },
  /* J23 */ { dateEvent:'2027-02-26', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Stade de Reims',           idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'23', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J24 */ { dateEvent:'2027-03-05', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Metz',                  idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'24', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J25 */ { dateEvent:'2027-03-12', strTime:'20:45:00', strHomeTeam:'Rodez Aveyron Football',   strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'25', strVenue:'Stade Paul Lignon',          _hardcoded:true },
  /* J26 */ { dateEvent:'2027-03-19', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'AS Nancy Lorraine',        idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'26', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J27 */ { dateEvent:'2027-04-02', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'FC Nantes',                idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'27', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J28 */ { dateEvent:'2027-04-09', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Red Star FC',              idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'28', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J29 */ { dateEvent:'2027-04-16', strTime:'20:45:00', strHomeTeam:'Montpellier Hérault SC',   strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'29', strVenue:'Stade de la Mosson',         _hardcoded:true },
  /* J30 */ { dateEvent:'2027-04-23', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Stade Lavallois MFC',      idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'30', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J31 */ { dateEvent:'2027-04-30', strTime:'20:45:00', strHomeTeam:'USL Dunkerque',            strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'31', strVenue:'Stade Marcel Tribut',        _hardcoded:true },
  /* J32 */ { dateEvent:'2027-05-07', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Clermont Foot 63',         idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'32', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J33 */ { dateEvent:'2027-05-14', strTime:'20:45:00', strHomeTeam:FCSM,                       strAwayTeam:'Grenoble Foot 38',         idHomeTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'33', strVenue:'Stade Auguste Bonal',        _hardcoded:true },
  /* J34 */ { dateEvent:'2027-05-22', strTime:'20:45:00', strHomeTeam:'EN Avant Guingamp',        strAwayTeam:FCSM, idAwayTeam:TEAM_ID_FCSM, strLeague:'French Ligue 2', intRound:'34', strVenue:'Stade du Roudourou',         _hardcoded:true },
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

function isSameMatch(a, b) {
  if (a.dateEvent !== b.dateEvent) return false;
  const ah = normTeam(a.strHomeTeam), aa = normTeam(a.strAwayTeam);
  const bh = normTeam(b.strHomeTeam), ba = normTeam(b.strAwayTeam);
  if (ah === bh && aa === ba) return true;
  const contains = (x, y) => x.includes(y) || y.includes(x);
  return contains(ah, bh) && contains(aa, ba);
}

for (const hev of LIGUE2_SCHEDULE.filter(ev => ev.dateEvent >= today)) {
  const apiMatch = teamAllNext.find(ev => isSameMatch(ev, hev));
  if (!apiMatch) {
    teamAllNext.push({ ...hev, _hardcoded: true });
  } else if (apiMatch && (!apiMatch.strTime || apiMatch.strTime === '00:00:00') && hev.strTime) {
    apiMatch.strTime = hev.strTime;
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
  const overrideBadgeUrls = BADGE_OVERRIDES[normTeam(oppName)];
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
  /* Sans clé API : récupérer quand même le badge adversaire depuis les overrides */
  const knownOpp = calendarTeamsBadges.find(t => normTeam(t.name) === normTeam(oppName));
  if (knownOpp) oppBadgeRemote = knownOpp.badgeUrl;
  const overrideBadgeUrls = BADGE_OVERRIDES[normTeam(oppName)];
  if (overrideBadgeUrls) oppBadgeRemote = overrideBadgeUrls[0];
}

const allBadgesToEnsure = [
  { name: teamName, urls: BADGE_OVERRIDES[normTeam(teamName)] || [teamBadgeRemote] },
  ...calendarTeamsBadges.map(t => ({ name: t.name, urls: t.badgeUrls })),
];
if (oppBadgeRemote && !allBadgesToEnsure.find(t => normTeam(t.name) === normTeam(oppName))) {
  const overrideUrls = BADGE_OVERRIDES[normTeam(oppName)];
  allBadgesToEnsure.push({ name: oppName, urls: overrideUrls || [oppBadgeRemote] });
}

const logoResults = await Promise.all(
  allBadgesToEnsure.map(async ({ name, urls }) => {
    const slug = slugify(name);
    const localUrl = await ensureBadgeWithFallbacks(urls, slug);
    return [normTeam(name), localUrl];
  })
);
const logos = Object.fromEntries(logoResults.filter(([, url]) => url));
console.log(`🎨 Logos dispos: ${Object.keys(logos).length}/${allBadgesToEnsure.length}`);

const formFCSM = calcFormStr(lastEvents, teamName);
const formOpp  = calcFormStr(oppLastEvents, oppName);
const ligue2Banner = ligue2Ready ? '' : '<div class="banner-warning">La Ligue 2 2026-2027 démarre le 8 août — les prochains matchs sont des amicaux</div>';
const round = nextMatch?.intRound ? `J${nextMatch.intRound}` : '—';
const nextMatchIso = buildIso(nextMatch?.dateEvent, nextMatch?.strTime);
const nextMatchUnconfirmed = nextMatch?._hardcoded === true;

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

const UNCONFIRMED_PILL = `<span title="Date et heure à confirmer" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;color:#B98900;background:rgba(255,207,33,.15);border:1px solid rgba(255,207,33,.5);border-radius:999px;padding:2px 8px;white-space:nowrap;flex-shrink:0">⏳ À confirmer</span>`;

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
    const unconfirmedPill = ev._hardcoded ? UNCONFIRMED_PILL : '';
    const timeDisplay = `<span style="color:var(--muted)">${time}</span>`;
    return `<div class="upcoming-row${i === 0 ? ' upcoming-row--next' : ''}">
  <div class="upcoming-date"><span class="upcoming-date-main">${dateLabel}</span>${timeDisplay}</div>
  <div class="upcoming-match"><span class="upcoming-teams">${teamsHtml}</span><span class="upcoming-venue">${ev.strVenue || ''}</span></div>
  <div class="upcoming-meta"><span class="match-league">🏆 ${league}</span>${roundLabel ? `<span class="match-round">${roundLabel}</span>` : ''}${unconfirmedPill}</div>
</div>`;
  }).join('\n');
}

const upcomingHtml = buildUpcomingRows(teamAllNext);

const vars = {
  NEXT_MATCH_DATE:       nextMatch?.dateEvent   || '—',
  NEXT_MATCH_TIME:       (nextMatch?.strTime || '—') + (nextMatchUnconfirmed ? ' ⏳' : ''),
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
  const unconfirmedLabel = ev._hardcoded ? ' ⏳' : '';
  const summary = isHome
    ? `FCSM ${rankFCSM} - ${opp}${roundLabel}${leagueLabel}${unconfirmedLabel}`
    : `${opp} - FCSM ${rankFCSM}${roundLabel}${leagueLabel}${unconfirmedLabel}`;
  const description = ev._hardcoded
    ? `Forme FCSM : ${formFCSM}\\nDate et heure à confirmer — source : calendrier LFP officiel`
    : `Forme FCSM : ${formFCSM}`;
  icsLines.push(
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${dt}`,
    `SUMMARY:${summary}`, `DESCRIPTION:${description}`,
    `LOCATION:${ev.strVenue || ''}`,
  );
  if (ev.intHomeScore != null && ev.intHomeScore !== '') icsLines.push(`X-SCORE:${ev.intHomeScore}-${ev.intAwayScore}`);
  icsLines.push('END:VEVENT');
}
icsLines.push('END:VCALENDAR');
fs.writeFileSync(path.join(out, 'fcsm.ics'), icsLines.join('\r\n'), 'utf8');

console.log('✅ Build OK', { seasonSource, upcoming: teamAllNext.length, logos: Object.keys(logos).length, lastUpdated: LAST_UPDATED, apiKey: API_KEY ? '✓' : '✗' });
