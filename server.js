const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let data = [];

// añadir / actualizar equipo
app.post("/set", (req, res) => {
  const { equipo, puntos } = req.body;

  const index = data.findIndex(e => e.equipo === equipo);

  if (index >= 0) {
    data[index].puntos = puntos;
  } else {
    data.push({ equipo, puntos });
  }

  res.json({ ok: true, data });
});

// obtener clasificación
app.get("/clasificacion", (req, res) => {
  const sorted = [...data].sort((a, b) => b.puntos - a.puntos);

  res.json(sorted);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FUTCAT API RUNNING");
});
