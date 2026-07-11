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
// SAFE GOOGLE AUTH
// ======================
function safeJsonParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

const GOOGLE_CREDS = safeJsonParse(process.env.GOOGLE_CREDENTIALS);

let auth = null;

if (GOOGLE_CREDS) {
  try {
    auth = new google.auth.GoogleAuth({
      credentials: GOOGLE_CREDS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });
  } catch (e) {
    console.error("❌ GOOGLE AUTH ERROR:", e.message);
  }
}

// ======================
// CACHE
// ======================
let cache = {
  data: {},
  lastUpdate: null
};

// ======================
// HELPERS
// ======================
function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

// ======================
// SHEETS READER
// ======================
async function getSheet(range) {

  if (!auth || !SHEET_ID) {
    console.error("❌ SHEETS NOT CONFIGURED");
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
    console.error("❌ SHEETS ERROR:", e.message);
    return [];
  }
}

// ======================
// LIGAS
// ======================
app.get("/ligas", (req, res) => {

  res.json({
    data: [
      { id: "1", nombre: "Liga Elit" },
      { id: "2", nombre: "Primera Catalana" },
      { id: "3", nombre: "Segona Catalana" }
    ]
  });

});

// ======================
// CLASIFICACION
// ======================
app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("Clasificacion!A2:G");

  const parsed = rows.map(r => ({
    liga: r[0],
    equipo: r[1],
    puntos: Number(r[2] || 0),
    jugados: Number(r[3] || 0),
    ganados: Number(r[4] || 0),
    empatados: Number(r[5] || 0),
    perdidos: Number(r[6] || 0)
  }));

  const filtered = parsed.filter(r =>
    normalize(r.liga) === ligaId
  );

  const key = JSON.stringify(filtered);

  const changed = cache.data[ligaId] !== key;

  if (changed) {
    cache.data[ligaId] = key;

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

  const rows = await getSheet("Partidos!A2:E");

  const parsed = rows.map(r => ({
    liga: r[0],
    local: r[1],
    goles_local: r[2],
    goles_visitante: r[3],
    visitante: r[4]
  }));

  const filtered = parsed.filter(r =>
    normalize(r.liga) === ligaId
  );

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
    status: "FUTCAT LIVE SERVER OK ⚽"
  });
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("⚽ FUTCAT SERVER RUNNING ON PORT", PORT);
});
