const express = require("express");
const cors = require("cors");
const axios = require("axios");
const session = require("express-session");
const path = require("path");
const { google } = require("googleapis");

const app = express();

// ======================
// MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json());

app.use(session({
  secret: "futcat_secret_key",
  resave: false,
  saveUninitialized: true
}));

// ======================
// CONFIG
// ======================
const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ======================
// ADMIN SIMPLE
// ======================
const ADMIN = {
  user: "admin",
  pass: "futcat"
};

// ======================
// TEST ROOT (CRÍTICO)
// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT SERVER RUNNING ⚽"
  });
});

// ======================
// TEST API
// ======================
app.get("/test-api", (req, res) => {
  res.json({
    ok: true,
    status: "API OK ⚽"
  });
});

// ======================
// GOOGLE AUTH
// ======================
function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  if (creds.private_key) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }

  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

// ======================
// PARTIDOS
// ======================
app.get("/partidos", async (req, res) => {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const r = await axios.get(url);

    res.json({
      ok: true,
      data: r.data
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ======================
// CLASIFICACIÓN SIMPLE
// ======================
app.get("/clasificacion", async (req, res) => {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const r = await axios.get(url);

    const partidos = r.data;

    const table = {};

    const init = (team) => {
      if (!table[team]) {
        table[team] = {
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
      const l = p.local;
      const v = p.visitante;

      const gl = Number(p.goles_local);
      const gv = Number(p.goles_visitante);

      init(l);
      init(v);

      table[l].jugados++;
      table[v].jugados++;

      if (gl > gv) {
        table[l].ganados++;
        table[l].puntos += 3;
        table[v].perdidos++;
      } else if (gv > gl) {
        table[v].ganados++;
        table[v].puntos += 3;
        table[l].perdidos++;
      } else {
        table[l].empatados++;
        table[v].empatados++;
        table[l].puntos++;
        table[v].puntos++;
      }
    });

    res.json({
      ok: true,
      data: Object.values(table)
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ======================
// ADD PARTIDO
// ======================
app.post("/add-partido", async (req, res) => {
  try {
    const authClient = getAuth();
    const client = await authClient.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const { jornada, liga, local, visitante, goles_local, goles_visitante } = req.body;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "PARTIDOS!A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [[jornada, liga, local, visitante, goles_local, goles_visitante, "final"]]
      }
    });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ======================
// SERVER START
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT SERVER RUNNING ⚽");
});
