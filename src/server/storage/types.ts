// ============================================================================
// GLÜCK PARENT PORTAL - STORAGE ARCHITECTURE TYPES
// ============================================================================

export interface SanitizedLesson {
  id: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  meetingLink?: string;
  homeworkStatus?: string;
  homeworkTitle?: string;
  attendanceStatus?: string;
  quizScore?: number;
  examScore?: number;
  publicNotes?: string;
}

export interface SanitizedHomework {
  id: string;
  title: string;
  assignedDate: string;
  dueDate?: string;
  status: 'completed' | 'not_completed' | 'assigned';
  description?: string;
}

export interface SanitizedGrade {
  id: string;
  title: string;
  date: string;
  type: 'dictation' | 'exam' | 'quiz' | 'participation';
  score: number;
  maxScore: number;
  percentage: number;
  feedback?: string;
}

export interface SanitizedFinanceRecord {
  id: string;
  date: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  notes?: string;
}

export interface SanitizedFinance {
  totalDue: number;
  totalPaid: number;
  remainingBalance: number;
  currency: string;
  records: SanitizedFinanceRecord[];
}

export interface SanitizedCertificate {
  id: string;
  title: string;
  recipientName: string;
  certificateType: string;
  issueDate: string;
  score?: string;
  teacherName?: string;
}

export interface PortalStudentData {
  studentCode: string;
  studentName: string;
  grade: string;
  groupName: string;
  parentPhones: string[];
  linkedParentUids: string[];
  attendanceRate: number;
  totalLessons: number;
  completedLessons: number;
  streak: number;
  nextLesson?: {
    date: string;
    time: string;
    title: string;
    meetingLink?: string;
  } | null;
  lessons: SanitizedLesson[];
  homework: SanitizedHomework[];
  grades: SanitizedGrade[];
  finance: SanitizedFinance;
  certificates: SanitizedCertificate[];
  lastSyncedAt: string;
}

export interface ParentAccount {
  parentUid: string;
  parentPhone: string;
  studentCodes: string[];
  passwordHash: string;
  salt: string;
  authVersion: number;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherDevice {
  deviceId: string;
  deviceName: string;
  publicKey: string;
  enrolledAt: string;
  isRevoked: boolean;
}

export interface PairingCodeEntry {
  code: string;
  expiresAt: number;
  consumed: boolean;
  createdAt: string;
}

export interface SiblingLinkRequest {
  requestId: string;
  parentUid: string;
  targetStudentCode: string;
  pairingPin: string;
  expiresAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface RateLimitEntry {
  attempts: number;
  resetAt: number;
  lockedUntil?: number;
}

export interface StorageStatus {
  engine: 'firestore' | 'atomic_transactional';
  isDurable: boolean;
  firestoreConfigured: boolean;
  firestoreConnected: boolean;
  firestoreDatabaseId?: string;
  firestoreProjectId?: string;
  reason?: string;
}

export interface IPortalStorage {
  // Initialization & Diagnostics
  init(): Promise<void>;
  getStatus(): StorageStatus;

  // Students
  getStudent(studentCode: string): Promise<PortalStudentData | null>;
  upsertStudents(students: PortalStudentData[]): Promise<number>;
  listStudents(): Promise<PortalStudentData[]>;

  // Parent Accounts
  getParentByUid(parentUid: string): Promise<ParentAccount | null>;
  getParentByPhone(cleanPhone: string): Promise<ParentAccount | null>;
  getParentByStudentCode(studentCode: string): Promise<ParentAccount | null>;
  createParentAccountAtomic(account: ParentAccount, studentCode: string): Promise<{
    success: boolean;
    account: ParentAccount;
    alreadyExists?: boolean;
    error?: string;
  }>;
  updatePasswordAtomic(parentUid: string, passwordHash: string, salt: string, newAuthVersion: number): Promise<boolean>;
  resetPasswordAtomic(studentCode: string, tempHash: string, salt: string, newAuthVersion: number): Promise<{
    success: boolean;
    parentUid?: string;
    newAuthVersion?: number;
    error?: string;
  }>;

  // Teacher Devices & Pairing
  createPairingCode(code: string, expiresAt: number): Promise<void>;
  consumePairingCodeAtomic(code: string): Promise<{ success: boolean; error?: string }>;
  registerDevice(device: TeacherDevice): Promise<void>;
  getDevice(deviceId: string): Promise<TeacherDevice | null>;

  // Sibling Linking
  createSiblingLinkRequest(req: SiblingLinkRequest): Promise<void>;
  getPendingLinkRequests(): Promise<SiblingLinkRequest[]>;
  resolveSiblingLinkAtomic(pairingPin: string, approve: boolean): Promise<{
    success: boolean;
    request?: SiblingLinkRequest;
    studentName?: string;
    error?: string;
  }>;

  // Security: Nonce Replay Protection
  verifyAndRecordNonceAtomic(nonce: string, timestamp: number, windowMs?: number): Promise<{
    valid: boolean;
    reason?: string;
  }>;

  // Security: Distributed Rate Limiting
  checkRateLimitAtomic(key: string, maxAttempts: number, windowMs: number, lockoutMs: number): Promise<{
    allowed: boolean;
    waitSeconds?: number;
    attempts: number;
  }>;
  recordFailureAtomic(key: string, maxAttempts: number, windowMs: number, lockoutMs: number): Promise<{
    locked: boolean;
    waitSeconds?: number;
  }>;
  clearRateLimit(key: string): Promise<void>;

  // Testing & Reset
  resetTestState(): Promise<void>;

  // Parent Account Management
  listParentAccounts(): Promise<ParentAccount[]>;
  unlinkParentStudentAtomic(parentUid: string, studentCode: string): Promise<{ success: boolean; error?: string }>;
  linkParentStudentAtomic(parentUid: string, studentCode: string): Promise<{ success: boolean; error?: string }>;
  toggleAccountStatusAtomic(parentUid: string, mustChangePassword?: boolean): Promise<{
    success: boolean;
    account?: ParentAccount;
    error?: string;
  }>;

  // Server Portal Backup & Restore
  createPortalBackup(): Promise<{
    backupId: string;
    filePath: string;
    createdAt: string;
    studentsCount: number;
    accountsCount: number;
    fileSize: number;
  }>;
  listPortalBackups(): Promise<Array<{
    backupId: string;
    fileName: string;
    createdAt: string;
    studentsCount: number;
    accountsCount: number;
    fileSize: number;
  }>>;
  restorePortalBackup(backupId: string, customPayload?: any): Promise<{
    success: boolean;
    restoredStudentsCount: number;
    restoredAccountsCount: number;
    error?: string;
  }>;
}
