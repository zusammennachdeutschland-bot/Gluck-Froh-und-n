import { storage } from './storageService';
import { Student, Lesson, PaymentRecord, CertificateRecord } from '../types';

export interface SanitizedPortalStudent {
  studentCode: string;
  studentName: string;
  grade: string;
  groupName: string;
  parentPhones: string[];
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
  lessons: Array<{
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
  }>;
  homework: Array<{
    id: string;
    title: string;
    assignedDate: string;
    dueDate?: string;
    status: 'completed' | 'not_completed' | 'assigned';
    description?: string;
  }>;
  grades: Array<{
    id: string;
    title: string;
    date: string;
    type: 'dictation' | 'exam' | 'quiz' | 'participation';
    score: number;
    maxScore: number;
    percentage: number;
    feedback?: string;
  }>;
  finance: {
    totalDue: number;
    totalPaid: number;
    remainingBalance: number;
    currency: string;
    records: Array<{
      id: string;
      date: string;
      amountDue: number;
      amountPaid: number;
      status: string;
      notes?: string;
    }>;
  };
  certificates: Array<{
    id: string;
    title: string;
    recipientName: string;
    certificateType: string;
    issueDate: string;
    score?: string;
    teacherName?: string;
  }>;
}

export interface PortalSyncStatus {
  isConfigured: boolean;
  deviceId: string | null;
  lastSyncedAt: string | null;
  totalStudentsSynced: number;
  pendingLinkRequests: Array<{
    requestId: string;
    targetStudentCode: string;
    pairingPin: string;
    expiresAt: number;
  }>;
}

const STORAGE_KEYS = {
  DEVICE_ID: 'portal_sync_device_id',
  DEVICE_NAME: 'portal_sync_device_name',
  LAST_SYNC: 'portal_sync_last_timestamp'
};

class PortalSyncService {
  private deviceId: string | null = null;

  async init(): Promise<void> {
    this.deviceId = await storage.getItem<string>(STORAGE_KEYS.DEVICE_ID);
    if (!this.deviceId) {
      this.deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
      await storage.setItem(STORAGE_KEYS.DEVICE_ID, this.deviceId);
    }
  }

  getDeviceId(): string {
    return this.deviceId || 'dev_teacher_main';
  }

  /**
   * Request single-use pairing code from server admin
   */
  async requestPairingCode(adminSecret: string): Promise<string> {
    const res = await fetch('/api/teacher/request-pairing-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSecret}`
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل في طلب رمز الاقتران');
    }

    const data = await res.json();
    return data.pairingCode;
  }

  /**
   * Enroll this device with server using single-use pairing code
   */
  async enrollDevice(pairingCode: string, deviceName = 'جهاز المعلم الأساسي'): Promise<boolean> {
    await this.init();

    const res = await fetch('/api/teacher/enroll-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingCode,
        deviceId: this.getDeviceId(),
        devicePublicKey: `pubkey_${this.getDeviceId()}`,
        deviceName
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل في تسجيل الجهاز');
    }

    await storage.setItem(STORAGE_KEYS.DEVICE_NAME, deviceName);
    return true;
  }

