const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

/* ======================
   USERS LOGIN
====================== */

const USERS = [
  { user: "admin", pass: "admin123", role: "admin" },
  { user: "editor", pass: "editor123", role: "editor" }
];

const SESSIONS = new Map();

/* ======================
   AUTH
====================== */

function auth(req, res, next) {

  const token = req.headers.authorization;

  if (!token || !SESSIONS.has(token)) {
    return res.status(403).json({ ok: false });
  }

  req.user = SESSIONS.get(token);
  next();
}

/* ======================
   GOOGLE SHEETS CONFIG
====================== */

function safeJson(v) {
  try { return JSON.parse(v); } catch { return null; }
}

const SHEET_ID = process.env.SHEET_ID || "";
const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);

const authGoogle = credentials
  ? new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    })
  : null;

/* ======================
   SHEETS HELPER
====================== */

async function getSheet(range) {

  if (!authGoogle || !SHEET_ID) return [];

  const client = await authGoogle.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  return res.data.values || [];
}

/* ======================
   NORMALIZE
====================== */

const normalize = v =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/* ======================
   LOGIN
====================== */

app.post("/login", (req, res) => {

  const { user, pass } = req.body;

  const found = USERS.find(u => u.user === user && u.pass === pass);

  if (!found) {
    return res.status(401).json({ ok: false });
  }

  const token = Buffer.from(user + Date.now()).toString("base64");

  SESSIONS.set(token, found);

  res.json({
    ok: true,
    token,
    role: found.role,
    user: found.user
  });
});

/* ======================
   LIGAS
====================== */

app.get("/ligas", async (req, res) => {

  const rows = await getSheet("LIGAS!A2:B");

  res.json({
    data: rows.map(r => ({
      id: normalize(r[0]),
      nombre: r[1]
    }))
  });
});

/* ======================
   PARTIDOS
====================== */

app.get("/partidos", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const data = rows
    .map(r => ({
      liga: normalize(r[0]),
      jornada: r[1],
      local: r[2],
      visitante: r[3],
      goles_local: Number(r[4] || 0),
      goles_visitante: Number(r[5] || 0)
    }))
    .filter(p => p.liga === ligaId);

  res.json({ data });
});

/* ======================
   CLASIFICACION
====================== */

app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const partidos = rows
    .map(r => ({
      liga: normalize(r[0]),
      local: r[2],
      visitante: r[3],
      gl: Number(r[4] || 0),
      gv: Number(r[5] || 0)
    }))
    .filter(p => p.liga === ligaId);

  const table = {};

  const init = (t) => {
    if (!table[t]) {
      table[t] = {
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

    table[p.local].jugados++;
    table[p.visitante].jugados++;

    if (p.gl > p.gv) {
      table[p.local].ganados++;
      table[p.local].puntos += 3;
      table[p.visitante].perdidos++;
    } else if (p.gl < p.gv) {
      table[p.visitante].ganados++;
      table[p.visitante].puntos += 3;
      table[p.local].perdidos++;
    } else {
      table[p.local].empatados++;
      table[p.visitante].empatados++;
      table[p.local].puntos++;
      table[p.visitante].puntos++;
    }
  });

  const result = Object.values(table).sort(
    (a,b) => b.puntos - a.puntos || a.equipo.localeCompare(b.equipo)
  );

  res.json({
    data: result,
    lastUpdate: Date.now()
  });
});

/* ======================
   GUARDAR PARTIDO (ADMIN REAL)
====================== */

app.post("/partido", auth, async (req, res) => {

  try {

    const { liga, jornada, local, visitante, goles_local, goles_visitante } = req.body;

    const client = await authGoogle.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "PARTIDOS!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          liga,
          jornada,
          local,
          visitante,
          goles_local,
          goles_visitante
        ]]
      }
    });

    res.json({ ok: true });

  } catch (err) {

    console.error(err);

    res.status(500).json({ ok: false });
  }
});

/* ======================
   SERVER
====================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER OK ON PORT", PORT);
});
