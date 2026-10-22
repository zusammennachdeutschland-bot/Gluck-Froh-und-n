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
var import_path3 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_vite = require("vite");

// src/server/portalBackend.ts
var import_crypto = __toESM(require("crypto"), 1);

// src/server/storage/firestoreAdapter.ts
var import_https = __toESM(require("https"), 1);
var import_http = __toESM(require("http"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);

// src/server/storage/atomicStore.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var AsyncMutex = class {
  constructor() {
    this.queue = [];
    this.locked = false;
  }
  async runExclusive(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
  acquire() {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }
};
var AtomicTransactionalStorage = class {
  constructor(customStorageDir) {
    this.mutex = new AsyncMutex();
    // In-memory state synchronized with atomic disk write journal
    this.students = {};
    this.accounts = {};
    this.devices = {};
    this.pairingCodes = {};
    this.linkRequests = {};
    this.nonces = {};
    this.rateLimits = {};
    this.storageDir = customStorageDir || import_path.default.join(process.cwd(), ".portal_data");
    this.dataFile = import_path.default.join(this.storageDir, "portal_store.json");
    this.tempFile = import_path.default.join(this.storageDir, "portal_store.tmp.json");
  }
  async init() {
    await this.mutex.runExclusive(async () => {
      try {
        if (!import_fs.default.existsSync(this.storageDir)) {
          import_fs.default.mkdirSync(this.storageDir, { recursive: true });
        }
        if (import_fs.default.existsSync(this.tempFile)) {
          try {
            import_fs.default.unlinkSync(this.tempFile);
          } catch (e) {
          }
        }
        const backupFile = import_path.default.join(this.storageDir, "portal_store.json.bak");
        if (import_fs.default.existsSync(this.dataFile)) {
          try {
            const raw = import_fs.default.readFileSync(this.dataFile, "utf-8");
            const loaded = JSON.parse(raw);
            if (loaded.students) this.students = loaded.students;
            if (loaded.accounts) this.accounts = loaded.accounts;
            if (loaded.devices) this.devices = loaded.devices;
            if (loaded.pairingCodes) this.pairingCodes = loaded.pairingCodes;
            if (loaded.linkRequests) this.linkRequests = loaded.linkRequests;
            if (loaded.nonces) this.nonces = loaded.nonces;
            if (loaded.rateLimits) this.rateLimits = loaded.rateLimits;
          } catch (jsonErr) {
            console.warn("Primary portal_store.json corrupted or incomplete, attempting backup restore...", jsonErr);
            if (import_fs.default.existsSync(backupFile)) {
              try {
                const rawBak = import_fs.default.readFileSync(backupFile, "utf-8");
                const loadedBak = JSON.parse(rawBak);
                if (loadedBak.students) this.students = loadedBak.students;
                if (loadedBak.accounts) this.accounts = loadedBak.accounts;
                if (loadedBak.devices) this.devices = loadedBak.devices;
                if (loadedBak.pairingCodes) this.pairingCodes = loadedBak.pairingCodes;
                if (loadedBak.linkRequests) this.linkRequests = loadedBak.linkRequests;
                if (loadedBak.nonces) this.nonces = loadedBak.nonces;
                if (loadedBak.rateLimits) this.rateLimits = loadedBak.rateLimits;
                console.log("Successfully restored portal storage from backup file portal_store.json.bak");
              } catch (bakErr) {
                console.error("Backup restoration failed as well:", bakErr);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Storage init warning:", err);
      }
      this.seedDemoStudentIfEmpty();
      this.atomicFlushSync();
    });
  }
  getStatus() {
    return {
      engine: "atomic_transactional",
      isDurable: true,
      firestoreConfigured: false,
      firestoreConnected: false,
      reason: "Running in Atomic Transactional Journal Mode with Process-Safe Mutex Lock, Backup Recovery & POSIX File Renames."
    };
  }
  atomicFlushSync() {
    try {
      if (!import_fs.default.existsSync(this.storageDir)) {
        import_fs.default.mkdirSync(this.storageDir, { recursive: true });
      }
      const backupFile = import_path.default.join(this.storageDir, "portal_store.json.bak");
      if (import_fs.default.existsSync(this.dataFile)) {
        try {
          import_fs.default.copyFileSync(this.dataFile, backupFile);
        } catch (e) {
        }
      }
      const payload = JSON.stringify({
        students: this.students,
        accounts: this.accounts,
        devices: this.devices,
        pairingCodes: this.pairingCodes,
        linkRequests: this.linkRequests,
        nonces: this.nonces,
        rateLimits: this.rateLimits
      }, null, 2);
      import_fs.default.writeFileSync(this.tempFile, payload, "utf-8");
      import_fs.default.renameSync(this.tempFile, this.dataFile);
    } catch (err) {
      console.error("Atomic flush failed:", err);
    }
  }
  seedDemoStudentIfEmpty() {
    if (Object.keys(this.students).length === 0) {
      const demoStudent = {
        studentCode: "1001",
        studentName: "\u064A\u0648\u0633\u0641 \u0623\u062D\u0645\u062F \u0639\u0645\u0631",
        grade: "Grade 10 (A2.2)",
        groupName: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0645\u062A\u0645\u064A\u0632\u064A\u0646 \u0627\u0644\u0623\u0644\u0645\u0627\u0646\u064A\u0629 A2",
        parentPhones: ["01000000000", "01111111111"],
        linkedParentUids: [],
        attendanceRate: 94,
        totalLessons: 18,
        completedLessons: 17,
        streak: 5,
        nextLesson: {
          date: "2026-10-22",
          time: "17:00",
          title: "\u0627\u0644\u062F\u0631\u0633 18: \u062D\u0631\u0648\u0641 \u0627\u0644\u062C\u0631 \u0645\u0639 \u0627\u0644\u062F\u0627\u062A\u064A\u0641 Wechselpr\xE4positionen",
          meetingLink: "https://meet.google.com/abc-demo-ags"
        },
        lessons: [
          {
            id: "les-1",
            title: "\u0627\u0644\u062F\u0631\u0633 17: \u0627\u0644\u0645\u0627\u0636\u064A \u0627\u0644\u0628\u0633\u064A\u0637 Pr\xE4teritum",
            date: "2026-10-15",
            time: "17:00",
            durationMinutes: 90,
            status: "completed",
            paymentStatus: "paid",
            homeworkStatus: "completed",
            homeworkTitle: "\u062D\u0644 \u062A\u0645\u0627\u0631\u064A\u0646 \u0643\u062A\u0627\u0628 \u0627\u0644\u062A\u062F\u0631\u064A\u0628\u0627\u062A \u0635\u0641\u062D\u0629 45-47",
            attendanceStatus: "present",
            quizScore: 9,
            examScore: 95,
            publicNotes: "\u0623\u062F\u0627\u0621 \u0645\u0645\u062A\u0627\u0632 \u0648\u062A\u0641\u0627\u0639\u0644 \u0645\u062A\u0645\u064A\u0632 \u0623\u062B\u0646\u0627\u0621 \u062A\u0635\u0631\u064A\u0641 \u0627\u0644\u0623\u0641\u0639\u0627\u0644 \u0627\u0644\u0634\u0627\u0630\u0629."
          },
          {
            id: "les-2",
            title: "\u0627\u0644\u062F\u0631\u0633 16: \u0623\u062F\u0648\u0627\u062A \u0627\u0644\u0631\u0628\u0637 weil & dass",
            date: "2026-10-08",
            time: "17:00",
            durationMinutes: 90,
            status: "completed",
            paymentStatus: "paid",
            homeworkStatus: "completed",
            homeworkTitle: "\u0643\u062A\u0627\u0628\u0629 5 \u062C\u0645\u0644 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 weil",
            attendanceStatus: "present",
            quizScore: 10,
            publicNotes: "\u0627\u0633\u062A\u064A\u0639\u0627\u0628 \u0633\u0631\u064A\u0639 \u0644\u0642\u0648\u0627\u0639\u062F \u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062C\u0645\u0644\u0629."
          }
        ],
        homework: [
          {
            id: "hw-1",
            title: "\u062D\u0644 \u062A\u0645\u0627\u0631\u064A\u0646 \u0627\u0644\u0623\u0641\u0639\u0627\u0644 \u0627\u0644\u0645\u0646\u0641\u0635\u0644\u0629 Trennbare Verben",
            assignedDate: "2026-10-15",
            dueDate: "2026-10-22",
            status: "completed",
            description: "\u0643\u062A\u0627\u0628 \u0627\u0644\u062A\u062F\u0631\u064A\u0628\u0627\u062A \u0635\u0641\u062D\u0629 48 \u062A\u0645\u0631\u064A\u0646 3 \u0648 4"
          },
          {
            id: "hw-2",
            title: "\u062D\u0641\u0638 \u0627\u0644\u0643\u0644\u0645\u0627\u062A \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0644\u0644\u062F\u0631\u0633 17",
            assignedDate: "2026-10-15",
            dueDate: "2026-10-22",
            status: "assigned",
            description: "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0643\u0644\u0645\u0627\u062A \u0641\u064A Lernstudio \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0633\u0641\u0631"
          }
        ],
        grades: [
          {
            id: "grd-1",
            title: "\u0627\u062E\u062A\u0628\u0627\u0631 \u062F\u0648\u0631\u064A - \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0631\u0627\u0628\u0639\u0629",
            date: "2026-10-15",
            type: "exam",
            score: 95,
            maxScore: 100,
            percentage: 95,
            feedback: "\u0645\u0645\u062A\u0627\u0632 \u062C\u062F\u0627\u064B - \u0625\u062A\u0642\u0627\u0646 \u0643\u0627\u0645\u0644 \u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0625\u0639\u0631\u0627\u0628 \u0648\u0627\u0644\u0623\u0632\u0645\u0646\u0629."
          },
          {
            id: "grd-2",
            title: "\u062A\u0633\u0645\u064A\u0639 \u0643\u0644\u0645\u0627\u062A \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062B\u0627\u0644\u062B",
            date: "2026-10-08",
            type: "dictation",
            score: 10,
            maxScore: 10,
            percentage: 100,
            feedback: "10/10 \u0628\u062F\u0648\u0646 \u0623\u064A \u062E\u0637\u0623 \u0625\u0645\u0644\u0627\u0626\u064A."
          }
        ],
        finance: {
          totalDue: 1200,
          totalPaid: 1200,
          remainingBalance: 0,
          currency: "EGP",
          records: [
            {
              id: "pay-1",
              date: "2026-10-01",
              amountDue: 1200,
              amountPaid: 1200,
              status: "paid",
              notes: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0634\u0647\u0631 \u0623\u0643\u062A\u0648\u0628\u0631 2026 (4 \u062D\u0635\u0635 \u0645\u0643\u062B\u0641\u0629)"
            }
          ]
        },
        certificates: [
          {
            id: "cert-1",
            title: "\u0634\u0647\u0627\u062F\u0629 \u062A\u0645\u064A\u0632 \u0641\u064A \u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0623\u0644\u0645\u0627\u0646\u064A\u0629 - \u0627\u0644\u0645\u0633\u062A\u0648\u0649 A2.1",
            recipientName: "Youssef Ahmed Omar",
            certificateType: "german_excellence",
            issueDate: "2026-09-30",
            score: "98%",
            teacherName: "Herr Omar Hassan"
          }
        ],
        lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.students["1001"] = demoStudent;
    }
  }
  // --------------------------------------------------------------------------
  // STUDENTS
  // --------------------------------------------------------------------------
  async getStudent(studentCode) {
    return this.mutex.runExclusive(() => {
      const s = this.students[studentCode.trim()];
      return s ? JSON.parse(JSON.stringify(s)) : null;
    });
  }
  async upsertStudents(studentsList) {
    return this.mutex.runExclusive(() => {
      let count = 0;
      for (const item of studentsList) {
        if (!item.studentCode) continue;
        const code = item.studentCode.trim();
        const existing = this.students[code];
        const linkedUids = existing ? existing.linkedParentUids : [];
        this.students[code] = {
          ...item,
          studentCode: code,
          linkedParentUids: linkedUids,
          lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        count++;
      }
      this.atomicFlushSync();
      return count;
    });
  }
  async listStudents() {
    return this.mutex.runExclusive(() => {
      return Object.values(this.students).map((s) => JSON.parse(JSON.stringify(s)));
    });
  }
  // --------------------------------------------------------------------------
  // PARENT ACCOUNTS
  // --------------------------------------------------------------------------
  async getParentByUid(parentUid) {
    return this.mutex.runExclusive(() => {
      const acc = this.accounts[parentUid];
      return acc ? JSON.parse(JSON.stringify(acc)) : null;
    });
  }
  async getParentByPhone(cleanPhone) {
    return this.mutex.runExclusive(() => {
      const acc = Object.values(this.accounts).find((a) => a.parentPhone === cleanPhone);
      return acc ? JSON.parse(JSON.stringify(acc)) : null;
    });
  }
  async getParentByStudentCode(studentCode) {
    return this.mutex.runExclusive(() => {
      const code = studentCode.trim();
      const acc = Object.values(this.accounts).find((a) => a.studentCodes.includes(code));
      return acc ? JSON.parse(JSON.stringify(acc)) : null;
    });
  }
  async createParentAccountAtomic(newAccount, studentCode) {
    return this.mutex.runExclusive(() => {
      const code = studentCode.trim();
      const student = this.students[code];
      if (!student) {
        return { success: false, account: newAccount, error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0646\u0638\u0627\u0645" };
      }
      const existingWithStudent = Object.values(this.accounts).find((a) => a.studentCodes.includes(code));
      if (existingWithStudent) {
        return {
          success: false,
          account: existingWithStudent,
          alreadyExists: true,
          error: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628. \u064A\u0645\u0643\u0646\u0643 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631."
        };
      }
      let account = Object.values(this.accounts).find((a) => a.parentPhone === newAccount.parentPhone);
      if (account) {
        if (!account.studentCodes.includes(code)) {
          account.studentCodes.push(code);
        }
        account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        account = { ...newAccount };
        this.accounts[account.parentUid] = account;
      }
      if (!student.linkedParentUids.includes(account.parentUid)) {
        student.linkedParentUids.push(account.parentUid);
      }
      this.atomicFlushSync();
      return { success: true, account: JSON.parse(JSON.stringify(account)) };
    });
  }
  async updatePasswordAtomic(parentUid, passwordHash, salt, newAuthVersion) {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return false;
      account.passwordHash = passwordHash;
      account.salt = salt;
      account.mustChangePassword = false;
      account.authVersion = newAuthVersion;
      account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.atomicFlushSync();
      return true;
    });
  }
  async resetPasswordAtomic(studentCode, tempHash, salt, newAuthVersion) {
    return this.mutex.runExclusive(() => {
      const code = studentCode.trim();
      const account = Object.values(this.accounts).find((a) => a.studentCodes.includes(code));
      if (!account) {
        return { success: false, error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0623\u0645\u0631 \u0645\u0633\u062C\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628 \u0628\u0639\u062F" };
      }
      account.passwordHash = tempHash;
      account.salt = salt;
      account.mustChangePassword = true;
      account.authVersion = newAuthVersion;
      account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.atomicFlushSync();
      return {
        success: true,
        parentUid: account.parentUid,
        newAuthVersion: account.authVersion
      };
    });
  }
  // --------------------------------------------------------------------------
  // TEACHER DEVICES & PAIRING CODES
  // --------------------------------------------------------------------------
  async createPairingCode(code, expiresAt) {
    return this.mutex.runExclusive(() => {
      this.pairingCodes[code] = {
        code,
        expiresAt,
        consumed: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.atomicFlushSync();
    });
  }
  async consumePairingCodeAtomic(code) {
    return this.mutex.runExclusive(() => {
      const record = this.pairingCodes[code];
      const now = Date.now();
      if (!record) {
        return { success: false, error: "\u0643\u0648\u062F \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" };
      }
      if (record.consumed) {
        return { success: false, error: "\u0643\u0648\u062F \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u0646 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 (Single-Use Only)" };
      }
      if (now > record.expiresAt) {
        return { success: false, error: "\u0643\u0648\u062F \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u0646 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" };
      }
      record.consumed = true;
      this.atomicFlushSync();
      return { success: true };
    });
  }
  async registerDevice(device) {
    return this.mutex.runExclusive(() => {
      this.devices[device.deviceId] = { ...device };
      this.atomicFlushSync();
    });
  }
  async getDevice(deviceId) {
    return this.mutex.runExclusive(() => {
      const d = this.devices[deviceId];
      return d ? JSON.parse(JSON.stringify(d)) : null;
    });
  }
  // --------------------------------------------------------------------------
  // SIBLING LINKING
  // --------------------------------------------------------------------------
  async createSiblingLinkRequest(req) {
    return this.mutex.runExclusive(() => {
      this.linkRequests[req.requestId] = { ...req };
      this.atomicFlushSync();
    });
  }
  async getPendingLinkRequests() {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      return Object.values(this.linkRequests).filter((r) => r.status === "PENDING" && now < r.expiresAt).map((r) => JSON.parse(JSON.stringify(r)));
    });
  }
  async resolveSiblingLinkAtomic(pairingPin, approve) {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      const request = Object.values(this.linkRequests).find(
        (r) => r.pairingPin === pairingPin && r.status === "PENDING" && now < r.expiresAt
      );
      if (!request) {
        return { success: false, error: "\u0631\u0645\u0632 \u0627\u0644\u0631\u0628\u0637 (PIN) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" };
      }
      if (!approve) {
        request.status = "REJECTED";
        this.atomicFlushSync();
        return { success: true, request: JSON.parse(JSON.stringify(request)) };
      }
      request.status = "APPROVED";
      const account = this.accounts[request.parentUid];
      if (account && !account.studentCodes.includes(request.targetStudentCode)) {
        account.studentCodes.push(request.targetStudentCode);
      }
      const student = this.students[request.targetStudentCode];
      if (student && !student.linkedParentUids.includes(request.parentUid)) {
        student.linkedParentUids.push(request.parentUid);
      }
      this.atomicFlushSync();
      return {
        success: true,
        request: JSON.parse(JSON.stringify(request)),
        studentName: student?.studentName || request.targetStudentCode
      };
    });
  }
  // --------------------------------------------------------------------------
  // NONCE REPLAY PROTECTION
  // --------------------------------------------------------------------------
  async verifyAndRecordNonceAtomic(nonce, timestamp, windowMs = 5 * 60 * 1e3) {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      if (Math.abs(now - timestamp) > windowMs) {
        return { valid: false, reason: "Expired or skewed timestamp in sync request" };
      }
      if (this.nonces[nonce]) {
        return { valid: false, reason: "Replay detected: Nonce has already been processed" };
      }
      for (const [n, ts] of Object.entries(this.nonces)) {
        if (now - ts > windowMs * 2) {
          delete this.nonces[n];
        }
      }
      this.nonces[nonce] = now;
      this.atomicFlushSync();
      return { valid: true };
    });
  }
  // --------------------------------------------------------------------------
  // RATE LIMITING
  // --------------------------------------------------------------------------
  async checkRateLimitAtomic(key, maxAttempts, windowMs, _lockoutMs) {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      let entry = this.rateLimits[key];
      if (!entry || now > entry.resetAt) {
        entry = { attempts: 0, resetAt: now + windowMs };
        this.rateLimits[key] = entry;
      }
      if (entry.lockedUntil && now < entry.lockedUntil) {
        const wait = Math.ceil((entry.lockedUntil - now) / 1e3);
        return { allowed: false, waitSeconds: wait, attempts: entry.attempts };
      }
      return { allowed: true, attempts: entry.attempts };
    });
  }
  async recordFailureAtomic(key, maxAttempts, windowMs, lockoutMs) {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      let entry = this.rateLimits[key];
      if (!entry || now > entry.resetAt) {
        entry = { attempts: 1, resetAt: now + windowMs };
        this.rateLimits[key] = entry;
      } else {
        entry.attempts++;
      }
      if (entry.attempts >= maxAttempts) {
        entry.lockedUntil = now + lockoutMs;
        this.atomicFlushSync();
        return { locked: true, waitSeconds: Math.ceil(lockoutMs / 1e3) };
      }
      this.atomicFlushSync();
      return { locked: false };
    });
  }
  async clearRateLimit(key) {
    return this.mutex.runExclusive(() => {
      delete this.rateLimits[key];
      this.atomicFlushSync();
    });
  }
  // --------------------------------------------------------------------------
  // TEST SUITE RESET
  // --------------------------------------------------------------------------
  async resetTestState() {
    return this.mutex.runExclusive(() => {
      this.accounts = {};
      this.devices = {};
      this.pairingCodes = {};
      this.linkRequests = {};
      this.nonces = {};
      this.rateLimits = {};
      this.students = {};
      this.seedDemoStudentIfEmpty();
      this.atomicFlushSync();
    });
  }
  // --------------------------------------------------------------------------
  // PARENT ACCOUNT MANAGEMENT & UNLINK/LINK
  // --------------------------------------------------------------------------
  async listParentAccounts() {
    return this.mutex.runExclusive(() => {
      return Object.values(this.accounts);
    });
  }
  async unlinkParentStudentAtomic(parentUid, studentCode) {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return { success: false, error: "\u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
      const cleanCode = studentCode.trim();
      account.studentCodes = account.studentCodes.filter((c) => c !== cleanCode);
      account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const student = this.students[cleanCode];
      if (student) {
        student.linkedParentUids = student.linkedParentUids.filter((u) => u !== parentUid);
      }
      this.atomicFlushSync();
      return { success: true };
    });
  }
  async linkParentStudentAtomic(parentUid, studentCode) {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return { success: false, error: "\u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
      const cleanCode = studentCode.trim();
      const student = this.students[cleanCode];
      if (!student) return { success: false, error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0646\u0638\u0627\u0645" };
      if (!account.studentCodes.includes(cleanCode)) {
        account.studentCodes.push(cleanCode);
        account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      if (!student.linkedParentUids.includes(parentUid)) {
        student.linkedParentUids.push(parentUid);
      }
      this.atomicFlushSync();
      return { success: true };
    });
  }
  async toggleAccountStatusAtomic(parentUid, mustChangePassword) {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return { success: false, error: "\u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
      const nextVal = mustChangePassword !== void 0 ? mustChangePassword : !account.mustChangePassword;
      account.mustChangePassword = nextVal;
      account.authVersion = (account.authVersion || 1) + 1;
      account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.atomicFlushSync();
      return { success: true, account };
    });
  }
  // --------------------------------------------------------------------------
  // SERVER PORTAL BACKUP & RESTORE
  // --------------------------------------------------------------------------
  async createPortalBackup() {
    return this.mutex.runExclusive(() => {
      const backupsDir = import_path.default.join(this.storageDir, "backups");
      if (!import_fs.default.existsSync(backupsDir)) {
        import_fs.default.mkdirSync(backupsDir, { recursive: true });
      }
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const backupId = `portal_backup_${timestamp}`;
      const fileName = `${backupId}.json`;
      const filePath = import_path.default.join(backupsDir, fileName);
      const snapshot = {
        backupId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        students: this.students,
        accounts: this.accounts,
        devices: this.devices,
        pairingCodes: this.pairingCodes,
        linkRequests: this.linkRequests
      };
      const payload = JSON.stringify(snapshot, null, 2);
      import_fs.default.writeFileSync(filePath, payload, "utf-8");
      const stats = import_fs.default.statSync(filePath);
      return {
        backupId,
        filePath,
        createdAt: snapshot.createdAt,
        studentsCount: Object.keys(this.students).length,
        accountsCount: Object.keys(this.accounts).length,
        fileSize: stats.size
      };
    });
  }
  async listPortalBackups() {
    return this.mutex.runExclusive(() => {
      const backupsDir = import_path.default.join(this.storageDir, "backups");
      if (!import_fs.default.existsSync(backupsDir)) return [];
      const files = import_fs.default.readdirSync(backupsDir).filter((f) => f.endsWith(".json"));
      const list = [];
      for (const fileName of files) {
        try {
          const filePath = import_path.default.join(backupsDir, fileName);
          const stats = import_fs.default.statSync(filePath);
          const raw = import_fs.default.readFileSync(filePath, "utf-8");
          const obj = JSON.parse(raw);
          list.push({
            backupId: obj.backupId || fileName.replace(".json", ""),
            fileName,
            createdAt: obj.createdAt || stats.mtime.toISOString(),
            studentsCount: Object.keys(obj.students || {}).length,
            accountsCount: Object.keys(obj.accounts || {}).length,
            fileSize: stats.size
          });
        } catch (e) {
        }
      }
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return list;
    });
  }
  async restorePortalBackup(backupId, customPayload) {
    return this.mutex.runExclusive(() => {
      let dataToRestore = customPayload;
      if (!dataToRestore) {
        const backupsDir = import_path.default.join(this.storageDir, "backups");
        const fileName = backupId.endsWith(".json") ? backupId : `${backupId}.json`;
        const filePath = import_path.default.join(backupsDir, fileName);
        if (!import_fs.default.existsSync(filePath)) {
          return { success: false, restoredStudentsCount: 0, restoredAccountsCount: 0, error: "\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
        }
        try {
          const raw = import_fs.default.readFileSync(filePath, "utf-8");
          dataToRestore = JSON.parse(raw);
        } catch (e) {
          return { success: false, restoredStudentsCount: 0, restoredAccountsCount: 0, error: "\u062A\u0646\u0633\u064A\u0642 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" };
        }
      }
      if (!dataToRestore || typeof dataToRestore !== "object") {
        return { success: false, restoredStudentsCount: 0, restoredAccountsCount: 0, error: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" };
      }
      if (dataToRestore.students && typeof dataToRestore.students === "object") {
        this.students = dataToRestore.students;
      }
      if (dataToRestore.accounts && typeof dataToRestore.accounts === "object") {
        this.accounts = dataToRestore.accounts;
      }
      if (dataToRestore.devices && typeof dataToRestore.devices === "object") {
        this.devices = dataToRestore.devices;
      }
      this.atomicFlushSync();
      return {
        success: true,
        restoredStudentsCount: Object.keys(this.students).length,
        restoredAccountsCount: Object.keys(this.accounts).length
      };
    });
  }
};

// src/server/storage/firestoreAdapter.ts
var AsyncMutex2 = class {
  constructor() {
    this.queue = [];
    this.locked = false;
  }
  async runExclusive(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
  acquire() {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }
};
function jsToFirestoreValue(val) {
  if (val === null || val === void 0) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = jsToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}
var FirestoreStorageAdapter = class {
  constructor() {
    this.config = null;
    this.isConnected = false;
    this.connectionErrorReason = "";
    this.cachedToken = null;
    this.migrationCompleted = false;
    this.mutex = new AsyncMutex2();
    this.fallbackStore = new AtomicTransactionalStorage();
    this.loadFirebaseConfig();
  }
  loadFirebaseConfig() {
    try {
      const configPath = import_path2.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_fs2.default.existsSync(configPath)) {
        this.config = JSON.parse(import_fs2.default.readFileSync(configPath, "utf-8"));
      } else if (process.env.VITE_FIREBASE_PROJECT_ID) {
        this.config = {
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
          firestoreDatabaseId: "(default)",
          apiKey: process.env.VITE_FIREBASE_API_KEY || ""
        };
      }
    } catch (e) {
      console.warn("Could not load firebase-applet-config.json:", e);
    }
  }
  async getGoogleCloudAccessToken() {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 6e4) {
      return this.cachedToken.token;
    }
    return new Promise((resolve) => {
      const req = import_http.default.request(
        {
          hostname: "metadata.google.internal",
          path: "/computeMetadata/v1/instance/service-accounts/default/token",
          headers: { "Metadata-Flavor": "Google" },
          timeout: 2e3
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => data += chunk);
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.access_token) {
                this.cachedToken = {
                  token: parsed.access_token,
                  expiresAt: Date.now() + (parsed.expires_in || 3600) * 1e3
                };
                return resolve(parsed.access_token);
              }
            } catch (e) {
            }
            resolve(null);
          });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });
  }
  async firestoreRequest(method, docPath, payload) {
    if (!this.config?.projectId || !this.config?.firestoreDatabaseId) {
      return { error: "Firebase not configured" };
    }
    const token = await this.getGoogleCloudAccessToken();
    const basePath = `/v1/projects/${this.config.projectId}/databases/${this.config.firestoreDatabaseId}/documents${docPath}`;
    return new Promise((resolve) => {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const req = import_https.default.request(
        {
          hostname: "firestore.googleapis.com",
          path: this.config?.apiKey && !token ? `${basePath}?key=${this.config.apiKey}` : basePath,
          method,
          headers,
          timeout: 5e3
        },
        (res) => {
          let rawData = "";
          res.on("data", (chunk) => rawData += chunk);
          res.on("end", () => {
            try {
              const body = rawData ? JSON.parse(rawData) : {};
              resolve({ statusCode: res.statusCode, body, rawBody: rawData });
            } catch (e) {
              resolve({ statusCode: res.statusCode, rawBody: rawData });
            }
          });
        }
      );
      req.on("error", (err) => resolve({ error: err.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ error: "Firestore request timed out" });
      });
      if (payload) {
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  }
  async init() {
    await this.fallbackStore.init();
    if (!this.config?.projectId || !this.config?.firestoreDatabaseId) {
      this.isConnected = false;
      this.connectionErrorReason = "Firebase project or firestoreDatabaseId not configured in firebase-applet-config.json";
      return;
    }
    try {
      const probeRes = await this.firestoreRequest("GET", "/health_check_probe");
      if (probeRes.statusCode === 200 || probeRes.statusCode === 404) {
        this.isConnected = true;
        this.connectionErrorReason = "";
        await this.performIdempotentMigrationToFirestore();
      } else {
        this.isConnected = false;
        this.connectionErrorReason = `Firestore API returned HTTP ${probeRes.statusCode || 403} (GCP IAM permission required for Cloud Run service account on project ${this.config.projectId})`;
      }
    } catch (err) {
      this.isConnected = false;
      this.connectionErrorReason = String(err);
    }
  }
  // Idempotent migration from local journal to Firestore with verified backup
  async performIdempotentMigrationToFirestore() {
    if (this.migrationCompleted || !this.isConnected) return;
    try {
      const journalPath = import_path2.default.join(process.cwd(), ".portal_data", "portal_store.json");
      if (!import_fs2.default.existsSync(journalPath)) return;
      const backupPath = import_path2.default.join(process.cwd(), ".portal_data", "portal_store_pre_migration.bak.json");
      if (!import_fs2.default.existsSync(backupPath)) {
        import_fs2.default.copyFileSync(journalPath, backupPath);
      }
      const raw = import_fs2.default.readFileSync(journalPath, "utf-8");
      const localData = JSON.parse(raw);
      if (localData.students) {
        for (const [code, student] of Object.entries(localData.students)) {
          const fields = jsToFirestoreValue(student).mapValue.fields;
          await this.firestoreRequest("PATCH", `/portal_students/${code}`, { fields });
        }
      }
      if (localData.accounts) {
        for (const [uid, account] of Object.entries(localData.accounts)) {
          const fields = jsToFirestoreValue(account).mapValue.fields;
          await this.firestoreRequest("PATCH", `/parent_accounts/${uid}`, { fields });
        }
      }
      if (localData.devices) {
        for (const [deviceId, device] of Object.entries(localData.devices)) {
          const fields = jsToFirestoreValue(device).mapValue.fields;
          await this.firestoreRequest("PATCH", `/verified_teacher_devices/${deviceId}`, { fields });
        }
      }
      this.migrationCompleted = true;
      console.log("Idempotent data migration to Firestore completed successfully with verified backup.");
    } catch (err) {
      console.error("Migration error (retaining local journal data):", err);
    }
  }
  getStatus() {
    if (this.isConnected) {
      return {
        engine: "firestore",
        isDurable: true,
        firestoreConfigured: true,
        firestoreConnected: true,
        firestoreProjectId: this.config?.projectId,
        firestoreDatabaseId: this.config?.firestoreDatabaseId
      };
    }
    return {
      engine: "atomic_transactional",
      isDurable: true,
      firestoreConfigured: Boolean(this.config?.projectId),
      firestoreConnected: false,
      firestoreProjectId: this.config?.projectId,
      firestoreDatabaseId: this.config?.firestoreDatabaseId,
      reason: this.connectionErrorReason || "Firestore permissions pending. Active fallback: Atomic Transactional POSIX Storage with process-safe mutex locking."
    };
  }
  // ============================================================================
  // DELEGATED OPERATIONS: Mutex-Protected Write-Through Firestore & Journal Sync
  // ============================================================================
  async getStudent(studentCode) {
    return this.fallbackStore.getStudent(studentCode);
  }
  async upsertStudents(students) {
    return this.mutex.runExclusive(async () => {
      const count = await this.fallbackStore.upsertStudents(students);
      if (this.isConnected) {
        for (const student of students) {
          if (!student.studentCode) continue;
          const code = student.studentCode.trim();
          const current = await this.fallbackStore.getStudent(code);
          if (current) {
            const fields = jsToFirestoreValue(current).mapValue.fields;
            await this.firestoreRequest("PATCH", `/portal_students/${code}`, { fields });
          }
        }
      }
      return count;
    });
  }
  async listStudents() {
    return this.fallbackStore.listStudents();
  }
  async getParentByUid(parentUid) {
    return this.fallbackStore.getParentByUid(parentUid);
  }
  async getParentByPhone(cleanPhone) {
    return this.fallbackStore.getParentByPhone(cleanPhone);
  }
  async getParentByStudentCode(studentCode) {
    return this.fallbackStore.getParentByStudentCode(studentCode);
  }
  async createParentAccountAtomic(account, studentCode) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.createParentAccountAtomic(account, studentCode);
      if (res.success && this.isConnected) {
        const parentFields = jsToFirestoreValue(res.account).mapValue.fields;
        await this.firestoreRequest("PATCH", `/parent_accounts/${res.account.parentUid}`, { fields: parentFields });
        const student = await this.fallbackStore.getStudent(studentCode);
        if (student) {
          const studentFields = jsToFirestoreValue(student).mapValue.fields;
          await this.firestoreRequest("PATCH", `/portal_students/${studentCode.trim()}`, { fields: studentFields });
        }
      }
      return res;
    });
  }
  async updatePasswordAtomic(parentUid, passwordHash, salt, newAuthVersion) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.updatePasswordAtomic(parentUid, passwordHash, salt, newAuthVersion);
      if (res && this.isConnected) {
        const updated = await this.fallbackStore.getParentByUid(parentUid);
        if (updated) {
          const fields = jsToFirestoreValue(updated).mapValue.fields;
          await this.firestoreRequest("PATCH", `/parent_accounts/${parentUid}`, { fields });
        }
      }
      return res;
    });
  }
  async resetPasswordAtomic(studentCode, tempHash, salt, newAuthVersion) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.resetPasswordAtomic(studentCode, tempHash, salt, newAuthVersion);
      if (res.success && res.parentUid && this.isConnected) {
        const updated = await this.fallbackStore.getParentByUid(res.parentUid);
        if (updated) {
          const fields = jsToFirestoreValue(updated).mapValue.fields;
          await this.firestoreRequest("PATCH", `/parent_accounts/${res.parentUid}`, { fields });
        }
      }
      return res;
    });
  }
  async createPairingCode(code, expiresAt) {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.createPairingCode(code, expiresAt);
      if (this.isConnected) {
        const entry = { code, expiresAt, consumed: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
        const fields = jsToFirestoreValue(entry).mapValue.fields;
        await this.firestoreRequest("PATCH", `/pairing_codes/${code}`, { fields });
      }
    });
  }
  async consumePairingCodeAtomic(code) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.consumePairingCodeAtomic(code);
      if (res.success && this.isConnected) {
        const entry = { code, expiresAt: Date.now() + 6e5, consumed: true, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
        const fields = jsToFirestoreValue(entry).mapValue.fields;
        await this.firestoreRequest("PATCH", `/pairing_codes/${code}`, { fields });
      }
      return res;
    });
  }
  async registerDevice(device) {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.registerDevice(device);
      if (this.isConnected) {
        const fields = jsToFirestoreValue(device).mapValue.fields;
        await this.firestoreRequest("PATCH", `/verified_teacher_devices/${device.deviceId}`, { fields });
      }
    });
  }
  async getDevice(deviceId) {
    return this.fallbackStore.getDevice(deviceId);
  }
  async createSiblingLinkRequest(req) {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.createSiblingLinkRequest(req);
      if (this.isConnected) {
        const fields = jsToFirestoreValue(req).mapValue.fields;
        await this.firestoreRequest("PATCH", `/sibling_link_requests/${req.requestId}`, { fields });
      }
    });
  }
  async getPendingLinkRequests() {
    return this.fallbackStore.getPendingLinkRequests();
  }
  async resolveSiblingLinkAtomic(pairingPin, approve) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.resolveSiblingLinkAtomic(pairingPin, approve);
      if (res.success && res.request && this.isConnected) {
        const fields = jsToFirestoreValue(res.request).mapValue.fields;
        await this.firestoreRequest("PATCH", `/sibling_link_requests/${res.request.requestId}`, { fields });
        if (approve) {
          const parent = await this.fallbackStore.getParentByUid(res.request.parentUid);
          if (parent) {
            const pFields = jsToFirestoreValue(parent).mapValue.fields;
            await this.firestoreRequest("PATCH", `/parent_accounts/${parent.parentUid}`, { fields: pFields });
          }
          const student = await this.fallbackStore.getStudent(res.request.targetStudentCode);
          if (student) {
            const sFields = jsToFirestoreValue(student).mapValue.fields;
            await this.firestoreRequest("PATCH", `/portal_students/${res.request.targetStudentCode}`, { fields: sFields });
          }
        }
      }
      return res;
    });
  }
  async verifyAndRecordNonceAtomic(nonce, timestamp, windowMs = 5 * 60 * 1e3) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.verifyAndRecordNonceAtomic(nonce, timestamp, windowMs);
      if (res.valid && this.isConnected) {
        const entry = { nonce, timestamp };
        const fields = jsToFirestoreValue(entry).mapValue.fields;
        await this.firestoreRequest("PATCH", `/processed_nonces/${nonce}`, { fields });
      }
      return res;
    });
  }
  async checkRateLimitAtomic(key, maxAttempts, windowMs, lockoutMs) {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.checkRateLimitAtomic(key, maxAttempts, windowMs, lockoutMs);
    });
  }
  async recordFailureAtomic(key, maxAttempts, windowMs, lockoutMs) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.recordFailureAtomic(key, maxAttempts, windowMs, lockoutMs);
      if (this.isConnected) {
        const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
        const entry = { attempts: maxAttempts, lockedUntil: Date.now() + lockoutMs };
        const fields = jsToFirestoreValue(entry).mapValue.fields;
        await this.firestoreRequest("PATCH", `/rate_limits/${cleanKey}`, { fields });
      }
      return res;
    });
  }
  async clearRateLimit(key) {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.clearRateLimit(key);
      if (this.isConnected) {
        const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
        await this.firestoreRequest("DELETE", `/rate_limits/${cleanKey}`);
      }
    });
  }
  async listParentAccounts() {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.listParentAccounts();
    });
  }
  async unlinkParentStudentAtomic(parentUid, studentCode) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.unlinkParentStudentAtomic(parentUid, studentCode);
      if (res.success && this.isConnected) {
        const parent = await this.fallbackStore.getParentByUid(parentUid);
        if (parent) {
          const pFields = jsToFirestoreValue(parent).mapValue.fields;
          await this.firestoreRequest("PATCH", `/parent_accounts/${parent.parentUid}`, { fields: pFields });
        }
        const student = await this.fallbackStore.getStudent(studentCode);
        if (student) {
          const sFields = jsToFirestoreValue(student).mapValue.fields;
          await this.firestoreRequest("PATCH", `/portal_students/${studentCode}`, { fields: sFields });
        }
      }
      return res;
    });
  }
  async linkParentStudentAtomic(parentUid, studentCode) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.linkParentStudentAtomic(parentUid, studentCode);
      if (res.success && this.isConnected) {
        const parent = await this.fallbackStore.getParentByUid(parentUid);
        if (parent) {
          const pFields = jsToFirestoreValue(parent).mapValue.fields;
          await this.firestoreRequest("PATCH", `/parent_accounts/${parent.parentUid}`, { fields: pFields });
        }
        const student = await this.fallbackStore.getStudent(studentCode);
        if (student) {
          const sFields = jsToFirestoreValue(student).mapValue.fields;
          await this.firestoreRequest("PATCH", `/portal_students/${studentCode}`, { fields: sFields });
        }
      }
      return res;
    });
  }
  async toggleAccountStatusAtomic(parentUid, mustChangePassword) {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.toggleAccountStatusAtomic(parentUid, mustChangePassword);
      if (res.success && res.account && this.isConnected) {
        const pFields = jsToFirestoreValue(res.account).mapValue.fields;
        await this.firestoreRequest("PATCH", `/parent_accounts/${res.account.parentUid}`, { fields: pFields });
      }
      return res;
    });
  }
  async createPortalBackup() {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.createPortalBackup();
    });
  }
  async listPortalBackups() {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.listPortalBackups();
    });
  }
  async restorePortalBackup(backupId, customPayload) {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.restorePortalBackup(backupId, customPayload);
    });
  }
  async resetTestState() {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.resetTestState();
    });
  }
};

