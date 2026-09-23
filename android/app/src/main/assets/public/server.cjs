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
//# sourceMappingURL=server.cjs.map
