const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// NORMALIZADOR CLAVE
// ======================
function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

// ======================
// LIGAS
// ======================
app.get("/ligas", (req, res) => {
  res.json({
    data: [
      { id: "1", nombre: "Liga Elit" },
      { id: "2", nombre: "Primera Catalana" },
      { id: "3", nombre: "Segona Catalana" }
    ]
  });
});

// ======================
// CLASIFICACION (TU ORIGINAL PERO ARREGLADO)
// ======================
app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getClasificacionFromSheets(); // TU FUNCIÓN REAL

  const filtered = rows.filter(r =>
    normalize(r.liga) === ligaId
  );

  res.json({
    data: filtered,
    lastUpdate: cache?.lastUpdate || null
  });
});

// ======================
// PARTIDOS
// ======================
app.get("/partidos", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getPartidosFromSheets(); // TU FUNCIÓN REAL

  const filtered = rows.filter(r =>
    normalize(r.liga) === ligaId
  );

  res.json({
    data: filtered
  });
});

// ======================
app.get("/", (req, res) => {
  res.json({ ok: true });
});

// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING", PORT));
