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
// MAPA DE LIGAS (NORMALIZADO)
// ============================
const LIGAS = {
  "1": "Lliga Elit",
  "2": "Primera Catalana",
  "3": "Segunda Catalana",
  "4": "Tercera Catalana",
  "5": "1RFEF",
  "6": "2RFEF",
  "7": "3RFEF"
};

// ============================
// NORMALIZADOR
// ============================
function normalizeTeam(t) {
  return {
    liga: String(t.liga || "").trim(),
    equipo: String(t.equipo || "").trim(),
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

    let data = response.data.map(normalizeTeam);

    // filtro por ID de liga (ESTABLE)
    if (liga) {
      data = data.filter(t => t.liga === String(liga));
    }

    // ordenar por puntos
    data.sort((a, b) => b.puntos - a.puntos);

    // ranking final
    const result = data.map((t, i) => ({
      position: i + 1,
      liga: LIGAS[t.liga] || t.liga,
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
      data = data.filter(p => String(p.liga || "").trim() === String(liga));
    }

    if (jornada) {
      data = data.filter(p => String(p.jornada || "").trim() === String(jornada));
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
// HEALTH CHECK
// ============================
app.get("/test-api", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT ENGINE RUNNING ⚽"
  });
});

// ============================
// SERVER
// ============================
const PORT = process.env.PORT || 3000;

// ============================
// MOTOR PRO: CLASIFICACIÓN AUTOMÁTICA
// ============================
app.get("/clasificacion-auto", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let partidos = response.data;

    // filtro liga
    if (liga) {
      partidos = partidos.filter(p => String(p.liga) === String(liga));
    }

    const tabla = {};

    const init = (team) => {
      if (!tabla[team]) {
        tabla[team] = {
          equipo: team,
          puntos: 0,
          jugados: 0,
          ganados: 0,
          empatados: 0,
          perdidos: 0,
          gf: 0,
          gc: 0
        };
      }
    };

    partidos.forEach(p => {
      const local = p.local;
      const visitante = p.visitante;

      const gl = Number(p.goles_local);
      const gv = Number(p.goles_visitante);

      init(local);
      init(visitante);

      tabla[local].jugados++;
      tabla[visitante].jugados++;

      tabla[local].gf += gl;
      tabla[local].gc += gv;

      tabla[visitante].gf += gv;
      tabla[visitante].gc += gl;

      if (gl > gv) {
        tabla[local].ganados++;
        tabla[local].puntos += 3;
        tabla[visitante].perdidos++;
      } else if (gl < gv) {
        tabla[visitante].ganados++;
        tabla[visitante].puntos += 3;
        tabla[local].perdidos++;
      } else {
        tabla[local].empatados++;
        tabla[visitante].empatados++;
        tabla[local].puntos += 1;
        tabla[visitante].puntos += 1;
      }
    });

    const result = Object.values(tabla)
      .sort((a, b) => b.puntos - a.puntos)
      .map((t, i) => ({
        position: i + 1,
        liga: liga || "all",
        ...t
      }));

    res.json({
      ok: true,
      source: "auto-engine",
      data: result
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log("FUTCAT ENGINE RUNNING ⚽");
});
