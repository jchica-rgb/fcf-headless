const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CLASIFICACIÓN SOFASCORE
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const tournamentId = req.query.id;

    if (!tournamentId) {
      return res.status(400).json({
        ok: false,
        error: "Falta tournament id"
      });
    }

    const url = `https://api.sofascore.com/api/v1/tournament/${tournamentId}/standings`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = response.data;

    // simplificamos salida para FutCat
    const standings = [];

    const groups = data?.standings || [];

    for (const group of groups) {
      for (const row of group.rows || []) {
        standings.push({
          team: row.team?.name,
          points: row.points,
          played: row.matches,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses
        });
      }
    }

    res.json({
      ok: true,
      source: "sofascore",
      tournamentId,
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT API READY (SOFASCORE MODE)");
});
