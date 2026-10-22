import fs from "fs";
import path from "path";
import {
  IPortalStorage,
  PortalStudentData,
  ParentAccount,
  TeacherDevice,
  PairingCodeEntry,
  SiblingLinkRequest,
  RateLimitEntry,
  StorageStatus
} from "./types";

// ============================================================================
// ASYNC MUTEX LOCK FOR SERIALIZING CRITICAL DATASTORE SECTIONS
// ============================================================================

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

// ============================================================================
// ATOMIC TRANSACTIONAL STORAGE ADAPTER
// ============================================================================

export class AtomicTransactionalStorage implements IPortalStorage {
  private storageDir: string;
  private dataFile: string;
  private tempFile: string;
  private mutex = new AsyncMutex();

  // In-memory state synchronized with atomic disk write journal
  private students: Record<string, PortalStudentData> = {};
  private accounts: Record<string, ParentAccount> = {};
  private devices: Record<string, TeacherDevice> = {};
  private pairingCodes: Record<string, PairingCodeEntry> = {};
  private linkRequests: Record<string, SiblingLinkRequest> = {};
  private nonces: Record<string, number> = {};
  private rateLimits: Record<string, RateLimitEntry> = {};

  constructor(customStorageDir?: string) {
    this.storageDir = customStorageDir || path.join(process.cwd(), '.portal_data');
    this.dataFile = path.join(this.storageDir, 'portal_store.json');
    this.tempFile = path.join(this.storageDir, 'portal_store.tmp.json');
  }

