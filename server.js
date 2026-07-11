const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const session = require("express-session");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// SESIÓN
// ============================
app.use(session({
  secret: "futcat-pro-2026",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
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
// FRONT
// ============================
app.get("/login", (req, res) => {
  res.send(`
    <html>
      <body style="background:#111;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial;">
        <form method="POST" action="/login">
          <h2>FutCat Login</h2>
          <input name="user" placeholder="Usuario"><br><br>
          <input name="pass" type="password" placeholder="Contraseña"><br><br>
          <button>Entrar</button>
        </form>
      </body>
    </html>
  `);
});

app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { user, pass } = req.body;

  if (user === ADMIN.user && pass === ADMIN.pass) {
    req.session.auth = true;
    return res.redirect("/admin");
  }

  res.send("Login incorrecto");
});

function checkAuth(req, res, next) {
  if (req.session.auth) return next();
  return res.redirect("/login");
}

// ============================
// PÁGINAS
// ============================
app.get("/admin", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// ============================
// CLEAN DATA
// ============================
function cleanKey(obj) {
  const cleaned = {};
  Object.keys(obj).forEach(k => {
    cleaned[k.trim().toLowerCase()] = obj[k];
  });
  return cleaned;
}

// ============================
// GOOGLE AUTH
// ============================
function getGoogleAuth() {
  const raw = process.env.GOOGLE_CREDENTIALS;

  if (!raw) throw new Error("NO GOOGLE_CREDENTIALS");

  const creds = JSON.parse(raw);

  if (creds.private_key) {
    creds.private_key = creds.private_key
      .replace(/\\n/g, "\n")
      .replace(/\r/g, "");
  }

  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

// ============================
// PARTIDOS (FILTRADO POR LIGA)
// ============================
app.get("/partidos", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let data = response.data.map((p, i) => ({
      id: i + 2,
      ...cleanKey(p)
    }));

    if (liga && liga !== "") {
      data = data.filter(p => String(p.liga) === String(liga));
    }

    res.json({ ok: true, data });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================
// CLASIFICACIÓN (FILTRADA POR LIGA)
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let partidos = response.data.map(cleanKey);

    if (liga && liga !== "") {
      partidos = partidos.filter(p => String(p.liga) === String(liga));
    }

    const tabla = {};

    const init = (t) => {
      if (!tabla[t]) {
        tabla[t] = {
          equipo: t,
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

      tabla[l].jugados++;
      tabla[v].jugados++;

      tabla[l].gf += gl;
      tabla[l].gc += gv;

      tabla[v].gf += gv;
      tabla[v].gc += gl;

      if (gl > gv) {
        tabla[l].ganados++;
        tabla[l].puntos += 3;
        tabla[v].perdidos++;
      } else if (gl < gv) {
        tabla[v].ganados++;
        tabla[v].puntos += 3;
        tabla[l].perdidos++;
      } else {
        tabla[l].empatados++;
        tabla[v].empatados++;
        tabla[l].puntos++;
        tabla[v].puntos++;
      }
    });

    res.json({
      ok: true,
      data: Object.values(tabla)
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================
// GUARDAR PARTIDO
// ============================
app.post("/add-partido", checkAuth, async (req, res) => {
  try {
    const { jornada, liga, local, visitante, goles_local, goles_visitante } = req.body;

    const gl = Number(goles_local);
    const gv = Number(goles_visitante);

    if (!jornada || !liga || !local || !visitante) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    if (isNaN(gl) || isNaN(gv)) {
      return res.status(400).json({ ok: false, error: "Goles inválidos" });
    }

    const auth = getGoogleAuth();
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "PARTIDOS!A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [[jornada, liga, local, visitante, gl, gv, "final"]]
      }
    });

    res.json({ ok: true, message: "Partido guardado" });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================
// EDITAR PARTIDO
// ============================
app.post("/edit-partido", checkAuth, async (req, res) => {
  try {
    const { row, jornada, liga, local, visitante, goles_local, goles_visitante } = req.body;

    const gl = Number(goles_local);
    const gv = Number(goles_visitante);

    const auth = getGoogleAuth();
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `PARTIDOS!A${row}:G${row}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[jornada, liga, local, visitante, gl, gv, "final"]]
      }
    });

    res.json({ ok: true, message: "Actualizado" });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================
// BORRAR PARTIDO
// ============================
app.post("/delete-partido", checkAuth, async (req, res) => {
  try {
    const { row } = req.body;

    const auth = getGoogleAuth();
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: row - 1,
              endIndex: row
            }
          }
        }]
      }
    });

    res.json({ ok: true, message: "Eliminado" });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================
app.get("/test-api", (req, res) => {
  res.json({ ok: true, status: "FUTCAT PRO RUNNING ⚽" });
});

// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("FUTCAT PRO RUNNING ⚽");
});
