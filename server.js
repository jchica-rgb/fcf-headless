const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// SPORTMONKS - CLASIFICACIÓN
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const leagueId = req.query.league;
    const seasonId = req.query.season;

    if (!leagueId || !seasonId) {
      return res.status(400).json({
        ok: false,
        error: "Falta league o season"
      });
    }

    const url = `https://api.sportmonks.com/v3/football/standings?api_token=${process.env.SPORTMONKS_KEY}&league_id=${leagueId}&season_id=${seasonId}`;

    const response = await axios.get(url);

    const data = response.data.data;

    let standings = [];

    data.forEach(group => {
      group.standings.forEach(team => {
        standings.push({
          position: team.position,
          team: team.participant?.name,
          points: team.points,
          played: team.played,
          won: team.won,
          draw: team.draw,
          lost: team.lost,
          goalsFor: team.goals_for,
          goalsAgainst: team.goals_against
        });
      });
    });

    res.json({
      ok: true,
      source: "sportmonks",
      data: standings
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
      detail: err.response?.data
    });
  }
});

// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT SPORTMONKS RUNNING");
});
