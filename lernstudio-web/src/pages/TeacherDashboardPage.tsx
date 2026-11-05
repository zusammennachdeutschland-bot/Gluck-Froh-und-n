import React, { useState, useEffect } from 'react';
import { DEFAULT_LERNSTUDIO_SETS } from '../../shared/defaultLernstudioSets';
import type { HomeworkAssignment, HomeworkSubmission } from '../../shared/homeworkTypes';
import {
  ShieldCheck,
  Lock,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Users,
  Award,
  Calendar,
  Clock,
  Download,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  XCircle,
  CheckCircle2,
  BookOpen,
  Sparkles,
  BarChart3,
  LogOut,
  RefreshCw
} from 'lucide-react';

interface AssignmentWithStats extends HomeworkAssignment {
  submissionCount: number;
  avgScore: number;
  avgAccuracy: number;
}

interface DetailedViewData {
  assignment: HomeworkAssignment;
  submissions: HomeworkSubmission[];
  questionAccuracy: {
    questionId: string;
    prompt: string;
    correctAnswer: string;
    totalAttempts: number;
    correctCount: number;
    accuracyPercent: number;
  }[];
}

export const TeacherDashboardPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentWithStats[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New assignment modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedSetId, setSelectedSetId] = useState(DEFAULT_LERNSTUDIO_SETS[0]?.id || '');
  const [targetQuestionCount, setTargetQuestionCount] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [allowReplay, setAllowReplay] = useState(true);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);

  // Detailed view state
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [detailedData, setDetailedData] = useState<DetailedViewData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Check auth by attempting to load assignments
  const loadAssignments = async () => {
    setIsLoadingAssignments(true);
    try {
      const res = await fetch('/api/teacher/assignments', { credentials: 'include' });
      if (res.status === 401) {
        setIsAuthenticated(false);
      } else if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Falsches Passwort');
      } else {
        setIsAuthenticated(true);
        setPasswordInput('');
        loadAssignments();
      }
    } catch (err: any) {
      setLoginError(err.message || 'Verbindungsfehler');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/teacher/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setIsAuthenticated(false);
    setAssignments([]);
    setSelectedAssignmentId(null);
    setDetailedData(null);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const setFound = DEFAULT_LERNSTUDIO_SETS.find((s) => s.id === selectedSetId);
    if (!setFound) return;

    setIsCreating(true);
    try {
      const payload = {
        title: newTitle.trim() || `Hausaufgabe: ${setFound.title}`,
        setSnapshot: {
          id: setFound.id,
          title: setFound.title,
          category: (setFound as any).category || setFound.topic || '',
          items: setFound.items
        },
        targetQuestionCount: Math.min(targetQuestionCount, setFound.items.length),
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : null,
        maxAttempts,
        allowReplay
      };

      const res = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Fehler beim Erstellen');
      } else {
        const fullLink = `${window.location.origin}/homework/${data.assignment.id}`;
        setCreatedShareLink(fullLink);
        loadAssignments();
      }
    } catch (err: any) {
      alert(err.message || 'Netzwerkfehler');
    } finally {
      setIsCreating(false);
    }
  };

  const loadDetails = async (id: string) => {
    setSelectedAssignmentId(id);
    setIsLoadingDetails(true);
    setDetailedData(null);
    try {
      const res = await fetch(`/api/teacher/assignment-details?id=${id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setDetailedData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const toggleAssignmentStatus = async (assignment: HomeworkAssignment) => {
    const updatedStatus = assignment.status === 'active' ? 'closed' : 'active';
    try {
      const res = await fetch('/api/teacher/assignment-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: assignment.id, status: updatedStatus })
      });
      if (res.ok) {
        loadAssignments();
        if (detailedData) {
          setDetailedData({
            ...detailedData,
            assignment: { ...detailedData.assignment, status: updatedStatus }
          });
        }
      }
    } catch {}
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const exportCSV = () => {
    if (!detailedData) return;
    const { assignment, submissions } = detailedData;
    const rows = [
      ['Schüler Name', 'Punkte', 'Gesamtfragen', 'Genauigkeit (%)', 'Zeit (s)', 'Eingereicht am'],
      ...submissions.map((sub) => [
        `"${sub.studentName.replace(/"/g, '""')}"`,
        sub.score,
        sub.totalQuestions,
        sub.accuracy,
        sub.timeSpentSeconds,
        `"${new Date(sub.completedAt).toLocaleString('de-DE')}"`
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Hausaufgabe_${assignment.title.replace(/\s+/g, '_')}_Ergebnisse.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Render Login Screen if not authenticated ---
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white flex flex-col justify-center items-center px-4 font-sans">
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Lehrer-Bereich</h1>
            <p className="text-slate-400 text-sm mt-1">Glück Lernstudio Hausaufgaben-Verwaltung</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Lehrer-Passwort
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Passwort eingeben..."
                  required
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-2xl text-white placeholder-slate-600 text-base outline-none transition-all"
                />
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Prüfen...</span>
                </>
              ) : (
                <span>Anmelden</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <a href="/" className="hover:text-slate-300 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Zurück zum Lernstudio
            </a>
            <span>Glück Lernstudio Web</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Loading state if initial check is running ---
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Zum Lernstudio
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-black font-black text-sm">
                GL
              </div>
              <span className="font-bold text-lg text-white">Lernstudio Lehrer-Cockpit</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreatedShareLink(null);
                setNewTitle('');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Neue Hausaufgabe</span>
            </button>
            <button
              onClick={handleLogout}
              title="Abmelden"
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {selectedAssignmentId && detailedData ? (
          /* --- DETAILED VIEW FOR SINGLE ASSIGNMENT --- */
          <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb / Back button */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedAssignmentId(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
              >
                <ArrowLeft className="w-4 h-4" /> Alle Hausaufgaben anzeigen
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleAssignmentStatus(detailedData.assignment)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    detailedData.assignment.status === 'active'
                      ? 'bg-red-950/40 border-red-800/80 text-red-300 hover:bg-red-900/50'
                      : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
                  }`}
                >
                  {detailedData.assignment.status === 'active' ? 'Aufgabe schließen' : 'Aufgabe wieder öffnen'}
                </button>

                <button
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/homework/${detailedData.assignment.id}`,
                      detailedData.assignment.id
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  {copiedId === detailedData.assignment.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Schüler-Link kopieren
                    </>
                  )}
                </button>

                {detailedData.submissions.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Als CSV exportieren
                  </button>
                )}
              </div>
            </div>

            {/* Assignment Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        detailedData.assignment.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {detailedData.assignment.status === 'active' ? 'Aktiv' : 'Geschlossen'}
                    </span>
                    <span className="text-slate-500 text-xs">•</span>
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      Set: {detailedData.assignment.setSnapshot.title}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white">{detailedData.assignment.title}</h2>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 md:gap-6 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="text-center">
                    <div className="text-2xl font-black text-amber-400">
                      {detailedData.submissions.length}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Abgaben
                    </div>
                  </div>
                  <div className="text-center border-x border-slate-800 px-4">
                    <div className="text-2xl font-black text-emerald-400">
                      {detailedData.submissions.length > 0
                        ? `${Math.round(
                            detailedData.submissions.reduce((acc, s) => acc + s.accuracy, 0) /
                              detailedData.submissions.length
                          )}%`
                        : '—'}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Durchschnitt
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-indigo-400">
                      {detailedData.submissions.length > 0
                        ? `${Math.round(
                            detailedData.submissions.reduce((acc, s) => acc + s.timeSpentSeconds, 0) /
                              detailedData.submissions.length
                          )}s`
                        : '—'}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Ø Zeit
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Two columns: Hardest Questions vs Student Submissions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Question Accuracy (Hardest Questions) */}
              <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  Schwierigste Wörter
                </h3>
                {detailedData.questionAccuracy.length === 0 ? (
                  <p className="text-slate-500 text-xs py-8 text-center">
                    Noch keine Abgaben vorhanden.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {detailedData.questionAccuracy.slice(0, 8).map((q) => (
                      <div
                        key={q.questionId}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-white truncate max-w-[150px]">{q.correctAnswer}</span>
                          <span
                            className={`font-black ${
                              q.accuracyPercent >= 80
                                ? 'text-emerald-400'
                                : q.accuracyPercent >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {q.accuracyPercent}% richtig
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              q.accuracyPercent >= 80
                                ? 'bg-emerald-500'
                                : q.accuracyPercent >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${q.accuracyPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>{q.prompt}</span>
                          <span>{q.correctCount}/{q.totalAttempts} gelöst</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submissions List */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Eingereichte Ergebnisse ({detailedData.submissions.length})
                </h3>

                {detailedData.submissions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-400 text-sm">Bisher hat noch kein Schüler abgegeben.</p>
                    <p className="text-slate-500 text-xs mt-1">
                      Teile den Schüler-Link mit deiner Klasse!
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-3">Schüler</th>
                          <th className="py-3 px-3">Punkte</th>
                          <th className="py-3 px-3">Genauigkeit</th>
                          <th className="py-3 px-3">Dauer</th>
                          <th className="py-3 px-3">Datum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {detailedData.submissions.map((sub) => (
                          <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 font-black text-xs flex items-center justify-center border border-indigo-500/30">
                                {sub.studentName.slice(0, 1).toUpperCase()}
                              </div>
                              {sub.studentName}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-200">
                              {sub.score} / {sub.totalQuestions}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  sub.accuracy >= 80
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : sub.accuracy >= 50
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {sub.accuracy}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-xs">
                              {sub.timeSpentSeconds}s
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-xs">
                              {new Date(sub.completedAt).toLocaleTimeString('de-DE', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* --- ASSIGNMENTS LIST VIEW --- */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white">Hausaufgaben & Aufgaben</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Erstelle interaktive Lernaufgaben für deine Schüler mit automatischer Auswertung
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadAssignments}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Aktualisieren"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingAssignments ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List of assignments */}
            {assignments.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Noch keine Hausaufgaben erstellt</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Wähle ein beliebiges Set aus dem Lernstudio und erstelle in Sekunden eine Hausaufgabe mit eigenem Schüler-Link.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Erste Hausaufgabe erstellen
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignments.map((item) => {
                  const shareUrl = `${window.location.origin}/homework/${item.id}`;
                  const isExpired = item.deadline && new Date(item.deadline) < new Date();
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        {/* Status bar */}
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              item.status === 'active' && !isExpired
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {item.status === 'active' && !isExpired ? 'Aktiv' : isExpired ? 'Frist abgelaufen' : 'Geschlossen'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(item.createdAt).toLocaleDateString('de-DE')}
                          </span>
                        </div>

                        {/* Title & Set */}
                        <h3 className="text-lg font-bold text-white line-clamp-1 mb-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-4">
                          <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{item.setSnapshot.title}</span>
                          <span className="text-slate-600">•</span>
                          <span>{item.questionCount} Fragen</span>
                        </p>

                        {/* Stats Box */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 mb-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                            <div>
                              <div className="text-sm font-black text-white">{item.submissionCount}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">Abgaben</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <div className="text-sm font-black text-emerald-400">
                                {item.avgAccuracy > 0 ? `${item.avgAccuracy}%` : '—'}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold">Ø Genauigkeit</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/70">
                        <button
                          onClick={() => copyToClipboard(shareUrl, item.id)}
                          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" /> Kopiert!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Link kopieren
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => loadDetails(item.id)}
                          className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 active:scale-95 text-amber-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- CREATE ASSIGNMENT MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Neue Hausaufgabe erstellen</h3>
                  <p className="text-slate-400 text-xs">Schüler üben fokussiert ohne Registrierung</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {createdShareLink ? (
              /* Success Screen with Copy Link */
              <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Hausaufgabe erstellt!</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Teile diesen Link jetzt mit deinen Schülern:
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdShareLink}
                    className="bg-transparent text-xs text-amber-300 font-mono w-full outline-none select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(createdShareLink, 'modal')}
                    className="px-3 py-1.5 bg-amber-500 text-black font-bold text-xs rounded-xl shrink-0 flex items-center gap-1 active:scale-95 transition-transform"
                  >
                    {copiedId === 'modal' ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Kopiert
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Kopieren
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-2">
                  <a
                    href={createdShareLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Als Schüler testen
                  </a>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedShareLink(null);
                    }}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-colors"
                  >
                    Fertig
                  </button>
                </div>
              </div>
            ) : (
              /* Configuration Form */
              <form onSubmit={handleCreateAssignment} className="space-y-4">
                {/* Select Set */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Lernstudio-Set auswählen
                  </label>
                  <select
                    value={selectedSetId}
                    onChange={(e) => setSelectedSetId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm outline-none"
                  >
                    {DEFAULT_LERNSTUDIO_SETS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.items.length} Wörter • {(s as any).category || s.topic || ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignment Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Titel der Hausaufgabe (optional)
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={`z. B. Hausaufgabe: ${
                      DEFAULT_LERNSTUDIO_SETS.find((s) => s.id === selectedSetId)?.title || 'Vokabeln'
                    }`}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white placeholder-slate-600 text-sm outline-none"
                  />
                </div>

                {/* Question Count & Max Attempts */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Anzahl Fragen
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={50}
                      value={targetQuestionCount}
                      onChange={(e) => setTargetQuestionCount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Max. Versuche pro Schüler
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm outline-none"
                    />
                  </div>
                </div>

                {/* Deadline toggle */}
                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={hasDeadline}
                      onChange={(e) => setHasDeadline(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 accent-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span>Abgabefrist (Deadline) festlegen</span>
                  </label>
                  {hasDeadline && (
                    <input
                      type="datetime-local"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-xs outline-none"
                    />
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-98 text-black font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Wird erstellt...</span>
                    </>
                  ) : (
                    <span>Hausaufgabe jetzt erstellen & Link generieren</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
