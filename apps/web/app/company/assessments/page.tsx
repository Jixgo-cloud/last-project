'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Code2,
  FileQuestion,
  Plus,
  Trash2,
  Edit3,
  Award,
  ArrowLeft,
  Search,
  Building2,
  Users,
  Lock,
  Sparkles,
  FileCode,
  Eye,
  ExternalLink,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  Copy,
  Sliders,
} from 'lucide-react';
import {
  AssessmentType,
  QuestionDifficulty,
  QuestionEvaluationMethod,
  FeedbackVisibility,
} from '@smartcareer/shared';

export default function CompanyAssessmentsPage() {
  useAuth();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State: Create Assessment
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<AssessmentType>(AssessmentType.PRACTICAL_CODING);
  const [formSkillId, setFormSkillId] = useState('');
  const [formTimeLimit, setFormTimeLimit] = useState(45);
  const [formPassingScore, setFormPassingScore] = useState(70);
  const [formFeedbackVisibility, setFormFeedbackVisibility] = useState<FeedbackVisibility>(FeedbackVisibility.IMMEDIATE);
  const [formQuestions, setFormQuestions] = useState<any[]>([
    {
      title: 'โจทย์ทดสอบการเขียนโค้ด',
      prompt: '',
      difficulty: QuestionDifficulty.MEDIUM,
      points: 50,
      starterCode: '// Write your solution here\nfunction solution() {\n  return 0;\n}',
      evaluationMethod: QuestionEvaluationMethod.OPEN_ENDED,
      testCases: [
        { input: '', expectedOutput: '', isHidden: false },
        { input: '', expectedOutput: '', isHidden: true },
      ],
      choices: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
      ],
    },
  ]);

  // Modal State: Attempts & Tech Lead Review
  const [showAttemptsModal, setShowAttemptsModal] = useState(false);
  const [selectedAssessmentForAttempts, setSelectedAssessmentForAttempts] = useState<any | null>(null);
  const [attemptsList, setAttemptsList] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  // Modal State: Inspect Single Attempt & Human Override
  const [selectedAttemptForReview, setSelectedAttemptForReview] = useState<any | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(80);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overriding, setOverriding] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      apiRequest('/company/assessments'),
      apiRequest('/admin/skills').catch(() => []),
    ])
      .then(([assessData, skillsData]) => {
        setAssessments(assessData || []);
        if (skillsData) setSkills(skillsData);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await apiRequest(`/company/assessments/${id}/toggle`, { method: 'PATCH' });
      loadData();
    } catch (e: any) {
      alert(`Toggle error: ${e.message}`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณต้องการลบแบบทดสอบ "${title}" ใช่หรือไม่?`)) return;
    try {
      await apiRequest(`/company/assessments/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDescription('');
    setFormType(AssessmentType.PRACTICAL_CODING);
    setFormSkillId(skills[0]?.id || '');
    setFormTimeLimit(45);
    setFormPassingScore(70);
    setFormFeedbackVisibility(FeedbackVisibility.IMMEDIATE);
    setFormQuestions([
      {
        title: 'โจทย์ปัญหาทางเทคนิค',
        prompt: 'เขียนโค้ดตามความต้องการของระบบ และออกแบบการทำงานให้รองรับสถานการณ์ต่าง ๆ',
        difficulty: QuestionDifficulty.MEDIUM,
        points: 50,
        language: 'javascript',
        starterCode: '// เขียนฟังก์ชันแก้ปัญหาด้านล่าง\nfunction solution() {\n  return 0;\n}',
        solutionCode: '',
        evaluationMethod: QuestionEvaluationMethod.OPEN_ENDED,
        rubric: '',
        explanation: '',
        testCases: [
          { input: '1, 2', expectedOutput: '3', isHidden: false },
          { input: '10, 20', expectedOutput: '30', isHidden: true },
        ],
        choices: [
          { text: 'ตัวเลือก 1', isCorrect: true },
          { text: 'ตัวเลือก 2', isCorrect: false },
          { text: 'ตัวเลือก 3', isCorrect: false },
          { text: 'ตัวเลือก 4', isCorrect: false },
        ],
      },
    ]);
    setShowModal(true);
  };

  const handleEditAssessment = async (id: string) => {
    try {
      setSaving(true);
      const data = await apiRequest(`/company/assessments/${id}`);
      setEditingId(id);
      setFormTitle(data.title || '');
      setFormDescription(data.description || '');
      setFormType(data.type || AssessmentType.PRACTICAL_CODING);
      setFormSkillId(data.skillId || '');
      setFormTimeLimit(data.timeLimitMinutes || 45);
      setFormPassingScore(data.passingScore || 70);
      setFormFeedbackVisibility(data.feedbackVisibility || FeedbackVisibility.IMMEDIATE);

      if (data.questions && data.questions.length > 0) {
        setFormQuestions(
          data.questions.map((q: any, idx: number) => {
            const isPy = (q.starterCode || '').includes('def solution') || (q.starterCode || '').includes('import sys');
            return {
              id: q.id,
              title: q.title || `โจทย์ข้อที่ ${idx + 1}`,
              prompt: q.prompt || '',
              difficulty: q.difficulty || QuestionDifficulty.MEDIUM,
              points: q.points ?? (data.type === AssessmentType.PRACTICAL_CODING ? 50 : 25),
              language: isPy ? 'python' : 'javascript',
              starterCode: q.starterCode || '// เขียนฟังก์ชันแก้ปัญหาด้านล่าง\nfunction solution() {\n  return 0;\n}',
              solutionCode: q.solutionCode || '',
              evaluationMethod: q.evaluationMethod || QuestionEvaluationMethod.OPEN_ENDED,
              rubric: q.rubric?.customGuidelines || (typeof q.rubric === 'string' ? q.rubric : '') || '',
              explanation: q.explanation || '',
              testCases:
                q.testCases && q.testCases.length > 0
                  ? q.testCases
                  : [{ input: '', expectedOutput: '', isHidden: false }],
              choices:
                q.choices && q.choices.length > 0
                  ? q.choices.map((c: any) => ({
                      id: c.id,
                      text: c.text || '',
                      isCorrect: !!c.isCorrect,
                    }))
                  : [
                      { text: '', isCorrect: true },
                      { text: '', isCorrect: false },
                    ],
            };
          }),
        );
      }
      setShowModal(true);
    } catch (err: any) {
      alert(`ไม่สามารถโหลดข้อมูลแบบทดสอบได้: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = () => {
    setFormQuestions((prev) => [
      ...prev,
      {
        title: `โจทย์ข้อที่ ${prev.length + 1}`,
        prompt: '',
        difficulty: QuestionDifficulty.MEDIUM,
        points: formType === AssessmentType.PRACTICAL_CODING ? 50 : 25,
        language: 'javascript',
        starterCode: '// เขียนฟังก์ชันแก้ปัญหาด้านล่าง\nfunction solution() {\n  return 0;\n}',
        solutionCode: '',
        evaluationMethod: QuestionEvaluationMethod.OPEN_ENDED,
        rubric: '',
        explanation: '',
        testCases: [{ input: '', expectedOutput: '', isHidden: false }],
        choices: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ],
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setFormQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveQuestionUp = (idx: number) => {
    if (idx === 0) return;
    setFormQuestions((prev) => {
      const next = [...prev];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const handleMoveQuestionDown = (idx: number) => {
    if (idx === formQuestions.length - 1) return;
    setFormQuestions((prev) => {
      const next = [...prev];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const handleDuplicateQuestion = (idx: number) => {
    setFormQuestions((prev) => {
      const target = prev[idx];
      const cloned = {
        ...target,
        id: undefined,
        title: `${target.title} (สำเนา)`,
        testCases: target.testCases ? target.testCases.map((tc: any) => ({ ...tc })) : [],
        choices: target.choices ? target.choices.map((c: any) => ({ ...c, id: undefined })) : [],
      };
      const next = [...prev];
      next.splice(idx + 1, 0, cloned);
      return next;
    });
  };

  const handleDistributePoints = () => {
    if (formQuestions.length === 0) return;
    const count = formQuestions.length;
    const basePoint = Math.floor(100 / count);
    const remainder = 100 % count;
    setFormQuestions((prev) =>
      prev.map((q, idx) => ({
        ...q,
        points: idx === 0 ? basePoint + remainder : basePoint,
      })),
    );
  };

  const handleAddChoice = (qIdx: number) => {
    setFormQuestions((prev) =>
      prev.map((item, idx) => {
        if (idx !== qIdx) return item;
        if (item.choices.length >= 6) {
          alert('จำกัดสูงสุด 6 ตัวเลือกต่อคำถาม');
          return item;
        }
        return {
          ...item,
          choices: [...item.choices, { text: '', isCorrect: false }],
        };
      }),
    );
  };

  const handleRemoveChoice = (qIdx: number, cIdx: number) => {
    setFormQuestions((prev) =>
      prev.map((item, idx) => {
        if (idx !== qIdx) return item;
        if (item.choices.length <= 2) {
          alert('ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก');
          return item;
        }
        const wasCorrect = item.choices[cIdx]?.isCorrect;
        const newChoices = item.choices.filter((_: any, i: number) => i !== cIdx);
        if (wasCorrect && newChoices.length > 0) {
          newChoices[0].isCorrect = true;
        }
        return {
          ...item,
          choices: newChoices,
        };
      }),
    );
  };

  const handleRemoveTestCase = (qIdx: number, tcIdx: number) => {
    setFormQuestions((prev) =>
      prev.map((item, idx) => {
        if (idx !== qIdx) return item;
        if (item.testCases.length <= 2) {
          alert('ต้องมีชุด Test Cases อย่างน้อย 2 ข้อ (Visible 1 ข้อ และ Hidden 1 ข้อ)');
          return item;
        }
        return {
          ...item,
          testCases: item.testCases.filter((_: any, i: number) => i !== tcIdx),
        };
      }),
    );
  };

  const handleLanguageChange = (qIdx: number, lang: 'javascript' | 'python') => {
    setFormQuestions((prev) =>
      prev.map((item, idx) => {
        if (idx !== qIdx) return item;
        const currentStarter = item.starterCode || '';
        let newStarter = currentStarter;
        if (lang === 'python') {
          if (!currentStarter || currentStarter.includes('function solution')) {
            newStarter = '# เขียนฟังก์ชันแก้ปัญหาด้านล่าง\ndef solution(*args):\n    return 0\n';
          }
        } else {
          if (!currentStarter || currentStarter.includes('def solution')) {
            newStarter = '// เขียนฟังก์ชันแก้ปัญหาด้านล่าง\nfunction solution() {\n  return 0;\n}';
          }
        }
        return {
          ...item,
          language: lang,
          starterCode: newStarter,
        };
      }),
    );
  };

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('กรุณาระบุชื่อชุดแบบทดสอบ');
      return;
    }
    if (formQuestions.length === 0) {
      alert('กรุณาเพิ่มข้อสอบอย่างน้อย 1 ข้อ');
      return;
    }

    // Strict Validation: THEORY
    if (formType === AssessmentType.THEORY) {
      for (let i = 0; i < formQuestions.length; i++) {
        const q = formQuestions[i];
        if (!q.title?.trim() && !q.prompt?.trim()) {
          alert(`ข้อที่ ${i + 1}: กรุณาระบุหัวข้อหรือคำถาม`);
          return;
        }
        if (!q.choices || q.choices.length < 2) {
          alert(`ข้อที่ ${i + 1}: ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`);
          return;
        }
        const hasCorrect = q.choices.some((c: any) => !!c.isCorrect);
        if (!hasCorrect) {
          alert(`ข้อที่ ${i + 1}: กรุณาเลือกตัวเลือกที่ถูกต้อง (ต้องมีเฉลยอย่างน้อย 1 ข้อ)`);
          return;
        }
        const emptyChoice = q.choices.some((c: any) => !c.text?.trim());
        if (emptyChoice) {
          alert(`ข้อที่ ${i + 1}: มีตัวเลือกที่ข้อความว่างเปล่า กรุณากรอกข้อความให้ครบทุกตัวเลือก`);
          return;
        }
      }
    }

    // Strict Validation: PRACTICAL_CODING
    if (formType === AssessmentType.PRACTICAL_CODING) {
      for (let i = 0; i < formQuestions.length; i++) {
        const q = formQuestions[i];
        if (!q.title?.trim()) {
          alert(`ข้อที่ ${i + 1}: กรุณาระบุหัวข้อคำถาม`);
          return;
        }
        if (q.evaluationMethod === QuestionEvaluationMethod.AUTOMATED_TEST_CASES) {
          if (!q.testCases || q.testCases.length < 2) {
            alert(`ข้อที่ ${i + 1}: กรุณากำหนดชุด Test Cases อย่างน้อย 2 ข้อ`);
            return;
          }
          const hasVisible = q.testCases.some((tc: any) => !tc.isHidden);
          const hasHidden = q.testCases.some((tc: any) => !!tc.isHidden);
          if (!hasVisible) {
            alert(`ข้อที่ ${i + 1}: ต้องมี Test Case แบบเปิดเผย (Visible) อย่างน้อย 1 ข้อ เพื่อให้ผู้สมัครรันโค้ดทดสอบได้`);
            return;
          }
          if (!hasHidden) {
            alert(`ข้อที่ ${i + 1}: ต้องมี Test Case แบบซ่อน (Hidden) อย่างน้อย 1 ข้อ สำหรับตรวจคะแนนตอนส่ง`);
            return;
          }
          const emptyExpected = q.testCases.some(
            (tc: any) => tc.expectedOutput === undefined || tc.expectedOutput === null || String(tc.expectedOutput).trim() === '',
          );
          if (emptyExpected) {
            alert(`ข้อที่ ${i + 1}: มี Test Case ที่ไม่มีค่า Expected Output กรุณาระบุผลลัพธ์ที่คาดหวังให้ครบ`);
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle,
        description: formDescription,
        type: formType,
        skillId: formSkillId || null,
        timeLimitMinutes: formTimeLimit,
        passingScore: formPassingScore,
        feedbackVisibility: formFeedbackVisibility,
        questions: formQuestions.map((q) => ({
          id: q.id,
          title: q.title,
          prompt: q.prompt,
          difficulty: q.difficulty || QuestionDifficulty.MEDIUM,
          points: Number(q.points) || 10,
          starterCode: q.starterCode || null,
          solutionCode: q.solutionCode || null,
          evaluationMethod: q.evaluationMethod,
          rubric: q.rubric ? { customGuidelines: q.rubric } : null,
          explanation: q.explanation || null,
          testCases: q.testCases,
          choices: q.choices,
        })),
      };

      if (editingId) {
        await apiRequest(`/company/assessments/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/company/assessments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // --- Attempts & Tech Lead Review Handlers ---
  const handleViewAttempts = async (assessment: any) => {
    setSelectedAssessmentForAttempts(assessment);
    setShowAttemptsModal(true);
    setLoadingAttempts(true);
    try {
      const attempts = await apiRequest(`/company/assessment-attempts?assessmentId=${assessment.id}`);
      setAttemptsList(attempts || []);
    } catch (err: any) {
      alert(`Failed to load attempts: ${err.message}`);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleInspectAttempt = async (attempt: any) => {
    try {
      const reviewDetails = await apiRequest(`/assessments/attempts/${attempt.id}/review`);
      setSelectedAttemptForReview(reviewDetails);
      setOverrideScore(reviewDetails.humanScore ?? reviewDetails.aiScore ?? 80);
      setOverrideReason(reviewDetails.reviewReason || '');
    } catch (err: any) {
      alert(`Failed to load review details: ${err.message}`);
    }
  };

  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttemptForReview) return;
    if (!overrideReason.trim()) {
      alert('กรุณาระบุเหตุผลการตรวจ/ปรับคะแนน (Audit Reason)');
      return;
    }

    setOverriding(true);
    try {
      const updated = await apiRequest(`/assessments/attempts/${selectedAttemptForReview.id}/override-score`, {
        method: 'POST',
        body: JSON.stringify({
          humanScore: Number(overrideScore),
          reviewReason: overrideReason,
        }),
      });

      setSelectedAttemptForReview(updated);
      alert('บันทึกผลการตรวจและคะแนนเรียบร้อยแล้ว (Human Review Saved)');

      // Refresh attempts list
      if (selectedAssessmentForAttempts) {
        const attempts = await apiRequest(`/company/assessment-attempts?assessmentId=${selectedAssessmentForAttempts.id}`);
        setAttemptsList(attempts || []);
      }
    } catch (err: any) {
      alert(`Override failed: ${err.message}`);
    } finally {
      setOverriding(false);
    }
  };

  const filtered = assessments.filter((a) =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.skill?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 py-8 px-4 sm:px-8 max-w-[1360px] mx-auto w-full">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Link
              href="/company/dashboard"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  แบบทดสอบคัดกรองพนักงาน (Company Technical Assessments)
                </h1>
                <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  Company Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                สร้างโจทย์เขียนโค้ดและแบบทดสอบเฉพาะบริษัท เพื่อคัดกรองผู้สมัครก่อนเรียกสัมภาษณ์งาน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 shadow-xs shadow-indigo-500/20 transition"
            >
              <Plus className="h-4 w-4" /> สร้างแบบทดสอบคัดกรองใหม่
            </button>
          </div>
        </div>

        {/* Integration Banner */}
        <div className="bg-linear-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-indigo-900">
            <div className="p-2 rounded-xl bg-white text-indigo-600 shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <strong className="block text-sm font-bold text-indigo-950">
                วิธีใช้งานแบบทดสอบกับตำแหน่งงานของคุณ
              </strong>
              <span>
                เมื่อสร้างแบบทดสอบเรียบร้อยแล้ว คุณสามารถเลือกผูกเข้ากับตำแหน่งงานได้ที่หน้า{' '}
                <Link href="/company/jobs/new" className="font-bold underline hover:text-indigo-700">
                  ลงประกาศงานใหม่
                </Link>{' '}
                ผู้สมัครในตำแหน่งนั้นจะได้รับข้อสอบนี้ไปทำอัตโนมัติ
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 mb-6 shadow-xs flex items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อแบบทดสอบของบริษัท..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Assessments List / Cards */}
        {loading ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-slate-500">กำลังโหลดรายการแบบทดสอบ...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 bg-white rounded-2xl border border-slate-200/90 text-center p-8">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-800 text-sm mb-1">ยังไม่มีแบบทดสอบคัดกรองเฉพาะของบริษัท</p>
            <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
              สร้างโจทย์ทดสอบทางเทคนิคเพื่อให้ผู้สมัครพิสูจน์ทักษะจริงผ่าน Judge0 Sandbox ก่อนเรียกนัดสัมภาษณ์
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
            >
              + สร้างแบบทดสอบชุดแรก
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        a.type === AssessmentType.PRACTICAL_CODING
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {a.type === AssessmentType.PRACTICAL_CODING ? (
                        <Code2 className="h-3 w-3" />
                      ) : (
                        <FileQuestion className="h-3 w-3" />
                      )}
                      {a.type === AssessmentType.PRACTICAL_CODING ? 'Coding Sandbox' : 'Theory Test'}
                    </span>

                    <button
                      onClick={() => handleToggle(a.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                        a.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {a.isActive ? 'เปิดรับสอบ' : 'ปิดใช้งาน'}
                    </button>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 mb-1.5 line-clamp-1">
                    {a.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {a.description || 'ไม่มีคำอธิบาย'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 mb-4">
                    <div>
                      เวลา: <strong className="text-slate-800">{a.timeLimitMinutes} นาที</strong>
                    </div>
                    <div>
                      เกณฑ์ผ่าน: <strong className="text-slate-800">{a.passingScore}%</strong>
                    </div>
                    <div>
                      ข้อสอบ: <strong className="text-slate-800">{a._count?.questions || 0} ข้อ</strong>
                    </div>
                    <div>
                      ผู้ทำแล้ว: <strong className="text-slate-800">{a._count?.attempts || 0} คน</strong>
                    </div>
                  </div>

                  {/* Tech Lead Review Action Button */}
                  <div className="mb-4">
                    <button
                      onClick={() => handleViewAttempts(a)}
                      className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-purple-200"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      <span>ตรวจผลและให้คะแนนผู้สมัคร ({a._count?.attempts || 0})</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    ผูกกับงาน: {a._count?.jobs || 0} ตำแหน่ง
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditAssessment(a.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition"
                      title="แก้ไขแบบทดสอบ"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id, a.title)}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                      title="ลบแบบทดสอบ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create / Edit Company Assessment */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {editingId ? 'แก้ไขแบบทดสอบคัดกรองของบริษัท' : 'สร้างแบบทดสอบคัดกรองเฉพาะของบริษัท'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {editingId
                      ? 'ปรับปรุงเนื้อหาโจทย์ เกณฑ์ผ่าน ตัวเลือก และ Test Cases (ระบบจะเพิ่มเลขเวอร์ชันอัตโนมัติ)'
                      : 'ตั้งโจทย์คัดกรองผู้สมัครในตำแหน่งของบริษัท พร้อมกำหนด Test Cases สำหรับ Judge0'}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveAssessment} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ชื่อชุดแบบทดสอบ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น Senior Frontend Take-Home Challenge"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ประเภทแบบทดสอบ</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AssessmentType)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value={AssessmentType.PRACTICAL_CODING}>Practical Coding (Judge0 Sandbox)</option>
                      <option value={AssessmentType.THEORY}>Theory Assessment (ปรนัย Multiple Choice)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">คำอธิบายรายละเอียด</label>
                  <textarea
                    rows={2}
                    placeholder="ระบุข้อกำหนด สิ่งที่ต้องการวัดผล หรือคำแนะนำสำหรับผู้สมัคร..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ทักษะที่เกี่ยวข้อง</label>
                    <select
                      value={formSkillId}
                      onChange={(e) => setFormSkillId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">-- ไม่ระบุ --</option>
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">เวลาทำข้อสอบ (นาที)</label>
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={formTimeLimit}
                      onChange={(e) => setFormTimeLimit(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">เกณฑ์ผ่าน (%)</label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={formPassingScore}
                      onChange={(e) => setFormPassingScore(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">การแสดงผลลัพธ์ (Feedback Visibility)</label>
                  <select
                    value={formFeedbackVisibility}
                    onChange={(e) => setFormFeedbackVisibility(e.target.value as FeedbackVisibility)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value={FeedbackVisibility.IMMEDIATE}>ทันที (Candidate เห็นคะแนนและการวิเคราะห์ AI ทันที)</option>
                    <option value={FeedbackVisibility.AFTER_REVIEW}>หลังตรวจเสร็จ (Candidate จะเห็นผลหลัง Tech Lead ตรวจประเมิน)</option>
                    <option value={FeedbackVisibility.PRIVATE_TO_COMPANY}>ภายในเท่านั้น (Candidate ไม่เห็นคะแนน)</option>
                  </select>
                </div>

                {/* Points Summary Badge & Auto-Distribute */}
                {(() => {
                  const totalPoints = formQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
                  const pointsToPass = Math.ceil((totalPoints * formPassingScore) / 100);
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl text-xs text-indigo-950">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-indigo-600 shrink-0" />
                        <div>
                          <span>คะแนนรวมทุกข้อ: <strong className="font-extrabold text-indigo-700">{totalPoints} คะแนน</strong></span>
                          <span className="text-[11px] text-indigo-600 block">
                            เกณฑ์ผ่าน {formPassingScore}% ➔ ต้องได้คะแนนอย่างน้อย <strong>{pointsToPass}</strong> / {totalPoints}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDistributePoints}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-2xs transition"
                        title="ปรับคะแนนทุกข้อให้รวมกันได้ 100 คะแนนเต็มโดยอัตโนมัติ"
                      >
                        <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                        เกลี่ยคะแนนให้ได้ 100 เต็ม
                      </button>
                    </div>
                  );
                })()}

                {/* Question Builder */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span>โจทย์และคำถาม ({formQuestions.length} ข้อ)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> เพิ่มโจทย์
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                      >
                        {/* Question Header Toolbar with Move Up, Down, Duplicate, Delete */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-purple-700 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-100">
                              ข้อที่ {qIdx + 1}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                q.difficulty === QuestionDifficulty.EASY
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : q.difficulty === QuestionDifficulty.HARD
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {q.difficulty === QuestionDifficulty.EASY
                                ? 'ง่าย (Easy)'
                                : q.difficulty === QuestionDifficulty.HARD
                                ? 'ยาก (Hard)'
                                : 'ปานกลาง (Medium)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestionUp(qIdx)}
                              disabled={qIdx === 0}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                              title="เลื่อนขึ้น (Move Up)"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestionDown(qIdx)}
                              disabled={qIdx === formQuestions.length - 1}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                              title="เลื่อนลง (Move Down)"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateQuestion(qIdx)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition ml-1"
                              title="ทำซ้ำข้อนี้ (Duplicate)"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            {formQuestions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(qIdx)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-700 transition ml-1"
                                title="ลบข้อนี้"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mode Selector & Language Switcher for Practical Coding */}
                        {formType === AssessmentType.PRACTICAL_CODING && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-600">วิธีประเมิน:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormQuestions((prev) =>
                                    prev.map((item, idx) =>
                                      idx === qIdx
                                        ? { ...item, evaluationMethod: QuestionEvaluationMethod.OPEN_ENDED }
                                        : item,
                                    ),
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                  (q.evaluationMethod || QuestionEvaluationMethod.OPEN_ENDED) ===
                                  QuestionEvaluationMethod.OPEN_ENDED
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <Sparkles className="h-3 w-3" />
                                โจทย์อิสระ (AI Rubric 4 มิติ)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormQuestions((prev) =>
                                    prev.map((item, idx) =>
                                      idx === qIdx
                                        ? { ...item, evaluationMethod: QuestionEvaluationMethod.AUTOMATED_TEST_CASES }
                                        : item,
                                    ),
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                  q.evaluationMethod === QuestionEvaluationMethod.AUTOMATED_TEST_CASES
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                Test Cases (Judge0)
                              </button>
                            </div>

                            {/* Language Switcher */}
                            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-500 pl-1">ภาษา:</span>
                              <button
                                type="button"
                                onClick={() => handleLanguageChange(qIdx, 'javascript')}
                                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                                  (q.language || 'javascript') === 'javascript'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                JavaScript
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLanguageChange(qIdx, 'python')}
                                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                                  q.language === 'python'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                Python 3.11
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Title, Difficulty, and Points Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              หัวข้อโจทย์ปัญหา *
                            </label>
                            <input
                              type="text"
                              placeholder="เช่น Database Optimization, Payment Gateway..."
                              value={q.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormQuestions((prev) =>
                                  prev.map((item, idx) => (idx === qIdx ? { ...item, title: val } : item)),
                                );
                              }}
                              className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              ระดับความยาก *
                            </label>
                            <select
                              value={q.difficulty || QuestionDifficulty.MEDIUM}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormQuestions((prev) =>
                                  prev.map((item, idx) => (idx === qIdx ? { ...item, difficulty: val } : item)),
                                );
                              }}
                              className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white font-medium"
                            >
                              <option value={QuestionDifficulty.EASY}>ง่าย (Easy)</option>
                              <option value={QuestionDifficulty.MEDIUM}>ปานกลาง (Medium)</option>
                              <option value={QuestionDifficulty.HARD}>ยาก (Hard)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              คะแนน (Points) *
                            </label>
                            <input
                              type="number"
                              min={1}
                              placeholder="คะแนน"
                              value={q.points}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value));
                                setFormQuestions((prev) =>
                                  prev.map((item, idx) => (idx === qIdx ? { ...item, points: val } : item)),
                                );
                              }}
                              className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white font-bold text-purple-700"
                            />
                          </div>
                        </div>

                        <div>
                          <textarea
                            rows={3}
                            placeholder="โจทย์หรือคำอธิบายอย่างละเอียด (สำหรับโจทย์อิสระ ให้ระบุเป้าหมาย และขอบเขตที่ต้องการให้ผู้สมัครออกแบบและเขียนโค้ด)..."
                            value={q.prompt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormQuestions((prev) =>
                                prev.map((item, idx) => (idx === qIdx ? { ...item, prompt: val } : item)),
                              );
                            }}
                            className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
                          />
                        </div>

                        {/* Starter Code for Practical Coding */}
                        {formType === AssessmentType.PRACTICAL_CODING && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-700">
                                โค้ดเริ่มต้น (Starter Code)
                              </label>
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                💡 สำคัญ: ต้องมีฟังก์ชัน <code>function solution(...)</code> สำหรับระบบ Test Runner
                              </span>
                            </div>
                            <textarea
                              rows={4}
                              placeholder="// เขียนโค้ดเริ่มต้นที่นี่\nfunction solution() {\n  return 0;\n}"
                              value={q.starterCode || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormQuestions((prev) =>
                                  prev.map((item, idx) => (idx === qIdx ? { ...item, starterCode: val } : item)),
                                );
                              }}
                              className="w-full p-2.5 rounded-lg border border-slate-700 text-xs font-mono bg-slate-900 text-slate-100"
                            />
                          </div>
                        )}

                        {/* Open-Ended Rubric Explainer */}
                        {formType === AssessmentType.PRACTICAL_CODING &&
                          (q.evaluationMethod || QuestionEvaluationMethod.OPEN_ENDED) ===
                            QuestionEvaluationMethod.OPEN_ENDED && (
                            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900 space-y-1.5">
                              <div className="flex items-center gap-1.5 font-bold text-purple-950">
                                <Sparkles className="h-4 w-4 text-purple-600" />
                                <span>เกณฑ์การประเมิน 4 มิติ (AI 4-Dimension Rubric)</span>
                              </div>
                              <p className="text-[11px] text-purple-800 leading-relaxed">
                                ผู้สมัครสามารถออกแบบโค้ดได้อย่างอิสระ ไม่ต้องมี Test Cases ตายตัว — โค้ดจะถูกรันใน Judge0 Sandbox เพื่อตรวจสอบ Output แล้วส่งให้ AI ตรวจประเมินตามเกณฑ์:
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-medium">
                                <div className="p-1.5 bg-white rounded-lg border border-purple-100 text-center">
                                  <span className="block font-bold text-purple-900">Functional</span>
                                  <span className="text-purple-600">40%</span>
                                </div>
                                <div className="p-1.5 bg-white rounded-lg border border-purple-100 text-center">
                                  <span className="block font-bold text-purple-900">Code Quality</span>
                                  <span className="text-purple-600">25%</span>
                                </div>
                                <div className="p-1.5 bg-white rounded-lg border border-purple-100 text-center">
                                  <span className="block font-bold text-purple-900">Efficiency</span>
                                  <span className="text-purple-600">20%</span>
                                </div>
                                <div className="p-1.5 bg-white rounded-lg border border-purple-100 text-center">
                                  <span className="block font-bold text-purple-900">Error Handling</span>
                                  <span className="text-purple-600">15%</span>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Solution Code (Optional reference for author) */}
                        {formType === AssessmentType.PRACTICAL_CODING && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-700">
                                โค้ดเฉลยตัวอย่าง (Reference Solution Code - ไม่บังคับ)
                              </label>
                              <span className="text-[10px] text-slate-400">
                                สำหรับเก็บไว้ตรวจสอบ Test Cases (ไม่แสดงให้ผู้สมัครเห็น)
                              </span>
                            </div>
                            <textarea
                              rows={3}
                              placeholder={
                                q.language === 'python'
                                  ? '# โค้ดเฉลยตัวอย่างภาษา Python\ndef solution(*args):\n    return ...'
                                  : '// โค้ดเฉลยตัวอย่างภาษา JavaScript\nfunction solution() {\n  return ...;\n}'
                              }
                              value={q.solutionCode || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormQuestions((prev) =>
                                  prev.map((item, idx) => (idx === qIdx ? { ...item, solutionCode: val } : item)),
                                );
                              }}
                              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-slate-50 text-slate-800"
                            />
                          </div>
                        )}

                        {/* Open-Ended Rubric Explainer & Custom Guidelines */}
                        {formType === AssessmentType.PRACTICAL_CODING &&
                          (q.evaluationMethod || QuestionEvaluationMethod.OPEN_ENDED) ===
                            QuestionEvaluationMethod.OPEN_ENDED && (
                            <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900 space-y-2.5">
                              <div className="flex items-center gap-1.5 font-bold text-purple-950">
                                <Sparkles className="h-4 w-4 text-purple-600" />
                                <span>เกณฑ์การประเมิน 4 มิติ (AI 4-Dimension Rubric)</span>
                              </div>
                              <p className="text-[11px] text-purple-800 leading-relaxed">
                                ผู้สมัครสามารถออกแบบโค้ดได้อย่างอิสระ โค้ดจะถูกรันใน Judge0 Sandbox เพื่อตรวจสอบ Output แล้วส่งให้ AI ตรวจประเมินตามเกณฑ์ 4 มิติ
                              </p>

                              {/* Custom AI Rubric Guidelines */}
                              <div>
                                <label className="block text-[11px] font-bold text-purple-950 mb-1">
                                  เกณฑ์เน้นย้ำพิเศษสำหรับ AI ตรวจ (Custom AI Evaluation Guidelines - Optional)
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="เช่น ผู้สมัครต้องคำนึงถึง Edge Case ค่าว่าง, ต้องใช้ Time Complexity O(N log N) เป็นต้น..."
                                  value={q.rubric || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFormQuestions((prev) =>
                                      prev.map((item, idx) => (idx === qIdx ? { ...item, rubric: val } : item)),
                                    );
                                  }}
                                  className="w-full p-2 rounded-lg border border-purple-200 text-xs bg-white text-slate-800"
                                />
                              </div>
                            </div>
                          )}

                        {/* Test Cases for Coding (When AUTOMATED_TEST_CASES) */}
                        {formType === AssessmentType.PRACTICAL_CODING &&
                          q.evaluationMethod === QuestionEvaluationMethod.AUTOMATED_TEST_CASES && (
                          <div className="pt-2 border-t border-slate-200/60">
                            <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                              <span>ชุด Test Cases (Judge0)</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormQuestions((prev) =>
                                    prev.map((item, idx) =>
                                      idx === qIdx
                                        ? {
                                            ...item,
                                            testCases: [
                                              ...item.testCases,
                                              { input: '', expectedOutput: '', isHidden: false },
                                            ],
                                          }
                                        : item,
                                    ),
                                  );
                                }}
                                className="text-indigo-600 text-[10px] font-bold hover:text-indigo-800 flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" /> เพิ่ม Test Case
                              </button>
                            </div>

                            <div className="space-y-2">
                              {q.testCases.map((tc: any, tcIdx: number) => (
                                <div key={tcIdx} className="grid grid-cols-12 gap-2 items-center text-xs">
                                  <div className="col-span-5">
                                    <input
                                      type="text"
                                      placeholder="Input (e.g. 2, 3)"
                                      value={tc.input}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setFormQuestions((prev) =>
                                          prev.map((item, idx) =>
                                            idx === qIdx
                                              ? {
                                                  ...item,
                                                  testCases: item.testCases.map((t: any, i: number) =>
                                                    i === tcIdx ? { ...t, input: val } : t,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        );
                                      }}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 text-[11px] bg-white font-mono"
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <input
                                      type="text"
                                      placeholder="Expected (e.g. 5)"
                                      value={tc.expectedOutput}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setFormQuestions((prev) =>
                                          prev.map((item, idx) =>
                                            idx === qIdx
                                              ? {
                                                  ...item,
                                                  testCases: item.testCases.map((t: any, i: number) =>
                                                    i === tcIdx ? { ...t, expectedOutput: val } : t,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        );
                                      }}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 text-[11px] bg-white font-mono"
                                    />
                                  </div>
                                  <div className="col-span-3 flex items-center justify-between gap-1">
                                    <label className="flex items-center gap-1 text-[10px] text-amber-800 font-semibold cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!tc.isHidden}
                                        onChange={(e) => {
                                          const val = e.target.checked;
                                          setFormQuestions((prev) =>
                                            prev.map((item, idx) =>
                                              idx === qIdx
                                                ? {
                                                    ...item,
                                                    testCases: item.testCases.map((t: any, i: number) =>
                                                      i === tcIdx ? { ...t, isHidden: val } : t,
                                                    ),
                                                  }
                                                : item,
                                            ),
                                          );
                                        }}
                                      />
                                      <Lock className="h-3 w-3" /> ซ่อน
                                    </label>
                                    {q.testCases.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTestCase(qIdx, tcIdx)}
                                        className="p-1 rounded text-slate-400 hover:text-red-600 transition"
                                        title="ลบ Test Case นี้"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Multiple Choice Options for Theory */}
                        {formType === AssessmentType.THEORY && (
                          <div className="pt-2 border-t border-slate-200/60">
                            <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                              <span>ตัวเลือกคำตอบปรนัย (Multiple Choices)</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-normal">ติ๊กเลือกคำตอบที่ถูกต้อง</span>
                                {q.choices.length < 6 && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddChoice(qIdx)}
                                    className="text-indigo-600 text-[11px] font-bold hover:text-indigo-800 flex items-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" /> เพิ่มตัวเลือก
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              {q.choices.map((choice: any, cIdx: number) => (
                                <div key={cIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`company-correct-choice-${qIdx}`}
                                    checked={choice.isCorrect}
                                    onChange={() => {
                                      setFormQuestions((prev) =>
                                        prev.map((item, idx) =>
                                          idx === qIdx
                                            ? {
                                                ...item,
                                                choices: item.choices.map((c: any, i: number) => ({
                                                  ...c,
                                                  isCorrect: i === cIdx,
                                                })),
                                              }
                                            : item,
                                        ),
                                      );
                                    }}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    placeholder={`ตัวเลือกข้อที่ ${cIdx + 1}`}
                                    value={choice.text}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormQuestions((prev) =>
                                        prev.map((item, idx) =>
                                          idx === qIdx
                                            ? {
                                                ...item,
                                                choices: item.choices.map((c: any, i: number) =>
                                                  i === cIdx ? { ...c, text: val } : c,
                                                ),
                                              }
                                            : item,
                                        ),
                                      );
                                    }}
                                    className="flex-1 p-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                                  />
                                  {choice.isCorrect ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                                      เฉลยข้อนี้
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 shrink-0 w-14 text-center">
                                      ตัวเลือก
                                    </span>
                                  )}
                                  {q.choices.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveChoice(qIdx, cIdx)}
                                      className="p-1 rounded text-slate-400 hover:text-red-600 transition"
                                      title="ลบตัวเลือกนี้"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Explanation for Theory */}
                            <div className="mt-3 pt-2 border-t border-slate-200/60">
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                คำอธิบายเฉลย (Explanation) — อธิบายเหตุผลให้ผู้สมัครทราบหลังส่งข้อสอบ
                              </label>
                              <textarea
                                rows={2}
                                placeholder="อธิบายหลักการและเหตุผลที่ตัวเลือกนี้ถูกต้อง เพื่อให้ผู้สมัครได้เรียนรู้..."
                                value={q.explanation || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormQuestions((prev) =>
                                    prev.map((item, idx) => (idx === qIdx ? { ...item, explanation: val } : item)),
                                  );
                                }}
                                className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs shadow-indigo-500/20 transition disabled:opacity-50"
                  >
                    {saving ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'บันทึกแบบทดสอบของบริษัท')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Attempts List for Selected Assessment */}
        {showAttemptsModal && selectedAssessmentForAttempts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 sm:p-8 my-8 max-h-[85vh] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold text-slate-900">
                        รายชื่อผู้ส่งคำตอบแบบทดสอบ
                      </h2>
                      <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
                        {selectedAssessmentForAttempts.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ตรวจสอบโค้ดของผู้สมัคร ดูผลวิเคราะห์จาก AI และประเมินคะแนนขั้นสุดท้าย (Tech Lead Human Review)
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAttemptsModal(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    ✕
                  </button>
                </div>

                {loadingAttempts ? (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    <span className="text-xs">กำลังโหลดรายการผู้เข้าสอบ...</span>
                  </div>
                ) : attemptsList.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs">ยังไม่มีผู้สมัครส่งคำตอบสำหรับชุดแบบทดสอบนี้</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[50vh]">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0">
                        <tr>
                          <th className="py-3 px-4">ผู้สมัคร</th>
                          <th className="py-3 px-3">ส่งเมื่อ</th>
                          <th className="py-3 px-3 text-center">สถานะการตรวจ</th>
                          <th className="py-3 px-3 text-center">Anti-Cheat</th>
                          <th className="py-3 px-3 text-center">AI Prelim</th>
                          <th className="py-3 px-3 text-center">Final Score</th>
                          <th className="py-3 px-4 text-right">ดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attemptsList.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              <Link
                                href={`/company/applications?candidateId=${att.candidate?.id || att.candidateId}`}
                                className="group inline-flex items-center gap-1 hover:text-[#4f46e5] transition"
                                title="คลิกเพื่อดูโปรไฟล์และเรดาร์ทักษะของผู้สมัคร"
                              >
                                <span>{att.candidate?.fullName || 'ผู้สมัคร'}</span>
                                <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-[#4f46e5] opacity-0 group-hover:opacity-100 transition" />
                              </Link>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {att.candidate?.targetCareer || 'Developer'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                              {att.completedAt ? new Date(att.completedAt).toLocaleString('th-TH') : '-'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {att.reviewStatus === 'PENDING_HUMAN_REVIEW' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  รอ Tech Lead รีวิว
                                </span>
                              )}
                              {att.reviewStatus === 'HUMAN_REVIEWED' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ตรวจแล้ว (Reviewed)
                                </span>
                              )}
                              {att.reviewStatus === 'EVALUATION_PENDING' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  กำลังประมวลผล AI
                                </span>
                              )}
                              {(!att.reviewStatus || att.reviewStatus === 'NOT_REQUIRED') && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  อัตโนมัติ
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {(() => {
                                const summary = att.integritySummary;
                                const count = summary?.tabSwitchCount || 0;
                                const risk = summary?.riskLevel || 'NORMAL';
                                if (risk === 'HIGH_RISK') {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={`สลับหน้าจอ ${count} ครั้ง`}>
                                      🚨 สลับจอ {count} ครั้ง
                                    </span>
                                  );
                                }
                                if (risk === 'SUSPICIOUS') {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title={`สลับหน้าจอ ${count} ครั้ง`}>
                                      ⚠️ สลับจอ {count} ครั้ง
                                    </span>
                                  );
                                }
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    🛡️ ปกติ ({count})
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {att.aiScore !== null && att.aiScore !== undefined ? `${att.aiScore}%` : '-'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {att.finalScore !== null && att.finalScore !== undefined ? (
                                <span
                                  className={`font-bold ${
                                    att.finalScore >= (selectedAssessmentForAttempts?.passingScore || 70)
                                      ? 'text-emerald-600'
                                      : 'text-rose-600'
                                  }`}
                                >
                                  {att.finalScore}%
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">รอยืนยัน</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleInspectAttempt(att)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 ml-auto"
                              >
                                <Eye className="h-3 w-3" />
                                ตรวจโค้ด & รีวิว
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAttemptsModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  ปิดหน้าต่างนี้
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Single Attempt Tech Lead Review & Score Override */}
        {selectedAttemptForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      ตรวจโค้ด & รีวิวผลการสอบ (Tech Lead Audit)
                    </h2>
                    <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      {selectedAttemptForReview.candidate?.fullName || 'Candidate'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตรวจสอบโค้ดที่ส่งมา, ผลลัพธ์ Sandbox, รายงาน AI 4 มิติ และระบุคะแนนขั้นสุดท้ายพร้อมบันทึก Audit Trail
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAttemptForReview(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Score Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">AI Preliminary Score</span>
                    <strong className="text-base text-slate-800">
                      {selectedAttemptForReview.aiScore !== null ? `${selectedAttemptForReview.aiScore}%` : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Human Review Score</span>
                    <strong className="text-base text-purple-700">
                      {selectedAttemptForReview.humanScore !== null ? `${selectedAttemptForReview.humanScore}%` : 'ยังไม่ได้ระบุ'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">สถานะปัจจุบัน</span>
                    <span className="font-bold text-xs">
                      {selectedAttemptForReview.reviewStatus === 'HUMAN_REVIEWED' ? (
                        <span className="text-emerald-600">ตรวจแล้ว (Reviewed)</span>
                      ) : (
                        <span className="text-amber-600">รอ Tech Lead ยืนยัน</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">คะแนนขั้นสุดท้าย (Final)</span>
                    <strong className="text-base text-indigo-700">
                      {selectedAttemptForReview.finalScore !== null ? `${selectedAttemptForReview.finalScore}%` : 'Pending'}
                    </strong>
                  </div>
                </div>

                {/* Anti-Cheat & Integrity Events Audit Bar */}
                {(() => {
                  const summary = selectedAttemptForReview.integritySummary;
                  const count = summary?.tabSwitchCount || 0;
                  const risk = summary?.riskLevel || 'NORMAL';
                  return (
                    <div className={`p-4 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                      risk === 'HIGH_RISK'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : risk === 'SUSPICIOUS'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <ShieldAlert className={`h-5 w-5 shrink-0 ${
                          risk === 'HIGH_RISK' ? 'text-rose-600' : risk === 'SUSPICIOUS' ? 'text-amber-600' : 'text-emerald-600'
                        }`} />
                        <div>
                          <div className="font-extrabold text-xs">
                            การตรวจสอบความซื่อสัตย์ (Anti-Cheat Audit):{' '}
                            {risk === 'HIGH_RISK' ? '⚠️ มีความเสี่ยงสูง (High Risk)' : risk === 'SUSPICIOUS' ? '⚠️ ตรวจพบพฤติกรรมน่าสงสัย (Suspicious)' : '✅ พฤติกรรมปกติ (Normal)'}
                          </div>
                          <div className="text-[11px] opacity-80 mt-0.5">
                            ตรวจพบการสลับหน้าจอ/เบลอแท็บทั้งหมด <strong>{count} ครั้ง</strong> ระหว่างทำข้อสอบ
                          </div>
                        </div>
                      </div>

                      {count > 0 && (
                        <span className="text-[11px] px-3 py-1 rounded-xl bg-white font-mono font-bold border border-slate-200 shadow-2xs">
                          Blur Count: {count}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Candidate Submitted Source Code */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileCode className="h-4 w-4 text-indigo-600" /> โค้ดของผู้สมัคร (Candidate Source Code)
                    </span>
                  </div>
                  <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-64 leading-relaxed border border-slate-800">
                    {selectedAttemptForReview.sourceCode ||
                      selectedAttemptForReview.answers?.[0]?.submittedCode ||
                      '(ไม่มีโค้ดที่ส่งมา)'}
                  </pre>
                </div>

                {/* AI Evaluation Snapshot (4-dimension rubric) */}
                {selectedAttemptForReview.evaluationSnapshot && (
                  <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 flex items-center gap-1.5 text-xs">
                        <Sparkles className="h-4 w-4 text-purple-600" /> ผลการวิเคราะห์จาก AI (Rubric Breakdown)
                      </span>
                      {selectedAttemptForReview.evaluatorModel && (
                        <span className="text-[10px] text-purple-600 font-mono">
                          Model: {selectedAttemptForReview.evaluatorModel}
                        </span>
                      )}
                    </div>

                    {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 bg-white rounded-xl border border-purple-100 space-y-1">
                          <div className="flex justify-between font-bold text-purple-950">
                            <span>1. Functional Correctness (40%)</span>
                            <span className="text-purple-700">
                              {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.functionalCorrectness?.score}/100
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.functionalCorrectness?.feedback}
                          </p>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-purple-100 space-y-1">
                          <div className="flex justify-between font-bold text-purple-950">
                            <span>2. Code Quality & Clean Code (25%)</span>
                            <span className="text-purple-700">
                              {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.codeQuality?.score}/100
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.codeQuality?.feedback}
                          </p>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-purple-100 space-y-1">
                          <div className="flex justify-between font-bold text-purple-950">
                            <span>3. Algorithmic Efficiency (20%)</span>
                            <span className="text-purple-700">
                              {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.algorithmEfficiency?.score}/100
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.algorithmEfficiency?.feedback}
                          </p>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-purple-100 space-y-1">
                          <div className="flex justify-between font-bold text-purple-950">
                            <span>4. Error Handling & Edge Cases (15%)</span>
                            <span className="text-purple-700">
                              {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.errorHandlingEdgeCases?.score}/100
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            {selectedAttemptForReview.evaluationSnapshot.rubricBreakdown.errorHandlingEdgeCases?.feedback}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedAttemptForReview.evaluationSnapshot.summaryReview && (
                      <div className="pt-2 text-slate-700">
                        <strong className="block text-slate-800 text-[11px] mb-0.5">บทสรุปภาพรวมจาก AI:</strong>
                        <p className="text-[11px] leading-relaxed">
                          {selectedAttemptForReview.evaluationSnapshot.summaryReview}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tech Lead Override Form */}
                <form onSubmit={handleSubmitOverride} className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                    <Award className="h-4 w-4 text-indigo-600" />
                    <span>Tech Lead Human Review & Score Override (การให้คะแนนขั้นสุดท้าย)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        คะแนนที่ Tech Lead ประเมิน (0-100) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        required
                        value={overrideScore}
                        onChange={(e) => setOverrideScore(Number(e.target.value))}
                        className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        เหตุผลการประเมิน / ตรวจสอบ (Audit Trail) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ตรวจสอบโครงสร้างโค้ดและ Business logic ผ่านตามเกณฑ์..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {selectedAttemptForReview.reviewedAt && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      ประเมินครั้งล่าสุดเมื่อ: {new Date(selectedAttemptForReview.reviewedAt).toLocaleString('th-TH')} โดย{' '}
                      {selectedAttemptForReview.reviewedById}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={overriding}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
                    >
                      {overriding ? 'กำลังบันทึก...' : 'บันทึกคะแนน Tech Lead (Finalize Score)'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
