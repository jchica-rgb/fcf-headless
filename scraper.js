const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CLASIFICACIÓN FUTCAT (JSON-LD SCRAPER)
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "Falta URL"
      });
    }

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = response.data;

    // ============================
    // EXTRAER JSON-LD
    // ============================
    const jsonLdMatches = [
      ...html.matchAll(
        /<script type="application\/ld\+json">(.*?)<\/script>/gs
      )
    ];

    let jsonLdData = [];

    for (const match of jsonLdMatches) {
      try {
        jsonLdData.push(JSON.parse(match[1]));
      } catch (e) {
        // ignoramos errores de parseo
      }
    }

    // ============================
    // RESPUESTA FINAL
    // ============================
    res.json({
      ok: true,
      source: url,
      found: jsonLdData.length,
      data: jsonLdData
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
  console.log("FUTCAT JSON-LD SCRAPER RUNNING ON", PORT);
});
