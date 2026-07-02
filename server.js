import express from "express";
import { chromium } from "playwright";

const app = express();

app.get("/fcf", async (req, res) => {

    const url = req.query.url;

    if (!url) {
        return res.json({ error: "missing url" });
    }

    let browser;

    try {

        browser = await chromium.launch({
            headless: true
        });

        const page = await browser.newPage();

        await page.goto(url, {
            waitUntil: "networkidle"
        });

        await page.waitForTimeout(3000);

        const data = await page.evaluate(() => {

            let rows = [];

            document.querySelectorAll("tr").forEach(tr => {

                let cols = tr.querySelectorAll("td");

                if (cols.length >= 3) {

                    let team = cols[1]?.innerText?.trim();
                    let points = cols[cols.length - 1]?.innerText?.trim();

                    if (team && !isNaN(points)) {
                        rows.push({
                            team,
                            points: parseInt(points)
                        });
                    }
                }
            });

            return rows;
        });

        await browser.close();

        res.json({
            success: true,
            count: data.length,
            data
        });

    } catch (e) {

        if (browser) await browser.close();

        res.json({
            success: false,
            error: e.message
        });
    }
});

app.listen(3000, () => {
    console.log("FCF HEADLESS RUNNING");
});
