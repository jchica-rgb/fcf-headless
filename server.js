const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// CONFIG
// ======================
const SHEET_ID = process.env.SHEET_ID || "";

// 🔥 ESTADO PARA FLECHAS (NO ROMPE NADA)
let lastTable = [];

// ======================
// SAFE JSON
// ======================
function safeJson(v) {
  try { return JSON.parse(v); } catch { return null; }
}

const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);

// ======================
// AUTH GOOGLE
// ======================
const auth = credentials
  ? new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    })
  : null;

// ======================
// NORMALIZE
// ======================
function normalize(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ======================
// GET SHEET
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
// LIGAS
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
// PARTIDOS
// ======================
app.get("/partidos", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const data = rows
    .filter(r => r && r.length >= 6)
    .map(r => ({
      liga: normalize(r[0]),
      jornada: r[1],
      local: (r[2] || "").trim(),
      visitante: (r[3] || "").trim(),
      goles_local: Number(r[4] || 0),
      goles_visitante: Number(r[5] || 0)
    }))
    .filter(p => p.liga === ligaId);

  res.json({ data });
});

// ======================
// CLASIFICACION (🔥 CON FLECHAS OK)
// ======================
app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const partidos = rows
    .filter(r => r && r.length >= 6)
    .map(r => ({
      liga: normalize(r[0]),
      local: (r[2] || "").trim(),
      visitante: (r[3] || "").trim(),
      gl: Number(r[4] || 0),
      gv: Number(r[5] || 0)
    }))
    .filter(p => p.liga === ligaId);

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
        movement: null
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

  // 🔥 ORDEN FIJO
  result.sort((a, b) =>
    b.puntos - a.puntos || a.equipo.localeCompare(b.equipo)
  );

  // ======================
  // 🔥 FLECHAS (COMPARACIÓN ENTRE REFRESHES)
  // ======================
  const prevIndex = new Map();

  lastTable.forEach((t, i) => {
    prevIndex.set(t.equipo, i);
  });

  result.forEach((t, i) => {

    const old = prevIndex.get(t.equipo);

    if (old !== undefined) {
      if (old > i) t.movement = "up";
      else if (old < i) t.movement = "down";
      else t.movement = null;
    } else {
      t.movement = null;
    }
  });

  // actualizar estado global
  lastTable = result.map(t => ({ ...t }));

  res.json({
    data: result,
    lastUpdate: Date.now()
  });
});

// ======================
// HEALTH CHECK
// ======================
app.get("/", (req, res) => {
  res.send("FUTCAT SERVER OK ⚽");
});

// ======================
// START
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT SERVER RUNNING ⚽");
});
