'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Building2,
  Briefcase,
  BookOpen,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Zap,
  Layers,
  FileCheck2,
  Clock,
  ChevronRight,
  Code2,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/admin/dashboard')
      .then((data) => setStats(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe] shadow-xs mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ระบบดูแลหลังบ้านส่วนกลาง · Platform Administration</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                ศูนย์ควบคุมระบบ & บันทึกสถานะการทำงาน
              </h1>
              <p className="text-slate-600 text-sm mt-1 max-w-2xl">
                ติดตามเมตริกผู้ใช้งาน ตรวจรับรองเอกสารนายจ้าง ตรวจสอบการดึงข้อมูลจาก Scrapers & RapidAPI และสถานะระบบแบบเรียลไทม์
              </p>
            </div>

            {/* Quick Admin Navigation Pills */}
            <div className="flex items-center flex-wrap gap-2">
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
              >
                <Users className="h-3.5 w-3.5" />
                <span>ผู้ใช้งาน (Users)</span>
              </Link>
              <Link
                href="/admin/skills"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>ทักษะ (Skills)</span>
              </Link>
              <Link
                href="/admin/assessments"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#eef2ff] border border-[#c7d2fe] text-[#4f46e5] hover:bg-[#e0e7ff] shadow-xs transition"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>แบบทดสอบ (Assessments)</span>
              </Link>
              <Link
                href="/admin/ingestion"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Scrapers & Sync</span>
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

        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mb-3"></div>
            <p className="text-sm font-semibold text-slate-500">กำลังโหลดข้อมูลภาพรวมระบบ... (Loading system metrics)</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Users Card */}
              <div className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm hover:shadow-[0_16px_40px_rgba(124,58,237,0.08)] hover:border-purple-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
                    <span className="uppercase tracking-wider">บัญชีผู้ใช้ทั้งหมด</span>
                    <div className="h-8 w-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats?.totalUsers || 0}
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>ผู้หางาน {stats?.totalCandidates || 0}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>บริษัท {stats?.totalCompanies || 0}</span>
                </div>
              </div>

              {/* Pending Verifications Card */}
              <div className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm hover:shadow-[0_16px_40px_rgba(245,158,11,0.08)] hover:border-amber-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-amber-600 mb-3">
                    <span className="uppercase tracking-wider">รอยืนยันนิติบุคคล</span>
                    <div className="h-8 w-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-amber-600 tracking-tight">
                    {stats?.pendingVerifications || 0}
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">คำขอใหม่รอพิจารณา</span>
                  <Link
                    href="/admin/verifications"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6366f1] hover:text-[#4f46e5]"
                  >
                    <span>ตรวจสอบ</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Active Jobs Card */}
              <div className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm hover:shadow-[0_16px_40px_rgba(59,130,246,0.08)] hover:border-blue-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-blue-600 mb-3">
                    <span className="uppercase tracking-wider">ตำแหน่งงานที่เปิดรับ</span>
                    <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <Briefcase className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats?.totalJobs || 0}
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                  {stats?.totalApplications || 0} การสมัครงานทั้งหมดในระบบ
                </div>
              </div>

              {/* Curated Courses Card */}
              <div className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm hover:shadow-[0_16px_40px_rgba(16,185,129,0.08)] hover:border-emerald-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-600 mb-3">
                    <span className="uppercase tracking-wider">คอร์สเรียนทักษะไอที</span>
                    <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <BookOpen className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats?.totalCourses || 0}
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                  ซิงก์จาก YouTube & Udemy Verified
                </div>
              </div>
            </div>

            {/* Ingestion & Scheduler Audit Summary */}
            <div className="rounded-[28px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      บันทึกการทำงานของ Ingestion Engine ล่าสุด
                    </h3>
                    <p className="text-xs text-slate-500">
                      ผลการทำงานของตัวดึงข้อมูลอัตโนมัติ (Automated Scrapers & Sync Audit Logs)
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin/ingestion"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-xs shadow-indigo-500/20 transition self-start sm:self-auto"
                >
                  <span>จัดการ Scheduler & รัน Sync ทันที</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {!stats?.recentLogs || stats.recentLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  ยังไม่มีประวัติการรัน Ingestion บันทึกไว้
                </div>
              ) : (
                <div className="divide-y divide-slate-100/90">
                  {stats.recentLogs.map((log: any) => {
                    const isSuccess = log.status === 'SUCCESS';
                    return (
                      <div
                        key={log.id}
                        className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 rounded-2xl px-3 transition"
                      >
                        <div className="flex items-center gap-3.5">
                          <span
                            className={`h-3 w-3 rounded-full shrink-0 ${
                              isSuccess ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500 ring-4 ring-amber-100'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-xs">
                                {log.source}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isSuccess
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {log.status}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              เวลาที่รัน: {new Date(log.startedAt).toLocaleString('th-TH')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs pl-6 md:pl-0">
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                            +{log.createdCount} เพิ่มใหม่
                          </span>
                          <span className="text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                            {log.duplicateCount} ซ้ำ (ข้าม)
                          </span>
                          {log.errorCount > 0 && (
                            <span className="text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                              {log.errorCount} ข้อผิดพลาด
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

