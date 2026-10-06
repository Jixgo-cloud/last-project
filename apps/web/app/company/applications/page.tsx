'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  Github,
  MessageSquare,
  Star,
  Search,
  ChevronDown,
  X,
  Send,
  Briefcase,
  Code2,
  Download,
  ExternalLink,
  Eye,
  UserCheck,
  GraduationCap,
  ShieldAlert,
  GitBranch,
  Mail,
  Calendar,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { ApplicationStatus, getAttemptPercentage, formatAttemptScore } from '@smartcareer/shared';
import { useLanguage } from '@/lib/use-language';
import { applicationStatusLabel } from '@/lib/application-status';

const STATUS_OPTIONS: { value: ApplicationStatus; label: string; labelTh: string; color: string }[] = [
  { value: ApplicationStatus.APPLIED, label: 'Applied', labelTh: 'สมัครเข้ามาใหม่', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: ApplicationStatus.REVIEWING, label: 'Reviewing', labelTh: 'กำลังคัดกรอง', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: ApplicationStatus.INTERVIEW, label: 'Interview', labelTh: 'นัดสัมภาษณ์', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: ApplicationStatus.TECHNICAL_TEST, label: 'Tech Test', labelTh: 'ทดสอบทักษะ', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: ApplicationStatus.OFFER, label: 'Offer', labelTh: 'ยื่นข้อเสนองาน', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: ApplicationStatus.ACCEPTED, label: 'Accepted', labelTh: 'รับเข้าทำงานแล้ว', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: ApplicationStatus.REJECTED, label: 'Rejected', labelTh: 'ปฏิเสธ', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

function CompanyApplicationsContent() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const jobQuery = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  const [loadError, setLoadError] = useState('');
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppForEval, setSelectedAppForEval] = useState<any | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Candidate Profile Dossier Modal states
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'overview' | 'skills' | 'github' | 'assessments' | 'experience'>('overview');

  // Evaluation form state
  const [technicalScore, setTechnicalScore] = useState(4);
  const [problemSolvingScore, setProblemSolvingScore] = useState(4);
  const [communicationScore, setCommunicationScore] = useState(4);
  const [teamworkScore, setTeamworkScore] = useState(4);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalToast, setEvalToast] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState('');
  const [csvRetryJobQuery, setCsvRetryJobQuery] = useState<string | null>(null);

  useEffect(() => {
    setExportError('');
    setCsvRetryJobQuery(null);
  }, [jobQuery]);

  // Assessment assignment state
  const [companyAssessments, setCompanyAssessments] = useState<any[]>([]);
  const [selectedAppForAssign, setSelectedAppForAssign] = useState<any | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [assignNote, setAssignNote] = useState<string>('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignToast, setAssignToast] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    try {
      setLoading(true);
      const [appsData, assessData] = await Promise.all([
        apiRequest(`/company/applications${jobQuery}`),
        apiRequest('/company/assessments').catch(() => []),
      ]);
      setApplications(appsData || []);
      setCompanyAssessments((assessData || []).filter((assessment: any) => assessment.isActive && assessment.isReady));
      setLoadError('');
    } catch (e: any) {
      setApplications([]);
      setLoadError(e.message || 'โหลดรายการไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }, [jobQuery]);

  const handleOpenAssignAssessment = (app: any) => {
    setSelectedAppForAssign(app);
    const existingId = app.assignedAssessmentId || app.job?.customAssessmentId;
    setSelectedAssessmentId(existingId || (companyAssessments[0]?.id || ''));
    setAssignNote('');
  };

  const handleSubmitAssignAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForAssign || !selectedAssessmentId) {
      alert('กรุณาเลือกแบบทดสอบที่ต้องการมอบหมาย');
      return;
    }
    setAssignSubmitting(true);
    try {
      await apiRequest(`/company/applications/${selectedAppForAssign.id}/assign-assessment`, {
        method: 'POST',
        body: JSON.stringify({
          assessmentId: selectedAssessmentId,
          note: assignNote || undefined,
        }),
      });
      setSelectedAppForAssign(null);
      setAssignToast('มอบหมายแบบทดสอบให้ผู้สมัครเรียบร้อยแล้ว พร้อมส่งการแจ้งเตือนไปยังผู้สมัคร');
      setTimeout(() => setAssignToast(null), 4000);
      fetchApps();
    } catch (err: any) {
      alert(`มอบหมายแบบทดสอบไม่สำเร็จ: ${err.message}`);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleOpenProfile = useCallback(async (candidateId: string, applicationId?: string) => {
    if (!candidateId) return;
    setSelectedCandidateId(candidateId);
    setCandidateProfile(null);
    setLoadingProfile(true);
    setProfileTab('overview');
    try {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
      const data = await apiRequest(`/company/candidates/${candidateId}${query}`);
      setCandidateProfile(data);
    } catch (err: any) {
      alert(`ไม่สามารถดึงข้อมูลโปรไฟล์ผู้สมัครได้: ${err.message}`);
      setSelectedCandidateId(null);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const handleCloseProfile = () => {
    setSelectedCandidateId(null);
    setCandidateProfile(null);
  };

  const handleOpenEvalFromProfile = () => {
    const currentApp = applications.find((a) => a.id === candidateProfile?.application?.id) || candidateProfile?.application;
    if (currentApp) {
      handleCloseProfile();
      handleOpenEvaluation(currentApp);
    }
  };

  const handleStatusChangeFromProfile = async (newStatus: ApplicationStatus) => {
    const appId = candidateProfile?.application?.id;
    if (!appId) return;
    if (!(await handleStatusChange(appId, newStatus))) return;
    setCandidateProfile((prev: any) =>
      prev?.application?.id === appId
        ? {
            ...prev,
            application: prev.application ? { ...prev.application, status: newStatus } : undefined,
          }
        : prev,
    );
  };

  useEffect(() => {
    fetchApps();
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const candidateIdParam = urlParams.get('candidateId');
      if (candidateIdParam) {
        handleOpenProfile(candidateIdParam);
      }
    }
  }, [fetchApps, handleOpenProfile]);

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    const targetApp = applications.find((a) => a.id === appId);
    if (
      newStatus === ApplicationStatus.TECHNICAL_TEST &&
      targetApp &&
      !targetApp.assignedAssessment &&
      !targetApp.job?.customAssessment
    ) {
      handleOpenAssignAssessment(targetApp);
      return false;
    }
    try {
      await apiRequest(`/company/applications/${appId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchApps();
      return true;
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
      return false;
    }
  };

  const handleExportCsv = async () => {
    if (exportingCsv) return;
    try {
      setExportingCsv(true);
      setExportError('');
      setCsvRetryJobQuery(null);
      const res = await fetch(`/api/company/applications/export${jobQuery}`, { credentials: 'same-origin', cache: 'no-store' });

      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }

      const blob = await res.blob();
      setCsvRetryJobQuery(jobQuery);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartcareer_applicants_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch (err: any) {
      setExportError(`ส่งออก CSV ไม่สำเร็จ: ${err.message} กรุณากด Export CSV เพื่อลองใหม่`);
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

      {loadError && <p role="alert" className="mx-auto mt-4 text-red-700">{loadError}</p>}
      {jobId && <div className="mx-auto mt-4 px-4"><span>กำลังแสดงผู้สมัครเฉพาะงานที่เลือก</span> · <Link href="/company/applications" className="text-indigo-700 underline">ดูผู้สมัครทุกงาน</Link></div>}
      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Toast Alert */}
        {assignToast && (
          <div className="mb-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600 shrink-0" />
              <span>{assignToast}</span>
            </div>
            <button onClick={() => setAssignToast(null)} className="text-indigo-600 hover:text-indigo-800 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
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
              <p className="text-xs text-slate-500 mt-2 max-w-2xl">{language === 'EN'
                ? 'Job match measures skills and career fit. Assessment scores come from test answers. Hiring decisions are a separate stage.'
                : 'ความเหมาะสมประเมินจากทักษะและสายงาน ส่วนคะแนนสอบมาจากคำตอบ การรับเข้าทำงานเป็นผลคัดเลือกอีกขั้นหนึ่ง'}</p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <button
                id="export-csv-btn"
                onClick={handleExportCsv}
                disabled={exportingCsv}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#4f46e5]" />
                <span>{exportingCsv ? 'กำลังเตรียมไฟล์...' : 'Export CSV (ส่งออกข้อมูลผู้สมัคร)'}</span>
              </button>
              {csvRetryJobQuery === jobQuery && (
                <a
                  href={`/api/company/applications/export${jobQuery}`}
                  download
                  className="text-sm font-semibold text-indigo-700 underline"
                >
                  ไฟล์ไม่เริ่มดาวน์โหลด? ดาวน์โหลด CSV อีกครั้ง
                </a>
              )}
              {exportError && (
                <p role="alert" className="max-w-sm text-sm text-rose-700">{exportError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">ใบสมัครทั้งหมด</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{counts.total} <span className="text-xs font-normal text-slate-400">รายการ</span></div>
          </div>
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">กำลังคัดกรอง</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{counts.reviewing} <span className="text-xs font-normal text-slate-400">รายการ</span></div>
          </div>
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">รอบสัมภาษณ์</span>
            <div className="text-2xl font-black text-purple-600 mt-1">{counts.interview} <span className="text-xs font-normal text-slate-400">รายการ</span></div>
          </div>
          <div className="bg-white/90 border border-slate-200/90 rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">ได้ข้อเสนอ/รับเข้าทำงาน</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{counts.offers} <span className="text-xs font-normal text-slate-400">รายการ</span></div>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-4">ตัวเลขนับใบสมัครแต่ละรอบ รวมใบสมัครที่ยกเลิกแล้ว ผู้สมัครคนเดียวอาจมีหลายรายการ</p>

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
                  <span>{applicationStatusLabel(st.value, language)}</span>
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
              const score = app.matchScoreAtApplication || 0;
              const isHighMatch = score >= 80;
              const isMedMatch = score >= 60;

              return (
                <div
                  key={app.id}
                  className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm hover:shadow-[0_16px_40px_rgba(79,70,229,0.08)] hover:border-indigo-200/80 transition-all flex flex-col justify-between"
                >
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">รอบที่ {app.roundNumber || 1}</p>
                    {/* Top Header with Clickable Profile Link */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(app.candidate?.id || app.candidateId, app.id)}
                          className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-[#6366f1] via-[#4f46e5] to-[#3730a3] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs hover:ring-2 hover:ring-indigo-400 hover:scale-105 transition cursor-pointer overflow-hidden group"
                          title="คลิกเพื่อดูโปรไฟล์ผู้สมัครแบบเต็ม"
                        >
                          {app.candidate?.avatarUrl ? (
                            <Image src={app.candidate.avatarUrl} alt={app.candidate?.fullName || 'รูปโปรไฟล์ผู้สมัคร'} width={44} height={44} unoptimized className="h-full w-full object-cover" />
                          ) : (
                            <span>{(app.candidate?.fullName || 'C').charAt(0).toUpperCase()}</span>
                          )}
                        </button>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(app.candidate?.id || app.candidateId, app.id)}
                            className="text-base font-black text-slate-900 hover:text-[#4f46e5] transition flex items-center gap-1.5 text-left group cursor-pointer"
                            title="คลิกดูโปรไฟล์ผู้สมัครและเรดาร์ทักษะ"
                          >
                            <span>{app.candidate?.fullName || 'Candidate'}</span>
                            <Eye className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#4f46e5] opacity-60 group-hover:opacity-100 transition shrink-0" />
                          </button>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                            <Briefcase className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{app.job?.title || 'Position'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Match Score Badge */}
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1 shrink-0 ${
                          isHighMatch
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isMedMatch
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>{score}% {language === 'EN' ? 'Job match' : 'ความเหมาะสม'}</span>
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

                    {/* Custom Technical Assessment Results (Assigned or Job Default) */}
                    {(() => {
                      const effectiveAssessment = app.assignedAssessment || app.job?.customAssessment;
                      if (!effectiveAssessment) return null;

                      const targetAssessmentId = app.assignedAssessmentId || app.job?.customAssessmentId;
                      const customAttempt = (app.candidate?.assessmentAttempts || []).find(
                        (att: any) => att.assessmentId === targetAssessmentId
                      );

                      return (
                        <div className="mb-5 p-3.5 rounded-2xl bg-[#f8f9fd] border border-indigo-100/90 shadow-2xs">
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                <Code2 className="h-3 w-3" /> Technical Test: {effectiveAssessment.title}
                              </span>
                              {app.assignedAssessment ? (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                                  Custom Assigned
                                </span>
                              ) : (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  Job Default
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">เกณฑ์ {effectiveAssessment.passingScore}%</span>
                          </div>
                          {(() => {
                            if (!customAttempt) {
                              return (
                                <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2 pt-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-amber-500" />
                                    <span>ยังไม่ได้เริ่มทำแบบทดสอบนี้</span>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={app.status === ApplicationStatus.CANCELLED}
                                    onClick={() => handleOpenAssignAssessment(app)}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                  >
                                    เปลี่ยนข้อสอบ
                                  </button>
                                </div>
                              );
                            }
                            const isPassed = (getAttemptPercentage(customAttempt) ?? -1) >= (effectiveAssessment.passingScore || 70);
                            return (
                              <div className="flex items-center justify-between text-xs pt-0.5">
                                <span className="font-semibold text-slate-800">
                                  คะแนนล่าสุด: <span className="font-extrabold text-[#4f46e5] text-sm">{formatAttemptScore(customAttempt)}</span>
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isPassed
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {getAttemptPercentage(customAttempt) === null ? 'รอตรวจ' : isPassed ? '✓ ผ่านเกณฑ์ (Passed)' : '✗ ยังไม่ผ่าน (Failed)'}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Pipeline Stage Select */}
                    <div className="pt-3 border-t border-slate-100">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">
                        สถานะขั้นตอน (Stage)
                      </label>
                      <div className="relative">
                        <select
                          value={app.status}
                          disabled={app.status === ApplicationStatus.CANCELLED}
                          onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                          className="w-full appearance-none text-xs font-bold rounded-xl border border-slate-200/90 py-2.5 pl-3.5 pr-8 bg-slate-50/70 hover:bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                        >
                          {app.status === ApplicationStatus.CANCELLED && <option value={ApplicationStatus.CANCELLED}>{applicationStatusLabel(ApplicationStatus.CANCELLED, language)}</option>}
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {applicationStatusLabel(opt.value, language)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: View Profile + Assign Test + Evaluation */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenProfile(app.candidate?.id || app.candidateId, app.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold border border-slate-200/90 bg-slate-50/70 hover:bg-indigo-50/80 hover:border-indigo-200 hover:text-[#4f46e5] text-slate-700 transition shadow-2xs cursor-pointer group"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-[#4f46e5] group-hover:scale-110 transition" />
                      <span>ดูโปรไฟล์</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAssignAssessment(app)}
                      disabled={app.status === ApplicationStatus.CANCELLED}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold border border-indigo-200/90 bg-indigo-50/50 hover:bg-indigo-100/80 hover:border-indigo-300 text-indigo-700 transition shadow-2xs cursor-pointer group"
                      title="มอบหมายหรือเปลี่ยนแบบทดสอบเฉพาะบุคคล"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#6366f1] group-hover:scale-110 transition" />
                      <span>{app.assignedAssessment ? 'เปลี่ยนข้อสอบ' : 'มอบหมายข้อสอบ'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEvaluation(app)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition shadow-2xs cursor-pointer ${
                        app.evaluation
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-indigo-500/20'
                      }`}
                    >
                      {app.evaluation ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>ผลประเมิน</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>ประเมิน</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Assign Assessment Modal */}
        {selectedAppForAssign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[28px] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200/90 my-8 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                    Skill Assessment Assignment
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    มอบหมายแบบทดสอบ: {selectedAppForAssign.candidate?.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตำแหน่งงาน: <strong className="text-slate-700">{selectedAppForAssign.job?.title}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAppForAssign(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitAssignAssessment} className="mt-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    เลือกแบบทดสอบจากคลังข้อสอบของบริษัท <span className="text-rose-500">*</span>
                  </label>
                  {companyAssessments.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      <p className="font-bold mb-1">ยังไม่มีแบบทดสอบในคลังข้อสอบของบริษัท</p>
                      <p className="text-[11px] mb-3 leading-relaxed">
                        คุณสามารถสร้างแบบทดสอบทักษะ Coding Sandbox หรือ Theory Quiz ได้ที่หน้าจัดการข้อสอบ
                      </p>
                      <Link
                        href="/company/assessments"
                        className="inline-flex items-center gap-1.5 font-bold text-[#6366f1] underline hover:text-indigo-800"
                      >
                        ไปที่หน้าจัดการข้อสอบ (Create Assessment) →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={selectedAssessmentId}
                        onChange={(e) => setSelectedAssessmentId(e.target.value)}
                        required
                        className="w-full text-xs font-semibold rounded-xl border border-slate-200 py-3 px-3.5 bg-slate-50 hover:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                      >
                        <option value="">-- กรุณาเลือกแบบทดสอบ --</option>
                        {companyAssessments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title} ({a.type === 'PRACTICAL_CODING' ? 'Coding Sandbox' : 'Theory'}, {a.timeLimitMinutes} นาที, เกณฑ์ {a.passingScore}%)
                          </option>
                        ))}
                      </select>

                      {/* Selected assessment preview card */}
                      {(() => {
                        const preview = companyAssessments.find((a) => a.id === selectedAssessmentId);
                        if (!preview) return null;
                        return (
                          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-700 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-900">{preview.title}</span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                                {preview.type === 'PRACTICAL_CODING' ? '💻 Coding Sandbox' : '📝 Theory Quiz'}
                              </span>
                            </div>
                            {preview.description && <p className="text-[11px] text-slate-600 italic leading-relaxed">{preview.description}</p>}
                            <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-1">
                              <span>ระยะเวลา: <strong>{preview.timeLimitMinutes} นาที</strong></span>
                              <span>เกณฑ์คะแนนผ่าน: <strong>{preview.passingScore}%</strong></span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ข้อความหรือคำแนะนำเพิ่มเติมถึงผู้สมัคร (Optional Note)
                  </label>
                  <textarea
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    rows={3}
                    placeholder="เช่น ขอให้เข้าทำแบบทดสอบภายใน 3 วัน หรือเตรียมคอมพิวเตอร์ให้พร้อมสำหรับการเขียนโค้ด..."
                    className="w-full text-xs rounded-xl border border-slate-200 p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAppForAssign(null)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={assignSubmitting || !selectedAssessmentId}
                    className="px-6 py-2.5 rounded-full text-xs font-bold bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-xs shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-2"
                  >
                    {assignSubmitting ? 'กำลังส่งมอบหมาย...' : 'ยืนยันและส่งแบบทดสอบ'}
                  </button>
                </div>
              </form>
            </div>
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
                      const isPassed = (getAttemptPercentage(customAttempt) ?? -1) >= (selectedAppForEval.job.customAssessment.passingScore || 70);
                      return (
                        <div className="flex items-center justify-between mt-1 text-slate-700">
                          <span>คะแนนสอบข้อสอบปฏิบัติล่าสุด: <strong className="text-indigo-700 text-sm">{formatAttemptScore(customAttempt)}</strong> (เกณฑ์ {selectedAppForEval.job.customAssessment.passingScore}%)</span>
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
        {/* Candidate Dossier Modal */}
        {selectedCandidateId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-[32px] max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/90 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {loadingProfile ? (
                <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
                  <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-500">กำลังโหลดโปรไฟล์ผู้สมัครและคำนวณเรดาร์ทักษะ... (Fetching Candidate Dossier)</p>
                </div>
              ) : candidateProfile ? (
                <>
                  {/* Modal Header */}
                  <div className="p-6 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#6366f1] via-[#4f46e5] to-[#3730a3] text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-md overflow-hidden ring-4 ring-indigo-50">
                        {candidateProfile.avatarUrl ? (
                          <Image src={candidateProfile.avatarUrl} alt={candidateProfile.fullName || 'รูปโปรไฟล์ผู้สมัคร'} width={64} height={64} unoptimized className="h-full w-full object-cover" />
                        ) : (
                          <span>{(candidateProfile.fullName || 'C').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl sm:text-2xl font-black text-slate-900">{candidateProfile.fullName}</h2>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff]">
                            {candidateProfile.targetCareer || 'Developer'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                          {candidateProfile.user?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              <span>{candidateProfile.user.email}</span>
                            </span>
                          )}
                          {candidateProfile.githubUsername && (
                            <a
                              href={`https://github.com/${candidateProfile.githubUsername}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[#4f46e5] hover:underline font-bold"
                            >
                              <Github className="h-3.5 w-3.5" />
                              <span>@{candidateProfile.githubUsername}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              สมัครเมื่อ{' '}
                              {new Date(
                                candidateProfile.application?.createdAt || candidateProfile.createdAt,
                              ).toLocaleDateString('th-TH')}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Match Score Badge */}
                      <div className="px-3.5 py-1.5 rounded-2xl bg-indigo-50 border border-indigo-200/90 text-[#4f46e5] flex items-center gap-1.5 shadow-2xs">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm font-black">
                          {candidateProfile.application?.matchScoreAtApplication || 0}% Match
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseProfile}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
                        title="ปิดหน้าต่าง"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Tabs Navigation */}
                  <div className="px-6 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-1.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setProfileTab('overview')}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        profileTab === 'overview'
                          ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                          : 'bg-white border border-slate-200/80 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>ภาพรวม & เรดาร์ทักษะ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileTab('skills')}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        profileTab === 'skills'
                          ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                          : 'bg-white border border-slate-200/80 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>ทักษะและหลักฐาน ({candidateProfile.skills?.length || 0})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileTab('github')}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        profileTab === 'github'
                          ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                          : 'bg-white border border-slate-200/80 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      <Github className="h-3.5 w-3.5" />
                      <span>คลังโค้ด GitHub ({candidateProfile.githubRepos?.length || 0})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileTab('assessments')}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        profileTab === 'assessments'
                          ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                          : 'bg-white border border-slate-200/80 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span>การทดสอบ & ความซื่อสัตย์ ({candidateProfile.assessmentAttempts?.length || 0})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileTab('experience')}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        profileTab === 'experience'
                          ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                          : 'bg-white border border-slate-200/80 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      <span>การศึกษา & ประสบการณ์</span>
                    </button>
                  </div>

                  {/* Modal Body / Tab Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Tab 1: Overview & Radar */}
                    {profileTab === 'overview' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* 5-axis Radar Chart */}
                          <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-5 flex flex-col items-center shadow-2xs">
                            <div className="flex items-center justify-between w-full mb-3">
                              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-[#4f46e5]" />
                                เรดาร์ทักษะ 5 มิติ (Skill Radar)
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">คะแนนเต็ม 100</span>
                            </div>
                            <div className="h-64 sm:h-72 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={candidateProfile.radarData || []}>
                                  <PolarGrid stroke="#e2e8f0" />
                                  <PolarAngleAxis
                                    dataKey="category"
                                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                                  />
                                  <PolarRadiusAxis
                                    angle={30}
                                    domain={[0, 100]}
                                    stroke="#cbd5e1"
                                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                                  />
                                  <Radar
                                    name="Candidate Score"
                                    dataKey="score"
                                    stroke="#4f46e5"
                                    fill="#6366f1"
                                    fillOpacity={0.45}
                                  />
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5 w-full mt-3 pt-3 border-t border-slate-200/80 text-center">
                              {(candidateProfile.radarData || []).map((pt: any) => (
                                <div key={pt.category} className="bg-white rounded-xl p-2 border border-slate-200/60 shadow-2xs">
                                  <div className="text-[9px] font-bold text-slate-400 uppercase truncate">{pt.category}</div>
                                  <div className="text-xs font-black text-[#4f46e5] mt-0.5">{pt.score}%</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Profile Overview & Bio */}
                          <div className="space-y-4">
                            {/* Headline & Bio */}
                            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                                สรุปประวัติและความเชี่ยวชาญ (Headline & Bio)
                              </span>
                              <h4 className="text-sm font-bold text-slate-900 mb-2">
                                {candidateProfile.headline || candidateProfile.targetCareer || 'Software Engineer'}
                              </h4>
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                {candidateProfile.bio || 'ผู้สมัครยังไม่ได้ระบุคำแนะนำตัว'}
                              </p>
                            </div>

                            {/* Cover Letter if provided */}
                            {candidateProfile.application?.coverLetter && (
                              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 shadow-2xs">
                                <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block mb-1.5">
                                  จดหมายแนะนำตัว (Cover Letter)
                                </span>
                                <p className="text-xs text-slate-700 italic leading-relaxed whitespace-pre-line">
                                  &ldquo;{candidateProfile.application.coverLetter}&rdquo;
                                </p>
                              </div>
                            )}

                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Verified Skills</span>
                                <span className="text-lg font-black text-slate-900 mt-1 block">
                                  {candidateProfile.skills?.length || 0}
                                </span>
                              </div>
                              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">GitHub Repos</span>
                                <span className="text-lg font-black text-[#4f46e5] mt-1 block">
                                  {candidateProfile.githubRepos?.length || 0}
                                </span>
                              </div>
                              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Assessments</span>
                                <span className="text-lg font-black text-emerald-600 mt-1 block">
                                  {candidateProfile.assessmentAttempts?.length || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Verified Skills & Evidences */}
                    {profileTab === 'skills' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900">
                            ทักษะที่ผ่านการตรวจสอบและหลักฐานเชิงประจักษ์ (Evidence-based Skills)
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">
                            ทั้งหมด {candidateProfile.skills?.length || 0} ทักษะ
                          </span>
                        </div>

                        {candidateProfile.skills && candidateProfile.skills.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {candidateProfile.skills.map((cs: any) => (
                              <div
                                key={cs.id}
                                className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4.5 space-y-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-bold text-slate-900">{cs.skill?.name}</h4>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600">
                                        {cs.skill?.category}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500">
                                      ระดับความเชี่ยวชาญ: {cs.isVerified ? '✓ ตรวจสอบแล้ว' : 'รอการยืนยัน'}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-base font-black text-[#4f46e5]">{cs.verifiedScore}%</span>
                                    <span className="text-[10px] text-slate-400 block font-semibold">Verified Score</span>
                                  </div>
                                </div>

                                {/* Score Bar */}
                                <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, cs.verifiedScore)}%` }}
                                  />
                                </div>

                                {/* Score Breakdown */}
                                <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-200/60">
                                  <div>ทฤษฎี: <strong className="text-slate-800">{cs.theoryScore || 0}%</strong></div>
                                  <div>ปฏิบัติ: <strong className="text-slate-800">{cs.codingScore || 0}%</strong></div>
                                  <div>GitHub: <strong className="text-slate-800">{cs.practicalScore || 0}%</strong></div>
                                </div>

                                {/* Evidences from GitHub */}
                                {cs.evidences && cs.evidences.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                      หลักฐานจาก Repositories ({cs.evidences.length})
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {cs.evidences.map((ev: any) => (
                                        <span
                                          key={ev.id}
                                          className="text-[10px] font-semibold bg-white border border-slate-200/80 px-2 py-0.5 rounded-lg text-slate-700 flex items-center gap-1 shadow-2xs"
                                        >
                                          <GitBranch className="h-2.5 w-2.5 text-indigo-500" />
                                          <span>{ev.repository?.repoName || 'repo'}</span>
                                          {ev.commitCount > 0 && (
                                            <span className="text-slate-400">({ev.commitCount} commits)</span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                            ยังไม่มีข้อมูลทักษะที่ผ่านการตรวจสอบ
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: GitHub Portfolio */}
                    {profileTab === 'github' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900">
                            คลังโค้ดและผลงานซอฟต์แวร์บน GitHub (GitHub Repositories)
                          </h3>
                          {candidateProfile.githubUsername && (
                            <a
                              href={`https://github.com/${candidateProfile.githubUsername}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-[#4f46e5] hover:underline flex items-center gap-1"
                            >
                              <span>ดูโปรไฟล์บน GitHub</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {candidateProfile.githubRepos && candidateProfile.githubRepos.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {candidateProfile.githubRepos.map((repo: any) => (
                              <div
                                key={repo.id}
                                className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4.5 flex flex-col justify-between hover:border-indigo-200 hover:bg-white transition shadow-2xs group"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <a
                                      href={repo.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sm font-bold text-slate-900 group-hover:text-[#4f46e5] transition flex items-center gap-1 truncate"
                                    >
                                      <span className="truncate">{repo.repoName}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                                    </a>
                                    {repo.language && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-[#4f46e5] border border-indigo-100 shrink-0">
                                        {repo.language}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                                    {repo.description || 'ไม่มีคำอธิบายโครงการ'}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-200/60 font-medium">
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1">
                                      <Star className="h-3.5 w-3.5 text-amber-500" />
                                      <span>{repo.stargazersCount || 0}</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                                      <span>{repo.forksCount || 0}</span>
                                    </span>
                                  </div>
                                  {repo.lastCommitAt && (
                                    <span className="text-[10px] text-slate-400">
                                      อัปเดต {new Date(repo.lastCommitAt).toLocaleDateString('th-TH')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                            ผู้สมัครยังไม่ได้เชื่อมต่อหรือยังไม่มี Repositories บน GitHub
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 4: Assessments & Integrity */}
                    {profileTab === 'assessments' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900">
                            ประวัติการทำแบบทดสอบและบันทึกการออกจากหน้าสอบ
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">
                            ทำแล้ว {candidateProfile.assessmentAttempts?.length || 0} ครั้ง
                          </span>
                        </div>

                        {candidateProfile.assessmentAttempts && candidateProfile.assessmentAttempts.length > 0 ? (
                          <div className="space-y-4">
                            {candidateProfile.assessmentAttempts.map((att: any) => {
                              const isPassed =
                                (getAttemptPercentage(att) ?? -1) >= (att.assessment?.passingScore || 70) || att.passed === true;
                              const integrity = att.integritySummary;
                              const tabSwitches = integrity?.tabSwitchCount || 0;
                              const requiresReview = tabSwitches > 0;

                              return (
                                <div
                                  key={att.id}
                                  className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-5 space-y-4"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-slate-900">
                                          {att.assessment?.title || 'แบบทดสอบทักษะ'}
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                                          {att.assessment?.type || 'PRACTICAL'}
                                        </span>
                                      </div>
                                      <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                                        ทำเมื่อ {new Date(att.startedAt).toLocaleString('th-TH')} · เกณฑ์ผ่าน{' '}
                                        {att.assessment?.passingScore || 70}%
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <span className="text-xl font-black text-[#4f46e5]">
                                          {formatAttemptScore(att)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 block font-semibold">คะแนนที่ได้</span>
                                      </div>
                                      <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                          isPassed
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}
                                      >
                                        {getAttemptPercentage(att) === null ? 'รอตรวจ' : isPassed ? '✓ ผ่านเกณฑ์ (Passed)' : '✗ ไม่ผ่านเกณฑ์ (Failed)'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Anti-cheat Integrity Telemetry Box */}
                                  <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                    <div className="flex items-center gap-2.5">
                                      <ShieldAlert
                                        className={`h-4 w-4 shrink-0 ${requiresReview ? 'text-amber-500' : 'text-slate-400'}`}
                                      />
                                      <div>
                                        <span className="text-xs font-bold text-slate-800 block">
                                          บันทึกการแสดงหน้าข้อสอบ
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                          ออกจากหน้าข้อสอบตามที่เบราว์เซอร์รายงาน: <strong>{tabSwitches} ครั้ง</strong>
                                          {' '}· ข้อมูลนี้ใช้ตรวจสอบตามบริบท ไม่ใช่ข้อสรุปว่าทุจริต
                                        </span>
                                      </div>
                                    </div>

                                    <div>
                                      <span
                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                          requiresReview
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                      >
                                        {requiresReview ? '📝 มีบันทึกให้ตรวจสอบ' : 'ไม่มีรายการบันทึก'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                            ยังไม่มีประวัติการทำแบบทดสอบ
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 5: Education & Experience */}
                    {profileTab === 'experience' && (
                      <div className="space-y-6">
                        {/* Work Experience */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-[#4f46e5]" />
                            <span>ประสบการณ์การทำงาน (Work Experience)</span>
                          </h3>
                          {Array.isArray(candidateProfile.experience) && candidateProfile.experience.length > 0 ? (
                            <div className="space-y-3">
                              {candidateProfile.experience.map((exp: any, idx: number) => (
                                <div key={idx} className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-sm font-bold text-slate-900">{exp.title || 'Position'}</h4>
                                    <span className="text-[10px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                                      {exp.duration || exp.year || 'ช่วงเวลา'}
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold text-slate-600 mt-0.5">{exp.company}</div>
                                  {exp.description && (
                                    <p className="text-xs text-slate-500 mt-2 leading-relaxed whitespace-pre-line">
                                      {exp.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                              ไม่มีข้อมูลประวัติการทำงานที่ระบุไว้
                            </div>
                          )}
                        </div>

                        {/* Education */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-[#4f46e5]" />
                            <span>ประวัติการศึกษา (Education)</span>
                          </h3>
                          {Array.isArray(candidateProfile.education) && candidateProfile.education.length > 0 ? (
                            <div className="space-y-3">
                              {candidateProfile.education.map((edu: any, idx: number) => (
                                <div key={idx} className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-sm font-bold text-slate-900">{edu.degree || 'Degree'}</h4>
                                    <span className="text-[10px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                                      {edu.year || 'ปีการศึกษา'}
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold text-slate-600 mt-0.5">{edu.school || edu.institution}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                              ไม่มีข้อมูลประวัติการศึกษาที่ระบุไว้
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Action Bar */}
                  <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Stage Selector inside Modal */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">รอบที่ {candidateProfile.application?.roundNumber || 1}</span>
                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">ขั้นตอน:</span>
                      <select
                        value={candidateProfile.application?.status || ApplicationStatus.APPLIED}
                        disabled={candidateProfile.application?.status === ApplicationStatus.CANCELLED}
                        onChange={(e) => handleStatusChangeFromProfile(e.target.value as ApplicationStatus)}
                        className="text-xs font-bold rounded-xl border border-slate-200 bg-white py-2 px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer shadow-2xs"
                      >
                        {candidateProfile.application?.status === ApplicationStatus.CANCELLED && (
                          <option value={ApplicationStatus.CANCELLED}>{applicationStatusLabel(ApplicationStatus.CANCELLED, language)}</option>
                        )}
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {applicationStatusLabel(opt.value, language)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={handleCloseProfile}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
                      >
                        ปิดหน้าต่าง
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenEvalFromProfile}
                        className="px-5 py-2 text-xs font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] rounded-full shadow-xs shadow-indigo-500/20 transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>ให้คะแนนประเมิน (Evaluate)</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}


export default function CompanyApplicationsPage() {
  return <Suspense fallback={<p>กำลังโหลดรายชื่อผู้สมัคร...</p>}><CompanyApplicationsContent /></Suspense>;
}