  async init(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      try {
        if (!fs.existsSync(this.storageDir)) {
          fs.mkdirSync(this.storageDir, { recursive: true });
        }

        // Clean up stale temporary files left by interrupted writes
        if (fs.existsSync(this.tempFile)) {
          try { fs.unlinkSync(this.tempFile); } catch (e) {}
        }

        const backupFile = path.join(this.storageDir, 'portal_store.json.bak');

        if (fs.existsSync(this.dataFile)) {
          try {
            const raw = fs.readFileSync(this.dataFile, 'utf-8');
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
            if (fs.existsSync(backupFile)) {
              try {
                const rawBak = fs.readFileSync(backupFile, 'utf-8');
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

  getStatus(): StorageStatus {
    return {
      engine: 'atomic_transactional',
      isDurable: true,
      firestoreConfigured: false,
      firestoreConnected: false,
      reason: 'Running in Atomic Transactional Journal Mode with Process-Safe Mutex Lock, Backup Recovery & POSIX File Renames.'
    };
  }

  private atomicFlushSync(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      const backupFile = path.join(this.storageDir, 'portal_store.json.bak');

      // Create backup copy before atomic overwrite
      if (fs.existsSync(this.dataFile)) {
        try {
          fs.copyFileSync(this.dataFile, backupFile);
        } catch (e) {}
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

      // Write to temporary file first, then atomic rename
      fs.writeFileSync(this.tempFile, payload, 'utf-8');
      fs.renameSync(this.tempFile, this.dataFile);
    } catch (err) {
      console.error("Atomic flush failed:", err);
    }
  }

  private seedDemoStudentIfEmpty(): void {
    if (Object.keys(this.students).length === 0) {
      const demoStudent: PortalStudentData = {
        studentCode: "1001",
        studentName: "يوسف أحمد عمر",
        grade: "Grade 10 (A2.2)",
        groupName: "مجموعة المتميزين الألمانية A2",
        parentPhones: ["01000000000", "01111111111"],
        linkedParentUids: [],
        attendanceRate: 94,
        totalLessons: 18,
        completedLessons: 17,
        streak: 5,
        nextLesson: {
          date: "2026-10-22",
          time: "17:00",
          title: "الدرس 18: حروف الجر مع الداتيف Wechselpräpositionen",
          meetingLink: "https://meet.google.com/abc-demo-ags"
        },
        lessons: [
          {
            id: "les-1",
            title: "الدرس 17: الماضي البسيط Präteritum",
            date: "2026-10-15",
            time: "17:00",
            durationMinutes: 90,
            status: "completed",
            paymentStatus: "paid",
            homeworkStatus: "completed",
            homeworkTitle: "حل تمارين كتاب التدريبات صفحة 45-47",
            attendanceStatus: "present",
            quizScore: 9,
            examScore: 95,
            publicNotes: "أداء ممتاز وتفاعل متميز أثناء تصريف الأفعال الشاذة."
          },
          {
            id: "les-2",
            title: "الدرس 16: أدوات الربط weil & dass",
            date: "2026-10-08",
            time: "17:00",
            durationMinutes: 90,
            status: "completed",
            paymentStatus: "paid",
            homeworkStatus: "completed",
            homeworkTitle: "كتابة 5 جمل باستخدام weil",
            attendanceStatus: "present",
            quizScore: 10,
            publicNotes: "استيعاب سريع لقواعد ترتيب الفعل في نهاية الجملة."
          }
        ],
        homework: [
          {
            id: "hw-1",
            title: "حل تمارين الأفعال المنفصلة Trennbare Verben",
            assignedDate: "2026-10-15",
            dueDate: "2026-10-22",
            status: "completed",
            description: "كتاب التدريبات صفحة 48 تمرين 3 و 4"
          },
          {
            id: "hw-2",
            title: "حفظ الكلمات الجديدة للدرس 17",
            assignedDate: "2026-10-15",
            dueDate: "2026-10-22",
            status: "assigned",
            description: "قائمة الكلمات في Lernstudio الخاصة بموضوع السفر"
          }
        ],
        grades: [
          {
            id: "grd-1",
            title: "اختبار دوري - الوحدة الرابعة",
            date: "2026-10-15",
            type: "exam",
            score: 95,
            maxScore: 100,
            percentage: 95,
            feedback: "ممتاز جداً - إتقان كامل لقواعد الإعراب والأزمنة."
          },
          {
            id: "grd-2",
            title: "تسميع كلمات الأسبوع الثالث",
            date: "2026-10-08",
            type: "dictation",
            score: 10,
            maxScore: 10,
            percentage: 100,
            feedback: "10/10 بدون أي خطأ إملائي."
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
              notes: "اشتراك شهر أكتوبر 2026 (4 حصص مكثفة)"
            }
          ]
        },
        certificates: [
          {
            id: "cert-1",
            title: "شهادة تميز في اللغة الألمانية - المستوى A2.1",
            recipientName: "Youssef Ahmed Omar",
            certificateType: "german_excellence",
            issueDate: "2026-09-30",
            score: "98%",
            teacherName: "Herr Omar Hassan"
          }
        ],
        lastSyncedAt: new Date().toISOString()
      };

      this.students["1001"] = demoStudent;
    }
  }

  // --------------------------------------------------------------------------
  // STUDENTS
  // --------------------------------------------------------------------------

  async getStudent(studentCode: string): Promise<PortalStudentData | null> {
    return this.mutex.runExclusive(() => {
      const s = this.students[studentCode.trim()];
      return s ? JSON.parse(JSON.stringify(s)) : null;
    });
  }

  async upsertStudents(studentsList: PortalStudentData[]): Promise<number> {
    return this.mutex.runExclusive(() => {
      let count = 0;
      for (const item of studentsList) {
        if (!item.studentCode) continue;
        const code = item.studentCode.trim();
        const existing = this.students[code];

        // Preserve linked parent UIDs across teacher sync pushes
        const linkedUids = existing ? existing.linkedParentUids : [];

        this.students[code] = {
          ...item,
          studentCode: code,
          linkedParentUids: linkedUids,
          lastSyncedAt: new Date().toISOString()
        };
        count++;
      }
      this.atomicFlushSync();
      return count;
    });
  }

  async listStudents(): Promise<PortalStudentData[]> {
    return this.mutex.runExclusive(() => {
      return Object.values(this.students).map(s => JSON.parse(JSON.stringify(s)));
    });
  }

  // --------------------------------------------------------------------------
  // PARENT ACCOUNTS
  // --------------------------------------------------------------------------

  async getParentByUid(parentUid: string): Promise<ParentAccount | null> {
    return this.mutex.runExclusive(() => {
      const acc = this.accounts[parentUid];
      return acc ? JSON.parse(JSON.stringify(acc)) : null;
    });
  }

  async getParentByPhone(cleanPhone: string): Promise<ParentAccount | null> {
    return this.mutex.runExclusive(() => {
      const acc = Object.values(this.accounts).find(a => a.parentPhone === cleanPhone);
      return acc ? JSON.parse(JSON.stringify(acc)) : null;
    });
  }

  async getParentByStudentCode(studentCode: string): Promise<ParentAccount | null> {
    return this.mutex.runExclusive(() => {
      const code = studentCode.trim();
      const acc = Object.values(this.accounts).find(a => a.studentCodes.includes(code));
      return acc ? JSON.parse(JSON.stringify(acc)) : null;
    });
  }

  async createParentAccountAtomic(
    newAccount: ParentAccount,
    studentCode: string
  ): Promise<{ success: boolean; account: ParentAccount; alreadyExists?: boolean; error?: string }> {
    return this.mutex.runExclusive(() => {
      const code = studentCode.trim();
      const student = this.students[code];
      if (!student) {
        return { success: false, account: newAccount, error: "كود الطالب غير موجود بالنظام" };
      }

      // 1. Check if ANY account already claimed this student
      const existingWithStudent = Object.values(this.accounts).find(a => a.studentCodes.includes(code));
      if (existingWithStudent) {
        return {
          success: false,
          account: existingWithStudent,
          alreadyExists: true,
          error: "تم تسجيل هذا الحساب مسبقاً لهذا الطالب. يمكنك تسجيل الدخول مباشرة بكود الطالب وكلمة المرور."
        };
      }

      // 2. Check if an account already exists with this phone number (merge student)
      let account = Object.values(this.accounts).find(a => a.parentPhone === newAccount.parentPhone);

      if (account) {
        if (!account.studentCodes.includes(code)) {
          account.studentCodes.push(code);
        }
        account.updatedAt = new Date().toISOString();
      } else {
        account = { ...newAccount };
        this.accounts[account.parentUid] = account;
      }

      // Update student linkedParentUids
      if (!student.linkedParentUids.includes(account.parentUid)) {
        student.linkedParentUids.push(account.parentUid);
      }

      this.atomicFlushSync();
      return { success: true, account: JSON.parse(JSON.stringify(account)) };
    });
  }

  async updatePasswordAtomic(
    parentUid: string,
    passwordHash: string,
    salt: string,
    newAuthVersion: number
  ): Promise<boolean> {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return false;

      account.passwordHash = passwordHash;
      account.salt = salt;
      account.mustChangePassword = false;
      account.authVersion = newAuthVersion;
      account.updatedAt = new Date().toISOString();

      this.atomicFlushSync();
      return true;
    });
  }

  async resetPasswordAtomic(
    studentCode: string,
    tempHash: string,
    salt: string,
    newAuthVersion: number
  ): Promise<{ success: boolean; parentUid?: string; newAuthVersion?: number; error?: string }> {
    return this.mutex.runExclusive(() => {
      const code = studentCode.trim();
      const account = Object.values(this.accounts).find(a => a.studentCodes.includes(code));
      if (!account) {
        return { success: false, error: "لا يوجد حساب ولي أمر مسجل لهذا الطالب بعد" };
      }

      account.passwordHash = tempHash;
      account.salt = salt;
      account.mustChangePassword = true; // FORCE MANDATORY PASSWORD CHANGE
      account.authVersion = newAuthVersion; // INSTANT SESSION INVALIDATION
      account.updatedAt = new Date().toISOString();

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

  async createPairingCode(code: string, expiresAt: number): Promise<void> {
    return this.mutex.runExclusive(() => {
      this.pairingCodes[code] = {
        code,
        expiresAt,
        consumed: false,
        createdAt: new Date().toISOString()
      };
      this.atomicFlushSync();
    });
  }

  async consumePairingCodeAtomic(code: string): Promise<{ success: boolean; error?: string }> {
    return this.mutex.runExclusive(() => {
      const record = this.pairingCodes[code];
      const now = Date.now();

      if (!record) {
        return { success: false, error: "كود الاقتران غير صحيح" };
      }

      if (record.consumed) {
        return { success: false, error: "كود الاقتران مستخدم بالفعل (Single-Use Only)" };
      }

      if (now > record.expiresAt) {
        return { success: false, error: "كود الاقتران منتهي الصلاحية" };
      }

      // Atomic consume
      record.consumed = true;
      this.atomicFlushSync();
      return { success: true };
    });
  }

  async registerDevice(device: TeacherDevice): Promise<void> {
    return this.mutex.runExclusive(() => {
      this.devices[device.deviceId] = { ...device };
      this.atomicFlushSync();
    });
  }

  async getDevice(deviceId: string): Promise<TeacherDevice | null> {
    return this.mutex.runExclusive(() => {
      const d = this.devices[deviceId];
      return d ? JSON.parse(JSON.stringify(d)) : null;
    });
  }

  // --------------------------------------------------------------------------
  // SIBLING LINKING
  // --------------------------------------------------------------------------

  async createSiblingLinkRequest(req: SiblingLinkRequest): Promise<void> {
    return this.mutex.runExclusive(() => {
      this.linkRequests[req.requestId] = { ...req };
      this.atomicFlushSync();
    });
  }

  async getPendingLinkRequests(): Promise<SiblingLinkRequest[]> {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      return Object.values(this.linkRequests)
        .filter(r => r.status === "PENDING" && now < r.expiresAt)
        .map(r => JSON.parse(JSON.stringify(r)));
    });
  }

  async resolveSiblingLinkAtomic(
    pairingPin: string,
    approve: boolean
  ): Promise<{ success: boolean; request?: SiblingLinkRequest; studentName?: string; error?: string }> {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      const request = Object.values(this.linkRequests).find(
        r => r.pairingPin === pairingPin && r.status === "PENDING" && now < r.expiresAt
      );

      if (!request) {
        return { success: false, error: "رمز الربط (PIN) غير صحيح أو منتهي الصلاحية" };
      }

      if (!approve) {
        request.status = "REJECTED";
        this.atomicFlushSync();
        return { success: true, request: JSON.parse(JSON.stringify(request)) };
      }

      // Approve & Link
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

  async verifyAndRecordNonceAtomic(
    nonce: string,
    timestamp: number,
    windowMs = 5 * 60 * 1000
  ): Promise<{ valid: boolean; reason?: string }> {
    return this.mutex.runExclusive(() => {
      const now = Date.now();

      // Check timestamp skew
      if (Math.abs(now - timestamp) > windowMs) {
        return { valid: false, reason: "Expired or skewed timestamp in sync request" };
      }

      // Check replay
      if (this.nonces[nonce]) {
        return { valid: false, reason: "Replay detected: Nonce has already been processed" };
      }

      // Prune expired nonces older than windowMs
      for (const [n, ts] of Object.entries(this.nonces)) {
        if (now - ts > windowMs * 2) {
          delete this.nonces[n];
        }
      }

      // Atomic record
      this.nonces[nonce] = now;
      this.atomicFlushSync();
      return { valid: true };
    });
  }

  // --------------------------------------------------------------------------
  // RATE LIMITING
  // --------------------------------------------------------------------------

  async checkRateLimitAtomic(
    key: string,
    maxAttempts: number,
    windowMs: number,
    _lockoutMs: number
  ): Promise<{ allowed: boolean; waitSeconds?: number; attempts: number }> {
    return this.mutex.runExclusive(() => {
      const now = Date.now();
      let entry = this.rateLimits[key];

      if (!entry || now > entry.resetAt) {
        entry = { attempts: 0, resetAt: now + windowMs };
        this.rateLimits[key] = entry;
      }

      if (entry.lockedUntil && now < entry.lockedUntil) {
        const wait = Math.ceil((entry.lockedUntil - now) / 1000);
        return { allowed: false, waitSeconds: wait, attempts: entry.attempts };
      }

      return { allowed: true, attempts: entry.attempts };
    });
  }

  async recordFailureAtomic(
    key: string,
    maxAttempts: number,
    windowMs: number,
    lockoutMs: number
  ): Promise<{ locked: boolean; waitSeconds?: number }> {
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
        return { locked: true, waitSeconds: Math.ceil(lockoutMs / 1000) };
      }

      this.atomicFlushSync();
      return { locked: false };
    });
  }

  async clearRateLimit(key: string): Promise<void> {
    return this.mutex.runExclusive(() => {
      delete this.rateLimits[key];
      this.atomicFlushSync();
    });
  }

  // --------------------------------------------------------------------------
  // TEST SUITE RESET
  // --------------------------------------------------------------------------

  async resetTestState(): Promise<void> {
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

  async listParentAccounts(): Promise<ParentAccount[]> {
    return this.mutex.runExclusive(() => {
      return Object.values(this.accounts);
    });
  }

  async unlinkParentStudentAtomic(parentUid: string, studentCode: string): Promise<{ success: boolean; error?: string }> {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return { success: false, error: 'حساب ولي الأمر غير موجود' };

      const cleanCode = studentCode.trim();
      account.studentCodes = account.studentCodes.filter(c => c !== cleanCode);
      account.updatedAt = new Date().toISOString();

      const student = this.students[cleanCode];
      if (student) {
        student.linkedParentUids = student.linkedParentUids.filter(u => u !== parentUid);
      }

      this.atomicFlushSync();
      return { success: true };
    });
  }

  async linkParentStudentAtomic(parentUid: string, studentCode: string): Promise<{ success: boolean; error?: string }> {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return { success: false, error: 'حساب ولي الأمر غير موجود' };

      const cleanCode = studentCode.trim();
      const student = this.students[cleanCode];
      if (!student) return { success: false, error: 'كود الطالب غير موجود بالنظام' };

      if (!account.studentCodes.includes(cleanCode)) {
        account.studentCodes.push(cleanCode);
        account.updatedAt = new Date().toISOString();
      }

      if (!student.linkedParentUids.includes(parentUid)) {
        student.linkedParentUids.push(parentUid);
      }

      this.atomicFlushSync();
      return { success: true };
    });
  }

  async toggleAccountStatusAtomic(parentUid: string, mustChangePassword?: boolean): Promise<{
    success: boolean;
    account?: ParentAccount;
    error?: string;
  }> {
    return this.mutex.runExclusive(() => {
      const account = this.accounts[parentUid];
      if (!account) return { success: false, error: 'حساب ولي الأمر غير موجود' };

      const nextVal = mustChangePassword !== undefined ? mustChangePassword : !account.mustChangePassword;
      account.mustChangePassword = nextVal;
      account.authVersion = (account.authVersion || 1) + 1; // Invalidate current session tokens
      account.updatedAt = new Date().toISOString();

      this.atomicFlushSync();
      return { success: true, account };
    });
  }

  // --------------------------------------------------------------------------
  // SERVER PORTAL BACKUP & RESTORE
  // --------------------------------------------------------------------------

  async createPortalBackup(): Promise<{
    backupId: string;
    filePath: string;
    createdAt: string;
    studentsCount: number;
    accountsCount: number;
    fileSize: number;
  }> {
    return this.mutex.runExclusive(() => {
      const backupsDir = path.join(this.storageDir, 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = `portal_backup_${timestamp}`;
      const fileName = `${backupId}.json`;
      const filePath = path.join(backupsDir, fileName);

      const snapshot = {
        backupId,
        createdAt: new Date().toISOString(),
        students: this.students,
        accounts: this.accounts,
        devices: this.devices,
        pairingCodes: this.pairingCodes,
        linkRequests: this.linkRequests
      };

      const payload = JSON.stringify(snapshot, null, 2);
      fs.writeFileSync(filePath, payload, 'utf-8');
      const stats = fs.statSync(filePath);

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

  async listPortalBackups(): Promise<Array<{
    backupId: string;
    fileName: string;
    createdAt: string;
    studentsCount: number;
    accountsCount: number;
    fileSize: number;
  }>> {
    return this.mutex.runExclusive(() => {
      const backupsDir = path.join(this.storageDir, 'backups');
      if (!fs.existsSync(backupsDir)) return [];

      const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json'));
      const list: Array<{
        backupId: string;
        fileName: string;
        createdAt: string;
        studentsCount: number;
        accountsCount: number;
        fileSize: number;
      }> = [];

      for (const fileName of files) {
        try {
          const filePath = path.join(backupsDir, fileName);
          const stats = fs.statSync(filePath);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const obj = JSON.parse(raw);

          list.push({
            backupId: obj.backupId || fileName.replace('.json', ''),
            fileName,
            createdAt: obj.createdAt || stats.mtime.toISOString(),
            studentsCount: Object.keys(obj.students || {}).length,
            accountsCount: Object.keys(obj.accounts || {}).length,
            fileSize: stats.size
          });
        } catch (e) {}
      }

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return list;
    });
  }

  async restorePortalBackup(backupId: string, customPayload?: any): Promise<{
    success: boolean;
    restoredStudentsCount: number;
    restoredAccountsCount: number;
    error?: string;
  }> {
    return this.mutex.runExclusive(() => {
      let dataToRestore: any = customPayload;

      if (!dataToRestore) {
        const backupsDir = path.join(this.storageDir, 'backups');
        const fileName = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
        const filePath = path.join(backupsDir, fileName);

        if (!fs.existsSync(filePath)) {
          return { success: false, restoredStudentsCount: 0, restoredAccountsCount: 0, error: 'ملف النسخة الاحتياطية غير موجود' };
        }

        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          dataToRestore = JSON.parse(raw);
        } catch (e) {
          return { success: false, restoredStudentsCount: 0, restoredAccountsCount: 0, error: 'تنسيق ملف النسخة الاحتياطية غير صالح' };
        }
      }

      if (!dataToRestore || typeof dataToRestore !== 'object') {
        return { success: false, restoredStudentsCount: 0, restoredAccountsCount: 0, error: 'صيغة النسخة الاحتياطية غير صحيحة' };
      }

      if (dataToRestore.students && typeof dataToRestore.students === 'object') {
        this.students = dataToRestore.students;
      }
      if (dataToRestore.accounts && typeof dataToRestore.accounts === 'object') {
        this.accounts = dataToRestore.accounts;
      }
      if (dataToRestore.devices && typeof dataToRestore.devices === 'object') {
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
}

