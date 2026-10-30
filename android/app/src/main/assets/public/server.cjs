var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.all("/api/health", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).json({ status: "ok" });
  });
  let serverGoldCache = null;
  const SERVER_GOLD_CACHE_TTL = 3 * 60 * 1e3;
  app.get("/api/gold-price", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const now = Date.now();
    if (serverGoldCache && now - serverGoldCache.timestamp < SERVER_GOLD_CACHE_TTL) {
      return res.json(serverGoldCache.data);
    }
    const TROY_OUNCE_TO_GRAMS = 31.1034768;
    try {
      const timeout = 6e3;
      const fetchWithTimeout = (url) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
      };
      let ozUsd = 0;
      let usdToEgp = 51.5;
      try {
        const fxRes = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD");
        if (fxRes.ok) {
          const fxData = await fxRes.json();
          if (fxData?.rates?.EGP) {
            usdToEgp = parseFloat(fxData.rates.EGP);
          }
        }
      } catch (e) {
        console.warn("FX fetch failed, using fallback exchange rate", e);
      }
      try {
        const paxgRes = await fetchWithTimeout("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT");
        if (paxgRes.ok) {
          const pData = await paxgRes.json();
          if (pData?.price) {
            ozUsd = parseFloat(pData.price);
          }
        }
      } catch (e) {
        console.warn("Binance PAXG fetch failed, trying Gold-API", e);
      }
      if (!ozUsd) {
        try {
          const gRes = await fetchWithTimeout("https://api.gold-api.com/price/XAU");
          if (gRes.ok) {
            const gData = await gRes.json();
            if (gData?.price) {
              ozUsd = parseFloat(gData.price);
            }
          }
        } catch (e) {
          console.warn("Gold-API fetch failed", e);
        }
      }
      if (ozUsd > 0 && usdToEgp > 0) {
        const pricePerGram24K = Math.round(ozUsd / TROY_OUNCE_TO_GRAMS * usdToEgp);
        const result = {
          pricePerGram24K,
          currency: "EGP",
          source: "\u0645\u0624\u0634\u0631 \u0627\u0644\u0630\u0647\u0628 \u0627\u0644\u0639\u0627\u0644\u0645\u064A \u0648\u0627\u0644\u0635\u0627\u063A\u0629 (EGP)",
          fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
          success: true,
          status: "live",
          ozUsd: Math.round(ozUsd * 100) / 100,
          usdToEgp: Math.round(usdToEgp * 100) / 100
        };
        serverGoldCache = { data: result, timestamp: now };
        return res.json(result);
      }
      if (serverGoldCache) {
        return res.json({
          ...serverGoldCache.data,
          status: "cached"
        });
      }
      const fallbackResult = {
        pricePerGram24K: 7090,
        currency: "EGP",
        source: "\u0645\u062A\u0648\u0633\u0637 \u0633\u0648\u0642 \u0627\u0644\u0630\u0647\u0628 \u0627\u0644\u0645\u0635\u0631\u064A (\u062A\u0642\u062F\u064A\u0631\u064A)",
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        success: true,
        status: "cached"
      };
      serverGoldCache = { data: fallbackResult, timestamp: now };
      return res.json(fallbackResult);
    } catch (err) {
      console.error("Gold price route error:", err);
      if (serverGoldCache) {
        return res.json(serverGoldCache.data);
      }
      return res.status(500).json({
        pricePerGram24K: 0,
        currency: "EGP",
        source: "Error",
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        success: false,
        error: err.message || "Failed to fetch gold price"
      });
    }
  });
  app.get("/api/hod/dashboard/timetable", (req, res) => {
    res.json({
      dayKey: (/* @__PURE__ */ new Date()).getDay().toString(),
      periodsCount: 8,
      teachers: [
        { id: "t-1", name: "\u0623. \u0623\u062D\u0645\u062F \u0639\u0644\u064A", periods: { "1": "1A", "2": "2B", "3": "3C" } },
        { id: "t-2", name: "\u0623. \u0633\u0627\u0631\u0629 \u0645\u062D\u0645\u0648\u062F", periods: { "2": "4A", "4": "5B", "5": "6C" } },
        { id: "t-3", name: "\u0623. \u0639\u0645\u0631 \u0641\u0627\u0631\u0648\u0642", periods: { "1": "7A", "3": "8B", "6": "9C" } }
      ],
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.post("/api/hod/dashboard/action", (req, res) => {
    const { actionType, payload } = req.body;
    res.json({ success: true, actionType, id: Date.now().toString(), payload, timestamp: Date.now() });
  });
  app.get("/api/tts", async (req, res) => {
    try {
      const text = (req.query.text || "").trim();
      const lang = (req.query.lang || "de").trim();
      if (!text) {
        return res.status(400).json({ error: "Missing text parameter" });
      }
      const encoded = encodeURIComponent(text);
      const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&sl=${lang}&tl=${lang}&dt=t&q=${encoded}`;
      const response = await fetch(ttsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://translate.google.com/"
        }
      });
      if (!response.ok) {
        return res.status(response.status).send("TTS fetch failed");
      }
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("TTS endpoint error:", err);
      res.status(500).json({ error: "TTS failed" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
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
