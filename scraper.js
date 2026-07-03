function parseStandings(apiResponse) {
  const standings = [];

  const leagues = apiResponse?.response || [];

  leagues.forEach((leagueData) => {
    const groups = leagueData?.league?.standings || [];

    groups.forEach((group) => {
      group.forEach((team) => {
        standings.push({
          position: team.rank,
          team: team.team.name,
          points: team.points,
          played: team.all.played,
          win: team.all.win,
          draw: team.all.draw,
          lose: team.all.lose,
          goalsFor: team.all.goals.for,
          goalsAgainst: team.all.goals.against
        });
      });
    });
  });

  return standings;
}

module.exports = { parseStandings };
