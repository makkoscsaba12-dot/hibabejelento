
const express = require("express");
const app = express();

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

const recentReports = new Map();

app.post("/api/report", async (req, res) => {
  try {
    if (!WEBHOOK) {
      return res.status(500).json({
        error: "A Discord webhook nincs beállítva."
      });
    }

    const { name, category, title, description, website } = req.body;

    // Rejtett mező a robotok kiszűrésére
    if (website) return res.json({ ok: true });

    if (
      typeof name !== "string" ||
      typeof category !== "string" ||
      typeof title !== "string" ||
      typeof description !== "string"
    ) {
      return res.status(400).json({ error: "Hiányzó adatok." });
    }

    const cleanName = name.trim().slice(0, 80);
    const cleanTitle = title.trim().slice(0, 120);
    const cleanDescription = description.trim().slice(0, 2000);
    const allowedCategories = ["Hiba", "Javaslat", "Egyéb"];

    if (
      !cleanTitle ||
      cleanDescription.length < 5 ||
      !allowedCategories.includes(category)
    ) {
      return res.status(400).json({
        error: "Ellenőrizd a címet, kategóriát és leírást."
      });
    }

    const ip = req.ip;
    const now = Date.now();
    const last = recentReports.get(ip) || 0;

    if (now - last < 30000) {
      return res.status(429).json({
        error: "Kérlek, várj 30 másodpercet a következő bejelentésig."
      });
    }

    const response = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          title: cleanTitle,
          color: category === "Hiba" ? 15158332 : 3447003,
          fields: [
            { name: "Kategória", value: category, inline: true },
            { name: "Beküldő", value: cleanName || "Névtelen", inline: true },
            { name: "Leírás", value: cleanDescription }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "Nem sikerült elküldeni a Discordra."
      });
    }

    recentReports.set(ip, now);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Hibabejelentés hiba:", error.message);
    return res.status(500).json({ error: "Belső szerverhiba." });
  }
});

app.listen(PORT, () => {
  console.log(`Hibabejelentő elindult a ${PORT} porton.`);
});
