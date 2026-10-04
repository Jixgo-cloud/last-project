'use client';

import React, { useState, useEffect } from 'react';
import { getAttemptPercentage, formatAttemptScore } from '@smartcareer/shared';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DeleteConfirmation from '@/components/DeleteConfirmation';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import {
  FileCheck2,
  Building2,
  Clock,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Bell,
  Code2,
} from 'lucide-react';
import Link from 'next/link';

export default function ApplicationsPage() {
  useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null);

  const fetchApplications = () => {
    apiRequest('/candidate/applications')
      .then((data) => setApplications(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleCancelApplication = async (appId: string) => {
    setCancellingId(appId);
    try {
      await apiRequest(`/applications/${appId}`, { method: 'DELETE' });
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status: 'CANCELLED' } : app))
      );
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OFFER':
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'TECHNICAL_TEST':
      case 'INTERVIEW':
        return 'bg-[#e8eaff] text-[#4f46e5] border-[#dce0ff]';
      case 'REVIEWING':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CANCELLED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPLIED':
        return 'ยื่นใบสมัครแล้ว';
      case 'REVIEWING':
        return 'กำลังพิจารณา';
      case 'INTERVIEW':
        return 'นัดสัมภาษณ์';
      case 'TECHNICAL_TEST':
        return 'ทดสอบทักษะ';
      case 'OFFER':
        return 'ได้รับข้อเสนอ';
      case 'ACCEPTED':
        return 'ตอบรับแล้ว';
      case 'REJECTED':
        return 'ไม่ผ่านการคัดเลือก';
      case 'CANCELLED':
        return 'ยกเลิกใบสมัครแล้ว';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        {/* Header */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3.5 py-1 text-[11px] font-[750] text-[#4f46e5] mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Recruitment Journey · ติดตามสถานะการสมัครงาน
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            ประวัติการสมัครงาน &amp;{' '}
            <span className="relative text-[#4f46e5]">
              ฟีดแบ็กจากผู้ว่าจ้าง
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[#818cf8] opacity-60" />
            </span>
          </h1>
          <p className="text-[13px] text-[#667085] mt-2 leading-relaxed">
            ติดตามขั้นตอนการคัดเลือกใน Recruitment Pipeline, ผลคะแนนสัมภาษณ์ และข้อเสนอแนะเพื่อพัฒนาตนเองอย่างต่อเนื่อง
          </p>
        </div>

        {loading ? (
          <div className="py-28 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-[#667085]">กำลังโหลดรายการใบสมัครของคุณ...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white/95 border border-slate-200/90 rounded-[24px] p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="h-16 w-16 rounded-2xl bg-[#e8eaff] text-[#4f46e5] flex items-center justify-center mx-auto mb-4">
              <FileCheck2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">ยังไม่มีประวัติการสมัครงาน</h3>
            <p className="text-xs text-[#667085] mt-1.5 mb-6 leading-relaxed">
              สำรวจตำแหน่งงานที่ตรงกับทักษะที่ได้รับการยืนยันของคุณ และยื่นใบสมัครได้ทันที
            </p>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] px-6 py-2.5 text-xs font-bold text-white shadow-xs shadow-indigo-500/20 transition"
            >
              ค้นหาตำแหน่งงาน <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {applications.map((app) => (
              <div
                key={app.id}
                className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition duration-200 space-y-6"
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-xl bg-[#f4f5fa] border border-slate-200/80 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <Building2 className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        {app.job.title}
                      </h2>
                      <span className="text-xs text-[#667085] font-medium">{app.job.companyName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {app.roundNumber && app.roundNumber > 1 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        รอบที่ {app.roundNumber}
                      </span>
                    )}
                    <span className="text-xs text-[#667085]">
                      ยื่นเมื่อ {new Date(app.createdAt).toLocaleDateString('th-TH')}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(
                        app.status,
                      )}`}
                    >
                      {getStatusLabel(app.status)}
                    </span>
                    {(app.status === 'APPLIED' || app.status === 'REVIEWING') && (
                      <button
                        id={`btn-cancel-app-${app.id}`}
                        onClick={() => setCancelTarget({ id: app.id, title: app.job.title })}
                        disabled={cancellingId === app.id}
                        className="px-3 py-1 text-xs font-semibold rounded-lg border border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-100 transition cursor-pointer"
                        title="ยกเลิกใบสมัคร"
                      >
                        {cancellingId === app.id ? 'กำลังยกเลิก...' : 'ยกเลิกใบสมัคร'}
                      </button>
                    )}
                    {(app.status === 'CANCELLED' || app.status === 'REJECTED') && (
                      <Link
                        href={`/jobs/${app.job.id}`}
                        className="px-3 py-1 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition flex items-center gap-1"
                      >
                        สมัครใหม่อีกครั้ง <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Status Update Alert Banner */}
                {app.statusHistory && app.statusHistory.length > 0 && app.statusHistory[0].newStatus !== 'APPLIED' && (
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      app.status === 'OFFER' || app.status === 'ACCEPTED'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                        : app.status === 'INTERVIEW' || app.status === 'TECHNICAL_TEST'
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-800'
                        : app.status === 'REJECTED'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                        : 'bg-amber-50/70 border-amber-200 text-amber-800'
                    }`}
                  >
                    <Bell className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <div className="font-bold flex items-center justify-between gap-2">
                        <span>การแจ้งเตือนสถานะ: {getStatusLabel(app.statusHistory[0].newStatus)}</span>
                        <span className="text-[10px] opacity-75 font-normal">
                          {new Date(app.statusHistory[0].createdAt).toLocaleString('th-TH')}
                        </span>
                      </div>
                      {app.statusHistory[0].note && (
                        <p className="mt-1 opacity-90 leading-relaxed font-medium">
                          {app.statusHistory[0].note}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Pipeline Progression Steps */}
                <div className="py-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-3 block">
                    ลำดับขั้นตอนการคัดเลือก (Recruitment Stages)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                    {[
                      { key: 'APPLIED', label: '1. ยื่นใบสมัคร' },
                      { key: 'REVIEWING', label: '2. พิจารณาประวัติ' },
                      { key: 'INTERVIEW', label: '3. นัดสัมภาษณ์' },
                      { key: 'TECHNICAL_TEST', label: '4. ทดสอบทักษะ' },
                      { key: 'OFFER', label: '5. เสนองาน' },
                      { key: 'ACCEPTED', label: '6. ตกลงร่วมงาน' },
                    ].map((step) => {
                      const isCurrent = app.status === step.key;
                      return (
                        <div
                          key={step.key}
                          className={`p-2.5 rounded-xl border text-[11px] font-semibold transition ${
                            isCurrent
                              ? 'bg-[#6366f1] text-white border-[#6366f1] shadow-xs shadow-indigo-500/20'
                              : 'bg-[#f8fafc] text-slate-400 border-slate-200/70'
                          }`}
                        >
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Candidate Skill Assessment Card */}
                {(() => {
                  const effectiveAssessment = app.assignedAssessment || app.job?.customAssessment;
                  if (!effectiveAssessment && app.status !== 'TECHNICAL_TEST') return null;

                  const customAttempt = (app.candidate?.assessmentAttempts || []).find(
                    (att: any) => att.assessmentId === effectiveAssessment?.id
                  );
                  const isPassed = customAttempt && (getAttemptPercentage(customAttempt) ?? -1) >= (effectiveAssessment?.passingScore || 70);

                  return (
                    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 p-5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-indigo-100/70">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-[#6366f1] text-white flex items-center justify-center shadow-xs shadow-indigo-500/20 shrink-0">
                            <Code2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                                {app.assignedAssessment ? 'แบบทดสอบที่ได้รับมอบหมายพิเศษ (Assigned Test)' : 'แบบทดสอบคัดกรองเฉพาะตำแหน่ง (Job Assessment)'}
                              </span>
                              {effectiveAssessment?.type && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                  {effectiveAssessment.type === 'PRACTICAL_CODING' ? 'Coding Sandbox' : 'Theory Quiz'}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                              {effectiveAssessment ? effectiveAssessment.title : 'แบบทดสอบทักษะเฉพาะทาง'}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {customAttempt ? (
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-500 block">คะแนนล่าสุด</span>
                                <span className="text-sm font-black text-indigo-700">{formatAttemptScore(customAttempt)}</span>
                              </div>
                              <span
                                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                  isPassed
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {getAttemptPercentage(customAttempt) === null ? 'รอตรวจ' : isPassed ? '✓ ผ่านเกณฑ์ (Passed)' : '✗ ยังไม่ผ่าน (Failed)'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-500" /> รอเข้าทำแบบทดสอบ
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          {effectiveAssessment?.timeLimitMinutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              เวลา: <strong>{effectiveAssessment.timeLimitMinutes} นาที</strong>
                            </span>
                          )}
                          {effectiveAssessment?.passingScore && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              เกณฑ์ผ่าน: <strong>{effectiveAssessment.passingScore}%</strong>
                            </span>
                          )}
                          {customAttempt?.completedAt && (
                            <span className="text-[11px] text-slate-400">
                              (ส่งข้อสอบเมื่อ: {new Date(customAttempt.completedAt).toLocaleDateString('th-TH')})
                            </span>
                          )}
                        </div>

                        {effectiveAssessment?.id && (
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/assessments/${effectiveAssessment.id}`}
                              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
                                customAttempt
                                  ? 'bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 shadow-slate-100'
                                  : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-indigo-500/20'
                              }`}
                            >
                              {customAttempt ? (
                                <>
                                  <span>ทำแบบทดสอบอีกครั้ง</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>เริ่มทำแบบทดสอบทันที</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </>
                              )}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Company Evaluation & Feedback Box */}
                {app.evaluation ? (
                  <div className="p-5 rounded-2xl bg-[#e8eaff]/40 border border-[#dce0ff]">
                    <div className="flex items-center justify-between mb-3.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#4f46e5] flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-[#6366f1]" />
                        ผลการประเมินและฟีดแบ็กจากผู้ว่าจ้าง
                      </h4>
                      <span className="text-[11px] font-semibold text-[#4f46e5] bg-white px-2.5 py-0.5 rounded-full border border-[#dce0ff]">
                        Verified by Hiring Team
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white p-3 rounded-xl text-center border border-slate-200/70">
                        <span className="text-[10px] uppercase font-bold text-[#667085] block">
                          Technical
                        </span>
                        <span className="text-base font-extrabold text-[#4f46e5]">
                          {app.evaluation.technicalScore} / 5
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl text-center border border-slate-200/70">
                        <span className="text-[10px] uppercase font-bold text-[#667085] block">
                          Problem Solving
                        </span>
                        <span className="text-base font-extrabold text-[#4f46e5]">
                          {app.evaluation.problemSolvingScore} / 5
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl text-center border border-slate-200/70">
                        <span className="text-[10px] uppercase font-bold text-[#667085] block">
                          Communication
                        </span>
                        <span className="text-base font-extrabold text-[#4f46e5]">
                          {app.evaluation.communicationScore} / 5
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl text-center border border-slate-200/70">
                        <span className="text-[10px] uppercase font-bold text-[#667085] block">
                          Teamwork
                        </span>
                        <span className="text-base font-extrabold text-[#4f46e5]">
                          {app.evaluation.teamworkScore} / 5
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed italic bg-white p-3.5 rounded-xl border border-slate-200/70">
                      &ldquo;{app.evaluation.overallFeedback}&rdquo;
                    </p>

                    <div className="mt-3.5 flex justify-end">
                      <Link
                        href="/courses"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4f46e5] hover:underline"
                      >
                        ดูคอร์สเรียนแนะนำเพิ่มเติมจากฟีดแบ็กนี้ <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#667085] italic bg-[#f9fafb] p-3 rounded-xl border border-slate-100">
                    ความเห็นและคะแนนประเมินจะแสดงที่นี่เมื่อผู้ว่าจ้างทำการตรวจสอบและประเมินรอบสัมภาษณ์
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {cancelTarget && <DeleteConfirmation
        title={cancelTarget.title}
        confirmLabel="ยืนยันการยกเลิกใบสมัคร"
        description="ใบสมัครนี้จะเปลี่ยนเป็นยกเลิก โดยยังเก็บประวัติไว้ คุณสามารถสมัครงานเดิมใหม่ในรอบถัดไปได้"
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => handleCancelApplication(cancelTarget.id)}
      />}

      <Footer />
    </div>
  );
}
