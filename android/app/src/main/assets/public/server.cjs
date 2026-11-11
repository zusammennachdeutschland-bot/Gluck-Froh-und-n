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

// src/server/firebaseAdmin.ts
var import_app2 = require("firebase-admin/app");
var import_firestore2 = require("firebase-admin/firestore");

// src/shared/firebaseCloudSync.ts
var import_app = require("firebase/app");
var import_auth = require("firebase/auth");

// src/shared/googleCredentialAuthPlugin.ts
var import_core = require("@capacitor/core");
var NativeGoogleCredentialAuth = (0, import_core.registerPlugin)("GoogleCredentialAuth");
var testAdapter = null;
function isAndroidNativePlatform() {
  if (testAdapter?.isAndroidNative) {
    return testAdapter.isAndroidNative();
  }
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  if (cap) {
    if (typeof cap.getPlatform === "function" && cap.getPlatform() === "android") {
      return true;
    }
    if (typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
      return true;
    }
  }
  const protocol = window.location?.protocol;
  return protocol === "capacitor:" || protocol === "file:";
}

// src/shared/firebaseCloudSync.ts
var import_firestore = require("firebase/firestore");
var FIREBASE_CONFIG = {
  projectId: "glueck-c8621",
  appId: "1:874458026984:web:f88ecbf0df451173854a5d",
  apiKey: "AIzaSyBJVhFLw3NeS1MNHJ9ZnAipuZNwRaoaZ-g",
  authDomain: "glueck-c8621.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixgluckgerman-fc71e704-09a9-492f-82ad-623b4e7b445e",
  storageBucket: "glueck-c8621.firebasestorage.app",
  messagingSenderId: "874458026984"
};
var app = (0, import_app.getApps)().length > 0 ? (0, import_app.getApp)() : (0, import_app.initializeApp)(FIREBASE_CONFIG);
function initFirestoreDb() {
  const hasIndexedDb = typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  if (hasIndexedDb) {
    try {
      return (0, import_firestore.initializeFirestore)(
        app,
        {
          localCache: (0, import_firestore.persistentLocalCache)({
            tabManager: (0, import_firestore.persistentMultipleTabManager)()
          }),
          experimentalAutoDetectLongPolling: true
        },
        FIREBASE_CONFIG.firestoreDatabaseId
      );
    } catch {
    }
  }
  try {
    return (0, import_firestore.initializeFirestore)(
      app,
      {
        localCache: (0, import_firestore.memoryLocalCache)(),
        experimentalAutoDetectLongPolling: true
      },
      FIREBASE_CONFIG.firestoreDatabaseId
    );
  } catch {
    return (0, import_firestore.getFirestore)(app, FIREBASE_CONFIG.firestoreDatabaseId);
  }
}
var db = initFirestoreDb();
try {
  (0, import_firestore.setLogLevel)("silent");
} catch {
}
var auth = (0, import_auth.getAuth)(app);
var googleProvider = new import_auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
var LEGACY_QUOTA_EXHAUSTED_DATE_KEY = "gluck_firestore_write_quota_date";
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem(LEGACY_QUOTA_EXHAUSTED_DATE_KEY);
  } catch {
  }
}
var connectionTested = false;
async function testFirestoreConnection() {
  if (connectionTested) return true;
  connectionTested = true;
  try {
    await (0, import_firestore.getDocFromServer)((0, import_firestore.doc)(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
    return false;
  }
}
if (typeof window !== "undefined") {
  testFirestoreConnection().catch(() => {
  });
}
if (typeof window !== "undefined") {
  (0, import_auth.setPersistence)(auth, import_auth.browserLocalPersistence).catch(() => {
    (0, import_auth.setPersistence)(auth, import_auth.browserSessionPersistence).catch(() => {
      (0, import_auth.setPersistence)(auth, import_auth.inMemoryPersistence).catch(() => {
      });
    });
  });
  if (!isAndroidNativePlatform()) {
    (0, import_auth.getRedirectResult)(auth).then((res) => {
      if (res?.user) {
        console.log("Redirect sign-in success:", res.user.email);
      }
    }).catch((e) => {
      console.warn("Redirect result notice:", e);
    });
  }
}

// src/server/firebaseAdmin.ts
var InMemoryAdminFirestore = class {
  constructor() {
    this.assignments = /* @__PURE__ */ new Map();
    this.submissions = /* @__PURE__ */ new Map();
    this.shouldFailWrites = false;
    this.failureErrorMessage = "Simulated Firestore persistence failure";
  }
  clear() {
    this.assignments.clear();
    this.submissions.clear();
    this.shouldFailWrites = false;
  }
  setSimulateFailure(fail, message) {
    this.shouldFailWrites = fail;
    if (message) this.failureErrorMessage = message;
  }
  getAssignmentsMap() {
    return this.assignments;
  }
  getSubmissionsMap() {
    return this.submissions;
  }
  collection(name) {
    const isAssignments = name === "homework_assignments";
    const store = isAssignments ? this.assignments : this.submissions;
    const parent = this;
    return {
      doc: (id) => ({
        get: async () => {
          const data = store.get(id);
          return {
            exists: !!data,
            id,
            data: () => data ? JSON.parse(JSON.stringify(data)) : void 0
          };
        },
        set: async (data, options) => {
          if (parent.shouldFailWrites) {
            throw new Error(parent.failureErrorMessage);
          }
          const existing = store.get(id) || {};
          const merged = options?.merge ? { ...existing, ...data } : { ...data };
          store.set(id, JSON.parse(JSON.stringify(merged)));
        },
        delete: async () => {
          if (parent.shouldFailWrites) {
            throw new Error(parent.failureErrorMessage);
          }
          store.delete(id);
        }
      }),
      where: (field, op, value) => ({
        where: (field2, op2, value2) => ({
          get: async () => {
            const docs = [];
            for (const [id, data] of store.entries()) {
              if (op === "==" && data[field] === value && op2 === "==" && data[field2] === value2) {
                docs.push({
                  id,
                  data: () => JSON.parse(JSON.stringify(data))
                });
              }
            }
            return { docs };
          }
        }),
        get: async () => {
          const docs = [];
          for (const [id, data] of store.entries()) {
            if (op === "==" && data[field] === value) {
              docs.push({
                id,
                data: () => JSON.parse(JSON.stringify(data))
              });
            }
          }
          return { docs };
        }
      })
    };
  }
  async runTransaction(updateFunction) {
    if (this.shouldFailWrites) {
      throw new Error(this.failureErrorMessage);
    }
    const self = this;
    const transaction = {
      get: async (docRef) => docRef.get(),
      set: (docRef, data, options) => docRef.set(data, options),
      delete: (docRef) => docRef.delete()
    };
    return await updateFunction(transaction);
  }
};
var customAdminDbOverride = null;
var defaultInMemoryDb = null;
function isNonTestDeploymentOrVercel() {
  if (process.env.VERCEL === "1") return true;
  if (process.env.VERCEL_ENV !== void 0 && process.env.VERCEL_ENV !== "") return true;
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production" || nodeEnv === "staging" || nodeEnv === "preview") return true;
  return false;
}
function isExplicitTestEnvironment() {
  if (globalThis.__TEST_ENV__ === false) {
    return false;
  }
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.JEST_WORKER_ID !== void 0 || process.env.IS_TEST_SUITE === "1" || Boolean(globalThis.__TEST_ENV__) || Array.isArray(process.argv) && process.argv.some((arg) => arg.includes(".test.") || arg.includes("/tests/"));
}
function getInMemoryAdminFirestore() {
  if (isNonTestDeploymentOrVercel()) {
    throw new Error("Forbidden: Cannot instantiate InMemoryAdminFirestore in production, staging, preview, or Vercel deployments.");
  }
  if (!isExplicitTestEnvironment()) {
    throw new Error("Forbidden: InMemoryAdminFirestore can only be instantiated in an explicit test environment.");
  }
  if (!defaultInMemoryDb) {
    defaultInMemoryDb = new InMemoryAdminFirestore();
  }
  return defaultInMemoryDb;
}
function hasFirebaseAdminCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return true;
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return true;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return true;
  }
  return false;
}
var cachedAdminApp = null;
var cachedAdminFirestore = null;
function initializeAdminApp() {
  if ((0, import_app2.getApps)().length > 0) {
    return (0, import_app2.getApp)();
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || FIREBASE_CONFIG.projectId;
  const saKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (saKeyJson) {
    try {
      const parsed = JSON.parse(saKeyJson);
      return (0, import_app2.initializeApp)({
        credential: (0, import_app2.cert)(parsed),
        projectId: parsed.project_id || projectId
      });
    } catch (err) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${err?.message || err}`);
    }
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    return (0, import_app2.initializeApp)({
      credential: (0, import_app2.cert)({
        projectId,
        clientEmail,
        privateKey
      }),
      projectId
    });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT) {
    return (0, import_app2.initializeApp)({
      credential: (0, import_app2.applicationDefault)(),
      projectId
    });
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return (0, import_app2.initializeApp)({ projectId });
  }
  throw new Error(
    "Firebase Admin credentials missing: Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel environment variables."
  );
}
function getAuthoritativeFirestore() {
  const isDeployment = isNonTestDeploymentOrVercel();
  if (isDeployment) {
    customAdminDbOverride = null;
    const hasCreds2 = hasFirebaseAdminCredentials();
    if (!hasCreds2) {
      throw new Error(
        "Firebase Admin credentials missing: Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel environment variables."
      );
    }
    if (cachedAdminFirestore) {
      return cachedAdminFirestore;
    }
    if (!cachedAdminApp) {
      cachedAdminApp = initializeAdminApp();
    }
    const dbId2 = process.env.FIREBASE_DATABASE_ID || FIREBASE_CONFIG.firestoreDatabaseId;
    const db3 = (0, import_firestore2.getFirestore)(cachedAdminApp, dbId2);
    db3.settings({ ignoreUndefinedProperties: true });
    cachedAdminFirestore = db3;
    return cachedAdminFirestore;
  }
  if (customAdminDbOverride) {
    if (!isExplicitTestEnvironment()) {
      customAdminDbOverride = null;
      throw new Error("Forbidden: Test override is only permitted in an explicit test environment.");
    }
    return customAdminDbOverride;
  }
  const hasCreds = hasFirebaseAdminCredentials();
  if (!hasCreds) {
    const isTest = isExplicitTestEnvironment();
    if (!isTest) {
      throw new Error(
        "Firebase Admin credentials missing: Firebase Admin SDK requires credentials in production and non-test environments. Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in environment variables."
      );
    }
    return getInMemoryAdminFirestore();
  }
  if (cachedAdminFirestore) {
    return cachedAdminFirestore;
  }
  if (!cachedAdminApp) {
    cachedAdminApp = initializeAdminApp();
  }
  const dbId = process.env.FIREBASE_DATABASE_ID || FIREBASE_CONFIG.firestoreDatabaseId;
  const db2 = (0, import_firestore2.getFirestore)(cachedAdminApp, dbId);
  db2.settings({ ignoreUndefinedProperties: true });
  cachedAdminFirestore = db2;
  return cachedAdminFirestore;
}
function cleanForFirestore(obj) {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== void 0) {
      if (val !== null && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanForFirestore(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}
async function getAuthoritativeAssignment(id) {
  if (!id || typeof id !== "string") return null;
  const db2 = getAuthoritativeFirestore();
  const snap = await db2.collection("homework_assignments").doc(id.trim()).get();
  if (!snap.exists) return null;
  return snap.data();
}
async function listAuthoritativeAssignments(ownerUid) {
  if (!ownerUid || typeof ownerUid !== "string") return [];
  const db2 = getAuthoritativeFirestore();
  const snap = await db2.collection("homework_assignments").where("ownerUid", "==", ownerUid.trim()).get();
  return snap.docs.map((d) => d.data());
}
async function saveAuthoritativeAssignment(assignment, verifiedOwnerUid) {
  if (!assignment || !assignment.id) {
    throw new Error("Assignment must contain a valid id");
  }
  if (!verifiedOwnerUid) {
    throw new Error("Unauthorized: verified ownerUid is required");
  }
  const cleanId = String(assignment.id).trim();
  const db2 = getAuthoritativeFirestore();
  const docRef = db2.collection("homework_assignments").doc(cleanId);
  const existingSnap = await docRef.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data();
    const existingOwner = String(existing.ownerUid || "").trim();
    if (existingOwner && existingOwner !== verifiedOwnerUid) {
      const err = new Error("Forbidden: Cannot overwrite assignment belonging to another teacher account");
      err.status = 403;
      throw err;
    }
  }
  const cleaned = cleanForFirestore({
    ...assignment,
    id: cleanId,
    ownerUid: verifiedOwnerUid,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  delete cleaned.ownerEmail;
  await docRef.set(cleaned, { merge: true });
  return cleaned;
}
async function listAuthoritativeSubmissions(ownerUid, assignmentId) {
  if (!ownerUid || typeof ownerUid !== "string") return [];
  const db2 = getAuthoritativeFirestore();
  const snap = await db2.collection("homework_submissions").where("ownerUid", "==", ownerUid.trim()).get();
  const all = snap.docs.map((d) => d.data());
  if (assignmentId) {
    const cleanAssignmentId = String(assignmentId).trim();
    return all.filter((s) => s.assignmentId === cleanAssignmentId);
  }
  return all;
}
async function saveAuthoritativeSubmission(submission, parentAssignment) {
  if (!submission || !submission.id) {
    throw new Error("Submission must contain a valid id");
  }
  if (!parentAssignment || !parentAssignment.id) {
    const err = new Error("Parent assignment not found");
    err.status = 404;
    throw err;
  }
  const assignmentOwnerUid = String(parentAssignment.ownerUid || "").trim();
  const subId = String(submission.id).trim();
  const db2 = getAuthoritativeFirestore();
  const docRef = db2.collection("homework_submissions").doc(subId);
  const cleaned = cleanForFirestore({
    ...submission,
    id: subId,
    assignmentId: String(parentAssignment.id).trim(),
    ...assignmentOwnerUid ? { ownerUid: assignmentOwnerUid } : {},
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  delete cleaned.assignmentFallback;
  delete cleaned.ownerEmail;
  let isIdempotentRetry = false;
  await db2.runTransaction(async (t) => {
    const existingSnap = await t.get(docRef);
    if (existingSnap.exists) {
      const existing = existingSnap.data();
      const existingOwner = String(existing.ownerUid || "").trim();
      if (existingOwner && assignmentOwnerUid && existingOwner !== assignmentOwnerUid) {
        const err = new Error("Forbidden: Cannot overwrite submission belonging to another teacher account");
        err.status = 403;
        throw err;
      }
      const existingName = String(existing.studentName || "").trim().toLowerCase();
      const incomingName = String(cleaned.studentName || "").trim().toLowerCase();
      if (existingName && incomingName && existingName !== incomingName) {
        const err = new Error("Forbidden: Cannot change studentName on an existing submission");
        err.status = 403;
        throw err;
      }
      if (existing.attemptSecret && String(cleaned.attemptSecret || "").trim() !== String(existing.attemptSecret).trim()) {
        const err = new Error("Forbidden: Invalid attemptSecret for existing submission");
        err.status = 403;
        throw err;
      }
      const existingCompleted = existing.status === "completed" || !existing.status && Boolean(existing.completedAt);
      if (existingCompleted) {
        const isIdentical = existing.score === cleaned.score && existing.accuracyPercent === cleaned.accuracyPercent && existing.scorePercentage === cleaned.scorePercentage && existing.studentName === cleaned.studentName;
        if (isIdentical) {
          isIdempotentRetry = true;
          return;
        }
        const err = new Error("Conflict: Completed submission is locked and cannot be overwritten");
        err.status = 409;
        throw err;
      }
    }
    t.set(docRef, cleaned, { merge: true });
  });
  return { submission: cleaned, isIdempotentRetry };
}

// src/api/expressApp.ts
var app2 = (0, import_express.default)();
app2.use(import_express.default.json({ limit: "50mb" }));
app2.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
async function getServerAssignment(id) {
  return await getAuthoritativeAssignment(id);
}
async function listServerAssignments(ownerUid) {
  return await listAuthoritativeAssignments(ownerUid);
}
async function saveServerAssignment(normalized, verifiedUid) {
  return await saveAuthoritativeAssignment(normalized, verifiedUid);
}
async function listServerSubmissions(ownerUid, assignmentId) {
  return await listAuthoritativeSubmissions(ownerUid, assignmentId);
}
async function saveServerSubmission(sub, targetHw) {
  const { submission: saved } = await saveAuthoritativeSubmission(sub, targetHw);
  return saved;
}
var serverGoldCache = null;
var SERVER_GOLD_CACHE_TTL = 3 * 60 * 1e3;
app2.all("/api/health", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).json({ status: "ok" });
});
app2.get("/api/gold-price", async (req, res) => {
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
        usdToEgp: Math.round(usdToEgp * 100) / 100,
        lastSuccessfulUpdateMs: now
      };
      serverGoldCache = { data: result, timestamp: now };
      return res.json(result);
    }
    if (serverGoldCache) {
      const isFresh = now - serverGoldCache.timestamp < SERVER_GOLD_CACHE_TTL;
      return res.json({
        ...serverGoldCache.data,
        status: isFresh ? "cached" : "stale"
      });
    }
    const fallbackResult = {
      pricePerGram24K: 7090,
      currency: "EGP",
      source: "\u0645\u062A\u0648\u0633\u0637 \u0633\u0648\u0642 \u0627\u0644\u0630\u0647\u0628 \u0627\u0644\u0645\u0635\u0631\u064A (\u062A\u0642\u062F\u064A\u0631\u064A)",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      success: true,
      status: "estimated"
    };
    return res.json(fallbackResult);
  } catch (err) {
    console.error("Gold price route error:", err);
    if (serverGoldCache) {
      return res.json({
        ...serverGoldCache.data,
        status: "stale"
      });
    }
    return res.status(500).json({
      pricePerGram24K: 0,
      currency: "EGP",
      source: "Error",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      success: false,
      status: "unavailable",
      error: err.message || "Failed to fetch gold price"
    });
  }
});
app2.get("/api/hod/dashboard/timetable", (req, res) => {
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
app2.post("/api/hod/dashboard/action", (req, res) => {
  const { actionType, payload } = req.body;
  res.json({ success: true, actionType, id: Date.now().toString(), payload, timestamp: Date.now() });
});
app2.get("/api/tts", async (req, res) => {
  try {
    const text = (req.query.text || "").trim();
    const lang = (req.query.lang || "de").trim();
    if (!text) {
      return res.status(400).json({ error: "Missing text parameter" });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: "Text parameter exceeds maximum length of 500 characters" });
    }
    const allowedLangs = /* @__PURE__ */ new Set(["de", "ar", "en", "de-DE", "ar-SA", "en-US"]);
    if (!allowedLangs.has(lang)) {
      return res.status(400).json({ error: "Unsupported language code" });
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
function isServerAssignmentOpen(hw) {
  if (!hw || !hw.id) return false;
  if (hw.deleted === true) return false;
  if (hw.isActive === false) return false;
  if (hw.status === "closed") return false;
  return true;
}
function sanitizePublicSetSnapshot(rawSnapshot) {
  if (!rawSnapshot || typeof rawSnapshot !== "object") return null;
  const rawItems = Array.isArray(rawSnapshot.items) ? rawSnapshot.items : [];
  const sanitizedItems = rawItems.map((item) => {
    if (!item || typeof item !== "object") return {};
    const cleanItem = {
      id: String(item.id || ""),
      german: String(item.german || ""),
      arabic: String(item.arabic || "")
    };
    if (item.article) cleanItem.article = item.article;
    if (item.english) cleanItem.english = String(item.english);
    if (item.plural) cleanItem.plural = String(item.plural);
    if (item.exampleSentenceGerman) cleanItem.exampleSentenceGerman = String(item.exampleSentenceGerman);
    if (item.exampleSentenceArabic) cleanItem.exampleSentenceArabic = String(item.exampleSentenceArabic);
    if (item.imageUrl) cleanItem.imageUrl = String(item.imageUrl);
    if (item.emoji) cleanItem.emoji = String(item.emoji);
    if (item.missingLetterWord) cleanItem.missingLetterWord = String(item.missingLetterWord);
    if (Array.isArray(item.sentence4Elements)) {
      cleanItem.sentence4Elements = item.sentence4Elements.slice(0, 4).map(String);
    }
    if (item.wordType) cleanItem.wordType = item.wordType;
    if (item.conjugation && typeof item.conjugation === "object") {
      cleanItem.conjugation = item.conjugation;
    }
    if (item.category) cleanItem.category = String(item.category);
    if (Array.isArray(item.syllables)) {
      cleanItem.syllables = item.syllables.map(String);
    }
    return cleanItem;
  });
  const rawExercises = Array.isArray(rawSnapshot.customExercises) ? rawSnapshot.customExercises : [];
  const sanitizedExercises = rawExercises.map((ex) => {
    if (!ex || typeof ex !== "object") return {};
    const cleanEx = {
      id: String(ex.id || ""),
      type: ex.type || "multiple_choice",
      question: String(ex.question || ex.prompt || "")
    };
    if (Array.isArray(ex.options)) {
      cleanEx.options = ex.options.map(String);
    }
    if (ex.itemRefId) {
      cleanEx.itemRefId = String(ex.itemRefId);
    }
    return cleanEx;
  });
  const sanitizedSnapshot = {
    id: String(rawSnapshot.id || ""),
    title: String(rawSnapshot.title || ""),
    level: rawSnapshot.level || "A1",
    topic: String(rawSnapshot.topic || rawSnapshot.category || ""),
    difficulty: rawSnapshot.difficulty || "medium",
    items: sanitizedItems
  };
  if (rawSnapshot.category) sanitizedSnapshot.category = String(rawSnapshot.category);
  if (rawSnapshot.hasArticles !== void 0) sanitizedSnapshot.hasArticles = Boolean(rawSnapshot.hasArticles);
  if (rawSnapshot.sentenceBuilderSupported !== void 0) {
    sanitizedSnapshot.sentenceBuilderSupported = Boolean(rawSnapshot.sentenceBuilderSupported);
  }
  if (sanitizedExercises.length > 0) {
    sanitizedSnapshot.customExercises = sanitizedExercises;
  }
  return sanitizedSnapshot;
}
function toPublicAssignmentDto(hw) {
  if (!hw || typeof hw !== "object") return hw;
  const normalized = normalizeServerAssignment(hw);
  const mode = resolveServerAudienceMode(normalized);
  const publicDto = {
    id: String(normalized.id || ""),
    title: String(normalized.title || ""),
    createdAt: String(normalized.createdAt || ""),
    isActive: Boolean(normalized.isActive),
    audienceMode: mode,
    allowedGameModes: Array.isArray(normalized.allowedGameModes) ? normalized.allowedGameModes : ["classic_quiz"],
    questionCount: typeof normalized.questionCount === "number" ? normalized.questionCount : void 0,
    ...typeof normalized.targetQuestionCount === "number" ? { targetQuestionCount: normalized.targetQuestionCount } : {},
    ...Array.isArray(normalized.questionTypes) ? { questionTypes: normalized.questionTypes } : {},
    ...normalized.questionTypeCounts && typeof normalized.questionTypeCounts === "object" ? { questionTypeCounts: normalized.questionTypeCounts } : {},
    ...Array.isArray(normalized.selectedItemIds) ? { selectedItemIds: normalized.selectedItemIds } : {},
    ...normalized.flowMode ? { flowMode: String(normalized.flowMode) } : {},
    ...normalized.blooketMode ? { blooketMode: String(normalized.blooketMode) } : {},
    maxAttempts: typeof normalized.maxAttempts === "number" ? normalized.maxAttempts : void 0,
    allowReplay: typeof normalized.allowReplay === "boolean" ? normalized.allowReplay : true,
    setSnapshot: sanitizePublicSetSnapshot(normalized.setSnapshot),
    ...normalized.status ? { status: String(normalized.status) } : {}
  };
  if (mode === "group") {
    publicDto.groupId = String(normalized.groupId || "");
    publicDto.groupName = String(normalized.groupName || "");
    if (Array.isArray(normalized.assignedStudents)) {
      publicDto.assignedStudents = normalized.assignedStudents.map((st) => ({
        id: String(st.id || ""),
        name: String(st.name || ""),
        groupId: String(st.groupId || normalized.groupId || "")
      }));
    } else {
      publicDto.assignedStudents = [];
    }
  }
  return publicDto;
}
function sanitizePublicAssignmentInfo(hw) {
  return toPublicAssignmentDto(hw);
}
function validateServerSubmission(hw, body) {
  const cleanSubmittedName = String(body?.studentName || "").trim();
  if (!hw || !hw.id) {
    return {
      valid: false,
      status: 404,
      error: "Assignment not found",
      audienceMode: "open"
    };
  }
  if (!isServerAssignmentOpen(hw)) {
    return {
      valid: false,
      status: 403,
      error: "Assignment is closed or inactive and no longer accepts submissions",
      audienceMode: resolveServerAudienceMode(hw)
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
app2.all("/api/teacher/assignments", async (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!bearerToken) {
    return res.status(401).json({
      error: "Unauthorized: Firebase Bearer token is required to access teacher assignments",
      assignments: []
    });
  }
  const verification = await verifyFirebaseIdToken(bearerToken);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error || "Invalid Firebase ID token"}`,
      assignments: []
    });
  }
  const verifiedUid = verification.payload.sub;
  if (req.method === "GET") {
    const requestedOwnerUid = String(req.query.ownerUid || req.headers["x-owner-uid"] || "").trim();
    if (requestedOwnerUid && requestedOwnerUid !== verifiedUid) {
      return res.status(403).json({
        error: "Forbidden: ownerUid does not match authenticated Firebase token",
        assignments: []
      });
    }
    const ownerUid = verifiedUid;
    const filtered = await listServerAssignments(ownerUid);
    return res.json({ assignments: filtered.map(normalizeServerAssignment) });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const bodyOwnerUid = String(body.ownerUid || req.headers["x-owner-uid"] || "").trim();
    if (bodyOwnerUid && bodyOwnerUid !== verifiedUid) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Assignment ownerUid does not match authenticated Firebase token"
      });
    }
    const effectiveOwnerUid = verifiedUid;
    if (body.audienceMode === "group") {
      const gid = String(body.groupId || "").trim();
      if (!gid || gid === "all") {
        return res.status(400).json({
          success: false,
          error: "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0645\u062C\u0645\u0648\u0639\u0629 \u0635\u0627\u0644\u062D\u0629 \u0639\u0646\u062F \u0627\u062E\u062A\u064A\u0627\u0631 \u062C\u0631\u0648\u0628 \u0645\u0639\u064A\u0646."
        });
      }
    }
    const normalized = normalizeServerAssignment({
      ...body,
      ownerUid: effectiveOwnerUid
    });
    delete normalized.ownerEmail;
    if (normalized.id) {
      try {
        const saved = await saveServerAssignment(normalized, effectiveOwnerUid);
        return res.json({ success: true, assignment: saved });
      } catch (err) {
        return res.status(err?.status || 500).json({
          success: false,
          error: err?.message || "Failed to persist assignment to database"
        });
      }
    }
    return res.json({ success: true, assignment: normalized });
  }
  return res.json({ success: true });
});
app2.all("/api/homework/submissions", async (req, res) => {
  if (req.method === "GET") {
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!bearerToken) {
      return res.status(401).json({
        error: "Unauthorized: Firebase Bearer token is required to list submissions",
        submissions: []
      });
    }
    const verification = await verifyFirebaseIdToken(bearerToken);
    if (!verification.isValid || !verification.payload) {
      return res.status(401).json({
        error: `Unauthorized: ${verification.error || "Invalid Firebase ID token"}`,
        submissions: []
      });
    }
    const verifiedUid = verification.payload.sub;
    const assignmentId = req.query.assignmentId ? String(req.query.assignmentId).trim() : null;
    const requestedOwnerUid = String(req.query.ownerUid || req.headers["x-owner-uid"] || "").trim();
    if (requestedOwnerUid && requestedOwnerUid !== verifiedUid) {
      return res.status(403).json({
        error: "Forbidden: ownerUid does not match authenticated Firebase token",
        submissions: []
      });
    }
    const ownerUid = verifiedUid;
    if (assignmentId) {
      const targetHw = await getServerAssignment(assignmentId);
      if (targetHw && targetHw.ownerUid && String(targetHw.ownerUid).trim() !== ownerUid) {
        return res.status(403).json({
          error: "Forbidden: Assignment belongs to another teacher account",
          submissions: []
        });
      }
    }
    const list = await listServerSubmissions(ownerUid, assignmentId);
    return res.json({ submissions: list });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const targetHw = await getServerAssignment(body.assignmentId);
    if (!targetHw) {
      return res.status(404).json({
        success: false,
        error: "Assignment not found"
      });
    }
    if (!isServerAssignmentOpen(targetHw)) {
      return res.status(403).json({
        success: false,
        error: "Assignment is closed or inactive and no longer accepts submissions"
      });
    }
    const hwOwnerUid = String(targetHw?.ownerUid || "").trim();
    const bodyOwnerUid = String(body?.ownerUid || "").trim();
    if (hwOwnerUid && bodyOwnerUid && hwOwnerUid !== bodyOwnerUid) {
      return res.status(403).json({
        success: false,
        error: "Submission ownerUid does not match assignment ownerUid"
      });
    }
    const check = validateServerSubmission(targetHw, body);
    if (!check.valid) {
      return res.status(check.status || 403).json({
        success: false,
        error: check.error || "Submission validation failed"
      });
    }
    const resolvedOwnerUid = hwOwnerUid || bodyOwnerUid || void 0;
    const cleanSub = {
      ...body,
      ...resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {},
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      groupId: check.normalizedGroupId,
      studentName: check.normalizedStudentName
    };
    delete cleanSub.assignmentFallback;
    if (cleanSub.id) {
      try {
        const saved = await saveServerSubmission(cleanSub, targetHw);
        return res.json({ success: true, submission: saved });
      } catch (err) {
        return res.status(err?.status || 500).json({
          success: false,
          error: err?.message || "Failed to persist submission to database"
        });
      }
    }
    return res.json({ success: true, submission: cleanSub });
  }
  return res.json({ success: true });
});
app2.get("/api/homework/info", async (req, res) => {
  const id = String(req.query.id || "").trim();
  const token = req.query.token !== void 0 && req.query.token !== null ? String(req.query.token).trim() : "";
  const found = await getServerAssignment(id);
  if (!found) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  if (!isServerAssignmentOpen(found)) {
    return res.status(403).json({ error: "Assignment is closed or inactive" });
  }
  const configuredShareToken = found.shareToken !== void 0 && found.shareToken !== null ? String(found.shareToken).trim() : "";
  if (configuredShareToken) {
    if (!token || token !== configuredShareToken) {
      return res.status(403).json({ error: "Forbidden: Valid share token is required to access this assignment" });
    }
  }
  return res.json(sanitizePublicAssignmentInfo(found));
});
app2.post("/api/homework/submit", async (req, res) => {
  const body = req.body || {};
  const targetHw = await getServerAssignment(body.assignmentId);
  if (!targetHw) {
    return res.status(404).json({
      success: false,
      error: "Assignment not found"
    });
  }
  if (!isServerAssignmentOpen(targetHw)) {
    return res.status(403).json({
      success: false,
      error: "Assignment is closed or inactive and no longer accepts submissions"
    });
  }
  const configuredShareToken = targetHw.shareToken !== void 0 && targetHw.shareToken !== null ? String(targetHw.shareToken).trim() : "";
  if (configuredShareToken) {
    const providedToken = String(body.token || body.shareToken || req.query.token || "").trim();
    if (providedToken && providedToken !== configuredShareToken) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Invalid share token provided for assignment submission"
      });
    }
  }
  const hwOwnerUid = String(targetHw?.ownerUid || "").trim();
  const bodyOwnerUid = String(body?.ownerUid || "").trim();
  if (hwOwnerUid && bodyOwnerUid && hwOwnerUid !== bodyOwnerUid) {
    return res.status(403).json({
      success: false,
      error: "Submission ownerUid does not match assignment ownerUid"
    });
  }
  const check = validateServerSubmission(targetHw, body);
  if (!check.valid) {
    return res.status(check.status || 403).json({
      success: false,
      error: check.error || "Submission rejected"
    });
  }
  const responses = Array.isArray(body.responses) ? body.responses : [];
  const setSnapshot = targetHw?.setSnapshot || {};
  const verifiedResponses = responses.map((r) => {
    if (!r || typeof r !== "object") return r;
    const targetQId = r.exerciseId || r.questionId || r.itemId || r.id;
    const serverExercises = Array.isArray(setSnapshot?.customExercises) ? setSnapshot.customExercises : [];
    if (targetQId && serverExercises.length > 0) {
      const match = serverExercises.find((ex) => String(ex.id) === String(targetQId));
      if (match && match.correctAnswer !== void 0 && match.correctAnswer !== null) {
        const studentAns = String(r.selectedAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? "").trim();
        const expected = String(match.correctAnswer).trim();
        const isActuallyCorrect = studentAns.toLowerCase() === expected.toLowerCase();
        return {
          ...r,
          isCorrect: isActuallyCorrect
        };
      }
    }
    const serverItems = Array.isArray(setSnapshot?.items) ? setSnapshot.items : [];
    if (targetQId && serverItems.length > 0) {
      const itemMatch = serverItems.find((it) => String(it.id) === String(targetQId));
      if (itemMatch) {
        const studentAns = String(r.selectedAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? "").trim();
        const type = String(r.type || r.mode || "").toLowerCase();
        let expected;
        if (type.includes("article") || type.includes("der_die_das") || r.expectedField === "article") {
          expected = itemMatch.article;
        } else if (type.includes("missing") || r.expectedField === "missingLetterWord") {
          expected = itemMatch.missingLetterWord || itemMatch.german;
        } else if (type.includes("sentence") || type.includes("order") || r.expectedField === "exampleSentenceGerman") {
          expected = itemMatch.exampleSentenceGerman || (Array.isArray(itemMatch.sentence4Elements) ? itemMatch.sentence4Elements.join(" ") : itemMatch.german);
        } else if (type.includes("arabic") || r.expectedField === "arabic") {
          expected = itemMatch.arabic;
        } else if (type.includes("german") || type.includes("vocab") || type.includes("translation") || r.expectedField === "german") {
          expected = itemMatch.german;
        } else {
          expected = itemMatch.german || itemMatch.arabic;
        }
        if (expected !== void 0 && expected !== null) {
          const isActuallyCorrect = studentAns.toLowerCase() === String(expected).trim().toLowerCase();
          return {
            ...r,
            isCorrect: isActuallyCorrect
          };
        }
      }
    }
    return r;
  });
  const correctCount = verifiedResponses.filter((r) => r && r.isCorrect).length;
  const totalQ = verifiedResponses.length;
  const pct = totalQ > 0 ? Math.round(correctCount / totalQ * 100) : 0;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const startMs = body.startedAt ? new Date(body.startedAt).getTime() : Date.now() - totalQ * 4e3;
  const timeSpentSeconds = Math.max(5, Math.round((Date.now() - startMs) / 1e3));
  const resolvedOwnerUid = hwOwnerUid || bodyOwnerUid || void 0;
  const submission = {
    id: body.id || `sub_${body.assignmentId || "hw"}_${Date.now()}`,
    assignmentId: body.assignmentId,
    ...resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {},
    ...body.attemptSecret ? { attemptSecret: String(body.attemptSecret).trim() } : {},
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
    responses: verifiedResponses
  };
  try {
    const saved = await saveServerSubmission(submission, targetHw);
    return res.json({ success: true, submission: saved });
  } catch (err) {
    return res.status(err?.status || 500).json({
      success: false,
      error: err?.message || "Failed to persist submission to database"
    });
  }
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
  let cert2;
  if (certsOverride) {
    cert2 = certsOverride[header.kid];
  } else {
    const certs = await getGooglePublicCerts(header.kid);
    cert2 = certs[header.kid];
  }
  if (!cert2) {
    return {
      isValid: false,
      payload: null,
      error: `Matching Google public certificate unavailable for kid: ${header.kid}`
    };
  }
  try {
    const verifier = import_crypto.default.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isSignatureValid = verifier.verify(cert2, parts[2], "base64url");
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
app2.all("/api/workspace/delta", async (req, res) => {
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
app2.post("/api/android/generate-keystore", async (req, res) => {
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
var expressApp_default = app2;

// server.ts
async function startServer() {
  const app3 = (0, import_express2.default)();
  const PORT = 3e3;
  app3.use(expressApp_default);
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app3.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app3.use(import_express2.default.static(distPath));
    app3.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app3.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
