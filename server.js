const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const session = require("express-session");
const { google } = require("googleapis");

const app = express();

// ============================
// MIDDLEWARE
// ============================
app.use(cors());
app.use(express.json());

app.use(session({
  secret: "futcat-production-key",
  resave: false,
  saveUninitialized: true
}));

// ============================
// CONFIG
// ============================
const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ============================
// ADMIN
// ============================
const ADMIN = {
  user: "admin",
  pass: "futcat2026"
};

// ============================
// CLEAN DATA
// ============================
function clean(obj) {
  const out = {};
  Object.keys(obj).forEach(k => {
    out[k.toLowerCase().trim()] = obj[k];
  });
  return out;
}

// ============================
// GOOGLE AUTH
// ============================
function getAuth() {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) throw new Error("Missing GOOGLE_CREDENTIALS");

  const creds = JSON.parse(raw);

  if (creds.private_key) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }

  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

// ============================
// TEST API (CRÍTICO)
// ============================
app.get("/test-api", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT PRODUCTION RUNNING ⚽"
  });
});

// ============================
// LOGIN
// ============================
app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { user, pass } = req.body;

  if (user === ADMIN.user && pass === ADMIN.pass) {
    req.session.auth = true;
    return res.redirect("/admin");
  }

  res.send("Login incorrecto");
});

function auth(req, res, next) {
  if (req.session.auth) return next();
  res.redirect("/login");
}

// ============================
// FRONT
// ============================
app.get("/admin", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// ============================
// PARTIDOS
// ============================
app.get("/partidos", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const r = await axios.get(url);

    let data = r.data.map((p, i) => ({
      id: i + 2,
      ...clean(p)
    }));

    if (liga) {
      data = data.filter(x => String(x.liga) === String(liga));
    }

    res.json({ ok: true, data });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================
// CLASIFICACIÓN
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const r = await axios.get(url);

    let partidos = r.data.map(clean);

    if (liga) {
      partidos = partidos.filter(p => String(p.liga) === String(liga));
    }

    const table = {};

    const init = (team) => {
      if (!table[team]) {
        table[team] = {
          equipo: team,
          puntos: 0,
          jugados: 0,
          ganados: 0,
          empatados: 0,
          perdidos: 0,
          gf: 0,
          gc: 0
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

      table[l].gf += gl;
      table[l].gc += gv;

      table[v].gf += gv;
      table[v].gc += gl;

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

// ============================
// ADD PARTIDO
// ============================
app.post("/add-partido", auth, async (req, res) => {
  try {
    const { jornada, liga, local, visitante, goles_local, goles_visitante } = req.body;

    const authClient = getAuth();
    const client = await authClient.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

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

// ============================
// SERVER START
// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT RUNNING ⚽");
});
