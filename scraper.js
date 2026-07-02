const axios = require("axios");

async function getClasificacion(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  // extraer scripts
  const scripts = data.match(/<script[\s\S]*?<\/script>/g) || [];

  return {
    scriptsCount: scripts.length,
    sample: scripts.slice(0, 3)
  };
}

module.exports = { getClasificacion };
