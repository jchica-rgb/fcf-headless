const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CLASIFICACIÓN SOFASCORE FIX 403
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Falta id"
      });
    }

    const url = `https://api.sofascore.com/api/v1/tournament/${id}/standings`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://www.sofascore.com/",
        "Origin": "https://www.sofascore.com"
      }
    });

    const data = response.data;

    let standings = [];

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
      data: standings
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
      detail: err.response?.status
    });
  }
});

// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT SOFASCORE FIX RUNNING");
});
