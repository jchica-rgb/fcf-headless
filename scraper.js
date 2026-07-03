const axios = require("axios");
const cheerio = require("cheerio");

async function getClasificacion(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(data);

  let rows = [];

  $("table tr").each((i, el) => {
    const cols = [];

    $(el).find("td,th").each((j, td) => {
      cols.push($(td).text().trim());
    });

    if (cols.length > 0) {
      rows.push(cols);
    }
  });

  // limpieza básica
  rows = rows.filter(r => r.length > 2);

  return {
    data: rows
  };
}

module.exports = { getClasificacion };
