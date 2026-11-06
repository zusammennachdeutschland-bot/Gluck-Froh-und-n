import {
  createSessionToken,
  getQueryParam,
  getTeacherPassword,
  isTeacherAuthenticated,
  parseRequestBody,
  sendJson,
  SESSION_COOKIE_NAME
} from './_auth.js';
import {
  getAssignment,
  getSubmissionsForAssignment,
  listAllAssignments,
  mergeExternalStoreData,
  saveAssignment,
  saveSubmission,
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkQuestionResponse,
  HomeworkQuestionType,
  HomeworkFlowMode,
  HomeworkBlooketMode
} from './_storage.js';

function resolveRoutePath(req: any): string {
  const fromQuery = getQueryParam(req, '__path');
  if (fromQuery) {
    return fromQuery.replace(/^\/+/, '').split('?')[0];
  }
  const rawUrl = req?.url || '';
  const pathPart = rawUrl.split('?')[0];
  return pathPart.replace(/^.*\/api\/+/, '').replace(/^\/+/, '');
}

async function buildEnrichedAssignments() {
  const assignments = await listAllAssignments();
  return await Promise.all(
    assignments.map(async (hw) => {
      const subs = await getSubmissionsForAssignment(hw.id);
      const uniqueStudents = new Set(subs.map((s) => s.studentName.trim().toLowerCase())).size;
      const avgScore =
        subs.length > 0
          ? Math.round(
              subs.reduce((acc, curr) => acc + (curr.scorePercentage ?? curr.accuracy ?? 0), 0) / subs.length
            )
          : 0;

      return {
        ...hw,
        status: hw.status || (hw.isActive !== false ? 'active' : 'closed'),
        questionCount: hw.questionCount || hw.targetQuestionCount || 10,
        targetQuestionCount: hw.targetQuestionCount || hw.questionCount || 10,
        submissionCount: subs.length,
        uniqueStudentsCount: uniqueStudents,
        averageScorePercentage: avgScore,
        avgAccuracy: avgScore,
        avgScore,
        recentSubmissions: subs.slice(0, 10)
      };
    })
  );
}

