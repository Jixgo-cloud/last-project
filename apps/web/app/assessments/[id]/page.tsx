'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import Editor from '@monaco-editor/react';
import {
  Code2,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  Terminal,
  RefreshCw,
  Send,
  Lock,
  ShieldAlert,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { AssessmentType, QuestionEvaluationMethod, getAttemptPercentage, getLatestFinishedAttempt } from '@smartcareer/shared';

export default function AssessmentRunnerPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [assessment, setAssessment] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Timer & Expiry
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);

  // Anti-Cheat (Tab switch & Window blur detection + Server Logging)
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showAntiCheatBanner, setShowAntiCheatBanner] = useState(false);
  const wasPageHiddenRef = useRef(false);
  const timeExpiredHandlerRef = useRef<() => void>(() => {});

  // Autosave status ('idle' | 'saving' | 'saved')
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Rate Limiting & Judge0 errors
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [judgeUnavailableError, setJudgeUnavailableError] = useState<string | null>(null);

  // Theory state
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [theoryResult, setTheoryResult] = useState<any>(null);
  const [submittingTheory, setSubmittingTheory] = useState(false);

  // Practical Coding state (Multi-question support)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [runningCode, setRunningCode] = useState(false);
  const [submittingCoding, setSubmittingCoding] = useState(false);
  const [testRunResults, setTestRunResults] = useState<Record<string, any>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, any>>({});
  const [finalizingAttempt, setFinalizingAttempt] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
  const [codingFinalResult, setCodingFinalResult] = useState<any>(null);

  // Load Assessment & Start Attempt
  const initAssessment = useCallback(async (retake = false) => {
    if (!id || !user) return;
    setLoading(true);
    setLoadError(null);

    try {
      // Load and validate the assessment before creating a timed attempt.
      const assessData = await apiRequest(`/assessments/${id}`);
      if (!retake) {
        const history = await apiRequest('/assessments/my-attempts');
        const finished = getLatestFinishedAttempt<any>(history, String(id));
        if (finished) {
          const result = { ...finished, percentage: getAttemptPercentage(finished) };
          setAssessment(assessData);
          setAttempt(finished);
          setTimeLeftSeconds(null);
          if (assessData.type === AssessmentType.THEORY) {
            setTheoryResult({ ...result, feedbackHidden: result.feedbackHidden || result.percentage === null });
          } else {
            setCodingFinalResult(result);
          }
          return;
        }
      }
      setTheoryResult(null);
      setCodingFinalResult(null);
      setHasAutoSubmitted(false);
      setSubmittedQuestions({});
      setActiveQuestionIndex(0);
      setSelectedChoices({});
      setTestRunResults({});
      setTabSwitchCount(0);
      setShowAntiCheatBanner(false);
      setRateLimitMessage(null);
      setJudgeUnavailableError(null);
      setSubmissionFeedback(null);
      setAutosaveStatus('idle');
      const attemptData = await apiRequest(`/assessments/${id}/start`, { method: 'POST' });
      setAssessment(assessData);
      setAttempt(attemptData);

      const totalSeconds = (assessData.timeLimitMinutes || 30) * 60;
      if (attemptData?.startedAt) {
        const elapsed = Math.floor((Date.now() - new Date(attemptData.startedAt).getTime()) / 1000);
        setTimeLeftSeconds(Math.max(0, totalSeconds - elapsed));
      } else {
        setTimeLeftSeconds(totalSeconds);
      }

      if (assessData.type === AssessmentType.PRACTICAL_CODING && assessData.questions) {
        const initialCodes: Record<string, string> = {};
        assessData.questions.forEach((q: any) => {
          const isPy =
            q.starterCode?.includes('def solution') ||
            q.starterCode?.includes('def ') ||
            q.starterCode?.includes('#');
          initialCodes[q.id] =
            q.starterCode ||
            (isPy
              ? '# เขียนฟังก์ชันแก้ปัญหาด้านล่าง\ndef solution(*args):\n    return 0'
              : '// เขียนฟังก์ชันแก้ปัญหาด้านล่าง\nfunction solution() {\n  return 0;\n}');
        });
        setCodes(initialCodes);
      }

      if (attemptData?.draftCode) {
        try {
          const parsed = typeof attemptData.draftCode === 'string'
            ? JSON.parse(attemptData.draftCode)
            : attemptData.draftCode;
          if (parsed.codes) setCodes((prev) => ({ ...prev, ...parsed.codes }));
          if (parsed.selectedChoices) setSelectedChoices((prev) => ({ ...prev, ...parsed.selectedChoices }));
          if (!parsed.codes && !parsed.selectedChoices && typeof parsed === 'object') {
            setCodes((prev) => ({ ...prev, ...parsed }));
          }
        } catch {
          if (assessData.questions?.[0]) {
            setCodes((prev) => ({ ...prev, [assessData.questions[0].id]: attemptData.draftCode }));
          }
        }
      }
    } catch (error: any) {
      setAssessment(null);
      setAttempt(null);
      setLoadError(error?.message || 'ไม่สามารถเปิดแบบทดสอบได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!id || authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    initAssessment();
  }, [id, user, authLoading, router, initAssessment]);

  // Active Real-time Countdown Timer
  useEffect(() => {
    if (timeLeftSeconds === null || timeLeftSeconds <= 0 || theoryResult || codingFinalResult) {
      return;
    }

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          timeExpiredHandlerRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeftSeconds, theoryResult, codingFinalResult]);

  // 3-Second Debounced Autosave for Candidate Draft
  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS' || theoryResult || codingFinalResult || submittingTheory || submittingCoding || finalizingAttempt) return;
    if (Object.keys(codes).length === 0 && Object.keys(selectedChoices).length === 0) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus('saving');

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const draftCode = {
          codes,
          selectedChoices,
        };
        await apiRequest(`/assessments/${id}/autosave`, {
          method: 'POST',
          body: JSON.stringify({ attemptId: attempt.id, draftCode }),
        });
        setAutosaveStatus('saved');
      } catch (err) {
        console.warn('Autosave error:', err);
        setAutosaveStatus('idle');
      }
    }, 3000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [codes, selectedChoices, attempt, id, theoryResult, codingFinalResult, submittingTheory, submittingCoding, finalizingAttempt]);

  // Record only transitions where the assessment page is actually hidden.
  useEffect(() => {
    if (theoryResult || codingFinalResult || !attempt) return;

    const logIntegrity = (eventType: string, payload?: any) => {
      apiRequest(`/assessments/${id}/integrity-event`, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: attempt.id,
          event: {
            type: eventType,
            timestamp: new Date().toISOString(),
            details: payload,
          },
        }),
      }).catch((e) => console.warn('Integrity log failed', e));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !wasPageHiddenRef.current) {
        wasPageHiddenRef.current = true;
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          logIntegrity('TAB_BLUR', { switchCount: next, timestamp: Date.now() });
          return next;
        });
        setShowAntiCheatBanner(true);
      } else if (document.visibilityState === 'visible' && wasPageHiddenRef.current) {
        wasPageHiddenRef.current = false;
        logIntegrity('TAB_FOCUS', { timestamp: Date.now() });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [theoryResult, codingFinalResult, attempt, id]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Theory Handlers
  const handleChoiceSelect = (questionId: string, choiceId: string) => {
    setSelectedChoices((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const handleSubmitTheory = useCallback(async () => {
    if (!attempt || submittingTheory) return;
    setSubmittingTheory(true);
    try {
      const answers = Object.entries(selectedChoices).map(([questionId, selectedChoiceId]) => ({
        questionId,
        selectedChoiceId,
      }));

      const result = await apiRequest(`/assessments/${id}/submit-theory`, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: attempt.id,
          answers,
        }),
      });
      setTheoryResult(result);
    } catch (e: any) {
      alert(`Submission error: ${e.message}`);
    } finally {
      setSubmittingTheory(false);
    }
  }, [attempt, submittingTheory, selectedChoices, id]);

  // Question Language Detector (Python vs JavaScript)
  const isQuestionPython = (q?: any): boolean => {
    if (!q) return false;
    const starter = q.starterCode || '';
    return (
      starter.includes('def solution') ||
      starter.includes('def ') ||
      starter.includes('import sys') ||
      starter.includes('# เขียนโค้ดแก้ปัญหา') ||
      starter.includes('# เขียนฟังก์ชันแก้ปัญหา') ||
      starter.includes('# Write your solution')
    );
  };

  // Practical Coding Handlers
  const currentQuestion = assessment?.questions?.[activeQuestionIndex];
  const currentCode = currentQuestion ? codes[currentQuestion.id] || '' : '';

  const handleCodeChange = (val: string | undefined) => {
    if (!attempt || !currentQuestion) return;
    setCodes((prev) => ({
      ...prev,
      [currentQuestion.id]: val || '',
    }));
  };

  // 1. Run Test Cases (Visible only, testing sandbox without finalizing)
  const handleRunTests = async () => {
    if (!attempt || !currentQuestion) return;
    setRunningCode(true);
    setRateLimitMessage(null);
    setJudgeUnavailableError(null);
    try {
      const result = await apiRequest(`/assessments/${id}/run-code`, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: attempt.id,
          questionId: currentQuestion.id,
          sourceCode: currentCode,
        }),
      });
      setTestRunResults((prev) => ({
        ...prev,
        [currentQuestion.id]: result,
      }));
    } catch (e: any) {
      if (e.message?.includes('429') || e.message?.includes('3 วินาที')) {
        setRateLimitMessage('⏱️ กรุณารอ 3 วินาทีก่อนกดรันโค้ดอีกครั้ง (Sandbox Rate Limit Protection)');
      } else if (e.message?.includes('503') || e.message?.includes('JUDGE_UNAVAILABLE') || e.message?.includes('Judge0')) {
        setJudgeUnavailableError('⚠️ ระบบรันโค้ด Sandbox (Judge0) ไม่พร้อมใช้งานชั่วคราว ข้อสอบของคุณได้รับการบันทึกร่างไว้แล้ว และคุณจะไม่เสียสิทธิ์');
      } else {
        alert(`Test Run error: ${e.message}`);
      }
    } finally {
      setRunningCode(false);
    }
  };

  // 2. Submit Single Question Solution (Evaluation with hidden test cases and DB score update)
  const handleSubmitCoding = async () => {
    if (!attempt || !currentQuestion || submittingCoding) return;
    setSubmittingCoding(true);
    setRateLimitMessage(null);
    setJudgeUnavailableError(null);
    setSubmissionFeedback(null);
    try {
      const result = await apiRequest(`/assessments/${id}/submit-coding`, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: attempt.id,
          questionId: currentQuestion.id,
          sourceCode: currentCode,
        }),
      });

      // Track this question's answered state
      setSubmittedQuestions((prev) => ({
        ...prev,
        [currentQuestion.id]: result,
      }));

      // If all questions are answered or single question completed
      if (result.isFinished) {
        setCodingFinalResult(result);
      } else {
        const earned = result.pointsEarned !== undefined ? result.pointsEarned : (result.score ?? 0);
        const max = currentQuestion.points || 10;
        setSubmissionFeedback(`✅ บันทึกคำตอบข้อที่ ${activeQuestionIndex + 1} เรียบร้อยแล้ว (ได้ ${earned}/${max} คะแนน) สามารถทำข้อถัดไปหรือกดส่งข้อสอบทั้งหมดเมื่อพร้อม`);

        // Auto-advance to next unanswered question if exists
        const nextIdx = assessment?.questions?.findIndex(
          (q: any, i: number) => i > activeQuestionIndex && !submittedQuestions[q.id],
        );
        if (nextIdx !== undefined && nextIdx !== -1) {
          setTimeout(() => {
            setActiveQuestionIndex(nextIdx);
          }, 1000);
        }
      }
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.includes('JUDGE_UNAVAILABLE') || e.message?.includes('Judge0')) {
        setJudgeUnavailableError('⚠️ ระบบรันโค้ด Sandbox (Judge0) ไม่พร้อมใช้งานชั่วคราว ระบบได้ตั้งสถานะ SYSTEM_ERROR ให้อัตโนมัติ เพื่อให้คุณสามารถเริ่มทำใหม่ได้โดยไม่เสียคะแนน');
      } else {
        alert(`Submission error: ${e.message}`);
      }
    } finally {
      setSubmittingCoding(false);
    }
  };

  // 3. Finalize Multi-Question Attempt (Calculates total and closes attempt)
  const handleFinalizeAttempt = useCallback(async (automatic = false) => {
    if (!attempt || finalizingAttempt) return;
    const answeredCount = Object.keys(submittedQuestions).length;
    const totalCount = assessment?.questions?.length || 1;
    if (!automatic && answeredCount < totalCount) {
      const confirmSubmit = window.confirm(
        `คุณเพิ่งส่งคำตอบไปแล้ว ${answeredCount} จาก ${totalCount} ข้อ คุณแน่ใจหรือไม่ว่าต้องการจบการสอบและส่งผลคะแนนทั้งหมดตอนนี้?`,
      );
      if (!confirmSubmit) return;
    }

    setFinalizingAttempt(true);
    try {
      const result = await apiRequest(`/assessments/${id}/finalize-attempt`, {
        method: 'POST',
        body: JSON.stringify({ attemptId: attempt.id }),
      });
      setCodingFinalResult(result);
    } catch (e: any) {
      alert(`Finalize error: ${e.message}`);
    } finally {
      setFinalizingAttempt(false);
    }
  }, [attempt, finalizingAttempt, submittedQuestions, assessment, id]);

  // Auto-submit when timer hits zero.
  const handleTimeExpired = useCallback(() => {
    if (hasAutoSubmitted || theoryResult || codingFinalResult) return;
    setHasAutoSubmitted(true);
    setSubmissionFeedback('⏱️ หมดเวลาทำข้อสอบแล้ว ระบบกำลังบันทึกและส่งผลการสอบโดยอัตโนมัติ');

    if (assessment?.type === AssessmentType.THEORY) {
      void handleSubmitTheory();
    } else if (assessment?.type === AssessmentType.PRACTICAL_CODING) {
      void handleFinalizeAttempt(true);
    }
  }, [hasAutoSubmitted, theoryResult, codingFinalResult, assessment, handleSubmitTheory, handleFinalizeAttempt]);

  useEffect(() => {
    timeExpiredHandlerRef.current = handleTimeExpired;
  }, [handleTimeExpired]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-[#667085]">
            กำลังจัดเตรียมสภาพแวดล้อม Sandbox และข้อสอบ...
          </span>
        </div>
        <Footer />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="font-bold text-slate-800 text-lg mb-2">ยังเปิดแบบทดสอบนี้ไม่ได้</p>
          <p className="text-sm text-[#667085] mb-5 max-w-xl">{loadError || 'แบบทดสอบอาจถูกปิด ยังไม่ได้มอบหมายให้คุณ หรือผู้สร้างยังกรอกโจทย์ไม่ครบ'}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void initAssessment()}
              className="px-5 py-2.5 rounded-full bg-[#6366f1] text-white text-xs font-semibold hover:bg-[#4f46e5] transition shadow-xs"
            >
              ลองอีกครั้ง
            </button>
            <Link
              href="/applications"
              className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
            >
              กลับหน้าการสมัครงาน
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const currentTestReport = currentQuestion ? testRunResults[currentQuestion.id] : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-6 px-4 sm:px-8 max-w-[1360px] mx-auto w-full">
        {/* Anti-Cheat Alert Banner */}
        {showAntiCheatBanner && !theoryResult && !codingFinalResult && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 flex items-center justify-between text-xs text-amber-800 animate-in fade-in duration-200 shadow-xs">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                ระบบบันทึกการออกจากหน้าข้อสอบไว้{' '}
                <span className="font-bold text-amber-900">{tabSwitchCount} ครั้ง</span>{' '}
                เพื่อประกอบการตรวจสอบ ข้อมูลนี้เพียงอย่างเดียวไม่ได้สรุปว่ามีการทุจริต
              </span>
            </div>
            <button
              onClick={() => setShowAntiCheatBanner(false)}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 px-2 py-0.5 rounded hover:bg-amber-100 transition"
            >
              รับทราบ
            </button>
          </div>
        )}

        {/* Judge0 Unavailable Modal */}
        {judgeUnavailableError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-150">
              <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Sandbox ชั่วคราวไม่พร้อมใช้งาน</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                {judgeUnavailableError}
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => setJudgeUnavailableError(null)}
                  className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  ปิดหน้าต่างนี้
                </button>
                <Link
                  href="/assessments"
                  className="w-full py-2.5 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold transition text-center shadow-xs"
                >
                  กลับหน้ารายการข้อสอบ
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Rate Limit Protection Banner */}
        {rateLimitMessage && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 flex items-center justify-between text-xs text-amber-800 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{rateLimitMessage}</span>
            </div>
            <button
              onClick={() => setRateLimitMessage(null)}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 px-2 py-0.5 rounded hover:bg-amber-100 transition"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Top Header & Live Timer Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200/80">
          <div className="flex items-center gap-3.5">
            <Link
              href="/assessments"
              className="p-2.5 rounded-full bg-white/95 border border-slate-200/90 text-slate-600 hover:text-[#4f46e5] hover:bg-[#e8eaff]/50 transition shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  {assessment.title}
                </h1>
                <span className="text-[10px] font-semibold bg-[#e8eaff] text-[#4f46e5] px-2.5 py-0.5 rounded-full border border-[#dce0ff]">
                  {assessment.type === AssessmentType.PRACTICAL_CODING
                    ? 'Strict Sandbox Coding'
                    : 'Theory Test'}
                </span>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                เกณฑ์ผ่าน: <span className="font-bold text-slate-800">{assessment.passingScore}%</span>{' '}
                · ทักษะ: <span className="font-semibold text-slate-700">{assessment.skill?.name || 'General'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Autosave status indicator */}
            {!theoryResult && !codingFinalResult && autosaveStatus !== 'idle' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border border-slate-200 bg-white/90 text-slate-600 shadow-xs">
                {autosaveStatus === 'saving' ? (
                  <>
                    <RefreshCw className="h-3 w-3 text-[#6366f1] animate-spin" />
                    <span>กำลังบันทึกร่าง...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-slate-700 font-semibold">บันทึกร่างอัตโนมัติแล้ว</span>
                  </>
                )}
              </div>
            )}

            {/* Active Countdown Timer */}
            {timeLeftSeconds !== null && !theoryResult && !codingFinalResult && (
              <div
                className={`flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-bold shadow-xs transition duration-200 ${
                  timeLeftSeconds <= 60
                    ? 'bg-red-50 border-red-300 text-red-600 animate-pulse'
                    : timeLeftSeconds <= 300
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white/95 border-slate-200/90 text-slate-800'
                }`}
              >
                <Clock
                  className={`h-4 w-4 ${
                    timeLeftSeconds <= 60
                      ? 'text-red-500'
                      : timeLeftSeconds <= 300
                      ? 'text-amber-500'
                      : 'text-[#4f46e5]'
                  }`}
                />
                <span>
                  เวลาที่เหลือ: <span className="font-mono text-sm">{formatTimer(timeLeftSeconds)}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 1. THEORY ASSESSMENT FLOW */}
        {assessment.type === AssessmentType.THEORY ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {theoryResult ? (
              <div className="rounded-[24px] border border-slate-200/90 bg-white/95 p-8 sm:p-10 shadow-[0_12px_32px_rgba(15,23,42,0.06)] text-center animate-in zoom-in-95 duration-200">
                <div
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4 ${
                    theoryResult.passed
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}
                >
                  <Award className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {theoryResult.passed ? '🎉 ยินดีด้วย! คุณผ่านการทดสอบทักษะ' : 'ผลการทำแบบทดสอบ'}
                </h2>
                <p className="text-sm text-[#667085] mt-2">
                  {theoryResult.feedbackHidden ? 'ผลสอบรอบล่าสุด ' : theoryResult.reviewStatus === 'HUMAN_REVIEWED' ? 'คะแนนหลังผู้ตรวจประเมิน ' : 'คุณได้คะแนนรอบล่าสุด '}
                  <span className="font-extrabold text-[#4f46e5] text-xl">
                    {theoryResult.feedbackHidden ? 'บริษัทเป็นผู้แจ้งผลสอบ' : `${theoryResult.percentage}%`}
                  </span>{' '}
                  {!theoryResult.feedbackHidden && theoryResult.reviewStatus !== 'HUMAN_REVIEWED' && `(${theoryResult.score} / ${theoryResult.maxScore} คะแนน)`}
                </p>
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[#667085]">
                  <span>ใช้เวลา: {Math.round(theoryResult.timeSpentSeconds || 0)} วินาที</span>
                  <span>·</span>
                  <span>เกณฑ์ผ่าน: {assessment.passingScore}%</span>
                </div>
                <p className="text-xs text-[#667085] mt-2 max-w-md mx-auto">
                  ระบบได้บันทึกผลการส่งข้อสอบรอบล่าสุดของคุณเรียบร้อยแล้ว
                </p>

                {theoryResult.passed && (
                  <div className="mt-5 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-left max-w-lg mx-auto shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                        🎖️
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-950">
                          ได้รับเหรียญทักษะเฉพาะ: {assessment.title}
                        </div>
                        <div className="text-[11px] text-indigo-700 mt-0.5">
                          ดูเหรียญและหลักฐานทักษะที่ได้รับในหน้าโปรไฟล์
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/profile?tab=skills"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs whitespace-nowrap shrink-0"
                    >
                      ดูเหรียญในโปรไฟล์
                    </Link>
                  </div>
                )}

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/profile?tab=skills"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#6366f1] text-white font-bold text-xs shadow-xs shadow-indigo-500/20 hover:bg-[#4f46e5] transition"
                  >
                    ดูเรดาร์ทักษะในโปรไฟล์
                  </Link>
                  <button
                    onClick={() => {
                      setTheoryResult(null);
                      setSelectedChoices({});
                      initAssessment(true);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full border border-slate-200/90 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> สอบใหม่อีกครั้ง (Retake)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {assessment.questions.map((q: any, idx: number) => (
                  <div
                    key={q.id}
                    className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[#4f46e5] uppercase tracking-wider">
                        คำถามข้อที่ {idx + 1} ({q.points} คะแนน)
                      </span>
                      <span className="text-[10px] font-semibold bg-[#f4f5fa] border border-slate-200/70 px-2.5 py-0.5 rounded-full text-[#667085]">
                        ระดับ: {q.difficulty}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-2">{q.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-5">{q.prompt}</p>

                    <div className="space-y-2.5">
                      {q.choices.map((c: any) => {
                        const isSelected = selectedChoices[q.id] === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleChoiceSelect(q.id, c.id)}
                            className={`w-full text-left p-4 rounded-xl text-xs font-medium border transition duration-150 flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-[#e8eaff]/70 border-[#6366f1] text-slate-900 shadow-xs'
                                : 'bg-[#fbfcfd] border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="leading-relaxed">{c.text}</span>
                            <div
                              className={`h-4 w-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                                isSelected
                                  ? 'border-[#6366f1] bg-[#6366f1] text-white'
                                  : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleSubmitTheory}
                    disabled={submittingTheory || Object.keys(selectedChoices).length === 0}
                    className="flex items-center gap-2 rounded-full bg-[#6366f1] px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-xs shadow-indigo-500/20 hover:bg-[#4f46e5] disabled:opacity-50 transition"
                  >
                    {submittingTheory ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        กำลังตรวจคำตอบอย่างเข้มงวด...
                      </>
                    ) : (
                      'ส่งคำตอบและบันทึกคะแนน'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 2. STRICT PRACTICAL CODING SANDBOX (Monaco Editor + Hardened VM / Judge0) */
          <div>
            {codingFinalResult ? (
              <div className="max-w-3xl mx-auto rounded-[24px] border border-slate-200/90 bg-white/95 p-6 sm:p-10 shadow-[0_12px_32px_rgba(15,23,42,0.06)] text-center animate-in zoom-in-95 duration-200">
                {/* 1. Evaluation Pending State (AI Outage or Queued) - NEVER shows 0% fail! */}
                {codingFinalResult.reviewStatus === 'EVALUATION_PENDING' ? (
                  <div>
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4 bg-blue-50 text-blue-600 border border-blue-200">
                      <Clock className="h-8 w-8 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      ส่งคำตอบเข้าสู่ระบบเรียบร้อยแล้ว
                    </h2>
                    <p className="text-sm font-bold text-blue-700 mt-2">
                      สถานะ: ระบบกำลังประเมินผลเชิงลึก (Evaluation Pending)
                    </p>
                    <p className="text-xs text-slate-600 mt-3 max-w-lg mx-auto leading-relaxed">
                      โค้ดที่คุณออกแบบถูกบันทึกไว้อย่างปลอดภัยในระบบแล้ว ระบบกำลังรอคิวประมวลผลการประเมินผล คะแนนจะไม่แสดงเป็น 0% และคุณจะไม่เสียสิทธิ์ คุณสามารถตรวจสอบผลได้อีกครั้งในภายหลัง
                    </p>
                    <div className="mt-8 flex justify-center">
                      <Link
                        href="/assessments"
                        className="px-6 py-2.5 rounded-full bg-[#6366f1] text-white font-bold text-xs shadow-xs hover:bg-[#4f46e5] transition"
                      >
                        กลับหน้ารายการข้อสอบ
                      </Link>
                    </div>
                  </div>
                ) : codingFinalResult.feedbackHidden || (codingFinalResult.reviewStatus === 'PENDING_HUMAN_REVIEW' &&
                  assessment.feedbackVisibility === 'AFTER_REVIEW') ? (
                  /* 2. Company Assessment Pending Human Review (AFTER_REVIEW mode) */
                  <div>
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4 bg-amber-50 text-amber-600 border border-amber-200">
                      <Clock className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      ส่งคำตอบให้บริษัทเรียบร้อยแล้ว
                    </h2>
                    <p className="text-sm font-bold text-amber-700 mt-2">
                      สถานะ: อยู่ระหว่างรอ Tech Lead ตรวจประเมินขั้นสุดท้าย (Pending Review)
                    </p>
                    <p className="text-xs text-slate-600 mt-3 max-w-lg mx-auto leading-relaxed">
                      แบบทดสอบนี้กำหนดให้ทีมวิศวกรของบริษัทตรวจประเมินผลโค้ดและยืนยันคะแนนขั้นสุดท้าย {assessment.feedbackVisibility === 'PRIVATE_TO_COMPANY' ? 'บริษัทเป็นผู้แจ้งผลการประเมินให้คุณทราบ' : 'ผลการประเมินจะแสดงให้ทราบหลังจากที่ทีมงานทำการตรวจเสร็จสิ้น'}
                    </p>
                    <div className="mt-8 flex justify-center">
                      <Link
                        href="/assessments"
                        className="px-6 py-2.5 rounded-full bg-[#6366f1] text-white font-bold text-xs shadow-xs hover:bg-[#4f46e5] transition"
                      >
                        กลับหน้ารายการข้อสอบ
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* 3. Completed Evaluation (AI Breakdown or Automated Test Cases) */
                  <div>
                    <div
                      className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4 ${
                        codingFinalResult.passed
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}
                    >
                      <Award className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {codingFinalResult.passed ? '🎉 ยินดีด้วย! คุณผ่านการทดสอบโค้ดดิ้ง' : 'ส่งผลการทดสอบโค้ดดิ้งเรียบร้อย'}
                    </h2>
                    <p className="text-sm text-[#667085] mt-2">
                      คะแนนการประเมินผล:{' '}
                      <span className="font-extrabold text-[#4f46e5] text-2xl">
                        {codingFinalResult.percentage ?? codingFinalResult.score ?? codingFinalResult.aiScore}%
                      </span>
                      {codingFinalResult.maxScore ? (
                        <span className="text-xs ml-1 text-slate-500">
                          ({codingFinalResult.totalPointsEarned ?? codingFinalResult.score} / {codingFinalResult.maxScore} คะแนน)
                        </span>
                      ) : codingFinalResult.pointsEarned !== undefined && codingFinalResult.maxPoints ? (
                        <span className="text-xs ml-1 text-slate-500">
                          ({codingFinalResult.pointsEarned} / {codingFinalResult.maxPoints} คะแนน)
                        </span>
                      ) : null}
                    </p>

                    {/* AI Rubric Breakdown Display */}
                    {codingFinalResult.evaluation?.rubricBreakdown && (
                      <div className="mt-6 text-left p-5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                          <span className="font-extrabold text-xs text-purple-950 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                            ผลการประเมิน 4 มิติจาก AI (Rubric Breakdown)
                          </span>
                          <span className="text-[10px] text-purple-700 font-semibold bg-white px-2 py-0.5 rounded-full border border-purple-200">
                            Confidence: {Math.round((codingFinalResult.evaluation.confidenceScore || 0.9) * 100)}%
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-white rounded-xl border border-purple-100">
                            <div className="flex justify-between font-bold text-slate-800 mb-1">
                              <span>1. Functional Correctness (40%)</span>
                              <span className="text-purple-700 font-extrabold">
                                {codingFinalResult.evaluation.rubricBreakdown.functionalCorrectness?.score}/100
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {codingFinalResult.evaluation.rubricBreakdown.functionalCorrectness?.feedback}
                            </p>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-purple-100">
                            <div className="flex justify-between font-bold text-slate-800 mb-1">
                              <span>2. Code Quality & Modularity (25%)</span>
                              <span className="text-purple-700 font-extrabold">
                                {codingFinalResult.evaluation.rubricBreakdown.codeQuality?.score}/100
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {codingFinalResult.evaluation.rubricBreakdown.codeQuality?.feedback}
                            </p>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-purple-100">
                            <div className="flex justify-between font-bold text-slate-800 mb-1">
                              <span>3. Algorithmic Efficiency (20%)</span>
                              <span className="text-purple-700 font-extrabold">
                                {codingFinalResult.evaluation.rubricBreakdown.algorithmEfficiency?.score}/100
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {codingFinalResult.evaluation.rubricBreakdown.algorithmEfficiency?.feedback}
                            </p>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-purple-100">
                            <div className="flex justify-between font-bold text-slate-800 mb-1">
                              <span>4. Error Handling & Edge Cases (15%)</span>
                              <span className="text-purple-700 font-extrabold">
                                {codingFinalResult.evaluation.rubricBreakdown.errorHandlingEdgeCases?.score}/100
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {codingFinalResult.evaluation.rubricBreakdown.errorHandlingEdgeCases?.feedback}
                            </p>
                          </div>
                        </div>

                        {codingFinalResult.evaluation.summaryReview && (
                          <div className="pt-2 border-t border-purple-100 text-xs">
                            <strong className="block text-purple-950 font-bold mb-1">สรุปภาพรวมจากระบบประเมิน AI:</strong>
                            <p className="text-slate-700 leading-relaxed">
                              {codingFinalResult.evaluation.summaryReview}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {codingFinalResult.passed && (
                      <div className="mt-6 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-left max-w-lg mx-auto shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                            🎖️
                          </div>
                          <div>
                            <div className="text-xs font-bold text-indigo-950">
                              ได้รับเหรียญทักษะเฉพาะ: {assessment.title}
                            </div>
                            <div className="text-[11px] text-indigo-700 mt-0.5">
                              ผ่านการทดสอบโค้ดดิ้งภาคปฏิบัติและยืนยันใน Verified Skills แล้ว
                            </div>
                          </div>
                        </div>
                        <Link
                          href="/profile?tab=skills"
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs whitespace-nowrap shrink-0"
                        >
                          ดูเหรียญในโปรไฟล์
                        </Link>
                      </div>
                    )}

                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link
                        href="/profile?tab=skills"
                        className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#6366f1] text-white font-bold text-xs shadow-xs shadow-indigo-500/20 hover:bg-[#4f46e5] transition"
                      >
                        ดูเรดาร์ทักษะในโปรไฟล์
                      </Link>
                      <button
                        onClick={() => {
                          setCodingFinalResult(null);
                          setTestRunResults({});
                          initAssessment(true);
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full border border-slate-200/90 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> ทดสอบใหม่อีกครั้ง (Retake)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Multi-Question Tabs */}
                {assessment.questions.length > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="text-xs font-bold text-slate-400 mr-1 uppercase tracking-wider">
                        ข้อสอบ:
                      </span>
                      {assessment.questions.map((q: any, idx: number) => {
                        const isSubmitted = !!submittedQuestions[q.id];
                        return (
                          <button
                            key={q.id}
                            onClick={() => setActiveQuestionIndex(idx)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                              activeQuestionIndex === idx
                                ? 'bg-[#6366f1] text-white border-[#6366f1] shadow-xs'
                                : isSubmitted
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {isSubmitted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                            <span>ข้อที่ {idx + 1}: {q.title}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                activeQuestionIndex === idx
                                  ? 'bg-white/20 text-white'
                                  : isSubmitted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {q.points} คะแนน
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => void handleFinalizeAttempt()}
                      disabled={finalizingAttempt || Object.keys(submittedQuestions).length === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                      title="ส่งชุดข้อสอบทั้งหมดและคำนวณคะแนนรวม"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>{finalizingAttempt ? 'กำลังประมวลผลสรุป...' : 'ส่งข้อสอบทั้งหมด (Finalize Exam)'}</span>
                    </button>
                  </div>
                )}

                {/* Submission Feedback Banner */}
                {submissionFeedback && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
                    <span className="font-semibold">{submissionFeedback}</span>
                    <button
                      onClick={() => setSubmissionFeedback(null)}
                      className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-0.5"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* 2-Column Split: Problem Spec & Console (5 cols) | Monaco Editor (7 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[750px]">
                  {/* Left Column: Problem, Test Cases, and Output */}
                  <div className="lg:col-span-5 rounded-[22px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] flex flex-col justify-between overflow-y-auto max-h-[800px]">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Code2 className="h-4 w-4" /> ข้อที่ {activeQuestionIndex + 1} ({currentQuestion?.points} คะแนน)
                        </span>
                        {currentQuestion?.difficulty === 'EASY' ? (
                          <span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-emerald-700">
                            ระดับ: ง่าย (Easy)
                          </span>
                        ) : currentQuestion?.difficulty === 'HARD' ? (
                          <span className="text-[10px] font-bold bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-rose-700">
                            ระดับ: ยาก (Hard)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-amber-700">
                            ระดับ: ปานกลาง (Medium)
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg font-extrabold text-slate-900 mb-2 tracking-tight">
                        {currentQuestion?.title}
                      </h2>
                      <p className="text-xs text-slate-700 leading-relaxed mb-6 whitespace-pre-line">
                        {currentQuestion?.prompt}
                      </p>

                      {/* Test Cases Specification or Open-Ended Rubric */}
                      {currentQuestion?.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED ? (
                        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 space-y-2.5 mb-6">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-purple-950">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                            <span>โจทย์ปฏิบัติการจริง (Open-Ended / AI Rubric)</span>
                          </div>
                          <p className="text-[11px] text-purple-900 leading-relaxed">
                            ออกแบบและเขียนฟังก์ชันแก้ปัญหาได้อย่างอิสระ ไม่จำกัดรูปแบบ — เมื่อกดส่ง ระบบจะส่งโค้ดไปรันใน Judge0 Sandbox เพื่อตรวจสอบความถูกต้อง และให้ Gemini AI ประเมินผล 4 มิติ:
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 bg-white rounded-xl border border-purple-100">
                              <span className="font-bold block text-purple-900">Functional (40%)</span>
                              <span className="text-[10px] text-slate-500">ตอบโจทย์ความต้องการ</span>
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-purple-100">
                              <span className="font-bold block text-purple-900">Code Quality (25%)</span>
                              <span className="text-[10px] text-slate-500">ความสะอาดและโครงสร้าง</span>
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-purple-100">
                              <span className="font-bold block text-purple-900">Efficiency (20%)</span>
                              <span className="text-[10px] text-slate-500">ความเร็วและ Memory</span>
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-purple-100">
                              <span className="font-bold block text-purple-900">Error Handling (15%)</span>
                              <span className="text-[10px] text-slate-500">ดักจับเคสขอบเขต</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] mb-3 flex items-center justify-between">
                            <span>ชุด Test Cases ประเมินผล</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {(currentQuestion?.testCases || []).length} ข้อทดสอบ
                            </span>
                          </h3>
                          <div className="space-y-2 mb-6">
                            {(currentQuestion?.testCases || []).map((tc: any, i: number) => (
                              <div
                                key={i}
                                className={`p-3 rounded-xl border text-[11px] font-mono ${
                                  tc.isHidden
                                    ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                                    : 'bg-[#f8fafc] border-slate-200/80 text-slate-700'
                                }`}
                              >
                                {tc.isHidden ? (
                                  <div className="flex items-center gap-1.5 font-sans font-semibold text-amber-800">
                                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                                    <span>Test Case {i + 1} (Hidden Test Case - ซ่อนไว้ตรวจเข้มงวดตอนส่ง)</span>
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <span className="text-slate-400">Input:</span> {tc.input}
                                    </div>
                                    <div className="mt-0.5">
                                      <span className="text-slate-400">Expected:</span>{' '}
                                      <span className="text-emerald-600 font-bold">{tc.expectedOutput}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Execution Report Terminal Panel */}
                    {currentTestReport && (
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-800">
                            <Terminal className="h-3.5 w-3.5 text-[#4f46e5]" />{' '}
                            {currentTestReport.isOpenEnded ? 'ผลลัพธ์ Sandbox Console' : 'ผลการรัน Test Cases'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              currentTestReport.status === 'ACCEPTED' ||
                              (currentTestReport.isOpenEnded && !currentTestReport.stderr)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {currentTestReport.status}
                          </span>
                        </div>

                        {currentTestReport.isOpenEnded ? (
                          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] space-y-2">
                            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                              <span>Standard Output (stdout)</span>
                              <span>
                                {currentTestReport.timeMs ? `${currentTestReport.timeMs}ms · ` : ''}Judge0 Sandbox
                              </span>
                            </div>
                            <pre className="whitespace-pre-wrap text-emerald-400 text-[11px] max-h-48 overflow-y-auto leading-relaxed">
                              {currentTestReport.stdout || '(โปรแกรมรันสำเร็จ ไม่มีข้อความส่งออกทาง console.log)'}
                            </pre>
                            {currentTestReport.stderr && (
                              <div className="pt-2 border-t border-slate-800 text-rose-400">
                                <span className="font-bold block text-[10px] mb-1">Runtime / Stderr:</span>
                                <pre className="whitespace-pre-wrap text-[10px]">{currentTestReport.stderr}</pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] space-y-2">
                            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                              <span>
                                ผ่าน {currentTestReport.passedTestCases} / {currentTestReport.totalTestCases} ข้อ
                              </span>
                              <span>{currentTestReport.engine || 'Judge0 Sandbox'}</span>
                            </div>

                            {currentTestReport.details?.map((d: any, idx: number) => (
                              <div
                                key={idx}
                                className={`p-2 rounded border text-[10px] ${
                                  d.passed
                                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                                    : 'bg-red-950/40 border-red-800/60 text-red-300'
                                }`}
                              >
                                <div className="flex items-center justify-between font-semibold">
                                  <span className="flex items-center gap-1">
                                    {d.passed ? (
                                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-red-400" />
                                    )}
                                    Test Case {idx + 1}: {d.passed ? 'Passed' : 'Failed'}
                                  </span>
                                  {d.timeMs !== undefined && (
                                    <span className="text-slate-400 text-[9px]">{d.timeMs}ms</span>
                                  )}
                                </div>
                                {!d.isHidden && !d.passed && (
                                  <div className="mt-1 text-slate-300 space-y-0.5">
                                    <div>Expected: <span className="text-emerald-400">{d.expected}</span></div>
                                    <div>Actual: <span className="text-red-400">{d.actual || d.error}</span></div>
                                  </div>
                                )}
                                {d.error && <div className="mt-1 text-red-400">Error: {d.error}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Monaco Editor & Action Controls */}
                  <div className="lg:col-span-7 rounded-[22px] border border-slate-800 bg-[#0f172a] p-4 shadow-xl flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400 text-xs">
                      <span className="font-mono text-slate-300 flex items-center gap-2">
                        <span>{isQuestionPython(currentQuestion) ? 'solution.py' : 'solution.js'}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            isQuestionPython(currentQuestion)
                              ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                              : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                          }`}
                        >
                          {isQuestionPython(currentQuestion) ? 'Python 3.11' : 'JavaScript Node.js'}
                        </span>
                      </span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Judge0 Isolated Sandbox Active
                      </span>
                    </div>

                    <div className="flex-1 my-3 overflow-hidden rounded-xl border border-slate-800">
                      <Editor
                        height="100%"
                        language={isQuestionPython(currentQuestion) ? 'python' : 'javascript'}
                        theme="vs-dark"
                        value={currentCode}
                        onChange={handleCodeChange}
                        options={{
                          // Keep the standard textarea input for keyboard and assistive-tool compatibility.
                          editContext: false,
                          minimap: { enabled: false },
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>

                    {/* Bottom Action Controls */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        {currentQuestion?.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED
                          ? 'ประเมินผลผ่าน Judge0 Sandbox + AI 4-Dimension Rubric'
                          : 'Anti-Cheat: ตรวจ Test Cases จริงทุกข้อ 100%'}
                      </span>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                          onClick={handleRunTests}
                          disabled={runningCode || submittingCoding}
                          className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 px-5 transition disabled:opacity-50"
                        >
                          <Play className={`h-3.5 w-3.5 ${runningCode ? 'animate-spin' : ''}`} />
                          {runningCode
                            ? 'กำลังรัน...'
                            : currentQuestion?.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED
                            ? 'รันโค้ดดูผลลัพธ์ (Run Console)'
                            : 'ทดสอบโค้ด (Run Tests)'}
                        </button>

                        <button
                          onClick={handleSubmitCoding}
                          disabled={submittingCoding || runningCode}
                          className="flex items-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-bold text-xs py-2.5 px-6 shadow-xs shadow-indigo-500/20 transition disabled:opacity-50"
                        >
                          <Send className={`h-3.5 w-3.5 ${submittingCoding ? 'animate-spin' : ''}`} />
                          {submittingCoding
                            ? 'กำลังส่งคำตอบ...'
                            : submittedQuestions[currentQuestion?.id]
                            ? 'ส่งคำตอบข้อนี้ใหม่อีกครั้ง'
                            : 'ส่งคำตอบข้อนี้'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
