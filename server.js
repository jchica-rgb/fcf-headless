const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// CACHE GLOBAL
// ======================
let cache = {
  clasificacion: {},
  partidos: {},
  lastUpdate: null
};

// ======================
// NORMALIZADOR (CLAVE DEL FIX)
// ======================
function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

// ======================
// SIMULACIÓN SHEETS (REEMPLAZA ESTO POR TU LÓGICA REAL)
// ======================
async function getClasificacionFromSheets() {
  return []; // <- tu conexión real aquí
}

async function getPartidosFromSheets() {
  return []; // <- tu conexión real aquí
}

// ======================
// LIGAS FIX (IMPORTANTE)
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
// CLASIFICACIÓN (FIX REAL)
// ======================
app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getClasificacionFromSheets();

  const filtered = rows.filter(r =>
    normalize(r.liga) === ligaId
  );

  const newKey = JSON.stringify(filtered);

  const oldKey = cache.clasificacion[ligaId];

  let changed = false;

  if (newKey !== oldKey) {
    cache.clasificacion[ligaId] = newKey;
    changed = true;

    cache.lastUpdate = new Date().toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  res.json({
    data: filtered,
    lastUpdate: cache.lastUpdate,
    changed
  });
});

// ======================
// PARTIDOS (FIX REAL)
// ======================
app.get("/partidos", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getPartidosFromSheets();

  const filtered = rows.filter(r =>
    normalize(r.liga) === ligaId
  );

  res.json({
    data: filtered
  });
});

// ======================
// HEALTH CHECK
// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT BACKEND OK ⚽"
  });
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("⚽ SERVER RUNNING ON PORT", PORT);
});
