'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import DeleteConfirmation from '@/components/DeleteConfirmation';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';
import {
  Briefcase,
  PlusCircle,
  MapPin,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Power,
  Trash2,
} from 'lucide-react';

export default function CompanyJobsManagePage() {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCompany = () => {
    setLoading(true);
    apiRequest('/company/profile')
      .then((data) => setCompany(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCompany();
  }, []);

  const handleToggleJob = async (jobId: string) => {
    try {
      setActionLoading(jobId);
      await apiRequest(`/company/jobs/${jobId}/toggle`, { method: 'PATCH' });
      fetchCompany();
    } catch (err: any) {
      alert(`ไม่สามารถเปลี่ยนสถานะงานได้: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = (id: string, title: string) => setDeleteTarget({ id, title });
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3.5 py-1 text-[11px] font-[750] text-[#4f46e5] mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Our Job Openings · ตำแหน่งงานที่เปิดรับสมัคร
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              ตำแหน่งงานที่เปิดรับ (Our Jobs)
            </h1>
            <p className="text-[13px] text-[#667085] mt-1">
              จัดการและติดตามสถานะตำแหน่งงานทั้งหมดของ {company?.name || 'องค์กรของคุณ'}
            </p>
          </div>

          <Link
            href="/company/jobs/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] px-6 py-2.5 text-xs font-bold text-white shadow-xs shadow-indigo-500/20 transition self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" />
            ลงประกาศงานใหม่
          </Link>
        </div>

        {loading ? (
          <div className="py-28 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-[#667085]">กำลังโหลดรายการตำแหน่งงาน...</span>
          </div>
        ) : company?.jobs?.length === 0 ? (
          <div className="bg-white/95 border border-slate-200/90 rounded-[24px] p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="h-16 w-16 rounded-2xl bg-[#e8eaff] text-[#4f46e5] flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">ยังไม่มีประกาศรับสมัครงาน</h3>
            <p className="text-xs text-[#667085] mt-1.5 mb-6">
              เริ่มค้นหาบุคลากรที่มีทักษะตรงกับความต้องการโดยลงประกาศงานแรกของคุณ
            </p>
            <Link
              href="/company/jobs/new"
              className="inline-flex items-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] px-6 py-2.5 text-xs font-bold text-white shadow-xs shadow-indigo-500/20 transition"
            >
              <PlusCircle className="h-4 w-4" />
              ลงประกาศงานใหม่
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {company?.jobs?.map((job: any) => (
              <div
                key={job.id}
                className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{job.title}</h3>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        job.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : (job.acceptedQuota && (job.applications?.length || 0) >= job.acceptedQuota)
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {job.isActive
                        ? 'เปิดรับสมัคร'
                        : (job.acceptedQuota && (job.applications?.length || 0) >= job.acceptedQuota)
                          ? 'ครบโควตาแล้ว (Auto-Closed)'
                          : 'ปิดรับสมัครแล้ว'}
                    </span>
                  </div>

                  <p className="text-xs text-[#667085] line-clamp-2 mt-1 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 bg-[#f9fafb] px-3 py-1 rounded-full border border-slate-200/70 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {job.location}
                    </span>
                    <span className="bg-[#e8eaff] text-[#4f46e5] px-3 py-1 rounded-full border border-[#dce0ff] font-bold">
                      ใบสมัคร {job._count?.applications || 0} รายการ
                    </span>
                    {job.acceptedQuota && (
                      <span className="flex items-center gap-1 bg-[#f0fdf4] text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 font-semibold">
                        🎯 โควตา: {job.applications?.length || 0} / {job.acceptedQuota} อัตรา
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs">
                    <Link
                      href={`/jobs/${job.id}`}
                      target="_blank"
                      className="text-[#667085] hover:text-slate-900 font-medium inline-flex items-center gap-1 transition"
                    >
                      ดูหน้าสาธารณะ <ExternalLink className="h-3 w-3" />
                    </Link>

                    <Link
                      href={`/company/applications?jobId=${job.id}`}
                      className="inline-flex items-center gap-1 font-bold text-[#4f46e5] hover:text-[#4338ca] transition"
                    >
                      ดู Pipeline ผู้สมัคร
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {/* Actions Bar: Toggle Status & Delete */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleToggleJob(job.id)}
                      disabled={actionLoading === job.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold border transition ${
                        job.isActive
                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <Power className="h-3 w-3" />
                      <span>{job.isActive ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteJob(job.id, job.title)}
                      disabled={actionLoading === job.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>ลบงาน</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {deleteTarget && <DeleteConfirmation title={deleteTarget.title} description="งานนี้และข้อมูลใบสมัครที่เกี่ยวข้องจะถูกลบถาวร ไม่สามารถกู้คืนผ่านหน้าเว็บได้"
        onCancel={() => setDeleteTarget(null)} onConfirm={async () => {
          await apiRequest(`/company/jobs/${deleteTarget.id}`, { method: 'DELETE' });
          fetchCompany();
        }} />}
      <Footer />
    </div>
  );
}
