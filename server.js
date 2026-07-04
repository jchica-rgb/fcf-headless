const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CONFIG
// ============================
const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ============================
// STATIC ADMIN PANEL
// ============================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ============================
// HELPERS
// ============================
function cleanKey(obj) {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    cleaned[key.trim().toLowerCase()] = obj[key];
  });
  return cleaned;
}

// ============================
// CLASIFICACIÓN AUTOMÁTICA
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let partidos = response.data.map(cleanKey);

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
// PARTIDOS (LECTURA)
// ============================
app.get("/partidos", async (req, res) => {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    const data = response.data.map(cleanKey);

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
// AÑADIR PARTIDO (ADMIN)
// ============================
app.post("/add-partido", async (req, res) => {
  try {
    const { liga, local, visitante, goles_local, goles_visitante } = req.body;

    const url = `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`;

    await axios.post(url, {
      liga,
      local,
      visitante,
      goles_local,
      goles_visitante,
      estado: "final"
    });

    res.json({
      ok: true,
      message: "Partido guardado"
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
