const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ======================
// SHEETS IDS
// ======================
const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ======================
// ROOT
// ======================
app.get("/", (req, res) => {
  res.json({ ok: true, status: "FUTCAT SHEETS SYSTEM RUNNING ⚽" });
});

// ======================
// LIGAS (DINÁMICO)
// ======================
app.get("/ligas", async (req, res) => {

  try {

    const r = await axios.get(`https://opensheet.elk.sh/${SHEET_ID}/LIGAS`);

    res.json({
      ok: true,
      data: r.data
    });

  } catch (err) {
    res.status(500).json({ ok: false });
  }

});

// ======================
// EQUIPOS
// ======================
app.get("/equipos", async (req, res) => {

  try {

    const r = await axios.get(`https://opensheet.elk.sh/${SHEET_ID}/EQUIPOS`);

    res.json({
      ok: true,
      data: r.data
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

    let r = await axios.get(`https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`);

    let data = r.data;

    if (liga) {
      data = data.filter(p => p.liga == liga);
    }

    res.json({ ok: true, data });

  } catch (err) {
    res.status(500).json({ ok: false });
  }

});

// ======================
// CLASIFICACION
// ======================
app.get("/clasificacion", async (req, res) => {

  try {

    const liga = req.query.liga;

    const r = await axios.get(`https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`);
    let partidos = r.data;

    if (liga) {
      partidos = partidos.filter(p => p.liga == liga);
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

    const result = Object.values(table).sort((a,b)=>b.puntos - a.puntos);

    res.json({ ok: true, data: result });

  } catch (err) {
    res.status(500).json({ ok: false });
  }

});

// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT SHEETS SYSTEM RUNNING ⚽");
});
