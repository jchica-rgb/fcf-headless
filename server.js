const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");

const app = express();

app.use(cors());
app.use(express.json());

// LEER EXCEL
function readExcel() {
  const workbook = XLSX.readFile("./data.xlsx");
  const sheet = workbook.Sheets["Sheet1"];
  return XLSX.utils.sheet_to_json(sheet);
}

// CLASIFICACIÓN
app.get("/clasificacion", (req, res) => {
  try {
    const liga = req.query.liga;

    let data = readExcel();

    if (liga) {
      data = data.filter(t => t.liga == liga);
    }

    data.sort((a, b) => b.puntos - a.puntos);

    const result = data.map((t, i) => ({
      position: i + 1,
      ...t
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

const PORT = 3000;

app.listen(PORT, () => {
  console.log("FUTCAT EXCEL API RUNNING");
});
