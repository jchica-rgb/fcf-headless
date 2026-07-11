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
// ROOT
// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FCF HEADLESS ONLINE ⚽"
  });
});

// ======================
// TEST
// ======================
app.get("/test-api", (req, res) => {
  res.json({ ok: true });
});

// ======================
// LIGAS DINÁMICAS ⭐ NUEVO
// ======================
app.get("/ligas", async (req, res) => {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const r = await axios.get(url);

    const ligas = [...new Set(r.data.map(p => p.liga))];

    res.json({
      ok: true,
      data: ligas
    });

  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// ======================
// PARTIDOS
// ======================
app.get("/partidos", async (req, res) => {

  try {

    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const r = await axios.get(url);

    let data = r.data;

    if (liga && liga !== "") {
      data = data.filter(p => String(p.liga) === String(liga));
    }

    res.json({
      ok: true,
      data
    });

  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// ======================
// CLASIFICACIÓN
// ======================
app.get("/clasificacion", async (req, res) => {

  try {

    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const r = await axios.get(url);

    let partidos = r.data;

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

      const l = p.local;
      const v = p.visitante;

      const gl = Number(p.goles_local);
      const gv = Number(p.goles_visitante);

      init(l);
      init(v);

      table[l].jugados++;
      table[v].jugados++;

      if (gl > gv) {
        table[l].ganados++;
        table[l].puntos += 3;
        table[v].perdidos++;
      } else if (gv > gl) {
        table[v].ganados++;
        table[v].puntos += 3;
        table[l].perdidos++;
      } else {
        table[l].empatados++;
        table[v].empatados++;
        table[l].puntos++;
        table[v].puntos++;
      }
    });

    res.json({
      ok: true,
      data: Object.values(table)
    });

  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// ======================
// START
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FCF HEADLESS RUNNING ⚽");
});
