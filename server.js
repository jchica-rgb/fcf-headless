const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ======================
// CONFIG
// ======================
const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ======================
// ROOT TEST
// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FCF HEADLESS RUNNING ⚽"
  });
});

// ======================
// TEST API
// ======================
app.get("/test-api", (req, res) => {
  res.json({
    ok: true,
    status: "API OK ⚽"
  });
});

// ======================
// PARTIDOS (CON FILTRO LIGA)
// ======================
app.get("/partidos", async (req, res) => {

  try {

    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let data = response.data;

    // 🔥 FILTRO POR LIGA
    if (liga && liga !== "") {
      data = data.filter(p => String(p.liga) === String(liga));
    }

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

// ======================
// CLASIFICACIÓN (REAL)
// ======================
app.get("/clasificacion", async (req, res) => {

  try {

    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let partidos = response.data;

    // 🔥 FILTRO POR LIGA
    if (liga && liga !== "") {
      partidos = partidos.filter(p => String(p.liga) === String(liga));
    }

    const table = {};

    const init = (team) => {
      if (!table[team]) {
        table[team] = {
          equipo: team,
          puntos: 0,
          jugados: 0,
          ganados: 0,
          empatados: 0,
          perdidos: 0
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

      table[local].jugados++;
      table[visitante].jugados++;

      if (gl > gv) {
        table[local].ganados++;
        table[local].puntos += 3;
        table[visitante].perdidos++;
      } else if (gv > gl) {
        table[visitante].ganados++;
        table[visitante].puntos += 3;
        table[local].perdidos++;
      } else {
        table[local].empatados++;
        table[visitante].empatados++;
        table[local].puntos++;
        table[visitante].puntos++;
      }
    });

    res.json({
      ok: true,
      data: Object.values(table)
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ======================
// ADD PARTIDO (ADMIN)
// ======================
app.post("/add-partido", async (req, res) => {

  try {

    const { jornada, liga, local, visitante, goles_local, goles_visitante } = req.body;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;

    // ⚠️ ESTE ENDPOINT SOLO FUNCIONA SI TIENES WRITE (Sheets API o backend)
    // Lo dejamos preparado para futura versión PRO

    res.json({
      ok: true,
      msg: "Endpoint listo (requiere integración Google Sheets API para escritura)",
      data: req.body
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FCF HEADLESS RUNNING ⚽ PORT:", PORT);
});
