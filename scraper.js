const { chromium } = require("playwright");

async function getClasificacion(url) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const data = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tr"));

    return rows.map(r => {
      const cols = r.querySelectorAll("td,th");
      return Array.from(cols).map(c => c.innerText.trim());
    });
  });

  await browser.close();

  return {
    rows: data
  };
}

module.exports = { getClasificacion };
