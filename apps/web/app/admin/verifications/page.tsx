'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import {
  Check,
  X,
  Building2,
  Clock,
  CheckCircle2,
  FileCheck2,
  ExternalLink,
  Paperclip,
} from 'lucide-react';
import { VerificationStatus } from '@smartcareer/shared';

const PAGE_SIZE = 10;
interface VerificationItem {
  id: string;
  businessRegNo: string | null;
  status: VerificationStatus;
  createdAt: string;
  reviewedAt: string | null;
  company: { id: string; name: string; logoUrl?: string | null };
  documents: { files: { name: string; downloadUrl?: string | null; dataUrl?: string | null }[] };
}
interface VerificationPage {
  items: VerificationItem[];
  total: number;
  page: number;
  pageCount: number;
  counts: { total: number; pending: number; verified: number; rejected: number };
}

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, pending: 0, verified: 0, rejected: 0 });
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const fetchVerifications = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    try {
      setLoading(true);
      setListError(null);
      const query = new URLSearchParams({ paginated: 'true', page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      const data = await apiRequest<VerificationPage | VerificationItem[]>(`/admin/verifications?${query}`, { signal });
      if (signal?.aborted || sequence !== requestSequence.current) return;
      if (Array.isArray(data)) {
        // Previous API remains usable during rolling deployment.
        setVerifications(data);
        setTotal(data.length);
        setPageCount(1);
        setCounts({ total: data.length, pending: data.filter(item => item.status === VerificationStatus.PENDING).length, verified: data.filter(item => item.status === VerificationStatus.VERIFIED).length, rejected: data.filter(item => item.status === VerificationStatus.REJECTED).length });
      } else {
        setVerifications(data.items);
        setTotal(data.total);
        setPageCount(data.pageCount);
        setPage(data.page);
        setCounts(data.counts);
      }
    } catch (e) {
      if (!signal?.aborted && sequence === requestSequence.current) {
        setListError(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      if (!signal?.aborted && sequence === requestSequence.current) setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchVerifications(controller.signal);
    return () => controller.abort();
  }, [fetchVerifications]);

  const selectFilter = (status: string) => {
    setPage(1);
    setStatusFilter(status);
  };

  const handleReview = async (id: string, action: 'APPROVE' | 'REJECT') => {
    if (reviewingId) return;
    setReviewingId(id);
    setActionError(null);
    try {
      await apiRequest(`/admin/verifications/${id}/review`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      setActionMsg(
        `ดำเนินการ ${action === 'APPROVE' ? 'อนุมัติการรับรอง' : 'ปฏิเสธคำขอ'} ขององค์กรเรียบร้อยแล้ว`
      );
      setTimeout(() => setActionMsg(null), 4000);
      await fetchVerifications();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'บันทึกผลไม่สำเร็จ กรุณาลองใหม่');
      await fetchVerifications();
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe] shadow-xs mb-3">
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>ตรวจรับรองนิติบุคคล · Employer Verification</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            ตรวจสอบ & อนุมัติการรับรองนิติบุคคลนายจ้าง
          </h1>
          <p className="text-slate-600 text-sm mt-1 max-w-3xl">
            พิจารณาตรวจสอบเลขทะเบียนนิติบุคคล 13 หลักจากกรมพัฒนาธุรกิจการค้า (DBD) เพื่อมอบสัญลักษณ์ Verified Employer และส่งเสริมความน่าเชื่อถือของประกาศงาน
          </p>
        </div>

        {/* Action Message Toast */}
        {actionMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{actionMsg}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white/95 border border-slate-200/90 rounded-[24px] p-4 mb-6 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => selectFilter('ALL')}
            disabled={loading || !!reviewingId}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({counts.total})
          </button>
          <button
            onClick={() => selectFilter(VerificationStatus.PENDING)}
            disabled={loading || !!reviewingId}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === VerificationStatus.PENDING
                ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
            }`}
          >
            <Clock className="h-3 w-3" />
            <span>รอการตรวจสอบ ({counts.pending})</span>
          </button>
          <button
            onClick={() => selectFilter(VerificationStatus.VERIFIED)}
            disabled={loading || !!reviewingId}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === VerificationStatus.VERIFIED
                ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
            }`}
          >
            <Check className="h-3 w-3" />
            <span>อนุมัติแล้ว ({counts.verified})</span>
          </button>
          <button
            onClick={() => selectFilter(VerificationStatus.REJECTED)}
            disabled={loading || !!reviewingId}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === VerificationStatus.REJECTED
                ? 'bg-rose-600 text-white shadow-xs shadow-rose-500/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
            }`}
          >
            <X className="h-3 w-3" />
            <span>ปฏิเสธคำขอ ({counts.rejected})</span>
          </button>
        </div>

        {actionError && <p role="alert" className="mb-4 text-sm font-semibold text-rose-600">{actionError}</p>}

        {/* Content Section */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mb-3"></div>
            <p className="text-sm font-semibold text-slate-500">กำลังโหลดรายการคำขอรับรอง... (Loading requests)</p>
          </div>
        ) : listError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <p role="alert" className="text-sm text-rose-700">{listError}</p>
            <button type="button" onClick={() => void fetchVerifications()} className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900">ลองโหลดอีกครั้ง</button>
          </div>
        ) : verifications.length === 0 ? (
          <div className="bg-white/95 border border-slate-200/90 rounded-[28px] p-14 text-center max-w-lg mx-auto shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <div className="h-14 w-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Building2 className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">ไม่พบคำขอรับรองในหมวดหมู่นี้</h3>
            <p className="text-xs text-slate-500 mt-1">
              เมื่อมีบริษัทนายจ้างยื่นเลขทะเบียนนิติบุคคล 13 หลักเข้ามา รายการจะแสดงขึ้นที่นี่
            </p>
          </div>
        ) : (
          <div className="bg-white/95 border border-slate-200/90 rounded-[28px] overflow-hidden shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm">
            <div className="divide-y divide-slate-100/90">
              {verifications.map((v) => {
                const isPending = v.status === VerificationStatus.PENDING;
                const isVerified = v.status === VerificationStatus.VERIFIED;
                const isRejected = v.status === VerificationStatus.REJECTED;

                return (
                  <div
                    key={v.id}
                    className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 hover:bg-slate-50/50 transition"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="h-14 w-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {v.company?.logoUrl ? (
                          <Image
                            src={v.company.logoUrl}
                            alt={v.company.name}
                            width={56}
                            height={56}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Building2 className="h-7 w-7 text-slate-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-black text-slate-900">
                            {v.company?.name || 'Company Name'}
                          </h3>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              isVerified
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {v.status}
                          </span>
                        </div>

                        {/* Tax ID */}
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                          <span className="text-slate-400 font-medium">เลขทะเบียนนิติบุคคล:</span>
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70 tracking-wider">
                            {v.businessRegNo || 'N/A'}
                          </span>
                        </div>

                        {/* Attached Documents */}
                        {v.documents?.files && Array.isArray(v.documents.files) && v.documents.files.length > 0 && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-500">เอกสารแนบ:</span>
                            {v.documents.files.map((file, fIdx) => (file.downloadUrl || file.dataUrl) ? (
                              <a
                                key={fIdx}
                                href={file.downloadUrl || file.dataUrl || undefined}
                                download={file.name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold border border-indigo-200/80 transition shadow-2xs"
                                title={`คลิกเพื่อเปิด/ดาวน์โหลด ${file.name}`}
                              >
                                <Paperclip className="h-3 w-3" />
                                <span className="truncate max-w-[160px]">{file.name}</span>
                                <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                              </a>
                            ) : <span key={fIdx} className="text-[11px] text-slate-400">{file.name} (ไม่พบไฟล์)</span>)}
                          </div>
                        )}

                        {/* Metadata */}
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>ยื่นเมื่อ: {new Date(v.createdAt).toLocaleString('th-TH')}</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {isPending ? (
                      <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
                        <button
                          onClick={() => handleReview(v.id, 'APPROVE')}
                          disabled={!!reviewingId}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-500/20 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>อนุมัติ (Approve)</span>
                        </button>
                        <button
                          onClick={() => handleReview(v.id, 'REJECT')}
                          disabled={!!reviewingId}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>ปฏิเสธ (Reject)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 font-medium self-start sm:self-center bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-100">
                        {v.reviewedAt
                          ? `ตรวจสอบเมื่อ ${new Date(v.reviewedAt).toLocaleDateString('th-TH')}`
                          : 'พิจารณาเสร็จสิ้น'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!loading && !listError && total > 0 && (
          <nav aria-label="หน้ารายการคำขอรับรอง" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>แสดง {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + verifications.length} จาก {total} รายการ</span>
            <div className="flex items-center gap-3">
              <button type="button" disabled={page <= 1 || !!reviewingId} onClick={() => setPage(current => current - 1)} className="rounded-full border border-slate-200 bg-white px-4 py-2 font-bold disabled:opacity-40">หน้าก่อน</button>
              <span aria-live="polite">หน้า {page} / {pageCount}</span>
              <button type="button" disabled={page >= pageCount || !!reviewingId} onClick={() => setPage(current => current + 1)} className="rounded-full border border-slate-200 bg-white px-4 py-2 font-bold disabled:opacity-40">หน้าถัดไป</button>
            </div>
          </nav>
        )}
      </main>

      <Footer />
    </div>
  );
}

