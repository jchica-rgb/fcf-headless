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

// ======================
// SAFE JSON PARSE
// ======================
function safeJson(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

// ======================
// GOOGLE AUTH
// ======================
const GOOGLE_CREDS = safeJson(process.env.GOOGLE_CREDENTIALS);

let auth = null;

if (GOOGLE_CREDS) {
  auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
}

// ======================
// CACHE
// ======================
let cache = {
  clasificacion: {},
  lastUpdate: null
};

// ======================
// NORMALIZE
// ======================
function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

// ======================
// SHEETS CORE
// ======================
async function getSheet(range) {

  if (!auth || !SHEET_ID) {
    console.error("❌ Sheets no configurado");
    return [];
  }

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range
    });

    return res.data.values || [];

  } catch (e) {
    console.error("❌ ERROR SHEETS:", e.message);
    return [];
  }
}

// ======================
// LIGAS (DESDE SHEETS - REAL)
// ======================
app.get("/ligas", async (req, res) => {

  const rows = await getSheet("LIGAS!A2:B");

  const ligas = rows.map(r => ({
    id: r[0],
    nombre: r[1]
  }));

  res.json({
    data: ligas
  });
});

// ======================
// CLASIFICACION
// ======================
app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("CLASIFICACION!A2:G");

  const parsed = rows.map(r => ({
    liga: normalize(r[0]),
    equipo: r[1],
    puntos: Number(r[2] || 0),
    jugados: Number(r[3] || 0),
    ganados: Number(r[4] || 0),
    empatados: Number(r[5] || 0),
    perdidos: Number(r[6] || 0)
  }));

  const filtered = parsed.filter(r => r.liga === ligaId);

  const key = JSON.stringify(filtered);
  const old = cache.clasificacion[ligaId];

  let changed = false;

  if (key !== old) {
    cache.clasificacion[ligaId] = key;
    changed = true;

    cache.lastUpdate = new Date().toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  res.json({
    data: filtered,
    lastUpdate: cache.lastUpdate,
    changed
  });
});

// ======================
// PARTIDOS
// ======================
app.get("/partidos", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const parsed = rows.map(r => ({
    liga: normalize(r[0]),
    jornada: r[1],
    local: r[2],
    visitante: r[3],
    goles_local: r[4],
    goles_visitante: r[5]
  }));

  const filtered = parsed.filter(r => r.liga === ligaId);

  res.json({
    data: filtered
  });
});

// ======================
// HEALTH
// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT FULL SYSTEM RUNNING ⚽"
  });
});

// ======================
// START
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("⚽ FUTCAT SERVER RUNNING ON", PORT);
});
