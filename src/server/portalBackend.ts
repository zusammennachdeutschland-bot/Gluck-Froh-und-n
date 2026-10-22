import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  portalStorage,
  PortalStudentData,
  ParentAccount,
  TeacherDevice,
  SiblingLinkRequest,
  SanitizedLesson,
  SanitizedHomework,
  SanitizedGrade,
  SanitizedFinance,
  SanitizedCertificate
} from "./storage";

export type {
  PortalStudentData,
  ParentAccount,
  TeacherDevice,
  SiblingLinkRequest,
  SanitizedLesson,
  SanitizedHomework,
  SanitizedGrade,
  SanitizedFinance,
  SanitizedCertificate
};

// ============================================================================
// SECURITY & CRYPTO HELPERS
// ============================================================================

const JWT_SECRET = process.env.PORTAL_JWT_SECRET || "gluck_portal_session_secret_2026_super_secure_key";
const ADMIN_SECRET = process.env.ADMIN_ENROLLMENT_SECRET || "gluck_teacher_master_enroll_2026";

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
  } catch (e) {
    return false;
  }
}

export interface SessionPayload {
  parentUid: string;
  studentCodes: string[];
  activeStudentCode: string;
  authVersion: number;
  mustChangePassword: boolean;
  exp: number;
}

function createSessionToken(payload: Omit<SessionPayload, "exp">, expiresInSeconds = 24 * 3600): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// Clean phone string helper: strips spaces, dashes, leading +20 or zeros
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) {
    return digits.substring(2);
  }
  return digits;
}

// ============================================================================
// EXPRESS MIDDLEWARE: STRICT AUTHENTICATION & LIVE ACCOUNT VERIFICATION
// ============================================================================

async function authenticateParent(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const token = authHeader.substring(7);
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired session token" });
  }

  // Live account state & authVersion check (Instant Invalidation Gate)
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

  (req as any).user = {
    ...payload,
    mustChangePassword: account.mustChangePassword,
    studentCodes: account.studentCodes
  };

  next();
}

// ============================================================================
// SETUP PORTAL ROUTES
// ============================================================================

