const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// CACHE GLOBAL (CLAVE)
// ======================
let cache = {
  clasificacion: {},
  partidos: {},
  lastUpdate: null
};

// ======================
// SIMULACIÓN / CONECTOR SHEETS
// 👉 aquí debes conectar tu Google Sheets real
// ======================
async function getClasificacionFromSheets(liga) {
  // 🔥 AQUÍ VA TU LÓGICA REAL DE SHEETS
  return [];
}

async function getPartidosFromSheets(liga) {
  // 🔥 AQUÍ VA TU LÓGICA REAL DE SHEETS
  return [];
}

// ======================
// HELPERS
// ======================
function stableStringify(obj) {
  return JSON.stringify(obj);
}

// ======================
// ENDPOINT LIGAS
// ======================
app.get("/ligas", async (req, res) => {

  const ligas = [
    { id: "1", nombre: "Liga Elit" },
    { id: "2", nombre: "Primera Catalana" },
    { id: "3", nombre: "Segona Catalana" }
  ];

  res.json({ data: ligas });
});

// ======================
// ENDPOINT CLASIFICACION + PARTIDOS
// ======================
app.get("/clasificacion", async (req, res) => {

  const liga = req.query.liga;

  if (!liga) {
    return res.json({ data: [], partidos: [], lastUpdate: cache.lastUpdate });
  }

  // ======================
  // OBTENER DATOS REALES
  // ======================
  const clasificacion = await getClasificacionFromSheets(liga);
  const partidos = await getPartidosFromSheets(liga);

  // ======================
  // CLAVES ESTABLES
  // ======================
  const newClasKey = stableStringify(clasificacion);
  const newPartKey = stableStringify(partidos);

  const oldClasKey = cache.clasificacion[liga];
  const oldPartKey = cache.partidos[liga];

  let changed = false;

  // ======================
  // DETECCIÓN REAL DE CAMBIOS
  // ======================
  if (newClasKey !== oldClasKey || newPartKey !== oldPartKey) {
    changed = true;

    cache.clasificacion[liga] = newClasKey;
    cache.partidos[liga] = newPartKey;

    cache.lastUpdate = new Date().toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // ======================
  // RESPUESTA
  // ======================
  res.json({
    data: clasificacion,
    partidos,
    lastUpdate: cache.lastUpdate,
    changed
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
  console.log("⚽ FUTCAT SERVER RUNNING ON PORT", PORT);
});
