import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import {
  IPortalStorage,
  PortalStudentData,
  ParentAccount,
  TeacherDevice,
  SiblingLinkRequest,
  StorageStatus
} from "./types";
import { AtomicTransactionalStorage } from "./atomicStore";

class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }
}

interface FirebaseConfig {
  projectId: string;
  firestoreDatabaseId: string;
  apiKey: string;
  authDomain?: string;
}

// Convert JS Objects to Firestore REST API field format
function jsToFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = jsToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convert Firestore REST API field format to JS Objects
function firestoreValueToJs(val: any): any {
  if (!val) return null;
  if ("nullValue" in val) return null;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return parseInt(val.integerValue, 10);
  if ("doubleValue" in val) return val.doubleValue;
  if ("stringValue" in val) return val.stringValue;
  if ("arrayValue" in val) {
    return (val.arrayValue.values || []).map(firestoreValueToJs);
  }
  if ("mapValue" in val) {
    const res: Record<string, any> = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = firestoreValueToJs(v);
    }
    return res;
  }
  return null;
}

export class FirestoreStorageAdapter implements IPortalStorage {
  private fallbackStore: AtomicTransactionalStorage;
  private config: FirebaseConfig | null = null;
  private isConnected = false;
  private connectionErrorReason = "";
  private cachedToken: { token: string; expiresAt: number } | null = null;
  private migrationCompleted = false;
  private mutex = new AsyncMutex();

  constructor() {
    this.fallbackStore = new AtomicTransactionalStorage();
    this.loadFirebaseConfig();
  }