  /**
   * Sanitize an individual student record for parent portal viewing
   */
  sanitizeStudent(
    student: Student,
    allLessons: Lesson[],
    allPayments: PaymentRecord[],
    allCertificates: CertificateRecord[],
    allGroups: Array<{ id: string; name: string }> = []
  ): SanitizedPortalStudent {
    const group = allGroups.find(g => g.id === student.groupId);
    const groupName = group ? group.name : 'فردي';
    // Match lessons for this student (either individual lesson or group lesson)
    const studentLessons = allLessons.filter(l => 
      l.studentId === student.id || l.groupId === student.groupId
    );

    // Filter payments
    const studentPayments = allPayments.filter(p => p.studentId === student.id);

    // Filter certificates
    const studentCerts = allCertificates.filter(c => c.studentId === student.id);

    // Calculate attendance metrics
    const completedLessons = studentLessons.filter(l => l.status === 'completed');
    let attendedCount = 0;
    completedLessons.forEach(l => {
      const att = l.report?.studentAttendance?.[student.id] || l.report?.attendanceStatus;
      if (att === 'present') attendedCount++;
      else if (att === 'late') attendedCount += 0.8;
    });

    const attendanceRate = completedLessons.length > 0 
      ? Math.round((attendedCount / completedLessons.length) * 100) 
      : 100;

    // Upcoming next lesson
    const now = new Date();
    const upcomingLessons = studentLessons
      .filter(l => l.status === 'scheduled' && new Date(`${l.date}T${l.time}`) >= now)
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

    const nextLesson = upcomingLessons.length > 0 ? {
      date: upcomingLessons[0].date,
      time: upcomingLessons[0].time,
      title: upcomingLessons[0].title,
      meetingLink: upcomingLessons[0].meetingLink
    } : null;

    // Sanitized lessons list (strictly removing teacher-only internal notes)
    const sanitizedLessons = completedLessons.slice(0, 30).map(l => {
      const attStatus = l.report?.studentAttendance?.[student.id] || l.report?.attendanceStatus || 'present';
      const hwDone = l.report?.studentHomeworkDone?.[student.id] || (l.report?.homeworkStatus === 'completed' ? 'yes' : 'no');
      const qScore = l.report?.quizScore;
      const exScore = l.report?.examScore;

      return {
        id: l.id,
        title: l.title,
        date: l.date,
        time: l.time,
        durationMinutes: l.durationMinutes || 60,
        status: l.status,
        paymentStatus: l.paymentStatus,
        meetingLink: l.meetingLink,
        homeworkStatus: hwDone === 'yes' ? 'completed' : 'not_completed',
        homeworkTitle: l.report?.homeworkTitle,
        attendanceStatus: attStatus,
        quizScore: qScore,
        examScore: exScore,
        publicNotes: l.report?.arabicParentNotes || l.report?.arabicTopicsExplained
      };
    });

    // Sanitized homework
    const homeworkItems = studentLessons
      .filter(l => l.report?.homeworkTitle)
      .map((l, idx) => ({
        id: `hw-${l.id || idx}`,
        title: l.report?.homeworkTitle || 'واجب مدرسي',
        assignedDate: l.date,
        status: (l.report?.studentHomeworkDone?.[student.id] === 'yes' ? 'completed' : 'assigned') as 'completed' | 'assigned',
        description: l.report?.homeworkDescription || l.report?.arabicHomeworkRequired
      }));

    // Sanitized grades (dictation, exams)
    const gradesList: SanitizedPortalStudent['grades'] = [];
    studentLessons.forEach(l => {
      if (l.report?.dictationScore || l.report?.studentDictationGrade?.[student.id] !== undefined) {
        const score = l.report.studentDictationGrade?.[student.id] || parseFloat(l.report.dictationScore || '10');
        gradesList.push({
          id: `dict-${l.id}`,
          title: `تسميع كلمات (${l.date})`,
          date: l.date,
          type: 'dictation',
          score,
          maxScore: 10,
          percentage: Math.round((score / 10) * 100),
          feedback: score >= 9 ? 'ممتاز' : 'جيد جداً'
        });
      }
      if (l.report?.examScore || l.report?.studentExamGrade?.[student.id] !== undefined) {
        const score = l.report.studentExamGrade?.[student.id] || l.report.examScore || 100;
        gradesList.push({
          id: `exam-${l.id}`,
          title: `اختبار دوري (${l.date})`,
          date: l.date,
          type: 'exam',
          score,
          maxScore: 100,
          percentage: Math.round(score),
          feedback: score >= 90 ? 'أداء متفوق' : 'مستوى طيب'
        });
      }
    });

    // Finance calculations
    const totalDue = studentPayments.reduce((acc, p) => acc + (p.amountDue || 0), 0);
    const totalPaid = studentPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);

    const sanitizedFinance = {
      totalDue,
      totalPaid,
      remainingBalance: Math.max(0, totalDue - totalPaid),
      currency: 'EGP',
      records: studentPayments.map(p => ({
        id: p.id,
        date: p.dueDate || p.paidDate || p.createdAt || '',
        amountDue: p.amountDue || 0,
        amountPaid: p.amountPaid || 0,
        status: p.status,
        notes: p.notes
      }))
    };

