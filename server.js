const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CLASIFICACIÓN FUTCAT
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

    const $ = cheerio.load(response.data);

    let rows = [];

    $("table tr").each((i, el) => {
      let cols = [];

      $(el).find("td,th").each((j, td) => {
        cols.push($(td).text().trim());
      });

      if (cols.length > 2) {
        rows.push(cols);
      }
    });

    res.json({
      ok: true,
      data: rows
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
  console.log("FUTCAT SCRAPER RUNNING ON PORT", PORT);
});
