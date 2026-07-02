const axios = require("axios");

async function getClasificacion(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  // devolvemos fragmento REAL para ver estructura
  return {
    length: data.length,
    preview: data.slice(0, 2000)
  };
}

module.exports = { getClasificacion };