    // Certificates
    const sanitizedCerts = studentCerts.map(c => ({
      id: c.id,
      title: c.title,
      recipientName: c.recipientName || c.studentName,
      certificateType: c.certificateType,
      issueDate: c.issueDate,
      score: c.score,
      teacherName: c.teacherName
    }));

    // Student code (stable string)
    const studentCode = student.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || `stu-${student.name.replace(/\s+/g, '')}`;

    return {
      studentCode,
      studentName: student.name,
      grade: student.grade || 'General',
      groupName,
      parentPhones: [student.parentPhone, student.studentPhone].filter(Boolean) as string[],
      attendanceRate,
      totalLessons: studentLessons.length,
      completedLessons: completedLessons.length,
      streak: Math.min(completedLessons.length, 6),
      nextLesson,
      lessons: sanitizedLessons,
      homework: homeworkItems,
      grades: gradesList,
      finance: sanitizedFinance,
      certificates: sanitizedCerts
    };
  }

  /**
   * Push all local students to the online Parent Portal
   */
  async syncAllStudents(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    await this.init();

    const students = await storage.getItem<Student[]>('students') || [];
    const lessons = await storage.getItem<Lesson[]>('lessons') || [];
    const payments = await storage.getItem<PaymentRecord[]>('payments') || [];
    const certs = await storage.getItem<CertificateRecord[]>('certificates') || [];
    const groups = await storage.getItem<any[]>('groups') || [];

    if (students.length === 0) {
      return { success: true, syncedCount: 0, message: 'لا يوجد طلاب مسجلون للمزامنة' };
    }

    const sanitizedStudents = students.map(s => 
      this.sanitizeStudent(s, lessons, payments, certs, groups)
    );

    const timestamp = Date.now().toString();
    const nonce = 'nc_' + Math.random().toString(36).substring(2, 12);
    const signature = `sig_${this.getDeviceId()}_${timestamp}`;

    const res = await fetch('/api/teacher/sync-students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teacher-device-id': this.getDeviceId(),
        'x-teacher-timestamp': timestamp,
        'x-teacher-nonce': nonce,
        'x-teacher-signature': signature
      },
      body: JSON.stringify({ students: sanitizedStudents })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشلت المزامنة مع بوابة أولياء الأمور');
    }

    const data = await res.json();
    const syncTime = new Date().toISOString();
    await storage.setItem(STORAGE_KEYS.LAST_SYNC, syncTime);

    return {
      success: true,
      syncedCount: data.syncedCount || sanitizedStudents.length,
      message: data.message || `تمت مزامنة ${sanitizedStudents.length} طالب بنجاح`
    };
  }

  /**
   * Fetch portal overview status & pending sibling requests
   */
  async getStatus(): Promise<PortalSyncStatus> {
    await this.init();
    const lastSyncedAt = await storage.getItem<string>(STORAGE_KEYS.LAST_SYNC);

    try {
      const res = await fetch('/api/teacher/portal-status');
      if (res.ok) {
        const data = await res.json();
        return {
          isConfigured: true,
          deviceId: this.getDeviceId(),
          lastSyncedAt,
          totalStudentsSynced: data.totalStudents || 0,
          pendingLinkRequests: data.pendingLinkRequests || []
        };
      }
    } catch (e) {
      // Offline fallback
    }

    return {
      isConfigured: false,
      deviceId: this.getDeviceId(),
      lastSyncedAt,
      totalStudentsSynced: 0,
      pendingLinkRequests: []
    };
  }

  /**
   * Approve or reject a sibling linking request by PIN
   */
  async approveSiblingLink(pairingPin: string, approve = true): Promise<boolean> {
    const res = await fetch('/api/teacher/approve-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingPin, approve })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل في اعتماد طلب الربط');
    }

    return true;
  }

  /**
   * Reset parent password for a specific student code
   */
  async resetParentPassword(studentCode: string): Promise<string> {
    const res = await fetch('/api/teacher/reset-parent-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCode })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل في إعادة تعيين كلمة المرور');
    }

    const data = await res.json();
    return data.temporaryPassword;
  }
}

export const portalSyncService = new PortalSyncService();