export function setupPortalRoutes(app: Express) {

  // --------------------------------------------------------------------------
  // HEALTH & STATUS
  // --------------------------------------------------------------------------
  app.get("/api/portal/health", async (req, res) => {
    try {
      const storageStatus = portalStorage.getStatus();
      const students = await portalStorage.listStudents();
      res.json({
        status: "online",
        portalVersion: "3.2.0",
        storage: storageStatus,
        studentsCount: students.length,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      res.status(500).json({ error: "Health probe failure", details: String(e) });
    }
  });

  // Admin / Testing: Reset rate limits for test suite runs
  app.post("/api/portal/test/reset-limits", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV !== "production" || authHeader === `Bearer ${ADMIN_SECRET}`) {
      await portalStorage.resetTestState();
      return res.json({ success: true, message: "Rate limits and test store reset" });
    }
    res.status(401).json({ error: "Unauthorized" });
  });

  // --------------------------------------------------------------------------
  // PARENT AUTH: REGISTRATION
  // Student Code + Registered Parent Phone Number -> Create Password
  // --------------------------------------------------------------------------
  app.post("/api/portal/auth/register", async (req, res) => {
    const clientIp = (req.ip || req.socket.remoteAddress || "unknown").toString();
    const { studentCode, parentPhone, password } = req.body;

    // Distributed Rate Limiting (IP)
    const ipCheck = await portalStorage.checkRateLimitAtomic(clientIp, 10, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${ipCheck.waitSeconds} ثانية.`
      });
    }

    if (!studentCode || !parentPhone || !password) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة (كود الطالب، رقم هاتف ولي الأمر، كلمة المرور)" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام" });
    }

    const cleanCode = studentCode.trim();
    const cleanPhone = normalizePhone(parentPhone);

    const student = await portalStorage.getStudent(cleanCode);
    if (!student) {
      await portalStorage.recordFailureAtomic(clientIp, 10, 15 * 60 * 1000, 15 * 60 * 1000);
      return res.status(404).json({ error: "كود الطالب غير موجود بالنظام. يرجى مراجعة المعلم." });
    }

    // Verify phone against student record
    const matchesPhone = student.parentPhones.some(p => normalizePhone(p) === cleanPhone);
    if (!matchesPhone) {
      await portalStorage.recordFailureAtomic(clientIp, 10, 15 * 60 * 1000, 15 * 60 * 1000);
      return res.status(400).json({ error: "رقم الهاتف المدخل لا يتطابق مع المسجل لدى المعلم لهذا الطالب." });
    }

    // Check if student already registered or phone registered
    const { hash, salt } = hashPassword(password);
    const parentUid = `p_${crypto.randomBytes(8).toString("hex")}`;
    const newAccountCandidate: ParentAccount = {
      parentUid,
      parentPhone: cleanPhone,
      studentCodes: [cleanCode],
      passwordHash: hash,
      salt,
      authVersion: 1,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const creationResult = await portalStorage.createParentAccountAtomic(newAccountCandidate, cleanCode);

    if (!creationResult.success) {
      if (creationResult.alreadyExists) {
        return res.status(409).json({ error: creationResult.error });
      }
      return res.status(400).json({ error: creationResult.error || "فشل تسجيل الحساب" });
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
      message: "تم إنشاء حساب ولي الأمر بنجاح",
      token,
      parentUid: finalAccount.parentUid,
      studentCodes: finalAccount.studentCodes,
      activeStudentCode: cleanCode,
      mustChangePassword: finalAccount.mustChangePassword
    });
  });

  // --------------------------------------------------------------------------
  // PARENT AUTH: LOGIN
  // Student Code + Password
  // --------------------------------------------------------------------------
  app.post("/api/portal/auth/login", async (req, res) => {
    const clientIp = (req.ip || req.socket.remoteAddress || "unknown").toString();
    const { studentCode, password } = req.body;

    const ipCheck = await portalStorage.checkRateLimitAtomic(clientIp, 15, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        error: `تم حظر الطلبات مؤقتاً من هذا العنوان بسبب المحاولات المتكررة. يرجى الانتظار ${ipCheck.waitSeconds} ثانية.`
      });
    }

    if (!studentCode || !password) {
      return res.status(400).json({ error: "كود الطالب وكلمة المرور مطلوبان" });
    }

    const cleanCode = studentCode.trim();
    const accountCheck = await portalStorage.checkRateLimitAtomic(cleanCode, 5, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!accountCheck.allowed) {
      return res.status(429).json({
        error: `تم قفل الحساب مؤقتاً لمدة 15 دقيقة بعد 5 محاولات خاطئة متتالية. انتظر ${accountCheck.waitSeconds} ثانية أو راجع المعلم.`
      });
    }

    // Find parent account containing this studentCode
    const account = await portalStorage.getParentByStudentCode(cleanCode);

    if (!account) {
      await portalStorage.recordFailureAtomic(cleanCode, 5, 15 * 60 * 1000, 15 * 60 * 1000);
      await portalStorage.recordFailureAtomic(clientIp, 15, 15 * 60 * 1000, 15 * 60 * 1000);
      return res.status(401).json({ error: "كود الطالب أو كلمة المرور غير صحيحة" });
    }

    // Verify password securely
    const valid = verifyPassword(password, account.passwordHash, account.salt);
    if (!valid) {
      await portalStorage.recordFailureAtomic(cleanCode, 5, 15 * 60 * 1000, 15 * 60 * 1000);
      await portalStorage.recordFailureAtomic(clientIp, 15, 15 * 60 * 1000, 15 * 60 * 1000);
      return res.status(401).json({ error: "كود الطالب أو كلمة المرور غير صحيحة" });
    }

    // Success: clear lockouts
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

  // --------------------------------------------------------------------------
  // PARENT AUTH: GET SESSION
  // --------------------------------------------------------------------------
  app.get("/api/portal/auth/session", authenticateParent, async (req, res) => {
    const user = (req as any).user as SessionPayload;
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

  // --------------------------------------------------------------------------
  // PARENT AUTH: CHANGE PASSWORD (Mandatory transition or user initiated)
  // --------------------------------------------------------------------------
  app.post("/api/portal/auth/change-password", authenticateParent, async (req, res) => {
    const user = (req as any).user as SessionPayload;
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف" });
    }

    const account = await portalStorage.getParentByUid(user.parentUid);
    if (!account) {
      return res.status(404).json({ error: "الحساب غير موجود" });
    }

    const { hash, salt } = hashPassword(newPassword);
    const newAuthVersion = (account.authVersion || 1) + 1; // Increment auth version to invalidate old sessions

    await portalStorage.updatePasswordAtomic(user.parentUid, hash, salt, newAuthVersion);

    // Issue brand new token with updated authVersion
    const freshToken = createSessionToken({
      parentUid: account.parentUid,
      studentCodes: account.studentCodes,
      activeStudentCode: user.activeStudentCode,
      authVersion: newAuthVersion,
      mustChangePassword: false
    });

    res.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح",
      token: freshToken,
      mustChangePassword: false,
      authVersion: newAuthVersion
    });
  });

  // --------------------------------------------------------------------------
  // PARENT AUTH: REQUEST SIBLING LINKING (ZERO-OTP FLOW)
  // --------------------------------------------------------------------------
  app.post("/api/portal/auth/link-request", authenticateParent, async (req, res) => {
    const user = (req as any).user as SessionPayload;
    const { targetStudentCode } = req.body;

    if (!targetStudentCode) {
      return res.status(400).json({ error: "كود الطالب المراد ربطه مطلوب" });
    }

    const cleanCode = targetStudentCode.trim();
    const targetStudent = await portalStorage.getStudent(cleanCode);

    if (!targetStudent) {
      return res.status(404).json({ error: "كود الطالب غير موجود في سجلات المدرسة" });
    }

    const account = await portalStorage.getParentByUid(user.parentUid);
    if (!account) {
      return res.status(401).json({ error: "Parent account not found" });
    }

    if (account.studentCodes.includes(cleanCode)) {
      return res.status(400).json({ error: "هذا الطالب مرتبط بالفعل بحسابك" });
    }

    // Generate 6-digit numeric pairing PIN
    const pairingPin = Math.floor(100000 + Math.random() * 900000).toString();
    const requestId = `req_${crypto.randomBytes(6).toString("hex")}`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    const requestObj: SiblingLinkRequest = {
      requestId,
      parentUid: user.parentUid,
      targetStudentCode: cleanCode,
      pairingPin,
      expiresAt,
      status: "PENDING",
      createdAt: new Date().toISOString()
    };

    await portalStorage.createSiblingLinkRequest(requestObj);

    res.json({
      success: true,
      requestId,
      targetStudentName: targetStudent.studentName,
      pairingPin,
      expiresInMinutes: 15,
      instruction: "أعطِ هذا الرمز (PIN) لمعلم المادة في الحصة أو تواصل معه لتأكيد الربط فوراً."
    });
  });

  // --------------------------------------------------------------------------
  // PARENT DATA: GET STUDENT DASHBOARD DATA
  // --------------------------------------------------------------------------
  app.get("/api/portal/data/:studentCode", authenticateParent, async (req, res) => {
    const user = (req as any).user as SessionPayload;
    const requestedCode = req.params.studentCode.trim();

    // Block data access if forced password change is pending
    if (user.mustChangePassword) {
      return res.status(403).json({
        error: "PasswordChangeRequired: يجب تعيين كلمة مرور جديدة قبل استعراض بيانات الطالب",
        code: "PASSWORD_CHANGE_REQUIRED"
      });
    }

    // Verify that parent is independently authorized on the server for this student
    if (!user.studentCodes.includes(requestedCode)) {
      return res.status(403).json({
        error: "Forbidden: غير مصرح لك باستعراض بيانات هذا الطالب",
        code: "CROSS_STUDENT_ACCESS_DENIED"
      });
    }

    const student = await portalStorage.getStudent(requestedCode);
    if (!student) {
      return res.status(404).json({ error: "لم يتم العثور على سجلات هذا الطالب" });
    }

    // Return sanitized student data
    res.json({
      success: true,
      student,
      availableSiblings: user.studentCodes
    });
  });

  // ==========================================================================
  // TEACHER & DEVICE APIS (OFFLINE-TO-ONLINE SYNC)
  // ==========================================================================

  // 1. Teacher Admin: Request Single-Use Pairing Code
  app.post("/api/teacher/request-pairing-code", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || (authHeader !== `Bearer ${ADMIN_SECRET}` && authHeader !== "Bearer teacher_portal_admin_session")) {
      return res.status(401).json({ error: "Unauthorized: Invalid administrative enrollment secret" });
    }

    // Generate 8-character numeric code
    const code = `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    await portalStorage.createPairingCode(code, expiresAt);

    res.json({
      success: true,
      pairingCode: code,
      expiresInMinutes: 10
    });
  });

  // 2. Teacher App: Enroll Device via Pairing Code
  app.post("/api/teacher/enroll-device", async (req, res) => {
    const { pairingCode, deviceId, devicePublicKey, deviceName } = req.body;

    if (!pairingCode || !deviceId || !devicePublicKey) {
      return res.status(400).json({ error: "Missing required enrollment fields" });
    }

    // Atomically consume pairing code (prevents race condition & double use)
    const consumeRes = await portalStorage.consumePairingCodeAtomic(pairingCode);
    if (!consumeRes.success) {
      return res.status(401).json({ error: consumeRes.error || "Invalid, expired, or already consumed pairing code" });
    }

    // Register teacher device
    await portalStorage.registerDevice({
      deviceId,
      deviceName: deviceName || "Teacher Device",
      publicKey: devicePublicKey,
      enrolledAt: new Date().toISOString(),
      isRevoked: false
    });

    res.json({
      success: true,
      message: "تم تسجيل جهاز المعلم بنجاح",
      deviceId
    });
  });

  // 3. Teacher App: Push Sanitized Student Records
  app.post("/api/teacher/sync-students", async (req, res) => {
    const deviceId = req.headers["x-teacher-device-id"] as string;
    const timestampStr = req.headers["x-teacher-timestamp"] as string;
    const nonce = req.headers["x-teacher-nonce"] as string;
    const signature = req.headers["x-teacher-signature"] as string;

    if (!deviceId || !timestampStr || !nonce || !signature) {
      return res.status(401).json({ error: "Missing teacher sync cryptographic signature headers" });
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return res.status(401).json({ error: "Invalid timestamp in sync request" });
    }

    // Atomic Nonce Check & Record (Replay Attack Shield)
    const nonceCheck = await portalStorage.verifyAndRecordNonceAtomic(nonce, timestamp);
    if (!nonceCheck.valid) {
      return res.status(401).json({ error: nonceCheck.reason || "Replay detected or expired timestamp" });
    }

    // Verify Device
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
      message: `تمت مزامنة ${syncedCount} طالب بنجاح مع بوابة أولياء الأمور`,
      syncedCount,
      timestamp: new Date().toISOString()
    });
  });

  // 4. Teacher App: Approve Sibling Link Request
  app.post("/api/teacher/approve-link", async (req, res) => {
    const { pairingPin, approve } = req.body;

    if (!pairingPin) {
      return res.status(400).json({ error: "رمز الربط (PIN) مطلوب" });
    }

    const isApprove = approve !== false;
    const result = await portalStorage.resolveSiblingLinkAtomic(pairingPin, isApprove);

    if (!result.success) {
      return res.status(404).json({ error: result.error || "رمز الربط (PIN) غير صحيح أو منتهي الصلاحية" });
    }

    if (!isApprove) {
      return res.json({ success: true, message: "تم رفض طلب الربط" });
    }

    res.json({
      success: true,
      message: `تم ربط الطالب ${result.studentName} بولي الأمر بنجاح`,
      studentCode: result.request?.targetStudentCode
    });
  });

  // 5. Teacher App: Reset Parent Password
  app.post("/api/teacher/reset-parent-password", async (req, res) => {
    const { studentCode } = req.body;
    if (!studentCode) {
      return res.status(400).json({ error: "كود الطالب مطلوب" });
    }

    const cleanCode = studentCode.trim();

    // Generate 8-character temporary password
    const tempPassword = `P${Math.floor(100000 + Math.random() * 900000)}`;
    const { hash, salt } = hashPassword(tempPassword);

    // Look up account version to increment
    const existing = await portalStorage.getParentByStudentCode(cleanCode);
    if (!existing) {
      return res.status(404).json({ error: "لا يوجد حساب ولي أمر مسجل لهذا الطالب بعد" });
    }

    const newAuthVersion = (existing.authVersion || 1) + 1;
    const resetRes = await portalStorage.resetPasswordAtomic(cleanCode, hash, salt, newAuthVersion);

    if (!resetRes.success) {
      return res.status(404).json({ error: resetRes.error || "لا يوجد حساب ولي أمر مسجل لهذا الطالب بعد" });
    }

    res.json({
      success: true,
      message: "تمت إعادة تعيين كلمة المرور بنجاح. يلزم ولي الأمر تغييرها عند أول تسجيل دخول.",
      temporaryPassword: tempPassword,
      studentCode: cleanCode,
      authVersion: newAuthVersion
    });
  });

  // 6. Teacher App: Get Portal Status
  app.get("/api/teacher/portal-status", async (req, res) => {
    const allStudents = await portalStorage.listStudents();
    const parents = await portalStorage.listParentAccounts();
    const students = allStudents.map(s => ({
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
      linkedStudentsCount: students.filter(s => s.hasLinkedParent).length,
      pendingLinkRequests: pendingLinks,
      storageStatus
    });
  });

  // 7. Teacher App: List Parent Accounts
  app.get("/api/teacher/parents", async (req, res) => {
    try {
      const accounts = await portalStorage.listParentAccounts();
      const sanitized = accounts.map(a => ({
        parentUid: a.parentUid,
        parentPhone: a.parentPhone,
        studentCodes: a.studentCodes,
        authVersion: a.authVersion,
        mustChangePassword: a.mustChangePassword,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }));
      res.json({ success: true, parents: sanitized });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to list parent accounts" });
    }
  });

  // 8. Teacher App: Unlink Student from Parent Account
  app.post("/api/teacher/parent/unlink", async (req, res) => {
    const { parentUid, studentCode } = req.body;
    if (!parentUid || !studentCode) {
      return res.status(400).json({ error: "معرف ولي الأمر وكود الطالب مطلوبان" });
    }

    const result = await portalStorage.unlinkParentStudentAtomic(parentUid, studentCode);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "فشل إلغاء ربط الطالب" });
    }

    res.json({ success: true, message: "تم إلغاء ربط الطالب بولي الأمر بنجاح" });
  });

  // 9. Teacher App: Link Student to Parent Account
  app.post("/api/teacher/parent/link", async (req, res) => {
    const { parentUid, studentCode } = req.body;
    if (!parentUid || !studentCode) {
      return res.status(400).json({ error: "معرف ولي الأمر وكود الطالب مطلوبان" });
    }

    const result = await portalStorage.linkParentStudentAtomic(parentUid, studentCode);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "فشل ربط الطالب بولي الأمر" });
    }

    res.json({ success: true, message: "تم ربط الطالب بولي الأمر بنجاح" });
  });

  // 10. Teacher App: Toggle Parent Account Status / Force Password Change
  app.post("/api/teacher/parent/toggle-status", async (req, res) => {
    const { parentUid, mustChangePassword } = req.body;
    if (!parentUid) {
      return res.status(400).json({ error: "معرف ولي الأمر مطلوب" });
    }

    const result = await portalStorage.toggleAccountStatusAtomic(parentUid, mustChangePassword);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "فشل تحديث حالة الحساب" });
    }

    res.json({
      success: true,
      message: "تم تحديث حالة حساب ولي الأمر وتحديث نسخة التوثيق بنجاح",
      account: {
        parentUid: result.account?.parentUid,
        mustChangePassword: result.account?.mustChangePassword,
        authVersion: result.account?.authVersion
      }
    });
  });

  // 11. Teacher App: List Portal Backups
  app.get("/api/teacher/backups", async (req, res) => {
    try {
      const backups = await portalStorage.listPortalBackups();
      res.json({ success: true, backups });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "فشل جلب النسخ الاحتياطية" });
    }
  });

  // 12. Teacher App: Create Portal Backup Snapshot
  app.post("/api/teacher/backup/create", async (req, res) => {
    try {
      const backup = await portalStorage.createPortalBackup();
      res.json({
        success: true,
        message: "تم إنشاء نسخة احتياطية موثقة للبوابة بنجاح",
        backup
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "فشل إنشاء النسخة الاحتياطية" });
    }
  });

  // 13. Teacher App: Restore Portal Backup Snapshot
  app.post("/api/teacher/backup/restore", async (req, res) => {
    const { backupId } = req.body;
    if (!backupId) {
      return res.status(400).json({ error: "معرف النسخة الاحتياطية مطلوب" });
    }

    try {
      const result = await portalStorage.restorePortalBackup(backupId);
      if (!result.success) {
        return res.status(400).json({ error: result.error || "فشل استعادة النسخة الاحتياطية" });
      }

      res.json({
        success: true,
        message: `تم استعادة النسخة الاحتياطية بنجاح (${result.restoredStudentsCount} طالب، ${result.restoredAccountsCount} ولي أمر)`,
        restoredStudentsCount: result.restoredStudentsCount,
        restoredAccountsCount: result.restoredAccountsCount
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "فشل استعادة النسخة الاحتياطية" });
    }
  });
}

