const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// TEST CONEXIÓN API-FOOTBALL
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
      error: err.message
    });
  }
});

// ============================
// CLASIFICACIÓN API-FOOTBALL
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const response = await axios.get(
      "https://v3.football.api-sports.io/standings",
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        },
        params: {
          league: 140,   // LaLiga (ejemplo)
          season: 2024
        }
      }
    );

    const data = response.data.response;

    res.json({
      ok: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================
// SERVER
// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT API RUNNING ON PORT", PORT);
});
