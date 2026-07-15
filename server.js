const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

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

const normalize = v =>
  String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

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
   EQUIPOS
====================== */

app.get("/equipos", async (req, res) => {

  const liga = normalize(req.query.liga);

  const rows = await getSheet("EQUIPOS!A2:C");

  res.json({
    data: rows
      .filter(r => normalize(r[2]) === liga)
      .map(r => r[1])
  });
});

/* ======================
   PARTIDOS LISTA
====================== */

app.get("/partidos", async (req, res) => {

  const liga = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const data = rows.map((r, i) => ({
    id: i + 2,
    liga: normalize(r[0]),
    jornada: r[1],
    local: r[2],
    visitante: r[3],
    goles_local: Number(r[4] || 0),
    goles_visitante: Number(r[5] || 0)
  })).filter(p => p.liga === liga);

  res.json({ data });
});

/* ======================
   CLASIFICACION
====================== */

app.get("/clasificacion", async (req, res) => {

  const liga = normalize(req.query.liga);

  const rows = await getSheet("PARTIDOS!A2:F");

  const partidos = rows
    .map(r => ({
      liga: normalize(r[0]),
      local: r[2],
      visitante: r[3],
      gl: Number(r[4] || 0),
      gv: Number(r[5] || 0)
    }))
    .filter(p => p.liga === liga);

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

  const result = Object.values(tabla);

  result.sort((a, b) =>
    b.puntos - a.puntos || a.equipo.localeCompare(b.equipo)
  );

  res.json({
    data: result,
    lastUpdate: Date.now()
  });
});

/* ======================
   CREAR PARTIDO
====================== */

app.post("/partido", async (req, res) => {

  try {

    const { liga, jornada, local, visitante, goles_local, goles_visitante } = req.body;

    const client = await getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "PARTIDOS!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[liga, jornada, local, visitante, goles_local, goles_visitante]]
      }
    });

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

/* ======================
   🔥 UPDATE PARTIDO (LO QUE TE FALTABA)
====================== */

app.post("/partido/update", async (req, res) => {

  try {

    const { row, liga, jornada, local, visitante, goles_local, goles_visitante } = req.body;

    const client = await getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `PARTIDOS!A${row}:F${row}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[liga, jornada, local, visitante, goles_local, goles_visitante]]
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
  console.log("SERVER OK ⚽", PORT);
});
