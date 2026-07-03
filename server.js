const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ============================
// CLASIFICACIÓN FUTCAT
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/EQUIPOS`;

    const response = await axios.get(url);

    let data = response.data;

    if (liga) {
      data = data.filter(t => t.liga == liga);
    }

    data.sort((a, b) => Number(b.puntos) - Number(a.puntos));

    const result = data.map((t, i) => ({
      position: i + 1,
      ...t
    }));

    res.json({
      ok: true,
      source: "google-sheets",
      data: result
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT SHEETS RUNNING");
});
