const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CONFIG
// ============================
const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ============================
// HELPERS
// ============================
function normalizeTeam(t) {
  return {
    liga: (t.liga || "").toString().trim(),
    equipo: (t.equipo || "").toString().trim(),
    puntos: Number(t.puntos || 0),
    jugados: Number(t.jugados || 0),
    ganados: Number(t.ganados || 0),
    empatados: Number(t.empatados || 0),
    perdidos: Number(t.perdidos || 0),
    gf: Number(t.gf || 0),
    gc: Number(t.gc || 0)
  };
}

// ============================
// CLASIFICACIÓN
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/EQUIPOS`;

    const response = await axios.get(url);

    let data = response.data;

    // normalizar datos
    data = data.map(normalizeTeam);

    // filtro robusto (A PRUEBA DE ERRORES)
    if (liga) {
      const ligaClean = liga.toString().trim().toLowerCase();

      data = data.filter(t =>
        (t.liga || "").toString().trim().toLowerCase() === ligaClean
      );
    }

    // ordenar por puntos
    data.sort((a, b) => b.puntos - a.puntos);

    // ranking final
    const result = data.map((t, i) => ({
      position: i + 1,
      liga: t.liga,
      equipo: t.equipo,
      puntos: t.puntos,
      jugados: t.jugados,
      ganados: t.ganados,
      empatados: t.empatados,
      perdidos: t.perdidos,
      gf: t.gf,
      gc: t.gc
    }));

    res.json({
      ok: true,
      source: "google-sheets",
      count: result.length,
      data: result
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================
// PARTIDOS
// ============================
app.get("/partidos", async (req, res) => {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;

    const response = await axios.get(url);

    let data = response.data;

    const liga = req.query.liga;
    const jornada = req.query.jornada;

    if (liga) {
      const ligaClean = liga.toString().trim().toLowerCase();

      data = data.filter(p =>
        (p.liga || "").toString().trim().toLowerCase() === ligaClean
      );
    }

    if (jornada) {
      data = data.filter(p =>
        (p.jornada || "").toString().trim() === jornada.toString().trim()
      );
    }

    res.json({
      ok: true,
      source: "google-sheets",
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
  console.log("FUTCAT ENGINE RUNNING ⚽");
});
