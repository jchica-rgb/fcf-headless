const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CONFIG
// ============================
const SHEET_ID = "1TI0XHtFjFoC7NFbDBQ_2GdgrqxUAIOXP61eL55RPrC8";

// ============================
// ADMIN PANEL
// ============================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ============================
// CLEAN KEYS
// ============================
function cleanKey(obj) {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    cleaned[key.trim().toLowerCase()] = obj[key];
  });
  return cleaned;
}

// ============================
// GOOGLE AUTH (FIX JWT SAFE)
// ============================
function getGoogleAuth() {
  const raw = process.env.GOOGLE_CREDENTIALS;

  if (!raw) {
    throw new Error("GOOGLE_CREDENTIALS no configurado");
  }

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
// CLASIFICACIÓN
// ============================
app.get("/clasificacion", async (req, res) => {
  try {
    const liga = req.query.liga;

    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    let partidos = response.data.map(cleanKey);

    if (liga) {
      partidos = partidos.filter(p =>
        String(p.liga).trim() === String(liga).trim()
      );
    }

    const tabla = {};

    const init = (team) => {
      if (!tabla[team]) {
        tabla[team] = {
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
      const local = p.local;
      const visitante = p.visitante;

      const gl = Number(p.goles_local);
      const gv = Number(p.goles_visitante);

      init(local);
      init(visitante);

      tabla[local].jugados++;
      tabla[visitante].jugados++;

      tabla[local].gf += gl;
      tabla[local].gc += gv;

      tabla[visitante].gf += gv;
      tabla[visitante].gc += gl;

      if (gl > gv) {
        tabla[local].ganados++;
        tabla[local].puntos += 3;
        tabla[visitante].perdidos++;
      } else if (gl < gv) {
        tabla[visitante].ganados++;
        tabla[visitante].puntos += 3;
        tabla[local].perdidos++;
      } else {
        tabla[local].empatados++;
        tabla[visitante].empatados++;
        tabla[local].puntos += 1;
        tabla[visitante].puntos += 1;
      }
    });

    const result = Object.values(tabla)
      .sort((a, b) => b.puntos - a.puntos)
      .map((t, i) => ({
        position: i + 1,
        equipo: t.equipo,
        puntos: t.puntos,
        jugados: t.jugados,
        ganados: t.ganados,
        empatados: t.empatados,
        perdidos: t.perdidos,
        gf: t.gf,
        gc: t.gc
      }));

    res.json({
      ok: true,
      data: result
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================
// PARTIDOS
// ============================
app.get("/partidos", async (req, res) => {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/PARTIDOS`;
    const response = await axios.get(url);

    const data = response.data.map(cleanKey);

    res.json({
      ok: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================
// GUARDAR PARTIDO (NIVEL 1 FINAL)
// ============================
app.post("/add-partido", async (req, res) => {
  try {
    const {
      jornada,
      liga,
      local,
      visitante,
      goles_local,
      goles_visitante
    } = req.body;

    if (!jornada || !liga || !local || !visitante) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    const gl = Number(goles_local);
    const gv = Number(goles_visitante);

    if (isNaN(gl) || isNaN(gv)) {
      return res.status(400).json({
        ok: false,
        error: "Goles no válidos"
      });
    }

    const auth = getGoogleAuth();
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "PARTIDOS!A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          jornada,
          liga,
          local,
          visitante,
          gl,
          gv,
          "final"
        ]]
      }
    });

    res.json({
      ok: true,
      message: "Partido guardado correctamente"
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ============================
// TEST
// ============================
app.get("/test-api", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT ENGINE RUNNING ⚽"
  });
});

// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT ENGINE RUNNING ⚽");
});
