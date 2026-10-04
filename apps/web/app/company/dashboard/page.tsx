'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';
import {
  Building2,
  Briefcase,
  Users,
  ShieldCheck,
  PlusCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { VerificationStatus } from '@smartcareer/shared';

export default function CompanyDashboardPage() {
  useAuth();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/company/profile')
      .then((data) => setCompany(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        {loading ? (
          <div className="py-28 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-[#667085]">กำลังโหลดพื้นที่ทำงานองค์กร...</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 sm:p-8 rounded-[24px] border border-slate-200/90 bg-white/95 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="h-16 w-16 rounded-2xl bg-[#f4f5fa] border border-slate-200/80 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {company?.logoUrl ? (
                    <img src={company.logoUrl} alt={company.name} className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-8 w-8 text-[#4f46e5]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      {company?.name || 'My Company'}
                    </h1>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        company?.verificationStatus === VerificationStatus.VERIFIED
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {company?.verificationStatus === VerificationStatus.VERIFIED ? '✓ ยืนยันแล้ว' : 'รอการตรวจสอบ'}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] mt-1">{company?.address || 'ประเทศไทย'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/company/jobs/new"
                  className="flex items-center gap-1.5 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] px-5 py-2.5 text-xs font-bold text-white shadow-xs shadow-indigo-500/20 transition"
                >
                  <PlusCircle className="h-4 w-4" />
                  ลงประกาศงานใหม่
                </Link>
                <Link
                  href="/company/applications"
                  className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition"
                >
                  <Users className="h-4 w-4 text-[#4f46e5]" />
                  ดูรายชื่อผู้สมัคร
                </Link>
              </div>
            </div>

            {/* Verification Alert if Pending */}
            {company?.verificationStatus === VerificationStatus.PENDING && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>
                    เอกสารยืนยันสถานประกอบการของคุณกำลังอยู่ระหว่างการตรวจสอบโดยทีมผู้ดูแลระบบ (Admin)
                  </span>
                </div>
                <Link href="/company/profile" className="font-bold underline hover:text-amber-900 ml-2">
                  ตรวจดูเอกสาร
                </Link>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between text-[#667085] text-xs font-bold mb-2">
                  <span>ตำแหน่งงานที่เปิดรับ (Active Jobs)</span>
                  <Briefcase className="h-4 w-4 text-[#4f46e5]" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {company?.jobs?.filter((j: any) => j.isActive).length || 0}
                </div>
              </div>

              <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between text-[#667085] text-xs font-bold mb-2">
                  <span>จำนวนผู้สมัครทั้งหมด (Applicants)</span>
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {company?.jobs?.reduce((acc: number, j: any) => acc + (j._count?.applications || 0), 0) || 0}
                </div>
              </div>

              <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between text-[#667085] text-xs font-bold mb-2">
                  <span>สถานะการยืนยันตัวตน</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {company?.verificationStatus === VerificationStatus.VERIFIED ? 'ยืนยันเรียบร้อย' : 'รอการอนุมัติ'}
                </div>
              </div>
            </div>

            {/* Recent Jobs Table */}
            <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  ตำแหน่งงานล่าสุด (Recent Job Listings)
                </h3>
                <Link href="/company/jobs" className="text-xs font-bold text-[#4f46e5] hover:underline">
                  ดูและจัดการทั้งหมด →
                </Link>
              </div>

              {company?.jobs?.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#667085]">
                  ยังไม่มีการเปิดรับสมัครงาน คลิก &apos;ลงประกาศงานใหม่&apos; เพื่อเริ่มรับสมัคร
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {company?.jobs?.map((job: any) => (
                    <div key={job.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{job.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#667085]">
                          <span>{job.location}</span>
                          <span>•</span>
                          <span>{job.employmentType}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#4f46e5]">
                            ผู้สมัคร {job._count?.applications || 0} คน
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/company/applications?jobId=${job.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4f46e5] hover:text-[#4338ca] self-start sm:self-auto"
                      >
                        Pipeline ผู้สมัคร <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
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
