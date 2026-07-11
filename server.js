const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// SAFE PARSE (CLAVE)
// ======================
function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

// ======================
// ENV VARS PROTEGIDAS
// ======================
const SHEET_ID = process.env.SHEET_ID || "";

// ⚠️ evita crash si variable no existe
const GOOGLE_CREDS = safeJsonParse(process.env.GOOGLE_CREDENTIALS, null);

// ======================
// GOOGLE AUTH SAFE
// ======================
let auth = null;

try {
  if (GOOGLE_CREDS) {
    auth = new google.auth.GoogleAuth({
      credentials: GOOGLE_CREDS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });
  }
} catch (e) {
  console.error("❌ ERROR GOOGLE AUTH:", e.message);
}

// ======================
// CACHE
// ======================
let cache = {
  clasificacion: {},
  partidos: {},
  lastUpdate: null
};

// ======================
// NORMALIZADOR
// ======================
function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

// ======================
// SHEETS HELPER
// ======================
async function getSheet(range) {

  if (!auth || !SHEET_ID) {
    console.warn("⚠️ Sheets no configurado");
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

  const newKey = JSON.stringify(filtered);
  const oldKey = cache.clasificacion[ligaId];

  let changed = false;

  if (newKey !== oldKey) {
    cache.clasificacion[ligaId] = newKey;
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
// DEBUG (CLAVE PARA TI AHORA)
// ======================
app.get("/debug", (req, res) => {
  res.json({
    ok: true,
    sheet: SHEET_ID ? "SET" : "MISSING",
    google: auth ? "READY" : "NOT READY"
  });
});

// ======================
// HEALTH
// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT SERVER RUNNING ⚽"
  });
});

// ======================
// START (PROTEGIDO)
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("⚽ SERVER RUNNING ON PORT", PORT);
});