export default async function handler(req: any, res?: any) {
  const route = resolveRoutePath(req);
  const method = (req?.method || 'GET').toUpperCase();

  // 1. /api/teacher/login
  if (route === 'teacher/login') {
    if (method === 'GET') {
      return sendJson(res, 200, { authenticated: isTeacherAuthenticated(req) });
    }
    if (method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        const password = (body?.password || '').trim();
        const correctPassword = getTeacherPassword();

        if (password !== correctPassword) {
          return sendJson(res, 401, { error: 'Falsches Passwort / كلمة المرور غير صحيحة' });
        }

        const token = createSessionToken();
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieHeader = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
          30 * 24 * 60 * 60
        }${isProduction ? '; Secure' : ''}`;

        return sendJson(res, 200, { success: true }, { 'Set-Cookie': cookieHeader });
      } catch (err: any) {
        return sendJson(res, 500, { error: err?.message || 'Server error' });
      }
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // 2. /api/teacher/logout
  if (route === 'teacher/logout') {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieHeader = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      isProduction ? '; Secure' : ''
    }`;
    return sendJson(res, 200, { success: true }, { 'Set-Cookie': cookieHeader });
  }

  // 3. /api/teacher/sync (Syncs client localStorage cache & returns enriched assignments + submissions)
  if (route === 'teacher/sync') {
    try {
      const body = method === 'POST' ? await parseRequestBody(req) : {};
      mergeExternalStoreData(body?.assignments, body?.submissions);
      const enriched = await buildEnrichedAssignments();
      return sendJson(res, 200, { assignments: enriched });
    } catch (err: any) {
      return sendJson(res, 500, { error: err?.message || 'Sync error' });
    }
  }

  // 4. /api/teacher/assignments
  if (route === 'teacher/assignments') {
    if (method === 'GET') {
      const allowDirect = getQueryParam(req, 'direct') === '1';
      if (!allowDirect && !isTeacherAuthenticated(req)) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }
      try {
        const enriched = await buildEnrichedAssignments();
        return sendJson(res, 200, { assignments: enriched });
      } catch (err: any) {
        return sendJson(res, 500, { error: err?.message || 'Error listing assignments' });
      }
    }

    if (method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        const {
          id: customId,
          title,
          setSnapshot,
          selectedItemIds,
          flowMode,
          questionTypes,
          blooketMode,
          allowedGameModes,
          questionCount,
          targetQuestionCount,
          maxAttempts,
          allowReplay,
          deadline
        } = body || {};

        if (!title || !setSnapshot || !setSnapshot.items || setSnapshot.items.length === 0) {
          return sendJson(res, 400, { error: 'Invalid assignment or empty set' });
        }

        const shortId =
          typeof customId === 'string' && customId.startsWith('hw_')
            ? customId
            : 'hw_' + Math.random().toString(36).substring(2, 8);

        const validQuestionTypes: HomeworkQuestionType[] =
          Array.isArray(questionTypes) && questionTypes.length > 0
            ? questionTypes
            : ['mc_de_ar', 'true_false'];

        const validFlowMode: HomeworkFlowMode =
          flowMode === 'quiz_only' ? 'quiz_only' : 'teacher_then_quiz';

        const validBlooketMode: HomeworkBlooketMode =
          blooketMode === 'tower_energy' || blooketMode === 'classic_quiz' ? blooketMode : 'gold_quest';

        const filteredItems =
          Array.isArray(selectedItemIds) && selectedItemIds.length > 0
            ? setSnapshot.items.filter((it: any) => selectedItemIds.includes(it.id))
            : setSnapshot.items;

        const finalItems = filteredItems.length > 0 ? filteredItems : setSnapshot.items;
        const qCount =
          Number(questionCount || targetQuestionCount) ||
          finalItems.length * validQuestionTypes.length;

        const assignment: HomeworkAssignment = {
          id: shortId,
          title: title.trim(),
          setSnapshot: {
            ...setSnapshot,
            items: finalItems
          },
          selectedItemIds: finalItems.map((it: any) => it.id),
          flowMode: validFlowMode,
          questionTypes: validQuestionTypes,
          blooketMode: validBlooketMode,
          allowedGameModes:
            allowedGameModes && allowedGameModes.length > 0 ? allowedGameModes : [validBlooketMode],
          questionCount: qCount,
          targetQuestionCount: qCount,
          maxAttempts: Number(maxAttempts) || 0,
          allowReplay: allowReplay ?? true,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          isActive: true,
          status: 'active',
          createdAt: new Date().toISOString(),
          createdBy: 'Teacher'
        };

        await saveAssignment(assignment);

        return sendJson(res, 201, { success: true, assignment });
      } catch (err: any) {
        return sendJson(res, 500, { error: err?.message || 'Error creating assignment' });
      }
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // 5. /api/teacher/assignment-details
  if (route === 'teacher/assignment-details') {
    const allowDirect = getQueryParam(req, 'direct') === '1';
    if (!allowDirect && !isTeacherAuthenticated(req)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    if (method === 'GET') {
      const id = getQueryParam(req, 'id');
      if (!id) {
        return sendJson(res, 400, { error: 'Missing assignment ID' });
      }

      const assignment = await getAssignment(id);
      if (!assignment) {
        return sendJson(res, 404, { error: 'Assignment not found' });
      }

      const rawSubmissions = await getSubmissionsForAssignment(id);
      const submissions = rawSubmissions.map((s) => ({
        ...s,
        score: s.score ?? s.correctAnswersCount ?? 0,
        accuracy: s.accuracy ?? s.scorePercentage ?? 0,
        goldEarned: s.goldEarned ?? (s.correctAnswersCount || 0) * 100
      }));

      const questionMap = new Map<
        string,
        {
          questionId: string;
          germanWord: string;
          prompt: string;
          correctAnswer: string;
          totalAttempts: number;
          correctCount: number;
          incorrectCount: number;
        }
      >();

      submissions.forEach((sub) => {
        sub.responses?.forEach((r) => {
          const key = r.germanWord || r.questionId;
          const existing = questionMap.get(key) || {
            questionId: r.questionId || key,
            germanWord: r.germanWord,
            prompt: r.promptText || r.germanWord,
            correctAnswer: r.correctAnswer || r.germanWord,
            totalAttempts: 0,
            correctCount: 0,
            incorrectCount: 0
          };
          existing.totalAttempts++;
          if (r.isCorrect) {
            existing.correctCount++;
          } else {
            existing.incorrectCount++;
          }
          questionMap.set(key, existing);
        });
      });

      const questionAccuracy = Array.from(questionMap.values())
        .map((q) => {
          const pct = Math.round((q.correctCount / Math.max(1, q.totalAttempts)) * 100);
          return {
            ...q,
            accuracyPercent: pct,
            accuracyPercentage: pct
          };
        })
        .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

      return sendJson(res, 200, {
        assignment: {
          ...assignment,
          status: assignment.status || (assignment.isActive !== false ? 'active' : 'closed')
        },
        submissions,
        questionAccuracy,
        stats: {
          totalSubmissions: submissions.length,
          uniqueStudentsCount: new Set(submissions.map((s) => s.studentName.trim().toLowerCase())).size,
          averageScorePercentage:
            submissions.length > 0
              ? Math.round(submissions.reduce((acc, curr) => acc + curr.accuracy, 0) / submissions.length)
              : 0,
          hardestQuestions: questionAccuracy
        }
      });
    }

    if (method === 'PATCH') {
      const body = await parseRequestBody(req);
      const id = getQueryParam(req, 'id') || body?.id;
      if (!id) {
        return sendJson(res, 400, { error: 'Missing ID' });
      }

      const assignment = await getAssignment(id);
      if (!assignment) {
        return sendJson(res, 404, { error: 'Assignment not found' });
      }

      if (typeof body?.isActive === 'boolean') {
        assignment.isActive = body.isActive;
        assignment.status = body.isActive ? 'active' : 'closed';
      } else if (body?.status === 'active' || body?.status === 'closed') {
        assignment.status = body.status;
        assignment.isActive = body.status === 'active';
      }

      await saveAssignment(assignment);
      return sendJson(res, 200, { success: true, assignment });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // 6. /api/homework/info
  if (route === 'homework/info') {
    const id = getQueryParam(req, 'id');
    if (!id) {
      return sendJson(res, 400, { error: 'Missing homework ID' });
    }

    const assignment = await getAssignment(id);
    if (!assignment) {
      return sendJson(res, 404, { error: 'Hausaufgabe nicht gefunden / Homework not found' });
    }

    if (assignment.deadline && new Date(assignment.deadline).getTime() < Date.now()) {
      return sendJson(res, 410, {
        error: 'Die Abgabefrist für diese Hausaufgabe ist abgelaufen / انتهت مهلة تسليم هذا الواجب',
        isExpired: true,
        assignment: { id: assignment.id, title: assignment.title, deadline: assignment.deadline }
      });
    }

    if (assignment.isActive === false || assignment.status === 'closed') {
      return sendJson(res, 403, {
        error: 'Diese Hausaufgabe wurde von der Lehrkraft geschlossen / تم إغلاق هذا الواجب من قِبل المعلم',
        isClosed: true,
        assignment: { id: assignment.id, title: assignment.title }
      });
    }

    const submissions = await getSubmissionsForAssignment(id);
    const leaderboard = submissions
      .slice()
      .sort((a, b) => (b.goldEarned || b.scorePercentage || 0) - (a.goldEarned || a.scorePercentage || 0))
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        studentName: s.studentName,
        score: s.score ?? s.correctAnswersCount,
        totalQuestions: s.totalQuestions,
        accuracy: s.accuracy ?? s.scorePercentage,
        goldEarned: s.goldEarned ?? s.correctAnswersCount * 100,
        completedAt: s.completedAt
      }));

    return sendJson(res, 200, {
      id: assignment.id,
      title: assignment.title,
      questionCount: assignment.questionCount || assignment.targetQuestionCount || 10,
      setSnapshot: assignment.setSnapshot,
      selectedItemIds: assignment.selectedItemIds,
      flowMode: assignment.flowMode || 'teacher_then_quiz',
      questionTypes: assignment.questionTypes || ['mc_de_ar', 'true_false'],
      blooketMode: assignment.blooketMode || 'gold_quest',
      maxAttempts: assignment.maxAttempts,
      allowReplay: assignment.allowReplay,
      deadline: assignment.deadline,
      leaderboard
    });
  }

  // 7. /api/homework/submit
  if (route === 'homework/submit') {
    try {
      const body = await parseRequestBody(req);
      const {
        assignmentId,
        studentName,
        responses,
        startedAt,
        completedAt,
        goldEarned,
        maxStreak,
        completedStudyPhase,
        assignmentFallback
      } = body || {};

      if (!assignmentId || !studentName || !responses || !Array.isArray(responses)) {
        return sendJson(res, 400, { error: 'Missing required submission fields' });
      }

      const cleanName = studentName.trim();
      if (cleanName.length < 2) {
        return sendJson(res, 400, { error: 'من فضلك أدخل اسمك بالكامل / Bitte gib deinen Namen ein' });
      }

      let assignment = await getAssignment(assignmentId);
      if (!assignment && assignmentFallback && assignmentFallback.setSnapshot) {
        assignment = {
          id: assignmentId,
          title: assignmentFallback.title || 'Hausaufgabe',
          setSnapshot: assignmentFallback.setSnapshot,
          selectedItemIds: assignmentFallback.selectedItemIds,
          flowMode: assignmentFallback.flowMode || 'teacher_then_quiz',
          questionTypes: assignmentFallback.questionTypes || ['mc_de_ar'],
          blooketMode: assignmentFallback.blooketMode || 'gold_quest',
          allowedGameModes: [assignmentFallback.blooketMode || 'gold_quest'],
          questionCount: assignmentFallback.questionCount || responses.length,
          targetQuestionCount: assignmentFallback.questionCount || responses.length,
          maxAttempts: assignmentFallback.maxAttempts || 0,
          allowReplay: assignmentFallback.allowReplay ?? true,
          isActive: true,
          status: 'active',
          createdAt: new Date().toISOString(),
          createdBy: 'Teacher'
        };
        await saveAssignment(assignment);
      }

      if (!assignment) {
        return sendJson(res, 404, { error: 'Assignment not found' });
      }

      const existingSubmissions = await getSubmissionsForAssignment(assignmentId);
      const studentAttempts = existingSubmissions.filter(
        (s) => s.studentName.trim().toLowerCase() === cleanName.toLowerCase()
      );

      if (assignment.maxAttempts > 0 && studentAttempts.length >= assignment.maxAttempts) {
        return sendJson(res, 429, {
          error: `لقد وصلت للحد الأقصى للمحاولات (${assignment.maxAttempts}) / Maximale Versuche erreicht`
        });
      }

      let correctCount = 0;
      const verifiedResponses: HomeworkQuestionResponse[] = responses.map((r: any) => {
        const isCorrect = Boolean(r.isCorrect);
        if (isCorrect) correctCount++;

        return {
          questionId: r.questionId || 'q_' + Math.random().toString(36).substring(2, 6),
          questionType: r.questionType || 'mc_de_ar',
          germanWord: r.germanWord || 'Wort',
          promptText: r.promptText || r.germanWord || '',
          studentAnswer: String(r.studentAnswer || '').trim(),
          correctAnswer: String(r.correctAnswer || '').trim(),
          isCorrect,
          timeSpentSeconds: Number(r.timeSpentSeconds) || 4
        };
      });

      const totalQuestions = verifiedResponses.length;
      const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

      const startMs = startedAt ? new Date(startedAt).getTime() : Date.now() - totalQuestions * 4000;
      const endMs = completedAt ? new Date(completedAt).getTime() : Date.now();
      const timeSpentSeconds = Math.max(5, Math.round((endMs - startMs) / 1000));
      const finalGold = typeof goldEarned === 'number' ? goldEarned : correctCount * 150;

      const submission: HomeworkSubmission = {
        id: 'sub_' + Math.random().toString(36).substring(2, 9),
        assignmentId,
        studentName: cleanName,
        attemptNumber: studentAttempts.length + 1,
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date(endMs).toISOString(),
        timeSpentSeconds,
        totalQuestions,
        correctAnswersCount: correctCount,
        scorePercentage,
        score: correctCount,
        accuracy: scorePercentage,
        goldEarned: finalGold,
        maxStreak: Number(maxStreak) || correctCount,
        completedStudyPhase: Boolean(completedStudyPhase),
        responses: verifiedResponses
      };

      await saveSubmission(submission);

      const updatedSubs = await getSubmissionsForAssignment(assignmentId);
      const leaderboard = updatedSubs
        .slice()
        .sort((a, b) => (b.goldEarned || b.scorePercentage || 0) - (a.goldEarned || a.scorePercentage || 0))
        .slice(0, 10)
        .map((s) => ({
          id: s.id,
          studentName: s.studentName,
          score: s.score ?? s.correctAnswersCount,
          totalQuestions: s.totalQuestions,
          accuracy: s.accuracy ?? s.scorePercentage,
          goldEarned: s.goldEarned ?? s.correctAnswersCount * 100,
          completedAt: s.completedAt
        }));

      return sendJson(res, 201, {
        success: true,
        submission,
        leaderboard
      });
    } catch (err: any) {
      return sendJson(res, 500, { error: err?.message || 'Error submitting homework' });
    }
  }

  return sendJson(res, 404, { error: `API route not found: ${route}` });
}

export const GET = (req: Request) => handler(req);
export const POST = (req: Request) => handler(req);
export const PATCH = (req: Request) => handler(req);
