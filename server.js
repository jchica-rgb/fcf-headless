const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

/* ======================
   USERS
====================== */

const USERS = [
  { user: "admin", pass: "admin123", role: "admin" },
  { user: "editor", pass: "editor123", role: "editor" }
];

const TOKENS = new Set();

/* ======================
   SHEETS CONFIG
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

async function getClient() {
  return await authGoogle.getClient();
}

/* ======================
   HELPERS
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

  TOKENS.add(token);

  res.json({
    ok: true,
    token,
    role: found.role
  });
});

/* ======================
   AUTH
====================== */

function auth(req, res, next) {

  const token = req.headers.authorization;

  if (!token || !TOKENS.has(token)) {
    return res.status(403).json({ ok: false, message: "No autorizado" });
  }

  next();
}

/* ======================
   SHEETS READ
====================== */

async function getSheet(range) {

  if (!authGoogle || !SHEET_ID) return [];

  const client = await getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  return res.data.values || [];
}

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
   EQUIPOS (FIX REAL SEGÚN TU SHEET)
   A = id
   B = nombre
   C = liga
====================== */

app.get("/equipos", async (req, res) => {

  try {

    const liga = normalize(req.query.liga);

    const rows = await getSheet("EQUIPOS!A2:C");

    const data = rows
      .filter(r =>
        r &&
        r.length >= 3 &&
        normalize(r[2]) === liga
      )
      .map(r => r[1]);

    res.json({ data });

  } catch (err) {

    console.error("ERROR /equipos:", err);
    res.json({ data: [] });
  }
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

  const result = Object.values(tabla).sort(
    (a, b) => b.puntos - a.puntos || a.equipo.localeCompare(b.equipo)
  );

  res.json({
    data: result,
    lastUpdate: Date.now()
  });
});

/* ======================
   GUARDAR PARTIDO
====================== */

app.post("/partido", auth, async (req, res) => {

  try {

    const {
      liga,
      jornada,
      local,
      visitante,
      goles_local,
      goles_visitante
    } = req.body;

    const client = await getClient();
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

    console.error("ERROR /partido:", err);
    res.status(500).json({ ok: false });
  }
});

/* ======================
   HEALTH
====================== */

app.get("/", (req, res) => {
  res.send("FUTCAT SERVER OK ⚽");
});

/* ======================
   START
====================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING", PORT);
});
