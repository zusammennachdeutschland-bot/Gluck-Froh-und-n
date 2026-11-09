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
var import_express2 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/api/expressApp.ts
var import_express = __toESM(require("express"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
var localAssignmentsStore = [];
var localSubmissionsStore = [];
var serverGoldCache = null;
var SERVER_GOLD_CACHE_TTL = 3 * 60 * 1e3;
app.all("/api/health", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).json({ status: "ok" });
});
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
      const paxgRes = await fetchWithTimeout(
        "https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT"
      );
      if (paxgRes.ok) {
        const pData = await paxgRes.json();
        if (pData?.price) {
          ozUsd = parseFloat(pData.price);
        }
      }
    } catch (e) {
      console.warn("Binance PAXG fetch failed", e);
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
function resolveServerAudienceMode(hw) {
  if (!hw) return "open";
  if (hw.audienceMode === "open") return "open";
  if (hw.audienceMode === "group") return "group";
  const gid = String(hw.groupId || "").trim();
  if (gid && gid !== "all") return "group";
  return "open";
}
function normalizeServerAssignment(hw) {
  if (!hw || typeof hw !== "object") return hw;
  const mode = resolveServerAudienceMode(hw);
  if (mode === "open") {
    const copy = { ...hw, audienceMode: "open" };
    delete copy.groupId;
    delete copy.groupName;
    delete copy.assignedStudents;
    return copy;
  }
  const targetGroupId = String(hw.groupId || "").trim();
  const byId = /* @__PURE__ */ new Map();
  if (Array.isArray(hw.assignedStudents)) {
    for (const raw of hw.assignedStudents) {
      if (!raw) continue;
      const cleanId = String(raw.id || "").trim();
      const cleanName = String(raw.name || "").trim();
      if (!cleanId || !cleanName) continue;
      if (raw.groupId && targetGroupId && String(raw.groupId).trim() !== targetGroupId) continue;
      if (!byId.has(cleanId)) {
        byId.set(cleanId, {
          id: cleanId,
          name: cleanName,
          ...raw.code ? { code: raw.code } : {},
          ...raw.groupId || targetGroupId ? { groupId: String(raw.groupId || targetGroupId).trim() } : {}
        });
      }
    }
  }
  return {
    ...hw,
    audienceMode: "group",
    groupId: targetGroupId && targetGroupId !== "all" ? targetGroupId : void 0,
    groupName: hw.groupName ? String(hw.groupName).trim() : void 0,
    assignedStudents: Array.from(byId.values())
  };
}
function validateServerSubmission(hw, body) {
  const cleanSubmittedName = String(body?.studentName || "").trim();
  if (!hw) {
    if (!cleanSubmittedName) {
      return { valid: false, status: 400, error: "Missing studentName", audienceMode: "open" };
    }
    return {
      valid: true,
      audienceMode: body?.audienceMode === "group" ? "group" : "open",
      normalizedStudentId: body?.studentId ? String(body.studentId).trim() : void 0,
      normalizedParticipantId: body?.participantId ? String(body.participantId).trim() : void 0,
      normalizedStudentName: cleanSubmittedName,
      normalizedGroupId: body?.groupId ? String(body.groupId).trim() : void 0
    };
  }
  const normalizedHw = normalizeServerAssignment(hw);
  const mode = resolveServerAudienceMode(normalizedHw);
  if (mode === "group") {
    const targetGroupId = String(normalizedHw.groupId || "").trim();
    if (!targetGroupId || targetGroupId === "all") {
      return {
        valid: false,
        status: 403,
        error: "Group assignment is missing a valid groupId",
        audienceMode: "group"
      };
    }
    const roster = Array.isArray(normalizedHw.assignedStudents) ? normalizedHw.assignedStudents : [];
    if (roster.length === 0) {
      return {
        valid: false,
        status: 403,
        error: "Group student roster is unavailable for this assignment",
        audienceMode: "group"
      };
    }
    const submittedStudentId = String(body?.studentId || "").trim();
    if (!submittedStudentId) {
      return {
        valid: false,
        status: 403,
        error: "studentId is required for a group-restricted homework assignment",
        audienceMode: "group"
      };
    }
    if (body?.groupId && String(body.groupId).trim() !== targetGroupId) {
      return {
        valid: false,
        status: 403,
        error: "Submitted groupId does not match assignment groupId",
        audienceMode: "group"
      };
    }
    const matchedStudent = roster.find((s) => s.id === submittedStudentId);
    if (!matchedStudent) {
      return {
        valid: false,
        status: 403,
        error: "Student does not belong to the assigned group",
        audienceMode: "group"
      };
    }
    if (!cleanSubmittedName || cleanSubmittedName.toLowerCase() !== String(matchedStudent.name).trim().toLowerCase()) {
      return {
        valid: false,
        status: 403,
        error: "Submitted studentName does not match registered student record",
        audienceMode: "group"
      };
    }
    return {
      valid: true,
      audienceMode: "group",
      normalizedStudentId: matchedStudent.id,
      normalizedParticipantId: void 0,
      normalizedStudentName: String(matchedStudent.name).trim(),
      normalizedGroupId: targetGroupId
    };
  }
  if (!cleanSubmittedName) {
    return {
      valid: false,
      status: 400,
      error: "Participant name is required for open homework",
      audienceMode: "open"
    };
  }
  const pid = String(body?.participantId || "").trim() || `pid_${String(body?.assignmentId || "hw").slice(0, 16)}_${Date.now().toString(36)}`;
  return {
    valid: true,
    audienceMode: "open",
    normalizedStudentId: void 0,
    normalizedParticipantId: pid,
    normalizedStudentName: cleanSubmittedName,
    normalizedGroupId: void 0
  };
}
app.all("/api/teacher/assignments", (req, res) => {
  if (req.method === "GET") {
    return res.json({ assignments: localAssignmentsStore.map(normalizeServerAssignment) });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    if (body.audienceMode === "group") {
      const gid = String(body.groupId || "").trim();
      if (!gid || gid === "all") {
        return res.status(400).json({
          success: false,
          error: "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0645\u062C\u0645\u0648\u0639\u0629 \u0635\u0627\u0644\u062D\u0629 \u0639\u0646\u062F \u0627\u062E\u062A\u064A\u0627\u0631 \u062C\u0631\u0648\u0628 \u0645\u0639\u064A\u0646."
        });
      }
    }
    const normalized = normalizeServerAssignment(body);
    if (normalized.id) {
      const idx = localAssignmentsStore.findIndex((a) => a.id === normalized.id);
      if (idx >= 0) {
        localAssignmentsStore[idx] = normalizeServerAssignment({
          ...localAssignmentsStore[idx],
          ...normalized
        });
      } else {
        localAssignmentsStore.unshift(normalized);
      }
    }
    return res.json({ success: true, assignment: normalized });
  }
  return res.json({ success: true });
});
app.all("/api/homework/submissions", (req, res) => {
  if (req.method === "GET") {
    const assignmentId = req.query.assignmentId ? String(req.query.assignmentId) : null;
    const list = assignmentId ? localSubmissionsStore.filter((s) => s.assignmentId === assignmentId) : localSubmissionsStore;
    return res.json({ submissions: list });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const targetHw = localAssignmentsStore.find((a) => a.id === body.assignmentId) || body.assignmentFallback || null;
    const check = validateServerSubmission(targetHw, body);
    if (!check.valid) {
      return res.status(check.status || 403).json({
        success: false,
        error: check.error || "Submission validation failed"
      });
    }
    const cleanSub = {
      ...body,
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      groupId: check.normalizedGroupId,
      studentName: check.normalizedStudentName
    };
    if (cleanSub.id) {
      const idx = localSubmissionsStore.findIndex((s) => s.id === cleanSub.id);
      if (idx >= 0) {
        localSubmissionsStore[idx] = { ...localSubmissionsStore[idx], ...cleanSub };
      } else {
        localSubmissionsStore.unshift(cleanSub);
      }
    }
    return res.json({ success: true, submission: cleanSub });
  }
  return res.json({ success: true });
});
app.get("/api/homework/info", (req, res) => {
  const id = String(req.query.id || "").trim();
  const found = localAssignmentsStore.find((a) => a.id === id);
  if (!found) {
    return res.status(404).json({ error: "Assignment not found in local relay" });
  }
  return res.json(normalizeServerAssignment(found));
});
app.post("/api/homework/submit", (req, res) => {
  const body = req.body || {};
  const targetHw = localAssignmentsStore.find((a) => a.id === body.assignmentId) || body.assignmentFallback || null;
  const check = validateServerSubmission(targetHw, body);
  if (!check.valid) {
    return res.status(check.status || 403).json({
      success: false,
      error: check.error || "Submission rejected"
    });
  }
  const responses = Array.isArray(body.responses) ? body.responses : [];
  const correctCount = responses.filter((r) => r && r.isCorrect).length;
  const totalQ = responses.length;
  const pct = totalQ > 0 ? Math.round(correctCount / totalQ * 100) : 0;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const startMs = body.startedAt ? new Date(body.startedAt).getTime() : Date.now() - totalQ * 4e3;
  const timeSpentSeconds = Math.max(5, Math.round((Date.now() - startMs) / 1e3));
  const submission = {
    id: body.id || `sub_${body.assignmentId || "hw"}_${Date.now()}`,
    assignmentId: body.assignmentId,
    audienceMode: check.audienceMode,
    studentId: check.normalizedStudentId,
    participantId: check.normalizedParticipantId,
    groupId: check.normalizedGroupId,
    studentName: check.normalizedStudentName,
    attemptNumber: body.attemptNumber || 1,
    status: "completed",
    startedAt: body.startedAt || nowIso,
    completedAt: body.completedAt || nowIso,
    updatedAt: nowIso,
    timeSpentSeconds,
    totalQuestions: totalQ,
    correctAnswersCount: correctCount,
    scorePercentage: pct,
    accuracyPercent: pct,
    score: correctCount,
    accuracy: pct,
    goldEarned: body.goldEarned || 0,
    maxStreak: body.maxStreak || 0,
    completedStudyPhase: Boolean(body.completedStudyPhase),
    responses
  };
  const idx = localSubmissionsStore.findIndex((s) => s.id === submission.id);
  if (idx >= 0) {
    localSubmissionsStore[idx] = { ...localSubmissionsStore[idx], ...submission };
  } else {
    localSubmissionsStore.unshift(submission);
  }
  return res.json({ success: true, submission });
});
var workspaceChunksRelayStore = /* @__PURE__ */ new Map();
var cachedGoogleCerts = null;
var cachedGoogleCertsExpiry = 0;
async function fetchGooglePublicCerts() {
  try {
    const res = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    if (!res.ok) {
      console.warn(`Failed to fetch Google public certs: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const cc = res.headers.get("cache-control") || "";
    const match = cc.match(/max-age=(\d+)/i);
    const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;
    cachedGoogleCerts = data;
    cachedGoogleCertsExpiry = Date.now() + maxAgeSeconds * 1e3;
    return data;
  } catch (err) {
    console.warn("Network error fetching Google public certs:", err);
    return null;
  }
}
async function getGooglePublicCerts(kid) {
  const now = Date.now();
  const isCacheExpired = !cachedGoogleCerts || now >= cachedGoogleCertsExpiry;
  if (isCacheExpired) {
    const freshCerts = await fetchGooglePublicCerts();
    if (!freshCerts) {
      cachedGoogleCerts = null;
      cachedGoogleCertsExpiry = 0;
      return {};
    }
  } else if (kid && !cachedGoogleCerts[kid]) {
    const freshCerts = await fetchGooglePublicCerts();
    if (!freshCerts && now >= cachedGoogleCertsExpiry) {
      cachedGoogleCerts = null;
      cachedGoogleCertsExpiry = 0;
      return {};
    }
  }
  if (now >= cachedGoogleCertsExpiry) {
    cachedGoogleCerts = null;
    return {};
  }
  return cachedGoogleCerts || {};
}
function emailToLegacyWorkspaceId(email) {
  const clean = (email || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return clean ? `ws_${clean.slice(0, 90)}` : "";
}
async function verifyFirebaseIdToken(token, expectedProjectId = "glueck-c8621", certsOverride) {
  if (!token || typeof token !== "string") {
    return { isValid: false, payload: null, error: "Token is missing or empty" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { isValid: false, payload: null, error: "Malformed JWT format: Expected 3 dot-separated segments" };
  }
  let header;
  try {
    const headerStr = Buffer.from(parts[0], "base64url").toString("utf8");
    header = JSON.parse(headerStr);
  } catch {
    return { isValid: false, payload: null, error: "Malformed JWT header" };
  }
  if (!header || typeof header !== "object") {
    return { isValid: false, payload: null, error: "JWT header is not an object" };
  }
  if (header.alg !== "RS256") {
    return { isValid: false, payload: null, error: `Invalid signing algorithm: Expected RS256, got ${header.alg}` };
  }
  if (!header.kid || typeof header.kid !== "string" || header.kid.trim() === "") {
    return { isValid: false, payload: null, error: "Missing or empty kid in JWT header" };
  }
  let cert;
  if (certsOverride) {
    cert = certsOverride[header.kid];
  } else {
    const certs = await getGooglePublicCerts(header.kid);
    cert = certs[header.kid];
  }
  if (!cert) {
    return {
      isValid: false,
      payload: null,
      error: `Matching Google public certificate unavailable for kid: ${header.kid}`
    };
  }
  try {
    const verifier = import_crypto.default.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isSignatureValid = verifier.verify(cert, parts[2], "base64url");
    if (!isSignatureValid) {
      return {
        isValid: false,
        payload: null,
        error: "Cryptographic signature verification failed: Signature does not match public key"
      };
    }
  } catch (verifyErr) {
    return {
      isValid: false,
      payload: null,
      error: `Cryptographic signature verification error: ${verifyErr?.message || "Verification exception"}`
    };
  }
  let payload;
  try {
    const payloadStr = Buffer.from(parts[1], "base64url").toString("utf8");
    payload = JSON.parse(payloadStr);
  } catch {
    return { isValid: false, payload: null, error: "Malformed JWT payload" };
  }
  if (!payload || typeof payload !== "object") {
    return { isValid: false, payload: null, error: "JWT payload is not an object" };
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  if (payload.aud !== expectedProjectId) {
    return {
      isValid: false,
      payload: null,
      error: `Invalid token audience: Expected ${expectedProjectId}, got ${payload.aud}`
    };
  }
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    return {
      isValid: false,
      payload: null,
      error: `Invalid token issuer: Expected https://securetoken.google.com/${expectedProjectId}, got ${payload.iss}`
    };
  }
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) {
    return { isValid: false, payload: null, error: "Invalid or missing token subject (sub/uid)" };
  }
  if (typeof payload.exp !== "number" || payload.exp <= nowSec - 5) {
    return { isValid: false, payload: null, error: "Token has expired" };
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 60) {
    return { isValid: false, payload: null, error: "Token issued in the future (iat)" };
  }
  if (typeof payload.auth_time !== "number" || !Number.isFinite(payload.auth_time)) {
    return { isValid: false, payload: null, error: "Missing or invalid mandatory token auth_time" };
  }
  if (payload.auth_time > nowSec + 60) {
    return { isValid: false, payload: null, error: "Token auth_time is in the future" };
  }
  return { isValid: true, payload };
}
app.all("/api/workspace/delta", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized: Valid Firebase ID token is required to access workspace relay."
    });
  }
  const verification = await verifyFirebaseIdToken(token);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error || "Invalid Firebase ID token"}`
    });
  }
  const authenticatedUid = verification.payload.sub;
  const legacyId = verification.payload.email ? emailToLegacyWorkspaceId(verification.payload.email) : null;
  const allowedWorkspaceIds = /* @__PURE__ */ new Set([authenticatedUid]);
  if (legacyId) allowedWorkspaceIds.add(legacyId);
  if (req.method === "GET") {
    const workspaceId = String(req.query.workspaceId || "").trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "Missing workspaceId" });
    }
    if (!allowedWorkspaceIds.has(workspaceId)) {
      return res.status(403).json({ error: "Forbidden: You do not have permission to read this workspace relay." });
    }
    const docsMap = workspaceChunksRelayStore.get(workspaceId);
    const docs = docsMap ? Array.from(docsMap.values()) : [];
    return res.json({ success: true, docs });
  }
  if (req.method === "POST") {
    const { workspaceId, chunks } = req.body || {};
    if (!workspaceId || !Array.isArray(chunks)) {
      return res.status(400).json({ error: "Invalid delta payload" });
    }
    if (!allowedWorkspaceIds.has(workspaceId)) {
      return res.status(403).json({ error: "Forbidden: You do not have permission to write to this workspace relay." });
    }
    for (const chunk of chunks) {
      if (chunk?.ownerUid && chunk.ownerUid !== authenticatedUid) {
        return res.status(403).json({ error: "Forbidden: Injected chunk ownerUid does not match authenticated user." });
      }
    }
    let docsMap = workspaceChunksRelayStore.get(workspaceId);
    if (!docsMap) {
      docsMap = /* @__PURE__ */ new Map();
      workspaceChunksRelayStore.set(workspaceId, docsMap);
    }
    for (const chunk of chunks) {
      if (chunk && chunk.id) {
        docsMap.set(chunk.id, chunk);
      }
    }
    return res.json({ success: true, storedCount: chunks.length });
  }
  if (req.method === "DELETE") {
    const workspaceId = String(req.query.workspaceId || "").trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "Missing workspaceId" });
    }
    if (!allowedWorkspaceIds.has(workspaceId)) {
      return res.status(403).json({ error: "Forbidden: You do not have permission to delete this workspace relay." });
    }
    const had = workspaceChunksRelayStore.has(workspaceId);
    workspaceChunksRelayStore.delete(workspaceId);
    return res.json({ success: true, cleared: had });
  }
  return res.json({ success: true });
});
app.post("/api/android/generate-keystore", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const { storePassword, keyAlias = "glueckrelease" } = req.body || {};
  const cleanAlias = String(keyAlias || "glueckrelease").trim() || "glueckrelease";
  const pass = String(storePassword || "");
  if (pass.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters long."
    });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanAlias)) {
    return res.status(400).json({
      success: false,
      error: "Key alias must contain only letters, numbers, underscores, or hyphens."
    });
  }
  const fs = await import("fs");
  const os = await import("os");
  const path2 = await import("path");
  const { execFileSync } = await import("child_process");
  const tmpDir = fs.mkdtempSync(path2.join(os.tmpdir(), "glueck-ks-"));
  const keyPemPath = path2.join(tmpDir, "key.pem");
  const certPemPath = path2.join(tmpDir, "cert.pem");
  const keystorePath = path2.join(tmpDir, "release.keystore");
  try {
    const envWithSecret = {
      ...process.env,
      _GLUECK_EPHEMERAL_KS_PASS: pass
    };
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyPemPath,
        "-out",
        certPemPath,
        "-days",
        "10000",
        "-subj",
        "/CN=Glueck Teacher/OU=Mobile/O=Glueck/L=Cairo/ST=Cairo/C=EG"
      ],
      { stdio: "ignore" }
    );
    execFileSync(
      "openssl",
      [
        "pkcs12",
        "-export",
        "-in",
        certPemPath,
        "-inkey",
        keyPemPath,
        "-out",
        keystorePath,
        "-name",
        cleanAlias,
        "-passout",
        "env:_GLUECK_EPHEMERAL_KS_PASS"
      ],
      { env: envWithSecret, stdio: "ignore" }
    );
    execFileSync(
      "openssl",
      [
        "pkcs12",
        "-in",
        keystorePath,
        "-noout",
        "-passin",
        "env:_GLUECK_EPHEMERAL_KS_PASS"
      ],
      { env: envWithSecret, stdio: "ignore" }
    );
    const fpOut = execFileSync(
      "openssl",
      ["x509", "-in", certPemPath, "-noout", "-fingerprint", "-sha256"],
      { encoding: "utf8" }
    ).trim();
    const keystoreBuffer = fs.readFileSync(keystorePath);
    const keystoreBase64 = keystoreBuffer.toString("base64").replace(/\s+/g, "");
    return res.status(200).json({
      success: true,
      alias: cleanAlias,
      keystoreBase64,
      byteLength: keystoreBuffer.length,
      sha256Fingerprint: fpOut.replace(/^.*Fingerprint=/i, "")
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to generate PKCS12 keystore."
    });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
    }
  }
});
var expressApp_default = app;

// server.ts
async function startServer() {
  const app2 = (0, import_express2.default)();
  const PORT = 3e3;
  app2.use(expressApp_default);
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app2.use(import_express2.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
