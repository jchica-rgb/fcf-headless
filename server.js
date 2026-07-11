const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// CACHE
// ======================
let cache = {
  data: {},
  lastUpdate: null
};

// ======================
// NORMALIZADOR
// ======================
function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

// ======================
// SIMULACIÓN DATA SOURCE
// (AQUÍ LUEGO CONECTAS SHEETS)
// ======================
async function getClasificacionFromSheets() {
  return [];
}

async function getPartidosFromSheets() {
  return [];
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
// CLASIFICACION
// ======================
app.get("/clasificacion", async (req, res) => {

  const ligaId = normalize(req.query.liga);

  const rows = await getClasificacionFromSheets();

  const filtered = rows.filter(r =>
    normalize(r.liga) === ligaId
  );

  const newHash = JSON.stringify(filtered);
  const oldHash = cache.data[ligaId];

  let changed = false;

  if (newHash !== oldHash) {
    cache.data[ligaId] = newHash;
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
// PARTIDOS
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
// HEALTH
// ======================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "FUTCAT SERVER 1.0 RUNNING ⚽"
  });
});

// ======================
// START
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("⚽ SERVER 1.0 RUNNING ON", PORT);
});
