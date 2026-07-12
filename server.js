const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

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
async function getSheet(range) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  return res.data.values || [];
}

// ======================
function normalize(v) {
  return String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// ======================
// CALCULAR CLASIFICACIÓN
function buildClasificacion(rows, ligaId) {

  const partidos = rows
    .filter(r => r && r.length >= 6)
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

  let result = Object.values(tabla);

  result.sort((a, b) =>
    b.puntos - a.puntos || a.equipo.localeCompare(b.equipo)
  );

  return result;
}

// ======================
// LOOP LIVE (CORE)
async function liveLoop() {

  if (!auth) return;

  const rows = await getSheet("PARTIDOS!A2:F");

  const ligas = ["lliga-elit", "primera", "segona"]; // ejemplo

  ligas.forEach(ligaId => {

    const clasificacion = buildClasificacion(rows, ligaId);

    io.emit("clasificacion", {
      liga: ligaId,
      data: clasificacion
    });
  });

  io.emit("heartbeat", { time: Date.now() });
}

// cada 5 segundos
setInterval(liveLoop, 5000);

// ======================
io.on("connection", (socket) => {
  console.log("cliente conectado live");
});

// ======================
server.listen(3000, () => {
  console.log("LIVE SERVER RUNNING ⚽🔥");
});
