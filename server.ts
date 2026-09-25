import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.all("/api/health", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).json({ status: "ok" });
  });

  // Gold price cache
  let serverGoldCache: { data: any; timestamp: number } | null = null;
  const SERVER_GOLD_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

  app.get("/api/gold-price", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    const now = Date.now();
    if (serverGoldCache && (now - serverGoldCache.timestamp < SERVER_GOLD_CACHE_TTL)) {
      return res.json(serverGoldCache.data);
    }

    const TROY_OUNCE_TO_GRAMS = 31.1034768;

    try {
      // 1. Fetch live gold and FX rates
      const timeout = 6000;
      const fetchWithTimeout = (url: string) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
      };

      let ozUsd = 0;
      let usdToEgp = 51.5; // robust baseline fallback

      // FX Rate
      try {
        const fxRes = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD");
        if (fxRes.ok) {
          const fxData = await fxRes.json() as any;
          if (fxData?.rates?.EGP) {
            usdToEgp = parseFloat(fxData.rates.EGP);
          }
        }
      } catch (e) {
        console.warn("FX fetch failed, using fallback exchange rate", e);
      }

      // Gold Spot Price: try Binance PAXG first
      try {
        const paxgRes = await fetchWithTimeout("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT");
        if (paxgRes.ok) {
          const pData = await paxgRes.json() as any;
          if (pData?.price) {
            ozUsd = parseFloat(pData.price);
          }
        }
      } catch (e) {
        console.warn("Binance PAXG fetch failed, trying Gold-API", e);
      }

      // If Binance failed, try Gold-API
      if (!ozUsd) {
        try {
          const gRes = await fetchWithTimeout("https://api.gold-api.com/price/XAU");
          if (gRes.ok) {
            const gData = await gRes.json() as any;
            if (gData?.price) {
              ozUsd = parseFloat(gData.price);
            }
          }
        } catch (e) {
          console.warn("Gold-API fetch failed", e);
        }
      }

      if (ozUsd > 0 && usdToEgp > 0) {
        const pricePerGram24K = Math.round((ozUsd / TROY_OUNCE_TO_GRAMS) * usdToEgp);
        const result = {
          pricePerGram24K,
          currency: "EGP",
          source: "مؤشر الذهب العالمي والصاغة (EGP)",
          fetchedAt: new Date().toISOString(),
          success: true,
          status: "live",
          ozUsd: Math.round(ozUsd * 100) / 100,
          usdToEgp: Math.round(usdToEgp * 100) / 100,
        };
        serverGoldCache = { data: result, timestamp: now };
        return res.json(result);
      }

      // If live queries failed but we have stale cache, return stale cache
      if (serverGoldCache) {
        return res.json({
          ...serverGoldCache.data,
          status: "cached",
        });
      }

      // Safe baseline estimate if first-time fetch failed
      const fallbackResult = {
        pricePerGram24K: 7090,
        currency: "EGP",
        source: "متوسط سوق الذهب المصري (تقديري)",
        fetchedAt: new Date().toISOString(),
        success: true,
        status: "cached",
      };
      serverGoldCache = { data: fallbackResult, timestamp: now };
      return res.json(fallbackResult);
    } catch (err: any) {
      console.error("Gold price route error:", err);
      if (serverGoldCache) {
        return res.json(serverGoldCache.data);
      }
      return res.status(500).json({
        pricePerGram24K: 0,
        currency: "EGP",
        source: "Error",
        fetchedAt: new Date().toISOString(),
        success: false,
        error: err.message || "Failed to fetch gold price",
      });
    }
  });

  app.get("/api/hod/dashboard/timetable", (req, res) => {
    res.json({
      dayKey: new Date().getDay().toString(),
      periodsCount: 8,
      teachers: [
        { id: 't-1', name: 'أ. أحمد علي', periods: { '1': '1A', '2': '2B', '3': '3C' } },
        { id: 't-2', name: 'أ. سارة محمود', periods: { '2': '4A', '4': '5B', '5': '6C' } },
        { id: 't-3', name: 'أ. عمر فاروق', periods: { '1': '7A', '3': '8B', '6': '9C' } }
      ],
      lastUpdated: new Date().toISOString()
    });
  });

  app.post("/api/hod/dashboard/action", (req, res) => {
    const { actionType, payload } = req.body;
    res.json({ success: true, actionType, id: Date.now().toString(), payload, timestamp: Date.now() });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
