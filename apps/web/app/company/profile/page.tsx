'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import {
  Building2,
  ShieldCheck,
  Save,
  CheckCircle2,
  Clock,
  Globe,
  Mail,
  MapPin,
  FileText,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { VerificationStatus } from '@smartcareer/shared';

export default function CompanyProfilePage() {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [taxId, setTaxId] = useState('');

  const fetchProfile = async () => {
    try {
      const data = await apiRequest('/company/profile');
      setCompany(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setWebsite(data.website || '');
      setAddress(data.address || '');
      setContactEmail(data.contactEmail || '');
      setTaxId(data.verifications?.[0]?.businessRegNo || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    try {
      await apiRequest('/company/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, description, website, address, contactEmail }),
      });
      setSuccess('บันทึกข้อมูลโปรไฟล์บริษัทเรียบร้อยแล้ว (Profile updated successfully)');
      setTimeout(() => setSuccess(null), 4000);
      fetchProfile();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxId) return;
    setVerifying(true);
    setSuccess(null);
    try {
      await apiRequest('/company/verify', {
        method: 'POST',
        body: JSON.stringify({ businessRegNo: taxId }),
      });
      setSuccess('ส่งคำขอรับรองนิติบุคคลไปยังผู้ดูแลระบบแล้ว (Verification request submitted)');
      setTimeout(() => setSuccess(null), 4000);
      fetchProfile();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const isVerified = company?.verificationStatus === VerificationStatus.VERIFIED;
  const isPending = company?.verificationStatus === VerificationStatus.PENDING;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff] shadow-xs mb-3">
            <Building2 className="h-3.5 w-3.5" />
            <span>ข้อมูลองค์กรและสิทธิ์ · Organization Profile & Trust</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            โปรไฟล์บริษัท & การยืนยันตัวตน
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            จัดการข้อมูลแบรนด์องค์กร การติดต่อ และยื่นคำขอยืนยันนิติบุคคลด้วยเลขประจำตัวผู้เสียภาษี 13 หลักเพื่อรับตรา Verified
          </p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mb-3"></div>
            <p className="text-sm font-semibold text-slate-500">กำลังโหลดข้อมูลบริษัท... (Loading company profile)</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Status Banner Card */}
            <div className="bg-white/95 border border-slate-200/90 rounded-[24px] p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                  สถานะการรับรององค์กร (Employer Verification Status)
                </span>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-lg font-black px-3.5 py-1 rounded-full inline-block border ${
                      isVerified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isPending
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {company?.verificationStatus || 'UNVERIFIED'}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {isVerified
                      ? 'ได้รับการยืนยันความถูกต้องแล้ว'
                      : isPending
                      ? 'อยู่ระหว่างรอผู้ดูแลระบบตรวจสอบเอกสาร'
                      : 'ยังไม่ได้ยืนยันตัวตน'}
                  </span>
                </div>
              </div>

              {isVerified ? (
                <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-700 bg-emerald-50/80 px-4 py-2.5 rounded-full border border-emerald-200 shadow-xs">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span>Verified Employer Active</span>
                </div>
              ) : isPending ? (
                <div className="flex items-center gap-2.5 text-xs font-bold text-amber-700 bg-amber-50/80 px-4 py-2.5 rounded-full border border-amber-200 shadow-xs">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span>Pending Admin Review</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 bg-slate-100 px-4 py-2.5 rounded-full border border-slate-200 shadow-xs">
                  <AlertCircle className="h-5 w-5 text-slate-400" />
                  <span>Not Verified</span>
                </div>
              )}
            </div>

            {/* General Profile Form */}
            <form
              onSubmit={handleSave}
              className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm space-y-6"
            >
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <FileText className="h-4 w-4 text-[#4f46e5]" />
                <h3 className="text-base font-black text-slate-900">
                  ข้อมูลทั่วไปของบริษัท (General Information)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ชื่อบริษัทหรือองค์กร (Company Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น TechVanguard Innovations Co., Ltd."
                    className="w-full rounded-2xl border border-slate-200/90 px-4 py-3 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    เว็บไซต์ทางการ (Official Website)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://company.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200/90 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เกี่ยวกับบริษัทและวิสัยทัศน์ (About & Vision)
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="อธิบายธุรกิจ วัฒนธรรมองค์กร พันธกิจ และเทคโนโลยีที่ทีมของคุณใช้งาน เพื่อดึงดูดผู้สมัครที่มีความสามารถ..."
                  className="w-full rounded-2xl border border-slate-200/90 p-4 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ที่ตั้งสำนักงานใหญ่ (HQ Address)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="เช่น อาคาร AIA Sathorn Tower ชั้น 24 กรุงเทพฯ"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200/90 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    อีเมลติดต่อฝ่ายสรรหา (Recruiting Contact Email)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="hr@company.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200/90 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  ข้อมูลจะแสดงต่อผู้สมัครเมื่อเปิดดูหน้ารายละเอียดงานของคุณ
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] px-6 py-2.5 text-xs font-bold text-white shadow-xs shadow-indigo-500/20 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์ (Save Profile)'}</span>
                </button>
              </div>
            </form>

            {/* Official Verification Submission Form */}
            <form
              onSubmit={handleVerify}
              className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23/42,0.04)] backdrop-blur-sm space-y-5"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#4f46e5]" />
                  <h3 className="text-base font-black text-slate-900">
                    ยื่นคำขอรับรองนิติบุคคล (Business Verification)
                  </h3>
                </div>
                {isVerified && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    ยืนยันตัวตนสำเร็จแล้ว
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                กรอกเลขทะเบียนพาณิชย์ หรือเลขประจำตัวผู้เสียภาษีอากร 13 หลักของกรมพัฒนาธุรกิจการค้า (DBD) เพื่อให้ผู้ดูแลระบบตรวจสอบความน่าเชื่อถือ และปลดล็อกสัญลักษณ์ <strong className="text-indigo-600">Verified Employer</strong> ซึ่งช่วยเพิ่มอัตราการคลิกสมัครงานจากผู้หางานชั้นนำ
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เลขทะเบียนนิติบุคคล / เลขประจำตัวผู้เสียภาษี 13 หลัก (13-Digit Tax ID / Reg No.) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="เช่น 0105562089123"
                  maxLength={13}
                  className="w-full rounded-2xl border border-slate-200/90 px-4 py-3 text-xs font-mono font-bold text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition tracking-wider"
                />
              </div>

              <div className="pt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                  <span>ใช้เวลาตรวจสอบประมาณ 1 วันทำการ</span>
                </span>
                <button
                  type="submit"
                  disabled={verifying || isVerified}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>
                    {verifying
                      ? 'กำลังส่งคำขอ...'
                      : isVerified
                      ? 'ยืนยันตัวตนแล้ว (Verified)'
                      : 'ยื่นตรวจสอบสิทธิ์ (Submit Verification)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

