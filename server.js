const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CLASIFICACIÓN API-FOOTBALL
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const league = req.query.league || 140; // default LaLiga
    const season = req.query.season || 2024;

    const response = await axios.get(
      "https://v3.football.api-sports.io/standings",
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        },
        params: {
          league,
          season
        }
      }
    );

    const raw = response.data.response;

    const standings = [];

    raw.forEach((leagueData) => {
      leagueData.league.standings.forEach((group) => {
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

    res.json({
      ok: true,
      league,
      season,
      data: standings
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================
// TEST API KEY
// ============================
app.get("/test-api", async (req, res) => {
  try {
    const response = await axios.get(
      "https://v3.football.api-sports.io/status",
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT API-FOOTBALL RUNNING");
});
