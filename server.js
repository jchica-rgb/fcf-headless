const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CLASIFICACIÓN (DIAGNÓSTICO WEB)
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

    // 🔍 detectar posible Next.js / JSON embebido
    const hasNextData = html.includes("__NEXT_DATA__");
    const hasJsonLd = html.includes("application/ld+json");

    // 🧪 intentar extraer JSON embebido si existe
    let nextData = null;

    if (hasNextData) {
      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/
      );

      if (match && match[1]) {
        try {
          nextData = JSON.parse(match[1]);
        } catch (e) {
          nextData = "ERROR parsing JSON";
        }
      }
    }

    res.json({
      ok: true,
      url,
      analysis: {
        length: html.length,
        hasNextData,
        hasJsonLd
      },
      nextData
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
  console.log("FUTCAT SCRAPER DIAGNOSTIC RUNNING");
});