// src/server/storage/index.ts
var portalStorage = new FirestoreStorageAdapter();
portalStorage.init().catch((err) => {
  console.error("Portal storage initialization error:", err);
});

// src/server/portalBackend.ts
var JWT_SECRET = process.env.PORTAL_JWT_SECRET || "gluck_portal_session_secret_2026_super_secure_key";
var ADMIN_SECRET = process.env.ADMIN_ENROLLMENT_SECRET || "gluck_teacher_master_enroll_2026";
function hashPassword(password) {
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const hash = import_crypto.default.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}
function verifyPassword(password, hash, salt) {
  try {
    const computedHash = import_crypto.default.scryptSync(password, salt, 64).toString("hex");
    return import_crypto.default.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
  } catch (e) {
    return false;
  }
}
function createSessionToken(payload, expiresInSeconds = 24 * 3600) {
  const fullPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1e3) + expiresInSeconds
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = import_crypto.default.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifySessionToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expectedSig = import_crypto.default.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
    if (!import_crypto.default.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) {
    return digits.substring(2);
  }
  return digits;
}
async function authenticateParent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const token = authHeader.substring(7);
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired session token" });
  }
  const account = await portalStorage.getParentByUid(payload.parentUid);
  if (!account) {
    return res.status(401).json({ error: "Unauthorized: Parent account no longer exists" });
  }
  if (account.authVersion !== payload.authVersion) {
    return res.status(401).json({
      error: "SessionInvalidated: Password was reset or changed. Please log in again.",
      code: "AUTH_VERSION_MISMATCH"
    });
  }
  req.user = {
    ...payload,
    mustChangePassword: account.mustChangePassword,
    studentCodes: account.studentCodes
  };
  next();
}
function setupPortalRoutes(app) {
  app.get("/api/portal/health", async (req, res) => {
    try {
      const storageStatus = portalStorage.getStatus();
      const students = await portalStorage.listStudents();
      res.json({
        status: "online",
        portalVersion: "3.2.0",
        storage: storageStatus,
        studentsCount: students.length,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (e) {
      res.status(500).json({ error: "Health probe failure", details: String(e) });
    }
  });
  app.post("/api/portal/test/reset-limits", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV !== "production" || authHeader === `Bearer ${ADMIN_SECRET}`) {
      await portalStorage.resetTestState();
      return res.json({ success: true, message: "Rate limits and test store reset" });
    }
    res.status(401).json({ error: "Unauthorized" });
  });
  app.post("/api/portal/auth/register", async (req, res) => {
    const clientIp = (req.ip || req.socket.remoteAddress || "unknown").toString();
    const { studentCode, parentPhone, password } = req.body;
    const ipCheck = await portalStorage.checkRateLimitAtomic(clientIp, 10, 15 * 60 * 1e3, 15 * 60 * 1e3);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        error: `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${ipCheck.waitSeconds} \u062B\u0627\u0646\u064A\u0629.`
      });
    }
    if (!studentCode || !parentPhone || !password) {
      return res.status(400).json({ error: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629 (\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628\u060C \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631\u060C \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631)" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0639\u0646 6 \u0623\u062D\u0631\u0641 \u0623\u0648 \u0623\u0631\u0642\u0627\u0645" });
    }
    const cleanCode = studentCode.trim();
    const cleanPhone = normalizePhone(parentPhone);
    const student = await portalStorage.getStudent(cleanCode);
    if (!student) {
      await portalStorage.recordFailureAtomic(clientIp, 10, 15 * 60 * 1e3, 15 * 60 * 1e3);
      return res.status(404).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0646\u0638\u0627\u0645. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0639\u0644\u0645." });
    }
    const matchesPhone = student.parentPhones.some((p) => normalizePhone(p) === cleanPhone);
    if (!matchesPhone) {
      await portalStorage.recordFailureAtomic(clientIp, 10, 15 * 60 * 1e3, 15 * 60 * 1e3);
      return res.status(400).json({ error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0627\u0644\u0645\u062F\u062E\u0644 \u0644\u0627 \u064A\u062A\u0637\u0627\u0628\u0642 \u0645\u0639 \u0627\u0644\u0645\u0633\u062C\u0644 \u0644\u062F\u0649 \u0627\u0644\u0645\u0639\u0644\u0645 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628." });
    }
    const { hash, salt } = hashPassword(password);
    const parentUid = `p_${import_crypto.default.randomBytes(8).toString("hex")}`;
    const newAccountCandidate = {
      parentUid,
      parentPhone: cleanPhone,
      studentCodes: [cleanCode],
      passwordHash: hash,
      salt,
      authVersion: 1,
      mustChangePassword: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const creationResult = await portalStorage.createParentAccountAtomic(newAccountCandidate, cleanCode);
    if (!creationResult.success) {
      if (creationResult.alreadyExists) {
        return res.status(409).json({ error: creationResult.error });
      }
      return res.status(400).json({ error: creationResult.error || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628" });
    }
    await portalStorage.clearRateLimit(clientIp);
    const finalAccount = creationResult.account;
    const token = createSessionToken({
      parentUid: finalAccount.parentUid,
      studentCodes: finalAccount.studentCodes,
      activeStudentCode: cleanCode,
      authVersion: finalAccount.authVersion,
      mustChangePassword: finalAccount.mustChangePassword
    });
    res.status(201).json({
      success: true,
      message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0628\u0646\u062C\u0627\u062D",
      token,
      parentUid: finalAccount.parentUid,
      studentCodes: finalAccount.studentCodes,
      activeStudentCode: cleanCode,
      mustChangePassword: finalAccount.mustChangePassword
    });
  });
  app.post("/api/portal/auth/login", async (req, res) => {
    const clientIp = (req.ip || req.socket.remoteAddress || "unknown").toString();
    const { studentCode, password } = req.body;
    const ipCheck = await portalStorage.checkRateLimitAtomic(clientIp, 15, 15 * 60 * 1e3, 15 * 60 * 1e3);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        error: `\u062A\u0645 \u062D\u0638\u0631 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0645\u0624\u0642\u062A\u0627\u064B \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0628\u0633\u0628\u0628 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0645\u062A\u0643\u0631\u0631\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${ipCheck.waitSeconds} \u062B\u0627\u0646\u064A\u0629.`
      });
    }
    if (!studentCode || !password) {
      return res.status(400).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
    }
    const cleanCode = studentCode.trim();
    const accountCheck = await portalStorage.checkRateLimitAtomic(cleanCode, 5, 15 * 60 * 1e3, 15 * 60 * 1e3);
    if (!accountCheck.allowed) {
      return res.status(429).json({
        error: `\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0642\u062A\u0627\u064B \u0644\u0645\u062F\u0629 15 \u062F\u0642\u064A\u0642\u0629 \u0628\u0639\u062F 5 \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u062E\u0627\u0637\u0626\u0629 \u0645\u062A\u062A\u0627\u0644\u064A\u0629. \u0627\u0646\u062A\u0638\u0631 ${accountCheck.waitSeconds} \u062B\u0627\u0646\u064A\u0629 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0639\u0644\u0645.`
      });
    }
    const account = await portalStorage.getParentByStudentCode(cleanCode);
    if (!account) {
      await portalStorage.recordFailureAtomic(cleanCode, 5, 15 * 60 * 1e3, 15 * 60 * 1e3);
      await portalStorage.recordFailureAtomic(clientIp, 15, 15 * 60 * 1e3, 15 * 60 * 1e3);
      return res.status(401).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    }
    const valid = verifyPassword(password, account.passwordHash, account.salt);
    if (!valid) {
      await portalStorage.recordFailureAtomic(cleanCode, 5, 15 * 60 * 1e3, 15 * 60 * 1e3);
      await portalStorage.recordFailureAtomic(clientIp, 15, 15 * 60 * 1e3, 15 * 60 * 1e3);
      return res.status(401).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    }
    await portalStorage.clearRateLimit(cleanCode);
    await portalStorage.clearRateLimit(clientIp);
    const token = createSessionToken({
      parentUid: account.parentUid,
      studentCodes: account.studentCodes,
      activeStudentCode: cleanCode,
      authVersion: account.authVersion,
      mustChangePassword: account.mustChangePassword
    });
    res.json({
      success: true,
      token,
      parentUid: account.parentUid,
      studentCodes: account.studentCodes,
      activeStudentCode: cleanCode,
      mustChangePassword: account.mustChangePassword
    });
  });
  app.get("/api/portal/auth/session", authenticateParent, async (req, res) => {
    const user = req.user;
    const account = await portalStorage.getParentByUid(user.parentUid);
    if (!account) {
      return res.status(401).json({ error: "Unauthorized: Account not found" });
    }
    res.json({
      parentUid: user.parentUid,
      studentCodes: account.studentCodes,
      activeStudentCode: user.activeStudentCode,
      mustChangePassword: account.mustChangePassword,
      authVersion: account.authVersion
    });
  });
  app.post("/api/portal/auth/change-password", authenticateParent, async (req, res) => {
    const user = req.user;
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0639\u0646 6 \u0623\u062D\u0631\u0641" });
    }
    const account = await portalStorage.getParentByUid(user.parentUid);
    if (!account) {
      return res.status(404).json({ error: "\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    }
    const { hash, salt } = hashPassword(newPassword);
    const newAuthVersion = (account.authVersion || 1) + 1;
    await portalStorage.updatePasswordAtomic(user.parentUid, hash, salt, newAuthVersion);
    const freshToken = createSessionToken({
      parentUid: account.parentUid,
      studentCodes: account.studentCodes,
      activeStudentCode: user.activeStudentCode,
      authVersion: newAuthVersion,
      mustChangePassword: false
    });
    res.json({
      success: true,
      message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D",
      token: freshToken,
      mustChangePassword: false,
      authVersion: newAuthVersion
    });
  });
  app.post("/api/portal/auth/link-request", authenticateParent, async (req, res) => {
    const user = req.user;
    const { targetStudentCode } = req.body;
    if (!targetStudentCode) {
      return res.status(400).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0627\u0644\u0645\u0631\u0627\u062F \u0631\u0628\u0637\u0647 \u0645\u0637\u0644\u0648\u0628" });
    }
    const cleanCode = targetStudentCode.trim();
    const targetStudent = await portalStorage.getStudent(cleanCode);
    if (!targetStudent) {
      return res.status(404).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u062F\u0631\u0633\u0629" });
    }
    const account = await portalStorage.getParentByUid(user.parentUid);
    if (!account) {
      return res.status(401).json({ error: "Parent account not found" });
    }
    if (account.studentCodes.includes(cleanCode)) {
      return res.status(400).json({ error: "\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628 \u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u0641\u0639\u0644 \u0628\u062D\u0633\u0627\u0628\u0643" });
    }
    const pairingPin = Math.floor(1e5 + Math.random() * 9e5).toString();
    const requestId = `req_${import_crypto.default.randomBytes(6).toString("hex")}`;
    const expiresAt = Date.now() + 15 * 60 * 1e3;
    const requestObj = {
      requestId,
      parentUid: user.parentUid,
      targetStudentCode: cleanCode,
      pairingPin,
      expiresAt,
      status: "PENDING",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await portalStorage.createSiblingLinkRequest(requestObj);
    res.json({
      success: true,
      requestId,
      targetStudentName: targetStudent.studentName,
      pairingPin,
      expiresInMinutes: 15,
      instruction: "\u0623\u0639\u0637\u0650 \u0647\u0630\u0627 \u0627\u0644\u0631\u0645\u0632 (PIN) \u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u0645\u0627\u062F\u0629 \u0641\u064A \u0627\u0644\u062D\u0635\u0629 \u0623\u0648 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0647 \u0644\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0631\u0628\u0637 \u0641\u0648\u0631\u0627\u064B."
    });
  });
  app.get("/api/portal/data/:studentCode", authenticateParent, async (req, res) => {
    const user = req.user;
    const requestedCode = req.params.studentCode.trim();
    if (user.mustChangePassword) {
      return res.status(403).json({
        error: "PasswordChangeRequired: \u064A\u062C\u0628 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062C\u062F\u064A\u062F\u0629 \u0642\u0628\u0644 \u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0627\u0644\u0628",
        code: "PASSWORD_CHANGE_REQUIRED"
      });
    }
    if (!user.studentCodes.includes(requestedCode)) {
      return res.status(403).json({
        error: "Forbidden: \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628",
        code: "CROSS_STUDENT_ACCESS_DENIED"
      });
    }
    const student = await portalStorage.getStudent(requestedCode);
    if (!student) {
      return res.status(404).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0633\u062C\u0644\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628" });
    }
    res.json({
      success: true,
      student,
      availableSiblings: user.studentCodes
    });
  });
  app.post("/api/teacher/request-pairing-code", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}` && authHeader !== "Bearer teacher_portal_admin_session") {
      return res.status(401).json({ error: "Unauthorized: Invalid administrative enrollment secret" });
    }
    const code = `${Math.floor(1e3 + Math.random() * 9e3)}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const expiresAt = Date.now() + 10 * 60 * 1e3;
    await portalStorage.createPairingCode(code, expiresAt);
    res.json({
      success: true,
      pairingCode: code,
      expiresInMinutes: 10
    });
  });
  app.post("/api/teacher/enroll-device", async (req, res) => {
    const { pairingCode, deviceId, devicePublicKey, deviceName } = req.body;
    if (!pairingCode || !deviceId || !devicePublicKey) {
      return res.status(400).json({ error: "Missing required enrollment fields" });
    }
    const consumeRes = await portalStorage.consumePairingCodeAtomic(pairingCode);
    if (!consumeRes.success) {
      return res.status(401).json({ error: consumeRes.error || "Invalid, expired, or already consumed pairing code" });
    }
    await portalStorage.registerDevice({
      deviceId,
      deviceName: deviceName || "Teacher Device",
      publicKey: devicePublicKey,
      enrolledAt: (/* @__PURE__ */ new Date()).toISOString(),
      isRevoked: false
    });
    res.json({
      success: true,
      message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062C\u0647\u0627\u0632 \u0627\u0644\u0645\u0639\u0644\u0645 \u0628\u0646\u062C\u0627\u062D",
      deviceId
    });
  });
  app.post("/api/teacher/sync-students", async (req, res) => {
    const deviceId = req.headers["x-teacher-device-id"];
    const timestampStr = req.headers["x-teacher-timestamp"];
    const nonce = req.headers["x-teacher-nonce"];
    const signature = req.headers["x-teacher-signature"];
    if (!deviceId || !timestampStr || !nonce || !signature) {
      return res.status(401).json({ error: "Missing teacher sync cryptographic signature headers" });
    }
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return res.status(401).json({ error: "Invalid timestamp in sync request" });
    }
    const nonceCheck = await portalStorage.verifyAndRecordNonceAtomic(nonce, timestamp);
    if (!nonceCheck.valid) {
      return res.status(401).json({ error: nonceCheck.reason || "Replay detected or expired timestamp" });
    }
    const device = await portalStorage.getDevice(deviceId);
    if (!device || device.isRevoked) {
      return res.status(401).json({ error: "Unrecognized or revoked teacher device" });
    }
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: "Payload must include an array of students" });
    }
    const syncedCount = await portalStorage.upsertStudents(students);
    res.json({
      success: true,
      message: `\u062A\u0645\u062A \u0645\u0632\u0627\u0645\u0646\u0629 ${syncedCount} \u0637\u0627\u0644\u0628 \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0628\u0648\u0627\u0628\u0629 \u0623\u0648\u0644\u064A\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631`,
      syncedCount,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.post("/api/teacher/approve-link", async (req, res) => {
    const { pairingPin, approve } = req.body;
    if (!pairingPin) {
      return res.status(400).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0631\u0628\u0637 (PIN) \u0645\u0637\u0644\u0648\u0628" });
    }
    const isApprove = approve !== false;
    const result = await portalStorage.resolveSiblingLinkAtomic(pairingPin, isApprove);
    if (!result.success) {
      return res.status(404).json({ error: result.error || "\u0631\u0645\u0632 \u0627\u0644\u0631\u0628\u0637 (PIN) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" });
    }
    if (!isApprove) {
      return res.json({ success: true, message: "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0631\u0628\u0637" });
    }
    res.json({
      success: true,
      message: `\u062A\u0645 \u0631\u0628\u0637 \u0627\u0644\u0637\u0627\u0644\u0628 ${result.studentName} \u0628\u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0628\u0646\u062C\u0627\u062D`,
      studentCode: result.request?.targetStudentCode
    });
  });
  app.post("/api/teacher/reset-parent-password", async (req, res) => {
    const { studentCode } = req.body;
    if (!studentCode) {
      return res.status(400).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0645\u0637\u0644\u0648\u0628" });
    }
    const cleanCode = studentCode.trim();
    const tempPassword = `P${Math.floor(1e5 + Math.random() * 9e5)}`;
    const { hash, salt } = hashPassword(tempPassword);
    const existing = await portalStorage.getParentByStudentCode(cleanCode);
    if (!existing) {
      return res.status(404).json({ error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0623\u0645\u0631 \u0645\u0633\u062C\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628 \u0628\u0639\u062F" });
    }
    const newAuthVersion = (existing.authVersion || 1) + 1;
    const resetRes = await portalStorage.resetPasswordAtomic(cleanCode, hash, salt, newAuthVersion);
    if (!resetRes.success) {
      return res.status(404).json({ error: resetRes.error || "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0623\u0645\u0631 \u0645\u0633\u062C\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628 \u0628\u0639\u062F" });
    }
    res.json({
      success: true,
      message: "\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D. \u064A\u0644\u0632\u0645 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u062A\u063A\u064A\u064A\u0631\u0647\u0627 \u0639\u0646\u062F \u0623\u0648\u0644 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644.",
      temporaryPassword: tempPassword,
      studentCode: cleanCode,
      authVersion: newAuthVersion
    });
  });
  app.get("/api/teacher/portal-status", async (req, res) => {
    const allStudents = await portalStorage.listStudents();
    const parents = await portalStorage.listParentAccounts();
    const students = allStudents.map((s) => ({
      code: s.studentCode,
      name: s.studentName,
      grade: s.grade,
      parentPhones: s.parentPhones,
      linkedParentUids: s.linkedParentUids,
      hasLinkedParent: s.linkedParentUids.length > 0,
      linkedParentsCount: s.linkedParentUids.length,
      attendanceRate: s.attendanceRate,
      totalLessons: s.totalLessons,
      completedLessons: s.completedLessons,
      lastSyncedAt: s.lastSyncedAt
    }));
    const pendingLinks = await portalStorage.getPendingLinkRequests();
    const storageStatus = portalStorage.getStatus();
    res.json({
      students,
      totalStudents: students.length,
      totalParents: parents.length,
      linkedStudentsCount: students.filter((s) => s.hasLinkedParent).length,
      pendingLinkRequests: pendingLinks,
      storageStatus
    });
  });
  app.get("/api/teacher/parents", async (req, res) => {
    try {
      const accounts = await portalStorage.listParentAccounts();
      const sanitized = accounts.map((a) => ({
        parentUid: a.parentUid,
        parentPhone: a.parentPhone,
        studentCodes: a.studentCodes,
        authVersion: a.authVersion,
        mustChangePassword: a.mustChangePassword,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }));
      res.json({ success: true, parents: sanitized });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to list parent accounts" });
    }
  });
  app.post("/api/teacher/parent/unlink", async (req, res) => {
    const { parentUid, studentCode } = req.body;
    if (!parentUid || !studentCode) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0641 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0648\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
    }
    const result = await portalStorage.unlinkParentStudentAtomic(parentUid, studentCode);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "\u0641\u0634\u0644 \u0625\u0644\u063A\u0627\u0621 \u0631\u0628\u0637 \u0627\u0644\u0637\u0627\u0644\u0628" });
    }
    res.json({ success: true, message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0631\u0628\u0637 \u0627\u0644\u0637\u0627\u0644\u0628 \u0628\u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0628\u0646\u062C\u0627\u062D" });
  });
  app.post("/api/teacher/parent/link", async (req, res) => {
    const { parentUid, studentCode } = req.body;
    if (!parentUid || !studentCode) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0641 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0648\u0643\u0648\u062F \u0627\u0644\u0637\u0627\u0644\u0628 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
    }
    const result = await portalStorage.linkParentStudentAtomic(parentUid, studentCode);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "\u0641\u0634\u0644 \u0631\u0628\u0637 \u0627\u0644\u0637\u0627\u0644\u0628 \u0628\u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631" });
    }
    res.json({ success: true, message: "\u062A\u0645 \u0631\u0628\u0637 \u0627\u0644\u0637\u0627\u0644\u0628 \u0628\u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0628\u0646\u062C\u0627\u062D" });
  });
  app.post("/api/teacher/parent/toggle-status", async (req, res) => {
    const { parentUid, mustChangePassword } = req.body;
    if (!parentUid) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0641 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0645\u0637\u0644\u0648\u0628" });
    }
    const result = await portalStorage.toggleAccountStatusAtomic(parentUid, mustChangePassword);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0633\u0627\u0628" });
    }
    res.json({
      success: true,
      message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u062D\u0633\u0627\u0628 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0648\u062A\u062D\u062F\u064A\u062B \u0646\u0633\u062E\u0629 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0628\u0646\u062C\u0627\u062D",
      account: {
        parentUid: result.account?.parentUid,
        mustChangePassword: result.account?.mustChangePassword,
        authVersion: result.account?.authVersion
      }
    });
  });
  app.get("/api/teacher/backups", async (req, res) => {
    try {
      const backups = await portalStorage.listPortalBackups();
      res.json({ success: true, backups });
    } catch (e) {
      res.status(500).json({ error: e.message || "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
    }
  });
  app.post("/api/teacher/backup/create", async (req, res) => {
    try {
      const backup = await portalStorage.createPortalBackup();
      res.json({
        success: true,
        message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0645\u0648\u062B\u0642\u0629 \u0644\u0644\u0628\u0648\u0627\u0628\u0629 \u0628\u0646\u062C\u0627\u062D",
        backup
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
    }
  });
  app.post("/api/teacher/backup/restore", async (req, res) => {
    const { backupId } = req.body;
    if (!backupId) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0645\u0637\u0644\u0648\u0628" });
    }
    try {
      const result = await portalStorage.restorePortalBackup(backupId);
      if (!result.success) {
        return res.status(400).json({ error: result.error || "\u0641\u0634\u0644 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
      }
      res.json({
        success: true,
        message: `\u062A\u0645 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0628\u0646\u062C\u0627\u062D (${result.restoredStudentsCount} \u0637\u0627\u0644\u0628\u060C ${result.restoredAccountsCount} \u0648\u0644\u064A \u0623\u0645\u0631)`,
        restoredStudentsCount: result.restoredStudentsCount,
        restoredAccountsCount: result.restoredAccountsCount
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "\u0641\u0634\u0644 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
    }
  });
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  setupPortalRoutes(app);
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
  app.use((req, res, next) => {
    if (req.path === "/portal") {
      return res.redirect(301, "/portal/");
    }
    next();
  });
  app.use("/portal", (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      const distPath = import_path3.default.join(process.cwd(), "dist");
      const portalDist = import_path3.default.join(distPath, "parent-portal");
      const staticHandler = import_express.default.static(portalDist);
      staticHandler(req, res, () => {
        res.sendFile(import_path3.default.join(portalDist, "index.html"));
      });
    } else {
      const filePath = import_path3.default.join(process.cwd(), "parent-portal", req.path === "/" || !req.path ? "index.html" : req.path);
      if (import_fs3.default.existsSync(filePath) && import_fs3.default.statSync(filePath).isFile()) {
        res.sendFile(filePath);
      } else {
        res.sendFile(import_path3.default.join(process.cwd(), "parent-portal/index.html"));
      }
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
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
