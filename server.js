const express = require("express");
const cors = require("cors");
const http = require("http");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// 🔐 USERS (LOGIN SYSTEM)
const USERS = [
  { user: "admin", pass: "admin123", role: "admin" },
  { user: "editor", pass: "editor123", role: "editor" }
];

// sesiones simples en memoria
const SESSIONS = new Map();

// ======================
// AUTH MIDDLEWARE
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token || !SESSIONS.has(token)) {
    return res.status(403).json({ ok: false, message: "No autorizado" });
  }

  req.user = SESSIONS.get(token);
  next();
}

// ======================
// CONFIG SHEETS
const SHEET_ID = process.env.SHEET_ID || "";

function safeJson(v) {
  try { return JSON.parse(v); } catch { return null; }
}

const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);

const authGoogle = credentials
  ? new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    })
  : null;

// ======================
// SHEETS
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

// ======================
// NORMALIZE
function normalize(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ======================
// 🔐 LOGIN ENDPOINT
app.post("/login", (req, res) => {

  const { user, pass } = req.body;

  const found = USERS.find(u =>
    u.user === user && u.pass === pass
  );

  if (!found) {
    return res.status(401).json({
      ok: false,
      message: "Credenciales incorrectas"
    });
  }

  const token = Buffer.from(user + ":" + Date.now()).toString("base64");

  SESSIONS.set(token, {
    user: found.user,
    role: found.role
  });

  res.json({
    ok: true,
    token,
    role: found.role,
    user: found.user
  });
});

// ======================
// 🟢 LIGAS (SIN CAMBIOS)
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
// 🟢 PARTIDOS (SIN CAMBIOS)
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
// 🟢 CLASIFICACION (SIN CAMBIOS)
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

  res.json({
    data: result,
    lastUpdate: Date.now()
  });
});

// ======================
// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("FUTCAT SERVER WITH LOGIN ⚽🔐");
});

// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING WITH LOGIN ⚽");
});
