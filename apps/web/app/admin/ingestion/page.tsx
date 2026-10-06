'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DeleteConfirmation from '@/components/DeleteConfirmation';
import LocalJobImport from '@/components/LocalJobImport';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  Globe,
  BookOpen,
  Sparkles,
  Zap,
  ExternalLink,
  Clock,
  RotateCw,
  Trash2,
  ShieldAlert,
  Search,
  X,
  Filter,
  Users,
  Layers,
  Code2,
  FileCheck2,
  Eye,
  GraduationCap,
  Briefcase,
  SlidersHorizontal,
  Settings2,
  Save,
  RotateCcw,
} from 'lucide-react';
import { JobSource, CourseSource, ingestionFeedback } from '@smartcareer/shared';

const JOB_RUN_STORAGE = 'smartcareer_admin_job_run';
type JobRunTracking = { id?: string; requestKey: string; source: JobSource; quota: number };

export default function AdminIngestionPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingSource, setSyncingSource] = useState<string | null>('CHECKING');
  const [jobRun, setJobRun] = useState<JobRunTracking | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgSeverity, setMsgSeverity] = useState<string>('success');
  const showMessage = useCallback((message: string | null, severity = 'success') => {
    setMsg(message);
    setMsgSeverity(severity);
  }, []);

  // Ingestion Quotas States
  const [quotas, setQuotas] = useState<any>(null);
  const [editingQuotas, setEditingQuotas] = useState<Record<string, number>>({});
  const [quotasLoading, setQuotasLoading] = useState(false);
  const [savingQuotas, setSavingQuotas] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [confirmQuotaReset, setConfirmQuotaReset] = useState(false);

  // Screening & Cleanup Tabs ('JOBS' | 'COURSES')
  const [screeningTab, setScreeningTab] = useState<'JOBS' | 'COURSES'>('JOBS');

  // Job Screening States
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningAction, setScreeningAction] = useState<'preview' | 'clean' | null>(null);
  const [screeningSource, setScreeningSource] = useState<string>('ALL');
  const [screeningLimit, setScreeningLimit] = useState<number>(50);

  // Course Screening States
  const [courseProvider, setCourseProvider] = useState<string>('ALL');
  const [courseLimit, setCourseLimit] = useState<number>(10);

  // Common Modal States
  const [screeningResult, setScreeningResult] = useState<any>(null);
  const [resultType, setResultType] = useState<'JOBS' | 'COURSES'>('JOBS');
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  // Course Skill Filtering States
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [selectedCourseSkillId, setSelectedCourseSkillId] = useState<string>('ALL');
  const [customCourseKeyword, setCustomCourseKeyword] = useState<string>('');
  const [backfillingCourses, setBackfillingCourses] = useState<boolean>(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/admin/ingestion-logs');
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuotas = useCallback(async () => {
    try {
      setQuotasLoading(true);
      const data = await apiRequest('/ingestion/quotas');
      setQuotas(data);
      const initial: Record<string, number> = {};
      for (const [k, v] of Object.entries(data as Record<string, any>)) {
        initial[k] = v.quota;
      }
      setEditingQuotas(initial);
    } catch (e) {
      console.error('Failed to load quotas:', e);
    } finally {
      setQuotasLoading(false);
    }
  }, []);

  const rememberJobRun = useCallback((run: JobRunTracking | null, completedRequestKey?: string) => {
    setJobRun(run);
    try {
      if (run) localStorage.setItem(JOB_RUN_STORAGE, JSON.stringify(run));
      else {
        // Another tab may already be tracking a newer run. Finishing this tab's
        // older run must not erase that newer run's recovery information.
        const stored = JSON.parse(localStorage.getItem(JOB_RUN_STORAGE) || 'null');
        if (stored?.requestKey === completedRequestKey) localStorage.removeItem(JOB_RUN_STORAGE);
      }
    } catch { /* Server-side active runs still protect against duplicate starts. */ }
  }, []);

  const displayJobRun = useCallback((run: any) => {
    if (run.state === 'RUNNING') {
      rememberJobRun({ id: run.id, requestKey: run.requestKey, source: run.source, quota: run.quota });
      setSyncingSource(run.source);
      showMessage(`กำลังนำเข้าจาก ${run.source} · รอบ ${run.id} โหลดหน้าใหม่ได้ ระบบจะติดตามรอบเดิมต่อ`, 'warning');
      return;
    }
    rememberJobRun(null, run.requestKey);
    setSyncingSource(null);
    if (run.state === 'COMPLETED' && run.result) {
      const feedback = ingestionFeedback(run.result, `${run.requestKey.startsWith('local-') ? 'ไฟล์ที่ดึงจากเครื่อง ' : 'ตำแหน่งงานจาก '}${run.source}`, `โควต้า: ${run.quota} ตำแหน่ง`);
      showMessage(feedback.message, feedback.severity);
    } else {
      showMessage(`รอบ ${run.id} ถูกขัดจังหวะ อาจมีงานที่บันทึกแล้ว กรุณาตรวจประวัติก่อนเริ่มรอบใหม่`, 'warning');
    }
    fetchLogs();
  }, [rememberJobRun, showMessage, fetchLogs]);

  const restoreJobRun = useCallback(async () => {
    try {
      let saved: JobRunTracking | null = null;
      try { saved = JSON.parse(localStorage.getItem(JOB_RUN_STORAGE) || 'null'); } catch { /* check server below */ }
      if (saved && /^(?:local-)?[a-f0-9-]{36}$/i.test(saved.requestKey)) {
        rememberJobRun(saved);
        setSyncingSource(saved.source);
        return;
      }
      const active = await apiRequest('/ingestion/job-runs');
      if (active.length) displayJobRun(active[0]);
      else setSyncingSource(null);
    } catch {
      showMessage('ยังตรวจสถานะรอบนำเข้าไม่ได้ กรุณาตรวจสถานะอีกครั้งก่อนเริ่มรอบใหม่', 'warning');
    }
  }, [rememberJobRun, displayJobRun, showMessage]);

  useEffect(() => {
    fetchLogs();
    fetchQuotas();
    restoreJobRun();
    apiRequest('/skills')
      .then((data) => setSkillsList(data || []))
      .catch((err) => console.error('Failed to load skills:', err));
  }, [fetchLogs, fetchQuotas, restoreJobRun]);

  useEffect(() => {
    if (!jobRun) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const runs = jobRun.id
          ? [await apiRequest(`/ingestion/job-runs/${jobRun.id}`)]
          : await apiRequest(`/ingestion/job-runs?requestKey=${encodeURIComponent(jobRun.requestKey)}`);
        if (cancelled) return;
        if (runs.length && runs[0].state !== 'RUNNING') { displayJobRun(runs[0]); return; }
        if (runs.length) {
          setSyncingSource(runs[0].source);
          showMessage(`กำลังนำเข้าจาก ${runs[0].source} · รอบ ${runs[0].id} โหลดหน้าใหม่ได้ ระบบจะติดตามรอบเดิมต่อ`, 'warning');
        } else {
          showMessage('ยังยืนยันการรับคำขอนำเข้าไม่ได้ กดส่งคำขอเดิมอีกครั้งได้โดยระบบป้องกันรอบซ้ำ', 'warning');
        }
      } catch {
        if (!cancelled) showMessage('การติดตามสถานะขาดการเชื่อมต่อ ระบบจะตรวจรอบเดิมต่อ ยังไม่ควรเริ่มรอบใหม่', 'warning');
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobRun, displayJobRun, showMessage]);

  const handleSaveQuotas = async () => {
    try {
      setSavingQuotas(true);
      const res = await apiRequest('/ingestion/quotas', {
        method: 'PUT',
        body: JSON.stringify(editingQuotas),
      });
      setQuotas(res);
      setShowQuotaModal(false);
      showMessage('บันทึกการตั้งค่าโควต้าสำหรับทุกแหล่งข้อมูลเรียบร้อยแล้ว!');
    } catch (err: any) {
      alert(`บันทึกโควต้าล้มเหลว: ${err.message}`);
    } finally {
      setSavingQuotas(false);
    }
  };

  const handleResetQuotas = async () => {
    try {
      setSavingQuotas(true);
      const res = await apiRequest('/ingestion/quotas/reset', { method: 'POST' });
      setQuotas(res);
      const resetEditing: Record<string, number> = {};
      for (const [k, v] of Object.entries(res as Record<string, any>)) {
        resetEditing[k] = v.quota;
      }
      setEditingQuotas(resetEditing);
      showMessage('คืนค่าโควต้ากลับเป็นค่ามาตรฐานเริ่มต้นเรียบร้อยแล้ว!');
    } catch (err: any) {
      throw err;
    } finally {
      setSavingQuotas(false);
    }
  };

  const triggerJobSync = async (source: JobSource) => {
    const tracking = jobRun?.source === source ? jobRun : {
      source, quota: quotas?.[source]?.quota, requestKey: crypto.randomUUID(),
    };
    try {
      setSyncingSource(source);
      rememberJobRun(tracking);
      showMessage('กำลังส่งคำขอนำเข้า ระบบจะติดตามรอบนี้ต่อแม้โหลดหน้าใหม่', 'warning');
      const run = await apiRequest('/ingestion/job-runs', {
        method: 'POST', body: JSON.stringify({ source, limit: tracking.quota, requestKey: tracking.requestKey }),
      });
      displayJobRun(run);
    } catch {
      showMessage('ยังยืนยันการรับคำขอไม่ได้ ระบบจะตรวจรอบเดิมต่อ กรุณาอย่าเริ่มคำขอใหม่', 'warning');
    }
  };

  const triggerCourseSync = async (provider: CourseSource) => {
    try {
      setSyncingSource(provider);
      showMessage(null);
      const quota = quotas?.[provider]?.quota;
      const queryParams = new URLSearchParams();
      queryParams.append('provider', provider);
      if (quota) queryParams.append('limit', String(quota));
      if (selectedCourseSkillId !== 'ALL') queryParams.append('skillId', selectedCourseSkillId);
      if (customCourseKeyword.trim()) queryParams.append('keyword', customCourseKeyword.trim());

      const res = await apiRequest(`/ingestion/sync-courses?${queryParams.toString()}`, { method: 'POST' });
      const matchedSkill = skillsList.find((s) => s.id === selectedCourseSkillId);
      const skillLabel = matchedSkill
        ? ` หมวดหมู่: [${matchedSkill.name}]`
        : customCourseKeyword.trim()
        ? ` คำค้นหา: ["${customCourseKeyword.trim()}"]`
        : ' ทุกหมวดหมู่ทักษะ';

      const feedback = ingestionFeedback(res, `คอร์สเรียนจาก ${provider}${skillLabel}`, `โควต้า: ${quota || 'ค่าเริ่มต้น'} คอร์ส`);
      showMessage(feedback.message, feedback.severity);
      fetchLogs();
    } catch (err: any) {
      showMessage(`ดึงข้อมูลไม่สำเร็จ: ${err.message}`, 'error');
      fetchLogs();
    } finally {
      setSyncingSource(null);
    }
  };

  const handleBackfillCourseSkills = async () => {
    try {
      setBackfillingCourses(true);
      showMessage(null);
      const res = await apiRequest('/ingestion/backfill-course-skills', { method: 'POST' });
      showMessage(
        `เชื่อมโยง CourseSkills อัตโนมัติสำเร็จ! ประมวลผลคอร์สทั้งหมด ${res.totalCourses} รายการ, เพิ่มการเชื่อมโยงทักษะใหม่ +${res.newConnectionsCreated} จุด`,
      );
      fetchLogs();
    } catch (err: any) {
      alert(`Backfill failed: ${err.message}`);
    } finally {
      setBackfillingCourses(false);
    }
  };

  // Preview closed jobs (Dry-run)
  const handlePreviewClosedJobs = async () => {
    try {
      setScreeningLoading(true);
      setScreeningAction('preview');
      const res = await apiRequest(
        `/ingestion/preview-closed-jobs?source=${screeningSource}&limit=${screeningLimit}`,
      );
      setScreeningResult({ ...res, previewOnly: true });
      setResultType('JOBS');
      setShowResultModal(true);
    } catch (err: any) {
      alert(`การตรวจสอบงานปิดรับสมัครล้มเหลว: ${err.message}`);
    } finally {
      setScreeningLoading(false);
      setScreeningAction(null);
    }
  };

  // Deactivate closed jobs while retaining their recruitment history.
  const handleCleanClosedJobs = async () => {
    try {
      setScreeningLoading(true);
      setScreeningAction('clean');
      const res = await apiRequest(
        `/ingestion/cleanup-closed-jobs?source=${screeningSource}&limit=${screeningLimit}`,
        {
          method: 'POST',
          body: JSON.stringify({ deleteMode: 'DEACTIVATE' }),
        },
      );
      setScreeningResult({ ...res, previewOnly: false });
      setResultType('JOBS');
      setShowResultModal(true);
      showMessage(
        `คัดกรองงานเสร็จสิ้น! สแกน ${res.scannedCount} ตำแหน่ง, พบปิดรับ ${res.closedCount} ตำแหน่ง, ปิดประกาศเพิ่ม ${res.deactivatedCount} ตำแหน่ง โดยเก็บใบสมัครและประวัติไว้`,
      );
      fetchLogs();
    } catch (err: any) {
      alert(`การลบงานที่ปิดรับสมัครล้มเหลว: ${err.message}`);
    } finally {
      setScreeningLoading(false);
      setScreeningAction(null);
    }
  };

  // Preview closed/unavailable courses (Dry-run)
  const handlePreviewClosedCourses = async () => {
    try {
      setScreeningLoading(true);
      setScreeningAction('preview');
      setSelectedCourseIds([]);
      const res = await apiRequest(
        `/ingestion/preview-closed-courses?provider=${courseProvider}&limit=${courseLimit}`,
      );
      setScreeningResult({ ...res, previewOnly: true });
      setResultType('COURSES');
      setShowResultModal(true);
    } catch (err: any) {
      alert(`การตรวจสอบคอร์สเรียนล้มเหลว: ${err.message}`);
    } finally {
      setScreeningLoading(false);
      setScreeningAction(null);
    }
  };

  // Clean & Delete closed/unavailable courses
  const handleCleanClosedCourses = async () => {
    if (!selectedCourseIds.length) return;
    try {
      setScreeningLoading(true);
      setScreeningAction('clean');
      const res = await apiRequest(
        `/ingestion/cleanup-closed-courses?provider=${courseProvider}&limit=${courseLimit}`,
        {
          method: 'POST',
          body: JSON.stringify({ courseIds: selectedCourseIds }),
        },
      );
      setScreeningResult({ ...res, previewOnly: false });
      setResultType('COURSES');
      setShowResultModal(true);
      showMessage(
        `คัดกรองคอร์สเรียนเสร็จสิ้น! สแกนทั้งหมด ${res.scannedCount} คอร์ส, ตรวจพบไม่พร้อมใช้งาน ${res.closedCount} คอร์ส, ลบออกจากระบบแล้ว ${res.deletedCount} คอร์ส`,
      );
      fetchLogs();
    } catch (err: any) {
      alert(`การลบคอร์สเรียนที่ไม่พร้อมใช้งานล้มเหลว: ${err.message}`);
    } finally {
      setScreeningLoading(false);
      setScreeningAction(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe] shadow-xs mb-3">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>ระบบดึงและคัดกรองข้อมูล · Ingestion & Screening Engine</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                ศูนย์จัดการข้อมูลงาน & แหล่งการเรียนรู้ภายนอก
              </h1>
              <p className="text-slate-600 text-sm mt-1 max-w-3xl">
                เชื่อมต่อ RapidAPI JSearch, JobsDB, Blognone, JobThai, Remotive และคอร์ส YouTube/Udemy พร้อมระบบคัดกรองข้อมูลที่ไม่พร้อมใช้งาน
              </p>
            </div>

            {/* Quick Admin Navigation Pills */}
            <div className="flex items-center flex-wrap gap-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>แดชบอร์ด</span>
              </Link>
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
              >
                <Users className="h-3.5 w-3.5" />
                <span>ผู้ใช้</span>
              </Link>
              <Link
                href="/admin/skills"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>ทักษะ</span>
              </Link>
              <Link
                href="/admin/assessments"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>แบบทดสอบ</span>
              </Link>
              <Link
                href="/admin/ingestion"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#eef2ff] border border-[#c7d2fe] text-[#4f46e5] shadow-xs transition"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Ingestion & Cleaner</span>
              </Link>
              <Link
                href="/admin/verifications"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f5f3ff] border border-[#ddd6fe] text-[#7c3aed] hover:bg-[#ede9fe] shadow-xs transition"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                <span>ตรวจนิติบุคคล</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sync Feedback Toast */}
        <LocalJobImport busy={!!syncingSource} pending={jobRun}
          onRequest={tracking => { rememberJobRun(tracking); setSyncingSource(tracking.source); showMessage('กำลังนำเข้าไฟล์จากเครื่อง โหลดหน้าใหม่เพื่อติดตามรอบเดิมได้', 'warning'); }}
          onRun={displayJobRun}
          onRejected={requestKey => { rememberJobRun(null, requestKey); setSyncingSource(null); }} />
        {syncingSource === 'CHECKING' && (
          <button onClick={restoreJobRun} className="mb-4 rounded-lg border px-4 py-2">ตรวจสถานะรอบนำเข้าอีกครั้ง</button>
        )}
        {jobRun && !jobRun.id && (
          !jobRun.requestKey.startsWith('local-') && <button onClick={() => triggerJobSync(jobRun.source)} className="mb-4 rounded-lg border px-4 py-2">ส่งคำขอเดิมอีกครั้ง (ป้องกันรอบซ้ำ)</button>
        )}
        {msg && (
          <div role="alert" className={`mb-6 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 shadow-xs ${msgSeverity === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : msgSeverity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            <div className="flex items-center gap-3">
              {msgSeverity === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <ShieldAlert className="h-5 w-5 shrink-0" />}
              <span>{msg}</span>
            </div>
            <button onClick={() => showMessage(null)} aria-label="ปิดข้อความ" className="hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* UNIFIED SCREENING & CLEANUP ENGINE CARD (Jobs & Courses)     */}
        {/* ============================================================ */}
        <div className="mb-10 rounded-[28px] border border-rose-200/90 bg-gradient-to-br from-white via-rose-50/20 to-white p-6 sm:p-8 shadow-[0_12px_32px_rgba(225,29,72,0.06)] backdrop-blur-sm">
          {/* Header & Tab Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-rose-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Trash2 className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  ระบบคัดกรองและกำจัดข้อมูลที่ปิดรับ/ไม่พร้อมใช้งาน (Screening & Cleanup Engine)
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
                {screeningTab === 'JOBS' ? (
                  <>
                    สแกนตำแหน่งงานที่ <strong className="text-rose-700">หมดอายุ (expiresAt)</strong>,{' '}
                    <strong className="text-rose-700">ลิงก์เสีย (HTTP 404/410)</strong>, หรือหน้าเว็บระบุว่า{' '}
                    <strong className="text-rose-700">&quot;ปิดรับสมัครแล้ว / No longer accepting applications&quot;</strong>{' '}
                    และปิดประกาศโดยเก็บใบสมัครและประวัติการคัดเลือกไว้
                  </>
                ) : (
                  <>
                    สแกนคอร์สเรียน YouTube ที่ <strong className="text-rose-700">วิดีโอถูกลบ (oEmbed 404)</strong>,{' '}
                    <strong className="text-rose-700">ตั้งค่าเป็นส่วนตัว (Private 401)</strong>, หรือคอร์ส Udemy ที่{' '}
                    <strong className="text-rose-700">ยุติการสอน/ปิดตัว (Retired / 404)</strong>{' '}
                    และลบออกจากฐานข้อมูลทันที
                  </>
                )}
              </p>
            </div>

            {/* Category Switcher Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 self-start lg:self-auto">
              <button
                onClick={() => setScreeningTab('JOBS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  screeningTab === 'JOBS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                <span>ตำแหน่งงาน (Jobs)</span>
              </button>

              <button
                onClick={() => setScreeningTab('COURSES')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  screeningTab === 'COURSES'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5 text-purple-600" />
                <span>คอร์สเรียน (Courses)</span>
              </button>
            </div>
          </div>

          {/* TAB 1: JOBS SCREENING CONTROLS */}
          {screeningTab === 'JOBS' && (
            <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/80 p-4 rounded-2xl border border-slate-200/80 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">แหล่งข้อมูลงาน:</span>
                  <select
                    value={screeningSource}
                    onChange={(e) => setScreeningSource(e.target.value)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="ALL">ทั้งหมด (All Sources)</option>
                    <option value="JOBTHAI">JobThai</option>
                    <option value="JOBSDB">JobsDB (SEEK Asia)</option>
                    <option value="JSEARCH">JSearch (Google Jobs)</option>
                    <option value="REMOTIVE">Remotive (Global Remote)</option>
                    <option value="BLOGNONE">Blognone Jobs</option>
                    <option value="INTERNAL">SmartCareer (Internal)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">จำนวนที่สแกน:</span>
                  <select
                    value={screeningLimit}
                    onChange={(e) => setScreeningLimit(Number(e.target.value))}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="20">20 ตำแหน่ง</option>
                    <option value="50">50 ตำแหน่ง</option>
                    <option value="100">100 ตำแหน่ง</option>
                    <option value="200">200 ตำแหน่ง</option>
                  </select>
                </div>

                <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>Cron Auto-Clean: ทุกคืน 00:30 ICT</span>
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePreviewClosedJobs}
                  disabled={screeningLoading}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-50 shadow-xs"
                >
                  {screeningLoading && screeningAction === 'preview' ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-600" />
                  )}
                  <span>ตรวจสอบงานก่อนปิดประกาศ (Preview)</span>
                </button>

                <button
                  onClick={handleCleanClosedJobs}
                  disabled={screeningLoading}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-xs shadow-rose-600/20"
                >
                  {screeningLoading && screeningAction === 'clean' ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-white" />
                  )}
                  <span>สแกนและปิดประกาศงาน (เก็บประวัติ)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COURSES SCREENING CONTROLS */}
          {screeningTab === 'COURSES' && (
            <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/80 p-4 rounded-2xl border border-purple-200/80 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-bold text-slate-700">ผู้ให้บริการคอร์ส:</span>
                  <select
                    value={courseProvider}
                    onChange={(e) => setCourseProvider(e.target.value)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="ALL">ทั้งหมด (All Providers)</option>
                    <option value="YOUTUBE">YouTube (freeCodeCamp Live oEmbed)</option>
                    <option value="UDEMY">Udemy (Industry Catalog)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">จำนวนที่สแกน:</span>
                  <select
                    value={courseLimit}
                    onChange={(e) => setCourseLimit(Number(e.target.value))}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="10">10 คอร์ส</option>
                    <option value="25">25 คอร์ส</option>
                    <option value="50">50 คอร์ส</option>
                    <option value="100">100 คอร์ส</option>
                  </select>
                </div>

                <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>Cron Auto-Clean: ทุกคืน 00:35 ICT</span>
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePreviewClosedCourses}
                  disabled={screeningLoading}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-50 shadow-xs"
                >
                  {screeningLoading && screeningAction === 'preview' ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-purple-600" />
                  )}
                  <span>ตรวจสอบคอร์สก่อนลบ (Preview)</span>
                </button>

                <button
                  onClick={handlePreviewClosedCourses}
                  disabled={screeningLoading}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-xs shadow-rose-600/20"
                >
                  {screeningLoading && screeningAction === 'clean' ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-white" />
                  )}
                  <span>ตรวจรายการและเลือกลบคอร์ส (Scan & Clean)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Connectors & Quota Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-indigo-600" />
              <span>ตัวเชื่อมต่อข้อมูล & โควต้าการนำเข้า (Ingestion Connectors & Quotas)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ควบคุมจำนวนและโควต้าที่ต้องการนำเข้าจากแต่ละแหล่งข้อมูล (ทั้งการกด Sync ด้วยตนเอง และรอบอัตโนมัติตอนเที่ยงคืน)
            </p>
          </div>
          <button
            onClick={() => setShowQuotaModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold transition shadow-xs shadow-indigo-600/20"
          >
            <Settings2 className="h-4 w-4" />
            <span>ตั้งค่าโควต้าแหล่งข้อมูล ({quotas ? Object.keys(quotas).length : 7} แหล่ง)</span>
          </button>
        </div>

        {/* Connectors Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Job Ingestion Connectors */}
          <div className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-[#4f46e5]" />
                  <span>ตัวดึงตำแหน่งงาน (Job Connectors & Scrapers)</span>
                </h3>
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Cron: ทุกเที่ยงคืน (00:00 ICT)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                ดึงตำแหน่งงานสายเทคเรียลไทม์จาก Google Jobs ผ่าน JSearch RapidAPI, SEEK Asia (JobsDB Thailand), Blognone Jobs, JobThai และ Remotive Global Remote API
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* JSearch */}
              <button
                onClick={() => triggerJobSync(JobSource.JSEARCH)}
                disabled={!!syncingSource || screeningLoading}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-indigo-200/90 bg-[#f0f3ff] hover:bg-[#e8eaff] text-[#3730a3] text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 text-[#4f46e5] ${syncingSource === JobSource.JSEARCH ? 'animate-spin' : ''}`} />
                    <span>Sync JSearch (RapidAPI)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    โควต้า: <strong className="text-indigo-700 font-bold">{quotas?.JSEARCH?.quota || 15}</strong> ตำแหน่ง
                  </span>
                </div>
                <span className="text-[10px] bg-[#dce0ff] text-[#4338ca] px-2 py-0.5 rounded-full font-black">LIVE API</span>
              </button>

              {/* JobsDB */}
              <button
                onClick={() => triggerJobSync(JobSource.JOBSDB)}
                disabled={!!syncingSource || screeningLoading}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-blue-200/90 bg-blue-50/70 hover:bg-blue-100/70 text-blue-900 text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 text-blue-600 ${syncingSource === JobSource.JOBSDB ? 'animate-spin' : ''}`} />
                    <span>Scrape JobsDB (SEEK)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    โควต้า: <strong className="text-blue-700 font-bold">{quotas?.JOBSDB?.quota || 30}</strong> ตำแหน่ง
                  </span>
                </div>
                <span className="text-[10px] bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded-full font-black">SEEK ASIA</span>
              </button>

              {/* Blognone */}
              <button
                onClick={() => triggerJobSync(JobSource.BLOGNONE)}
                disabled={!!syncingSource || screeningLoading}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100/80 text-slate-800 text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 text-slate-600 ${syncingSource === JobSource.BLOGNONE ? 'animate-spin' : ''}`} />
                    <span>Scrape Blognone Jobs</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    โควต้า: <strong className="text-slate-800 font-bold">{quotas?.BLOGNONE?.quota || 15}</strong> ตำแหน่ง
                  </span>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-black">THAI TECH</span>
              </button>

              {/* JobThai */}
              <button
                onClick={() => triggerJobSync(JobSource.JOBTHAI)}
                disabled={!!syncingSource || screeningLoading}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100/80 text-slate-800 text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 text-slate-600 ${syncingSource === JobSource.JOBTHAI ? 'animate-spin' : ''}`} />
                    <span>Scrape JobThai</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    โควต้า: <strong className="text-slate-800 font-bold">{quotas?.JOBTHAI?.quota || 25}</strong> ตำแหน่ง
                  </span>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-black">JOBTHAI</span>
              </button>

              {/* Remotive */}
              <button
                onClick={() => triggerJobSync(JobSource.REMOTIVE)}
                disabled={!!syncingSource || screeningLoading}
                className="sm:col-span-2 flex items-center justify-between p-3.5 rounded-2xl border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${syncingSource === JobSource.REMOTIVE ? 'animate-spin' : ''}`} />
                    <span>Sync Remotive Global Remote Tech Jobs</span>
                  </span>
                  <span className="text-[10px] text-slate-300 font-medium">
                    โควต้า: <strong className="text-emerald-400 font-bold">{quotas?.REMOTIVE?.quota || 20}</strong> ตำแหน่ง
                  </span>
                </div>
                <span className="text-[10px] bg-white/20 text-white px-2.5 py-0.5 rounded-full font-black">100% REMOTE REST</span>
              </button>
            </div>
          </div>

          {/* Course Ingestion Connectors */}
          <div className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#7c3aed]" />
                  <span>ตัวดึงคอร์สเรียน (Course Catalogs)</span>
                </h3>
                <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></span>
                  <span>Cron: ทุกเที่ยงคืน (00:00 ICT)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                ดึงหลักสูตรและบทเรียนคุณภาพสูงจาก YouTube (oEmbed API) และ Udemy Industry Registry พร้อมผูกเข้ากับ <strong className="text-purple-700">CourseSkill</strong> เพื่อแสดงผลในระบบ Skill Gap
              </p>

              {/* Skill Selection & Keyword Filters */}
              <div className="p-3.5 mb-5 rounded-2xl bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white border border-purple-100/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-[#7c3aed]" />
                    <span>กำหนดทักษะเป้าหมาย (Target Skill Filter)</span>
                  </span>
                  <button
                    onClick={handleBackfillCourseSkills}
                    disabled={backfillingCourses || !!syncingSource}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white border border-purple-200 text-purple-700 hover:bg-purple-100/80 transition disabled:opacity-50 shadow-2xs"
                    title="สแกนคอร์สทั้งหมดในระบบและจับคู่เข้ากับ Master Skills อัตโนมัติ"
                  >
                    <Sparkles className={`h-3 w-3 text-amber-500 ${backfillingCourses ? 'animate-spin' : ''}`} />
                    <span>{backfillingCourses ? 'กำลังผูกทักษะ...' : 'Auto-Link All CourseSkills'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      เลือกทักษะที่ต้องการดึง:
                    </label>
                    <select
                      value={selectedCourseSkillId}
                      onChange={(e) => setSelectedCourseSkillId(e.target.value)}
                      className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
                    >
                      <option value="ALL">🌟 ทุกทักษะ (General Catalog)</option>
                      {skillsList.map((skill) => (
                        <option key={skill.id} value={skill.id}>
                          {skill.name} ({skill.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      คำค้นหาเพิ่มเติม (Optional Keyword):
                    </label>
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="เช่น Fastify, Redux Toolkit..."
                        value={customCourseKeyword}
                        onChange={(e) => setCustomCourseKeyword(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500 placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {selectedCourseSkillId !== 'ALL' && (
                  <div className="text-[11px] text-purple-700 font-semibold flex items-center gap-1.5 pt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                    <span>
                      กำลังจะดึงเฉพาะคอร์สเกี่ยวกับ{' '}
                      <strong>{skillsList.find((s) => s.id === selectedCourseSkillId)?.name}</strong> และผูกเข้าสู่ระบบทันที
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => triggerCourseSync(CourseSource.YOUTUBE)}
                disabled={!!syncingSource || screeningLoading || backfillingCourses}
                className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/80 border border-rose-200/90 hover:bg-rose-100/80 text-rose-900 text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 text-rose-600 ${syncingSource === CourseSource.YOUTUBE ? 'animate-spin' : ''}`} />
                    <span>Sync YouTube Courses</span>
                  </span>
                  <span className="text-[10px] text-rose-700 font-medium">
                    {selectedCourseSkillId !== 'ALL'
                      ? `ดึงเฉพาะ: ${skillsList.find((s) => s.id === selectedCourseSkillId)?.name}`
                      : `โควต้า: ${quotas?.YOUTUBE?.quota || 10} คอร์ส`}
                  </span>
                </div>
                <span className="text-[10px] bg-rose-200/70 text-rose-800 px-2 py-0.5 rounded-full font-black">oEmbed LIVE</span>
              </button>

              <button
                onClick={() => triggerCourseSync(CourseSource.UDEMY)}
                disabled={!!syncingSource || screeningLoading || backfillingCourses}
                className="flex items-center justify-between p-4 rounded-2xl bg-purple-50/80 border border-purple-200/90 hover:bg-purple-100/80 text-purple-900 text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 text-purple-600 ${syncingSource === CourseSource.UDEMY ? 'animate-spin' : ''}`} />
                    <span>Sync Udemy Courses</span>
                  </span>
                  <span className="text-[10px] text-purple-700 font-medium">
                    {selectedCourseSkillId !== 'ALL'
                      ? `ดึงเฉพาะ: ${skillsList.find((s) => s.id === selectedCourseSkillId)?.name}`
                      : `โควต้า: ${quotas?.UDEMY?.quota || 10} คอร์ส`}
                  </span>
                </div>
                <span className="text-[10px] bg-purple-200/70 text-purple-800 px-2 py-0.5 rounded-full font-black">VERIFIED REPO</span>
              </button>
            </div>
          </div>
        </div>

        {/* Historical Ingestion Logs */}
        <div className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#7c3aed]" />
              <span>ประวัติการทำงานของ Ingestion & Cleanup (Execution Audit Logs)</span>
            </h3>
            <button
              onClick={fetchLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>รีเฟรชบันทึก (Refresh)</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">กำลังโหลดประวัติ Ingestion...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">ยังไม่มีประวัติการรันบันทึกไว้ในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/70">
                    <th className="py-3 px-4 font-bold">แหล่งข้อมูล (Source)</th>
                    <th className="py-3 px-4 font-bold">สถานะ (Status)</th>
                    <th className="py-3 px-4 font-bold">เวลาที่ทำงาน (Run Timestamp)</th>
                    <th className="py-3 px-4 font-bold text-right">เพิ่มใหม่ (Created)</th>
                    <th className="py-3 px-4 font-bold text-right">การจัดการ / รายการซ้ำ</th>
                    <th className="py-3 px-4 font-bold text-right">ข้อผิดพลาด (Errors)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90">
                  {logs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const isPartial = log.status === 'PARTIAL_SUCCESS';
                    const isJobCleanup = log.source === 'JOB_CLEANUP';
                    const isCourseCleanup = log.source === 'COURSE_CLEANUP';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {isJobCleanup ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-mono text-[11px] font-black border border-rose-200 flex items-center gap-1.5 w-fit">
                              <Trash2 className="h-3 w-3" />
                              <span>JOB_CLEANUP</span>
                            </span>
                          ) : isCourseCleanup ? (
                            <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-mono text-[11px] font-black border border-purple-200 flex items-center gap-1.5 w-fit">
                              <GraduationCap className="h-3.5 w-3.5 text-purple-600" />
                              <span>COURSE_CLEANUP</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold border border-slate-200/70">
                              {log.source}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`font-black px-2.5 py-0.5 rounded-full text-[10px] border ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {new Date(log.startedAt).toLocaleString('th-TH')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-600">
                          {isJobCleanup || isCourseCleanup ? (
                            <span className="text-slate-400 font-medium">-</span>
                          ) : log.createdCount > 0 ? (
                            `+${log.createdCount}`
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isJobCleanup ? (
                            <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              ปิดประกาศ {log.updatedCount || 0} ตำแหน่ง · ลบ {log.duplicateCount} ตำแหน่ง
                            </span>
                          ) : isCourseCleanup ? (
                            <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                              ลบออก -{log.duplicateCount} คอร์ส
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">{log.duplicateCount}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {log.errorCount > 0 ? (
                            <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                              {log.errorCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ============================================================ */}
      {/* SCREENING RESULT MODAL (Shared for Jobs & Courses)           */}
      {/* ============================================================ */}
      {showResultModal && screeningResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-[28px] max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-2xl bg-rose-100 text-rose-700">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {resultType === 'JOBS'
                      ? 'รายงานการคัดกรองงานที่ปิดรับสมัคร (Closed Job Screening Report)'
                      : 'รายงานการคัดกรองคอร์สเรียนที่ไม่พร้อมใช้งาน (Course Screening Report)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {resultType === 'JOBS' && !screeningResult.previewOnly
                      ? `ปิดประกาศเพิ่ม ${screeningResult.deactivatedCount} ตำแหน่ง โดยเก็บใบสมัครและประวัติไว้`
                      : screeningResult.deletedCount > 0
                      ? `ดำเนินการลบข้อมูลที่ไม่พร้อมใช้งานออกจากระบบแล้ว ${screeningResult.deletedCount} รายการ`
                      : `ผลการตรวจสอบพรีวิว (ตรวจพบรายการที่เข้าข่าย ${screeningResult.closedCount} รายการ)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">สแกนทั้งหมด</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{screeningResult.scannedCount}</div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80">
                  <div className="text-[11px] font-bold text-amber-700 uppercase">
                    {resultType === 'JOBS' ? 'พบว่าปิดรับสมัคร' : 'พบว่าไม่พร้อมใช้งาน'}
                  </div>
                  <div className="text-2xl font-black text-amber-700 mt-1">{screeningResult.closedCount}</div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80">
                  <div className="text-[11px] font-bold text-rose-700 uppercase">{resultType === 'JOBS' ? 'ปิดประกาศเพิ่ม' : 'ลบออกจากระบบแล้ว'}</div>
                  <div className="text-2xl font-black text-rose-700 mt-1">{resultType === 'JOBS' ? screeningResult.deactivatedCount : screeningResult.deletedCount}</div>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200/80">
                  <div className="text-[11px] font-bold text-indigo-700 uppercase">อัตราส่วนที่พบปัญหา</div>
                  <div className="text-2xl font-black text-indigo-700 mt-1">
                    {screeningResult.scannedCount > 0
                      ? Math.round((screeningResult.closedCount / screeningResult.scannedCount) * 100)
                      : 0}
                    %
                  </div>
                </div>
              </div>

              {/* Reasons Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                <div className="text-xs font-bold text-slate-700 mb-2">จำแนกตามสาเหตุ:</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {resultType === 'JOBS' ? (
                    <>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        ข้อความระบุปิดรับสมัคร: <strong className="text-rose-600">{screeningResult.reasons?.closedContent || 0}</strong>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        ลิงก์เสีย (404/410): <strong className="text-rose-600">{screeningResult.reasons?.deadLinkHttp || 0}</strong>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        หมดอายุตามกำหนด: <strong className="text-rose-600">{screeningResult.reasons?.expiredDate || 0}</strong>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        ปิดรับสมัครโดยตรง: <strong className="text-rose-600">{screeningResult.reasons?.manualInactive || 0}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        YouTube วิดีโอถูกลบ (oEmbed 404): <strong className="text-rose-600">{screeningResult.reasons?.oembedDeleted || 0}</strong>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        YouTube วิดีโอส่วนตัว (Private 401): <strong className="text-rose-600">{screeningResult.reasons?.oembedPrivate || 0}</strong>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        YouTube Video ID ไม่ถูกต้อง: <strong className="text-rose-600">{screeningResult.reasons?.oembedInvalid || 0}</strong>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        หน้าคอร์สเสีย (HTTP 404): <strong className="text-rose-600">{screeningResult.reasons?.httpNotFound || 0}</strong>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        คอร์สยุติการสอน: <strong className="text-rose-600">{screeningResult.reasons?.contentRetired || 0}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
                  <span>
                    รายการที่ตรวจพบ ({screeningResult.items?.length || 0} {resultType === 'JOBS' ? 'ตำแหน่ง' : 'คอร์ส'})
                  </span>
                </div>

                {screeningResult.items?.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    ยอดเยี่ยม! ไม่พบรายการที่ผิดปกติในรอบการสแกนนี้
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                          <th className="py-2.5 px-3">
                            {resultType === 'JOBS' ? 'ตำแหน่งงาน & บริษัท' : 'ชื่อคอร์สเรียน & ลิงก์'}
                          </th>
                          <th className="py-2.5 px-3">แหล่งที่มา / ผู้ให้บริการ</th>
                          <th className="py-2.5 px-3">สาเหตุที่พบ</th>
                          <th className="py-2.5 px-3 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {screeningResult.items?.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 leading-snug">{item.title}</div>
                              {resultType === 'JOBS' ? (
                                <div className="text-[11px] text-slate-500">{item.companyName}</div>
                              ) : (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1 mt-0.5 truncate max-w-xs"
                                >
                                  {item.url} <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                </a>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.provider === 'YOUTUBE'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : item.provider === 'UDEMY'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {item.source || item.provider}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-rose-700 font-medium max-w-xs leading-relaxed">
                              {item.reason}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {resultType === 'COURSES' && screeningResult.previewOnly && (
                                <label className="mb-2 flex items-center justify-end gap-2 text-xs font-semibold text-slate-700">
                                  <input type="checkbox" aria-label={`เลือกลบ ${item.title}`} checked={selectedCourseIds.includes(item.id)} disabled={screeningLoading} onChange={event => setSelectedCourseIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />
                                  เลือกลบรายการนี้
                                </label>
                              )}
                              {item.actionTaken === 'DELETED' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                                  <Trash2 className="h-3 w-3" />
                                  <span>ลบแล้ว</span>
                                </span>
                              ) : item.actionTaken === 'DEACTIVATED' ? (
                                <span className="text-xs font-bold text-indigo-700">ปิดประกาศ · เก็บประวัติ</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <Eye className="h-3 w-3" />
                                  <span>{resultType === 'JOBS' ? 'ตรวจพบ · ยังไม่เปลี่ยนข้อมูล' : 'รอการลบ'}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-[28px] flex items-center justify-between">
              <button
                onClick={() => setShowResultModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                ปิดหน้าต่าง
              </button>

              {screeningResult.closedCount > 0 && screeningResult.previewOnly && (
                <button
                  disabled={screeningLoading || (resultType === 'COURSES' && selectedCourseIds.length === 0)}
                  onClick={() => {
                    setShowResultModal(false);
                    if (resultType === 'JOBS') {
                      handleCleanClosedJobs();
                    } else {
                      handleCleanClosedCourses();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs shadow-rose-600/20 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>
                    {resultType === 'JOBS' ? 'ยืนยันปิดประกาศโดยเก็บประวัติ' : 'ยืนยันลบรายการที่เลือก'} ({resultType === 'JOBS' ? screeningResult.closedCount : selectedCourseIds.length}{' '}
                    {resultType === 'JOBS' ? 'ตำแหน่ง' : 'คอร์ส'})
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* INGESTION QUOTA CONFIGURATION MODAL                           */}
      {/* ============================================================ */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-xs">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    ตั้งค่าโควต้าการนำเข้าข้อมูล (Ingestion Quota Settings)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กำหนดจำนวนรายการเป้าหมายต่อรอบสำหรับแต่ละแหล่งข้อมูล มีผลต่อทั้งการ Sync ด้วยตนเอง และรอบ Cron เที่ยงคืน
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuotaModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {quotasLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">กำลังโหลดการตั้งค่าโควต้า...</div>
              ) : quotas ? (
                <>
                  {/* Job Sources Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                      <Briefcase className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        แหล่งตำแหน่งงาน (Tech Job Sources - 5 แหล่ง)
                      </h4>
                    </div>

                    <div className="space-y-4">
                      {['JSEARCH', 'JOBSDB', 'JOBTHAI', 'REMOTIVE', 'BLOGNONE'].map((key) => {
                        const config = quotas[key];
                        if (!config) return null;
                        const currentVal = editingQuotas[key] !== undefined ? editingQuotas[key] : config.quota;

                        return (
                          <div
                            key={key}
                            className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition"
                          >
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div>
                                <div className="text-xs font-bold text-slate-900">{config.label}</div>
                                <div className="text-[11px] text-slate-500">
                                  ขอบเขต: {config.min} - {config.max} {config.unit} (มาตรฐาน: {config.default})
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={config.min}
                                  max={config.max}
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) {
                                      setEditingQuotas((prev) => ({
                                        ...prev,
                                        [key]: Math.max(config.min, Math.min(config.max, val)),
                                      }));
                                    }
                                  }}
                                  className="w-20 px-2.5 py-1 text-center font-bold text-xs rounded-xl border border-slate-300 bg-white focus:border-indigo-500 focus:outline-hidden"
                                />
                                <span className="text-xs text-slate-600 font-semibold">{config.unit}</span>
                              </div>
                            </div>

                            {/* Slider */}
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-400 font-mono w-6 text-right">{config.min}</span>
                              <input
                                type="range"
                                min={config.min}
                                max={config.max}
                                value={currentVal}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setEditingQuotas((prev) => ({ ...prev, [key]: val }));
                                }}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <span className="text-[10px] text-slate-400 font-mono w-6">{config.max}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Course Catalogs Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                      <GraduationCap className="h-4 w-4 text-purple-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        แหล่งคอร์สเรียน (Course Catalogs - 2 แหล่ง)
                      </h4>
                    </div>

                    <div className="space-y-4">
                      {['YOUTUBE', 'UDEMY'].map((key) => {
                        const config = quotas[key];
                        if (!config) return null;
                        const currentVal = editingQuotas[key] !== undefined ? editingQuotas[key] : config.quota;

                        return (
                          <div
                            key={key}
                            className="p-4 rounded-2xl border border-slate-200/90 bg-purple-50/30 hover:bg-white hover:border-purple-200 transition"
                          >
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div>
                                <div className="text-xs font-bold text-slate-900">{config.label}</div>
                                <div className="text-[11px] text-slate-500">
                                  ขอบเขต: {config.min} - {config.max} {config.unit} (มาตรฐาน: {config.default})
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={config.min}
                                  max={config.max}
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) {
                                      setEditingQuotas((prev) => ({
                                        ...prev,
                                        [key]: Math.max(config.min, Math.min(config.max, val)),
                                      }));
                                    }
                                  }}
                                  className="w-20 px-2.5 py-1 text-center font-bold text-xs rounded-xl border border-slate-300 bg-white focus:border-purple-500 focus:outline-hidden"
                                />
                                <span className="text-xs text-slate-600 font-semibold">{config.unit}</span>
                              </div>
                            </div>

                            {/* Slider */}
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-400 font-mono w-6 text-right">{config.min}</span>
                              <input
                                type="range"
                                min={config.min}
                                max={config.max}
                                value={currentVal}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setEditingQuotas((prev) => ({ ...prev, [key]: val }));
                                }}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                              />
                              <span className="text-[10px] text-slate-400 font-mono w-6">{config.max}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/70 rounded-b-[28px] flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmQuotaReset(true)}
                disabled={savingQuotas}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>คืนค่าเริ่มต้น (Reset Defaults)</span>
              </button>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowQuotaModal(false)}
                  disabled={savingQuotas}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuotas}
                  disabled={savingQuotas}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs shadow-indigo-600/20 disabled:opacity-50"
                >
                  {savingQuotas ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Save className="h-4 w-4 text-white" />
                  )}
                  <span>บันทึกการตั้งค่าโควต้า</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmQuotaReset && <DeleteConfirmation title="โควต้าทั้ง 7 แหล่ง" confirmLabel="ยืนยันคืนค่าเริ่มต้น"
        description="คืนจำนวนรายการนำเข้าทุกแหล่งเป็นค่ามาตรฐาน รวมค่างานและคอร์สเรียน กรุณาบันทึกค่าเดิมไว้หากต้องการนำกลับมาใช้"
        onCancel={() => setConfirmQuotaReset(false)} onConfirm={handleResetQuotas} />}
      <Footer />
    </div>
  );
}
