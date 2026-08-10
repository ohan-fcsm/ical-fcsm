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
    const timeDisplay = `<span style="color:var(--muted)">${time}</span>`;
    const hiddenClass = i >= VISIBLE ? ' upcoming-row--hidden' : '';
    return `<div class="upcoming-row${i === 0 ? ' upcoming-row--next' : ''}${hiddenClass}" data-index="${i}">
  <div class="upcoming-date"><span class="upcoming-date-main">${dateLabel}</span>${timeDisplay}</div>
  <div class="upcoming-match"><span class="upcoming-teams">${teamsHtml}</span><span class="upcoming-venue">${ev.strVenue || ''}</span></div>
  <div class="upcoming-meta"><span class="match-league">🏆 ${league}</span>${roundLabel ? `<span class="match-round">${roundLabel}</span>` : ''}${hourglass}</div>
</div>`;
  });
  const hiddenCount = events.length - VISIBLE;
  const seeMoreBtn = events.length > VISIBLE
    ? `<button class="btn-see-more" onclick="toggleMatchList(this, ${events.length})" data-sect="upcoming">
  <span class="btn-see-more-label">Voir les ${hiddenCount} matchs suivants ▾</span>
</button>`
    : '';
