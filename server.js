const express = require("express");
const cors = require("cors");
const { getClasificacion } = require("./scraper");

const app = express();
app.use(cors());

app.get("/clasificacion", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Falta URL FCF"
      });
    }

    const data = await getClasificacion(url);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("FCF HEADLESS PRO RUNNING ON", PORT);
});