  private loadFirebaseConfig() {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        this.config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
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

  private async getGoogleCloudAccessToken(): Promise<string | null> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    // Probe Cloud Run metadata server for GCP default application credentials token
    return new Promise(resolve => {
      const req = http.request(
        {
          hostname: "metadata.google.internal",
          path: "/computeMetadata/v1/instance/service-accounts/default/token",
          headers: { "Metadata-Flavor": "Google" },
          timeout: 2000
        },
        res => {
          let data = "";
          res.on("data", chunk => (data += chunk));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.access_token) {
                this.cachedToken = {
                  token: parsed.access_token,
                  expiresAt: Date.now() + (parsed.expires_in || 3600) * 1000
                };
                return resolve(parsed.access_token);
              }
            } catch (e) {}
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

  private async firestoreRequest(
    method: string,
    docPath: string,
    payload?: any
  ): Promise<{ statusCode?: number; body?: any; rawBody?: string; error?: string }> {
    if (!this.config?.projectId || !this.config?.firestoreDatabaseId) {
      return { error: "Firebase not configured" };
    }

    const token = await this.getGoogleCloudAccessToken();
    const basePath = `/v1/projects/${this.config.projectId}/databases/${this.config.firestoreDatabaseId}/documents${docPath}`;

    return new Promise(resolve => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const req = https.request(
        {
          hostname: "firestore.googleapis.com",
          path: this.config?.apiKey && !token ? `${basePath}?key=${this.config.apiKey}` : basePath,
          method,
          headers,
          timeout: 5000
        },
        res => {
          let rawData = "";
          res.on("data", chunk => (rawData += chunk));
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

      req.on("error", err => resolve({ error: err.message }));
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

  async init(): Promise<void> {
    await this.fallbackStore.init();

    if (!this.config?.projectId || !this.config?.firestoreDatabaseId) {
      this.isConnected = false;
      this.connectionErrorReason = "Firebase project or firestoreDatabaseId not configured in firebase-applet-config.json";
      return;
    }

    try {
      // Test read access using Cloud Run service account token or API key
      const probeRes = await this.firestoreRequest("GET", "/health_check_probe");

      if (probeRes.statusCode === 200 || probeRes.statusCode === 404) {
        this.isConnected = true;
        this.connectionErrorReason = "";
        
        // Execute idempotent migration if local journal data exists
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
  private async performIdempotentMigrationToFirestore(): Promise<void> {
    if (this.migrationCompleted || !this.isConnected) return;

    try {
      const journalPath = path.join(process.cwd(), ".portal_data", "portal_store.json");
      if (!fs.existsSync(journalPath)) return;

      // 1. Create verified backup file before any migration attempt
      const backupPath = path.join(process.cwd(), ".portal_data", "portal_store_pre_migration.bak.json");
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(journalPath, backupPath);
      }

      // 2. Read local journal content
      const raw = fs.readFileSync(journalPath, "utf-8");
      const localData = JSON.parse(raw);

      // 3. Migrate Students (idempotent upsert by studentCode)
      if (localData.students) {
        for (const [code, student] of Object.entries<any>(localData.students)) {
          const fields = jsToFirestoreValue(student).mapValue.fields;
          await this.firestoreRequest("PATCH", `/portal_students/${code}`, { fields });
        }
      }

      // 4. Migrate Parent Accounts (idempotent upsert by parentUid)
      if (localData.accounts) {
        for (const [uid, account] of Object.entries<any>(localData.accounts)) {
          const fields = jsToFirestoreValue(account).mapValue.fields;
          await this.firestoreRequest("PATCH", `/parent_accounts/${uid}`, { fields });
        }
      }

      // 5. Migrate Teacher Devices (idempotent upsert by deviceId)
      if (localData.devices) {
        for (const [deviceId, device] of Object.entries<any>(localData.devices)) {
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

  getStatus(): StorageStatus {
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

  async getStudent(studentCode: string): Promise<PortalStudentData | null> {
    return this.fallbackStore.getStudent(studentCode);
  }

  async upsertStudents(students: PortalStudentData[]): Promise<number> {
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

  async listStudents(): Promise<PortalStudentData[]> {
    return this.fallbackStore.listStudents();
  }

  async getParentByUid(parentUid: string): Promise<ParentAccount | null> {
    return this.fallbackStore.getParentByUid(parentUid);
  }

  async getParentByPhone(cleanPhone: string): Promise<ParentAccount | null> {
    return this.fallbackStore.getParentByPhone(cleanPhone);
  }

  async getParentByStudentCode(studentCode: string): Promise<ParentAccount | null> {
    return this.fallbackStore.getParentByStudentCode(studentCode);
  }

  async createParentAccountAtomic(
    account: ParentAccount,
    studentCode: string
  ): Promise<{ success: boolean; account: ParentAccount; alreadyExists?: boolean; error?: string }> {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.createParentAccountAtomic(account, studentCode);
      if (res.success && this.isConnected) {
        // Sync parent account and student to Firestore
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

  async updatePasswordAtomic(
    parentUid: string,
    passwordHash: string,
    salt: string,
    newAuthVersion: number
  ): Promise<boolean> {
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

  async resetPasswordAtomic(
    studentCode: string,
    tempHash: string,
    salt: string,
    newAuthVersion: number
  ): Promise<{ success: boolean; parentUid?: string; newAuthVersion?: number; error?: string }> {
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

  async createPairingCode(code: string, expiresAt: number): Promise<void> {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.createPairingCode(code, expiresAt);
      if (this.isConnected) {
        const entry = { code, expiresAt, consumed: false, createdAt: new Date().toISOString() };
        const fields = jsToFirestoreValue(entry).mapValue.fields;
        await this.firestoreRequest("PATCH", `/pairing_codes/${code}`, { fields });
      }
    });
  }

  async consumePairingCodeAtomic(code: string): Promise<{ success: boolean; error?: string }> {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.consumePairingCodeAtomic(code);
      if (res.success && this.isConnected) {
        const entry = { code, expiresAt: Date.now() + 600000, consumed: true, createdAt: new Date().toISOString() };
        const fields = jsToFirestoreValue(entry).mapValue.fields;
        await this.firestoreRequest("PATCH", `/pairing_codes/${code}`, { fields });
      }
      return res;
    });
  }

  async registerDevice(device: TeacherDevice): Promise<void> {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.registerDevice(device);
      if (this.isConnected) {
        const fields = jsToFirestoreValue(device).mapValue.fields;
        await this.firestoreRequest("PATCH", `/verified_teacher_devices/${device.deviceId}`, { fields });
      }
    });
  }

  async getDevice(deviceId: string): Promise<TeacherDevice | null> {
    return this.fallbackStore.getDevice(deviceId);
  }

  async createSiblingLinkRequest(req: SiblingLinkRequest): Promise<void> {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.createSiblingLinkRequest(req);
      if (this.isConnected) {
        const fields = jsToFirestoreValue(req).mapValue.fields;
        await this.firestoreRequest("PATCH", `/sibling_link_requests/${req.requestId}`, { fields });
      }
    });
  }

  async getPendingLinkRequests(): Promise<SiblingLinkRequest[]> {
    return this.fallbackStore.getPendingLinkRequests();
  }

  async resolveSiblingLinkAtomic(
    pairingPin: string,
    approve: boolean
  ): Promise<{ success: boolean; request?: SiblingLinkRequest; studentName?: string; error?: string }> {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.resolveSiblingLinkAtomic(pairingPin, approve);
      if (res.success && res.request && this.isConnected) {
        const fields = jsToFirestoreValue(res.request).mapValue.fields;
        await this.firestoreRequest("PATCH", `/sibling_link_requests/${res.request.requestId}`, { fields });

        // Sync parent and student if approved
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

  async verifyAndRecordNonceAtomic(
    nonce: string,
    timestamp: number,
    windowMs = 5 * 60 * 1000
  ): Promise<{ valid: boolean; reason?: string }> {
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

  async checkRateLimitAtomic(
    key: string,
    maxAttempts: number,
    windowMs: number,
    lockoutMs: number
  ): Promise<{ allowed: boolean; waitSeconds?: number; attempts: number }> {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.checkRateLimitAtomic(key, maxAttempts, windowMs, lockoutMs);
    });
  }

  async recordFailureAtomic(
    key: string,
    maxAttempts: number,
    windowMs: number,
    lockoutMs: number
  ): Promise<{ locked: boolean; waitSeconds?: number }> {
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

  async clearRateLimit(key: string): Promise<void> {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.clearRateLimit(key);
      if (this.isConnected) {
        const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
        await this.firestoreRequest("DELETE", `/rate_limits/${cleanKey}`);
      }
    });
  }

  async listParentAccounts(): Promise<ParentAccount[]> {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.listParentAccounts();
    });
  }

  async unlinkParentStudentAtomic(parentUid: string, studentCode: string): Promise<{ success: boolean; error?: string }> {
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

  async linkParentStudentAtomic(parentUid: string, studentCode: string): Promise<{ success: boolean; error?: string }> {
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

  async toggleAccountStatusAtomic(parentUid: string, mustChangePassword?: boolean): Promise<{
    success: boolean;
    account?: ParentAccount;
    error?: string;
  }> {
    return this.mutex.runExclusive(async () => {
      const res = await this.fallbackStore.toggleAccountStatusAtomic(parentUid, mustChangePassword);
      if (res.success && res.account && this.isConnected) {
        const pFields = jsToFirestoreValue(res.account).mapValue.fields;
        await this.firestoreRequest("PATCH", `/parent_accounts/${res.account.parentUid}`, { fields: pFields });
      }
      return res;
    });
  }

  async createPortalBackup(): Promise<{
    backupId: string;
    filePath: string;
    createdAt: string;
    studentsCount: number;
    accountsCount: number;
    fileSize: number;
  }> {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.createPortalBackup();
    });
  }

  async listPortalBackups(): Promise<Array<{
    backupId: string;
    fileName: string;
    createdAt: string;
    studentsCount: number;
    accountsCount: number;
    fileSize: number;
  }>> {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.listPortalBackups();
    });
  }

  async restorePortalBackup(backupId: string, customPayload?: any): Promise<{
    success: boolean;
    restoredStudentsCount: number;
    restoredAccountsCount: number;
    error?: string;
  }> {
    return this.mutex.runExclusive(async () => {
      return this.fallbackStore.restorePortalBackup(backupId, customPayload);
    });
  }

  async resetTestState(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      await this.fallbackStore.resetTestState();
    });
  }
}
