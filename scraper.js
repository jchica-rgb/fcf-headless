const axios = require("axios");
const cheerio = require("cheerio");

async function getClasificacion(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(data);

  let tabla = [];

  $("table tbody tr").each((i, el) => {
    const cols = $(el).find("td");

    if (cols.length >= 3) {
      const pos = $(cols[0]).text().trim();
      const equipo = $(cols[1]).text().trim();
      const puntos = $(cols[2]).text().trim();

      if (pos && equipo) {
        tabla.push({
          pos: Number(pos),
          equipo,
          puntos: Number(puntos)
        });
      }
    }
  });

  return tabla;
}

module.exports = { getClasificacion };
