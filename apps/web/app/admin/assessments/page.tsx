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
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Search,
  Building2,
  ShieldCheck,
  RefreshCw,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  AssessmentType,
  QuestionDifficulty,
  QuestionEvaluationMethod,
  FeedbackVisibility,
} from '@smartcareer/shared';

export default function AdminAssessmentsPage() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<AssessmentType>(AssessmentType.THEORY);
  const [formSkillId, setFormSkillId] = useState('');
  const [formTimeLimit, setFormTimeLimit] = useState(30);
  const [formPassingScore, setFormPassingScore] = useState(70);
  const [formFeedbackVisibility, setFormFeedbackVisibility] = useState<FeedbackVisibility>(FeedbackVisibility.IMMEDIATE);
  const [formQuestions, setFormQuestions] = useState<any[]>([
    {
      title: 'คำถามข้อที่ 1',
      prompt: '',
      difficulty: QuestionDifficulty.MEDIUM,
      points: 10,
      starterCode: '',
      evaluationMethod: QuestionEvaluationMethod.AUTOMATED_TEST_CASES,
      testCases: [{ input: '', expectedOutput: '', isHidden: false }],
      choices: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ],
    },
  ]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      apiRequest('/admin/assessments'),
      apiRequest('/admin/skills'),
    ])
      .then(([assessData, skillsData]) => {
        setAssessments(assessData || []);
        setSkills(skillsData || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await apiRequest(`/admin/assessments/${id}/toggle`, { method: 'PATCH' });
      loadData();
    } catch (e: any) {
      alert(`Toggle error: ${e.message}`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณต้องการลบหรือปิดการใช้งานแบบทดสอบ "${title}" ใช่หรือไม่?`)) return;
    try {
      await apiRequest(`/admin/assessments/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDescription('');
    setFormType(AssessmentType.THEORY);
    setFormSkillId(skills[0]?.id || '');
    setFormTimeLimit(30);
    setFormPassingScore(70);
    setFormFeedbackVisibility(FeedbackVisibility.IMMEDIATE);
    setFormQuestions([
      {
        title: 'คำถามข้อที่ 1',
        prompt: '',
        difficulty: QuestionDifficulty.MEDIUM,
        points: 25,
        starterCode: '// Write your solution here\nfunction solution() {\n  return 0;\n}',
        evaluationMethod: QuestionEvaluationMethod.AUTOMATED_TEST_CASES,
        testCases: [
          { input: '2, 3', expectedOutput: '5', isHidden: false },
          { input: '10, 20', expectedOutput: '30', isHidden: true },
        ],
        choices: [
          { text: 'ตัวเลือก A', isCorrect: true },
          { text: 'ตัวเลือก B', isCorrect: false },
          { text: 'ตัวเลือก C', isCorrect: false },
          { text: 'ตัวเลือก D', isCorrect: false },
        ],
      },
    ]);
    setShowModal(true);
  };

  const handleAddQuestion = () => {
    setFormQuestions((prev) => [
      ...prev,
      {
        title: `คำถามข้อที่ ${prev.length + 1}`,
        prompt: '',
        difficulty: QuestionDifficulty.MEDIUM,
        points: formType === AssessmentType.PRACTICAL_CODING ? 50 : 25,
        starterCode: '// Write your solution here\nfunction solution() {\n  return 0;\n}',
        evaluationMethod: QuestionEvaluationMethod.AUTOMATED_TEST_CASES,
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

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('กรุณาระบุชื่อชุดแบบทดสอบ');
      return;
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
        questions: formQuestions,
      };

      if (editingId) {
        await apiRequest(`/admin/assessments/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/admin/assessments', {
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

  const filtered = assessments.filter((a) => {
    const matchType = filterType === 'ALL' || a.type === filterType;
    const matchSearch =
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.skill?.name?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 py-8 px-4 sm:px-8 max-w-[1360px] mx-auto w-full">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  ระบบบริหารจัดการแบบทดสอบ (Admin Assessments)
                </h1>
                <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  Admin Panel
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                จัดการชุดแบบทดสอบส่วนกลางของแพลตฟอร์ม กำหนดเกณฑ์ผ่าน โจทย์ และ Test Cases สำหรับ Judge0
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 shadow-xs shadow-indigo-500/20 transition"
            >
              <Plus className="h-4 w-4" /> สร้างแบบทดสอบใหม่
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({assessments.length})
            </button>
            <button
              onClick={() => setFilterType(AssessmentType.THEORY)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === AssessmentType.THEORY
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Theory ({assessments.filter((a) => a.type === AssessmentType.THEORY).length})
            </button>
            <button
              onClick={() => setFilterType(AssessmentType.PRACTICAL_CODING)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === AssessmentType.PRACTICAL_CODING
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Coding Sandbox ({assessments.filter((a) => a.type === AssessmentType.PRACTICAL_CODING).length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อแบบทดสอบ หรือทักษะ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        {/* Assessments Table */}
        {loading ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-slate-500">กำลังโหลดรายการแบบทดสอบ...</span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">ชื่อแบบทดสอบ</th>
                    <th className="py-3.5 px-3">ประเภท</th>
                    <th className="py-3.5 px-3">ทักษะที่เกี่ยวข้อง</th>
                    <th className="py-3.5 px-3">สังกัด</th>
                    <th className="py-3.5 px-3">จำนวนข้อ</th>
                    <th className="py-3.5 px-3">เกณฑ์ / เวลา</th>
                    <th className="py-3.5 px-3">ผู้เข้าสอบ</th>
                    <th className="py-3.5 px-3 text-center">สถานะ</th>
                    <th className="py-3.5 px-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        ไม่พบแบบทดสอบที่ตรงกับเงื่อนไข
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div>{a.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono">v{a.version || 1} · {a.slug}</div>
                        </td>
                        <td className="py-3.5 px-3">
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
                            {a.type === AssessmentType.PRACTICAL_CODING ? 'Sandbox' : 'Theory'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-medium">
                          {a.skill?.name || '-'}
                        </td>
                        <td className="py-3.5 px-3">
                          {a.company ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {a.company.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" /> แพลตฟอร์มกลาง
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-medium">
                          {a._count?.questions || 0} ข้อ
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          <div>{a.passingScore}%</div>
                          <div className="text-[10px] text-slate-400">{a.timeLimitMinutes} นาที</div>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-slate-800">
                          {a._count?.attempts || 0} ครั้ง
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => handleToggle(a.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                              a.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {a.isActive ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" /> เปิดใช้งาน
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 text-slate-400" /> ปิดใช้งาน
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleDelete(a.id, a.title)}
                            className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                            title="ลบ / ปิดการใช้งาน"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Create Assessment */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    สร้างแบบทดสอบใหม่ (New Assessment)
                  </h2>
                  <p className="text-xs text-slate-500">
                    กำหนดค่าเกณฑ์การวัดระดับและเพิ่มโจทย์คำถามพร้อม Test Cases
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
                      placeholder="เช่น TypeScript Core & Advanced Patterns"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ประเภทแบบทดสอบ *
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AssessmentType)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value={AssessmentType.THEORY}>Theory Assessment (ปรนัย Multiple Choice)</option>
                      <option value={AssessmentType.PRACTICAL_CODING}>Practical Coding (Judge0 Sandbox)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">คำอธิบายรายละเอียด</label>
                  <textarea
                    rows={2}
                    placeholder="อธิบายเนื้อหาและขอบเขตการวัดผล..."
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
                      <option value="">-- ไม่ระบุ (ข้อสอบทั่วไป) --</option>
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">เวลาทำข้อสอบ (นาที)</label>
                    <input
                      type="number"
                      min={5}
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
                    <option value={FeedbackVisibility.AFTER_REVIEW}>หลังตรวจเสร็จ (Candidate จะเห็นผลหลังตรวจประเมิน)</option>
                    <option value={FeedbackVisibility.PRIVATE_TO_COMPANY}>ภายในเท่านั้น (Candidate ไม่เห็นคะแนน)</option>
                  </select>
                </div>

                {/* Question Builder */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span>ข้อคำถามและโจทย์ ({formQuestions.length} ข้อ)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> เพิ่มข้อสอบ
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-600">ข้อที่ {qIdx + 1}</span>
                          {formQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(qIdx)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              ลบข้อนี้
                            </button>
                          )}
                        </div>

                        {/* Mode Selector for Practical Coding */}
                        {formType === AssessmentType.PRACTICAL_CODING && (
                          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                            <span className="text-[11px] font-bold text-slate-600">วิธีประเมิน:</span>
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
                                (q.evaluationMethod || QuestionEvaluationMethod.AUTOMATED_TEST_CASES) ===
                                QuestionEvaluationMethod.AUTOMATED_TEST_CASES
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Test Cases (Judge0)
                            </button>
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
                                q.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Sparkles className="h-3 w-3" />
                              โจทย์อิสระ (AI Rubric 4 มิติ)
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              placeholder="หัวข้อคำถาม..."
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
                            <input
                              type="number"
                              placeholder="คะแนน (Points)"
                              value={q.points}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setFormQuestions((prev) =>
                                  prev.map((item, idx) => (idx === qIdx ? { ...item, points: val } : item)),
                                );
                              }}
                              className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
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

                        {/* Open-Ended Rubric Explainer */}
                        {formType === AssessmentType.PRACTICAL_CODING &&
                          q.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED && (
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

                        {/* Test Cases for Coding (When AUTOMATED_TEST_CASES) */}
                        {formType === AssessmentType.PRACTICAL_CODING &&
                          (q.evaluationMethod || QuestionEvaluationMethod.AUTOMATED_TEST_CASES) ===
                            QuestionEvaluationMethod.AUTOMATED_TEST_CASES && (
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
                                className="text-indigo-600 text-[10px] font-bold"
                              >
                                + เพิ่ม Test Case
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
                                  <div className="col-span-3 flex items-center gap-1.5">
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
                                      <Lock className="h-3 w-3" /> ซ่อน (Hidden)
                                    </label>
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
                              <span className="text-[10px] text-slate-400 font-normal">ติ๊กเลือกคำตอบที่ถูกต้อง</span>
                            </div>
                            <div className="space-y-2">
                              {q.choices.map((choice: any, cIdx: number) => (
                                <div key={cIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct-choice-${qIdx}`}
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
                                  {choice.isCorrect && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      เฉลยข้อนี้
                                    </span>
                                  )}
                                </div>
                              ))}
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
                    {saving ? 'กำลังบันทึก...' : 'บันทึกแบบทดสอบ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
