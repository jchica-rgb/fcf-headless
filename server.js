const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

function safeParse(v) {
  try { return JSON.parse(v); } catch { return null; }
}

const SHEET_ID = process.env.SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: safeParse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

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
// LIGAS (FIJO)
// ======================
app.get("/ligas", (req, res) => {
  res.json({
    data: [
      { id: "1", nombre: "Liga 1" },
      { id: "2", nombre: "Liga 2" },
      { id: "3", nombre: "Liga 3" }
    ]
  });
});

// ======================
// PARTIDOS (ESTO ES TU DATA REAL)
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

  const filtered = parsed.filter(r =>
    r.liga === ligaId
  );

  res.json({
    data: filtered
  });
});

// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT RUNNING ⚽"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("RUNNING ON", PORT);
});
