'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import {
  Users,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  Github,
  MessageSquare,
  ArrowRight,
  Star,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  X,
  Send,
  AlertCircle,
  Briefcase,
  Layers,
  Code2,
  Download,
} from 'lucide-react';
import { ApplicationStatus } from '@smartcareer/shared';

const STATUS_OPTIONS: { value: ApplicationStatus; label: string; labelTh: string; color: string }[] = [
  { value: ApplicationStatus.APPLIED, label: 'Applied', labelTh: 'สมัครเข้ามาใหม่', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: ApplicationStatus.REVIEWING, label: 'Reviewing', labelTh: 'กำลังคัดกรอง', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: ApplicationStatus.INTERVIEW, label: 'Interview', labelTh: 'นัดสัมภาษณ์', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: ApplicationStatus.TECHNICAL_TEST, label: 'Tech Test', labelTh: 'ทดสอบทักษะ', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: ApplicationStatus.OFFER, label: 'Offer', labelTh: 'ยื่นข้อเสนองาน', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: ApplicationStatus.ACCEPTED, label: 'Accepted', labelTh: 'รับเข้าทำงานแล้ว', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: ApplicationStatus.REJECTED, label: 'Rejected', labelTh: 'ปฏิเสธ', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

export default function CompanyApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppForEval, setSelectedAppForEval] = useState<any | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Evaluation form state
  const [technicalScore, setTechnicalScore] = useState(4);
  const [problemSolvingScore, setProblemSolvingScore] = useState(4);
  const [communicationScore, setCommunicationScore] = useState(4);
  const [teamworkScore, setTeamworkScore] = useState(4);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalToast, setEvalToast] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/company/applications');
      setApplications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    try {
      await apiRequest(`/company/applications/${appId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchApps();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('smartcareer_token') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/company/applications/export`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartcareer_applicants_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export CSV ล้มเหลว: ${err.message}`);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleOpenEvaluation = (app: any) => {
    setSelectedAppForEval(app);
    if (app.evaluation) {
      setTechnicalScore(app.evaluation.technicalScore || 4);
      setProblemSolvingScore(app.evaluation.problemSolvingScore || 4);
      setCommunicationScore(app.evaluation.communicationScore || 4);
      setTeamworkScore(app.evaluation.teamworkScore || 4);
      setOverallFeedback(app.evaluation.overallFeedback || '');
    } else {
      setTechnicalScore(4);
      setProblemSolvingScore(4);
      setCommunicationScore(4);
      setTeamworkScore(4);
      setOverallFeedback('');
    }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForEval) return;
    setEvalSubmitting(true);
    try {
      await apiRequest(`/evaluations/${selectedAppForEval.id}`, {
        method: 'POST',
        body: JSON.stringify({
          technicalScore,
          problemSolvingScore,
          communicationScore,
          teamworkScore,
          overallFeedback,
          strengths: ['Technical competency', 'Communication'],
          areasForImprovement: ['System scalability'],
        }),
      });
      setSelectedAppForEval(null);
      setEvalToast('บันทึกผลการประเมินเรียบร้อยแล้ว (Evaluation saved successfully)');
      setTimeout(() => setEvalToast(null), 4000);
      fetchApps();
    } catch (err: any) {
      alert(`Evaluation failed: ${err.message}`);
    } finally {
      setEvalSubmitting(false);
    }
  };

  // Filtered applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchSearch =
        searchQuery === '' ||
        app.candidate?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.job?.title?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || app.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [applications, searchQuery, statusFilter]);

  // Counts
  const counts = useMemo(() => {
    const total = applications.length;
    const reviewing = applications.filter((a) => a.status === ApplicationStatus.REVIEWING).length;
    const interview = applications.filter((a) => a.status === ApplicationStatus.INTERVIEW).length;
    const offers = applications.filter((a) => a.status === ApplicationStatus.OFFER || a.status === ApplicationStatus.ACCEPTED).length;
    return { total, reviewing, interview, offers };
  }, [applications]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Toast Alert */}
        {evalToast && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{evalToast}</span>
            </div>
            <button onClick={() => setEvalToast(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff] shadow-xs mb-3">
            <Users className="h-3.5 w-3.5" />
            <span>กระบวนการสรรหาและคัดเลือก · Applicant Pipeline</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                ผู้สมัครงาน & ไพป์ไลน์การคัดเลือก
              </h1>
              <p className="text-slate-600 text-sm mt-1 max-w-2xl">
                ตรวจสอบความพร้อมของผู้สมัครด้วยคะแนน 70/20/10 AI Matching, ทักษะที่ยืนยันแล้ว, เลื่อนสถานะกระบวนการ และให้คะแนนประเมินรายบุคคล
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                id="export-csv-btn"
                onClick={handleExportCsv}
                disabled={exportingCsv}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#4f46e5]" />
                <span>{exportingCsv ? 'กำลังเตรียมไฟล์...' : 'Export CSV (ส่งออกข้อมูลผู้สมัคร)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">ผู้สมัครทั้งหมด</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{counts.total} <span className="text-xs font-normal text-slate-400">คน</span></div>
          </div>
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">กำลังคัดกรอง</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{counts.reviewing} <span className="text-xs font-normal text-slate-400">คน</span></div>
          </div>
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">รอบสัมภาษณ์</span>
            <div className="text-2xl font-black text-purple-600 mt-1">{counts.interview} <span className="text-xs font-normal text-slate-400">คน</span></div>
          </div>
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">ได้ข้อเสนอ/รับเข้าทำงาน</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{counts.offers} <span className="text-xs font-normal text-slate-400">คน</span></div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white/90 border border-slate-200/90 rounded-[24px] p-4 mb-8 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้สมัคร หรือตำแหน่งงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-full border border-slate-200/80 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Status Capsule Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({applications.length})
            </button>
            {STATUS_OPTIONS.map((st) => {
              const countInStatus = applications.filter((a) => a.status === st.value).length;
              return (
                <button
                  key={st.value}
                  onClick={() => setStatusFilter(st.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    statusFilter === st.value
                      ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === st.value ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {countInStatus}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mb-3"></div>
            <p className="text-sm font-semibold text-slate-500">กำลังโหลดข้อมูลผู้สมัคร... (Loading pipeline)</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white/90 border border-slate-200/90 rounded-[28px] p-14 text-center max-w-lg mx-auto shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <div className="h-16 w-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">ไม่พบรายชื่อผู้สมัครในตัวกรองนี้</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              เมื่อมีผู้หางานยื่นใบสมัครเข้ามารับการคัดเลือก รายชื่อและผลประเมินจะปรากฏขึ้นที่กระดานนี้โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => {
              const currentStatusMeta = STATUS_OPTIONS.find((s) => s.value === app.status) || STATUS_OPTIONS[0];
              const score = app.matchScoreAtApplication || 0;
              const isHighMatch = score >= 80;
              const isMedMatch = score >= 60;

              return (
                <div
                  key={app.id}
                  className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm hover:shadow-[0_16px_40px_rgba(79,70,229,0.08)] hover:border-indigo-200/80 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          {app.candidate?.fullName || 'Candidate'}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                          <Briefcase className="h-3 w-3 text-slate-400" />
                          <span>{app.job?.title || 'Position'}</span>
                        </div>
                      </div>

                      {/* Match Score Badge */}
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1 ${
                          isHighMatch
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isMedMatch
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>{score}% Match</span>
                      </div>
                    </div>

                    {/* Cover Letter Quote */}
                    {app.coverLetter && (
                      <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/90 mb-4 text-xs text-slate-600 italic line-clamp-2 leading-relaxed">
                        &ldquo;{app.coverLetter}&rdquo;
                      </div>
                    )}

                    {/* Verified Competencies */}
                    <div className="mb-4">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                        ทักษะที่ผ่านการตรวจสอบ (Verified Skills)
                      </span>
                      {app.candidate?.skills && app.candidate.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {app.candidate.skills.slice(0, 4).map((cs: any) => (
                            <span
                              key={cs.id}
                              className="text-[11px] font-semibold bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
                            >
                              <span>{cs.skill?.name}</span>
                              <span className="text-[10px] font-bold text-[#4f46e5]/80 bg-white/70 px-1 rounded-md">
                                {cs.verifiedScore}%
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">ไม่มีข้อมูลทักษะที่บันทึกไว้</p>
                      )}
                    </div>

                    {/* Custom Technical Assessment Results if Job has Assessment */}
                    {app.job?.customAssessment && (
                      <div className="mb-5 p-3 rounded-2xl bg-[#f8f9fd] border border-indigo-100/90 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                            <Code2 className="h-3 w-3" /> Technical Test: {app.job.customAssessment.title}
                          </span>
                          <span className="text-[10px] text-slate-400">เกณฑ์ {app.job.customAssessment.passingScore}%</span>
                        </div>
                        {(() => {
                          const customAttempt = (app.candidate?.assessmentAttempts || []).find(
                            (att: any) => att.assessmentId === app.job.customAssessmentId,
                          );
                          if (!customAttempt) {
                            return (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-amber-500" />
                                <span>ยังไม่ได้เริ่มทำแบบทดสอบเฉพาะตำแหน่งนี้</span>
                              </div>
                            );
                          }
                          const isPassed = customAttempt.score >= (app.job.customAssessment.passingScore || 70);
                          return (
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">
                                คะแนนล่าสุด: <span className="font-extrabold text-[#4f46e5] text-sm">{customAttempt.score}%</span>
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isPassed
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {isPassed ? '✓ ผ่านเกณฑ์ (Passed)' : '✗ ยังไม่ผ่าน (Failed)'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Pipeline Stage Select */}
                    <div className="pt-3 border-t border-slate-100">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">
                        สถานะขั้นตอน (Stage)
                      </label>
                      <div className="relative">
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                          className="w-full appearance-none text-xs font-bold rounded-xl border border-slate-200/90 py-2.5 pl-3.5 pr-8 bg-slate-50/70 hover:bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label} — {opt.labelTh}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Evaluation Trigger Button */}
                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEvaluation(app)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold transition shadow-xs ${
                        app.evaluation
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-indigo-500/20'
                      }`}
                    >
                      {app.evaluation ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>ดู/แก้ไขผลประเมิน (Evaluation Done)</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>ให้คะแนนประเมิน (Evaluate Candidate)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Evaluation Modal */}
        {selectedAppForEval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[28px] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200/90 my-8 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                    Candidate Evaluation Form
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    ประเมิน: {selectedAppForEval.candidate?.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตำแหน่ง: {selectedAppForEval.job?.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAppForEval(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitEvaluation} className="space-y-5 pt-5">
                {/* Custom Assessment Performance if available */}
                {selectedAppForEval.job?.customAssessment && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-xs">
                    <span className="font-bold text-indigo-900 block mb-1 flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-indigo-600" />
                      ผลการทดสอบเฉพาะตำแหน่ง ({selectedAppForEval.job.customAssessment.title})
                    </span>
                    {(() => {
                      const customAttempt = (selectedAppForEval.candidate?.assessmentAttempts || []).find(
                        (att: any) => att.assessmentId === selectedAppForEval.job.customAssessmentId,
                      );
                      if (!customAttempt) {
                        return (
                          <span className="text-slate-500">ผู้สมัครยังไม่ได้ทำแบบทดสอบทักษะเฉพาะตำแหน่งนี้</span>
                        );
                      }
                      const isPassed = customAttempt.score >= (selectedAppForEval.job.customAssessment.passingScore || 70);
                      return (
                        <div className="flex items-center justify-between mt-1 text-slate-700">
                          <span>คะแนนสอบข้อสอบปฏิบัติล่าสุด: <strong className="text-indigo-700 text-sm">{customAttempt.score}%</strong> (เกณฑ์ {selectedAppForEval.job.customAssessment.passingScore}%)</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {isPassed ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 4 Competency Score Pickers */}
                <div className="space-y-4">
                  {/* Technical Competency */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <label className="font-bold text-slate-700">ความเชี่ยวชาญทางเทคนิค (Technical Score)</label>
                      <span className="font-extrabold text-indigo-600">{technicalScore}/5</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTechnicalScore(val)}
                          className={`py-2 text-xs font-bold rounded-xl transition ${
                            technicalScore === val
                              ? 'bg-[#6366f1] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Problem Solving */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <label className="font-bold text-slate-700">การแก้ปัญหาและตรรกะ (Problem Solving)</label>
                      <span className="font-extrabold text-indigo-600">{problemSolvingScore}/5</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setProblemSolvingScore(val)}
                          className={`py-2 text-xs font-bold rounded-xl transition ${
                            problemSolvingScore === val
                              ? 'bg-[#6366f1] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Communication */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <label className="font-bold text-slate-700">การสื่อสารและการอธิบาย (Communication)</label>
                      <span className="font-extrabold text-indigo-600">{communicationScore}/5</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCommunicationScore(val)}
                          className={`py-2 text-xs font-bold rounded-xl transition ${
                            communicationScore === val
                              ? 'bg-[#6366f1] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Teamwork */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <label className="font-bold text-slate-700">การทำงานร่วมกับผู้อื่น (Teamwork & Culture)</label>
                      <span className="font-extrabold text-indigo-600">{teamworkScore}/5</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTeamworkScore(val)}
                          className={`py-2 text-xs font-bold rounded-xl transition ${
                            teamworkScore === val
                              ? 'bg-[#6366f1] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Qualitative Feedback */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ข้อเสนอแนะเชิงสร้างสรรค์ (Qualitative Feedback)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={overallFeedback}
                    onChange={(e) => setOverallFeedback(e.target.value)}
                    placeholder="ระบุจุดแข็งและสิ่งที่สามารถพัฒนาเพิ่มเติมได้ โดยข้อมูลนี้จะถูกนำไปใช้วิเคราะห์ช่องว่างทักษะ (Skill Gap) ของผู้สมัคร..."
                    className="w-full rounded-2xl border border-slate-200/90 p-3.5 text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition leading-relaxed"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAppForEval(null)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-full transition"
                  >
                    ยกเลิก (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={evalSubmitting}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] rounded-full shadow-xs shadow-indigo-500/20 transition disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {evalSubmitting ? (
                      'กำลังบันทึก...'
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>บันทึกผลการประเมิน (Submit)</span>
                      </>
                    )}
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

