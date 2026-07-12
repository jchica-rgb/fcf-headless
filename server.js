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
// SAFE PARSE
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
const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);

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
  return String(v || "").trim().toLowerCase();
}

// ======================
// READ SHEET
// ======================
async function getSheet(range) {
  try {
    if (!auth || !SHEET_ID) return [];

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range
    });

    return res.data.values || [];
  } catch (e) {
    console.error("SHEETS ERROR:", e.message);
    return [];
  }
}

// ======================
// LIGAS (DESDE SHEETS)
// Hoja: LIGAS
// A = id
// B = nombre
// ======================
app.get("/ligas", async (req, res) => {

  const rows = await getSheet("LIGAS!A2:B");

  const data = rows.map(r => ({
    id: r[0],
    nombre: r[1]
  }));

  res.json({ data });
});

// ======================
// PARTIDOS (DESDE SHEETS)
// Hoja: PARTIDOS
// A liga
// B jornada
// C local
// D visitante
// E goles_local
// F goles_visitante
// ======================
app.get("/partidos", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const data = rows.map(r => ({
    liga: normalize(r[0]),
    jornada: r[1],
    local: r[2],
    visitante: r[3],
    goles_local: Number(r[4] || 0),
    goles_visitante: Number(r[5] || 0)
  }));

  const filtered = data.filter(p => p.liga === ligaId);

  res.json({ data: filtered });
});

// ======================
// CLASIFICACIÓN (AUTOMÁTICA)
// ======================
app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const partidos = rows.map(r => ({
    liga: normalize(r[0]),
    local: r[2],
    visitante: r[3],
    gl: Number(r[4] || 0),
    gv: Number(r[5] || 0)
  }));

  const filtered = partidos.filter(p => p.liga === ligaId);

  const tabla = {};

  function init(team) {
    if (!tabla[team]) {
      tabla[team] = {
        equipo: team,
        puntos: 0,
        jugados: 0,
        ganados: 0,
        empatados: 0,
        perdidos: 0
      };
    }
  }

  filtered.forEach(p => {

    init(p.local);
    init(p.visitante);

    tabla[p.local].jugados++;
    tabla[p.visitante].jugados++;

    if (p.gl > p.gv) {
      tabla[p.local].ganados++;
      tabla[p.visitante].perdidos++;
      tabla[p.local].puntos += 3;
    }

    if (p.gl < p.gv) {
      tabla[p.visitante].ganados++;
      tabla[p.local].perdidos++;
      tabla[p.visitante].puntos += 3;
    }

    if (p.gl === p.gv) {
      tabla[p.local].empatados++;
      tabla[p.visitante].empatados++;
      tabla[p.local].puntos++;
      tabla[p.visitante].puntos++;
    }
  });

  const result = Object.values(tabla).sort((a, b) => b.puntos - a.puntos);

  res.json({ data: result });
});

// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT RUNNING ⚽"
  });
});

// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON", PORT);
});
