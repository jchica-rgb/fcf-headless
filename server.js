const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const SHEET_ID = process.env.SHEET_ID || "";

// ======================
function safeJson(v) {
  try { return JSON.parse(v); } catch { return null; }
}

const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);

const auth = credentials
  ? new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    })
  : null;

// ======================
function normalize(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ======================
async function getSheet(range) {
  if (!auth || !SHEET_ID) return [];

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  return res.data.values || [];
}

// ======================
app.get("/ligas", async (req, res) => {

  const rows = await getSheet("LIGAS!A2:B");

  res.json({
    data: rows.map(r => ({
      id: normalize(r[0]),
      nombre: r[1]
    }))
  });
});

// ======================
app.get("/partidos", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const data = rows
    .filter(r => r && r.length >= 6)
    .map(r => ({
      liga: normalize(r[0]),
      local: normalize(r[2]),
      visitante: normalize(r[3]),
      goles_local: Number(r[4] || 0),
      goles_visitante: Number(r[5] || 0)
    }))
    .filter(p => p.liga === ligaId);

  res.json({ data });
});

// ======================
// 🔥 CLASIFICACIÓN FLASHCORE FIX REAL
// ======================
const historyByLiga = {};

app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const partidos = rows
    .filter(r => r && r.length >= 6)
    .map(r => ({
      liga: normalize(r[0]),
      local: normalize(r[2]),
      visitante: normalize(r[3]),
      gl: Number(r[4] || 0),
      gv: Number(r[5] || 0)
    }))
    .filter(p => p.liga === ligaId);

  const tabla = {};

  const init = (t) => {
    if (!tabla[t]) {
      tabla[t] = {
        equipo: t,
        puntos: 0,
        jugados: 0,
        ganados: 0,
        empatados: 0,
        perdidos: 0
      };
    }
  };

  partidos.forEach(p => {

    init(p.local);
    init(p.visitante);

    tabla[p.local].jugados++;
    tabla[p.visitante].jugados++;

    if (p.gl > p.gv) {
      tabla[p.local].ganados++;
      tabla[p.local].puntos += 3;
      tabla[p.visitante].perdidos++;
    } else if (p.gl < p.gv) {
      tabla[p.visitante].ganados++;
      tabla[p.visitante].puntos += 3;
      tabla[p.local].perdidos++;
    } else {
      tabla[p.local].empatados++;
      tabla[p.visitante].empatados++;
      tabla[p.local].puntos++;
      tabla[p.visitante].puntos++;
    }
  });

  let result = Object.values(tabla);

  result.sort((a, b) =>
    b.puntos - a.puntos || a.equipo.localeCompare(b.equipo)
  );

  // ======================
  // 🔥 MOVIMIENTO REAL CORRECTO
  const prev = historyByLiga[ligaId] || {};

  const indexMapPrev = prev.indexMap || {};

  result = result.map((t, i) => {

    let movement = "same";

    if (indexMapPrev[t.equipo] !== undefined) {
      if (i < indexMapPrev[t.equipo]) movement = "up";
      else if (i > indexMapPrev[t.equipo]) movement = "down";
    }

    return {
      ...t,
      pos: i + 1,
      movement
    };
  });

  // ======================
  // SNAPSHOT CORRECTO
  historyByLiga[ligaId] = {
    indexMap: Object.fromEntries(
      result.map((t, i) => [t.equipo, i])
    )
  };

  res.json({
    data: result,
    lastUpdate: Date.now()
  });
});

// ======================
app.listen(process.env.PORT || 3000, () => {
  console.log("FLASHCORE PRO RUNNING ⚽");
});
