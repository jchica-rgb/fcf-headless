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
// MAPA DE LIGAS
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
// LIMPIEZA DE KEYS (ANTI-ERRORES SHEETS)
// ============================
function cleanKey(obj) {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    cleaned[key.trim().toLowerCase()] = obj[key];
  });
  return cleaned;
}

// ============================
// CLASIFICACIÓN (SOLO AUTOMÁTICA)
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let partidos = response.data.map(cleanKey);

    // filtro liga
    if (liga) {
      partidos = partidos.filter(p =>
        String(p.liga).trim() === String(liga).trim()
      );
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
        liga: LIGAS[liga] || liga,
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

// ============================
// PARTIDOS (RAW)
// ============================
app.get("/partidos", async (req, res) => {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    const data = response.data.map(cleanKey);

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
// TEST
// ============================
app.get("/test-api", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT ENGINE RUNNING ⚽"
  });
});

// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT ENGINE RUNNING ⚽");
});
