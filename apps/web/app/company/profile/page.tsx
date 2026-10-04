'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
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
  Phone,
  Upload,
  Trash2,
  Paperclip,
  FileCheck2,
  ExternalLink,
} from 'lucide-react';
import { VerificationStatus, VERIFICATION_MAX_BYTES, VERIFICATION_MAX_FILES, VERIFICATION_MIME_TYPES } from '@smartcareer/shared';
import { companyVerificationLabels, getCompanyVerificationState } from '@/lib/company-verification';

interface UploadedDocument {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export default function CompanyProfilePage() {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Verification Form States
  const [taxId, setTaxId] = useState('');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const documentReadInProgress = useRef(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const data = await apiRequest('/company/profile');
      setCompany(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setWebsite(data.website || '');
      setAddress(data.address || '');
      setContactEmail(data.contactEmail || '');
      setContactPhone(data.contactPhone || '');
      setLogoUrl(data.logoUrl || null);
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

  // Handle Logo Upload (Direct file selection to Base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setLogoError('รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoError('ขนาดไฟล์โลโก้ต้องไม่เกิน 5MB');
      return;
    }

    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoError(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  // Handle Document Upload (Multiple files to Base64)
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || documentReadInProgress.current || verifying || isPending || isVerified) return;
    setVerificationError(null);
    if (files.some(file => !VERIFICATION_MIME_TYPES.includes(file.type) || file.size === 0 || file.name.length > 255)) {
      setVerificationError('กรุณาเลือกไฟล์ PDF, JPG หรือ PNG ที่มีข้อมูลและชื่อไม่เกิน 255 ตัวอักษร');
      return;
    }
    if (documents.length + files.length > VERIFICATION_MAX_FILES) {
      setVerificationError('แนบเอกสารได้ไม่เกิน 5 ไฟล์');
      return;
    }
    if ([...documents, ...files].reduce((total, file) => total + file.size, 0) > VERIFICATION_MAX_BYTES) {
      setVerificationError('เอกสารทั้งหมดรวมกันต้องไม่เกิน 6MB');
      return;
    }
    documentReadInProgress.current = true;
    setDocumentLoading(true);
    try {
      const selected = await Promise.all(files.map(file => new Promise<UploadedDocument>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result as string });
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ กรุณาเลือกไฟล์ใหม่'));
        reader.onabort = () => reject(new Error('การอ่านไฟล์ถูกยกเลิก กรุณาเลือกไฟล์ใหม่'));
        reader.readAsDataURL(file);
      })));
      setDocuments(prev => [...prev, ...selected]);
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ กรุณาเลือกไฟล์ใหม่');
    } finally {
      documentReadInProgress.current = false;
      setDocumentLoading(false);
    }
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    try {
      await apiRequest('/company/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          description,
          website,
          address,
          contactEmail,
          contactPhone,
          logoUrl,
        }),
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
    if (verifying || documentReadInProgress.current || isVerified || isPending) return;
    setVerificationError(null);
    if (!/^[0-9]{13}$/.test(taxId)) {
      setVerificationError('เลขทะเบียนหรือเลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก');
      return;
    }
    if (!documents.length) {
      setVerificationError('กรุณาแนบเอกสารอย่างน้อย 1 ไฟล์');
      return;
    }
    setVerifying(true);
    setSuccess(null);
    try {
      await apiRequest('/company/verify', {
        method: 'POST',
        body: JSON.stringify({
          businessRegNo: taxId,
          documents: {
            files: documents.map((d) => ({
              name: d.name,
              type: d.type,
              size: d.size,
              dataUrl: d.dataUrl,
            })),
          },
        }),
      });
      setSuccess('ส่งคำขอรับรองนิติบุคคลและเอกสารไปยังผู้ดูแลระบบเรียบร้อยแล้ว');
      setDocuments([]);
      setTimeout(() => setSuccess(null), 4000);
      await fetchProfile();
    } catch (err: any) {
      setVerificationError(err.message || 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
      // Another tab may have submitted while this form was open.
      await fetchProfile();
    } finally {
      setVerifying(false);
    }
  };

  const verificationState = getCompanyVerificationState(company);
  const isVerified = verificationState === VerificationStatus.VERIFIED;
  const isPending = verificationState === VerificationStatus.PENDING;
  const existingVerification = company?.verifications?.[0];
  const existingFiles: any[] = existingVerification?.documents?.files || [];

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
            จัดการข้อมูลแบรนด์องค์กร โลโก้ ช่องทางการติดต่อ และยื่นเอกสารรับรองนิติบุคคลเพื่อรับตรา Verified Employer
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
                    {companyVerificationLabels[verificationState]}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {isVerified
                      ? 'ได้รับการยืนยันความถูกต้องแล้ว'
                      : isPending
                      ? 'อยู่ระหว่างรอผู้ดูแลระบบตรวจสอบเอกสาร'
                      : verificationState === VerificationStatus.REJECTED
                      ? 'กรุณาตรวจข้อมูลและเอกสารก่อนส่งคำขอใหม่'
                      : 'ยังไม่ได้ส่งคำขอและเอกสารให้ผู้ดูแลระบบ'}
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
                  <span>{verificationState === VerificationStatus.REJECTED ? 'Request Rejected' : 'Not Submitted'}</span>
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

              {/* Company Logo Upload Section */}
              <div className="p-5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 flex flex-col sm:flex-row items-center gap-5">
                <div className="h-20 w-20 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt="Company Logo Preview"
                      width={80}
                      height={80}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-9 w-9 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-bold text-slate-800">โลโก้บริษัท (Company Logo)</span>
                    <span className="text-[10px] text-slate-400 font-medium">PNG, JPG, WebP, SVG ไม่เกิน 5MB</span>
                  </div>

                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />

                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-bold shadow-2xs transition"
                    >
                      <Upload className="h-3.5 w-3.5 text-indigo-600" />
                      <span>{logoUrl ? 'เปลี่ยนโลโก้ (Change)' : 'อัปโหลดโลโก้ (Upload)'}</span>
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>ลบรูป</span>
                      </button>
                    )}
                  </div>

                  {logoError && (
                    <p className="text-[11px] font-semibold text-rose-600">{logoError}</p>
                  )}
                </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    เบอร์โทรศัพท์ติดต่อ (Contact Phone)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="เช่น 02-123-4567 หรือ 081-234-5678"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200/90 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  ข้อมูลและโลโก้จะแสดงต่อผู้สมัครเมื่อเปิดดูหน้ารายละเอียดงานของคุณ
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
              className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm space-y-6"
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
                กรอกเลขทะเบียนพาณิชย์ หรือเลขประจำตัวผู้เสียภาษีอากร 13 หลักของกรมพัฒนาธุรกิจการค้า (DBD) พร้อมแนบเอกสารรับรอง เพื่อให้ผู้ดูแลระบบตรวจสอบความถูกต้อง และปลดล็อกสัญลักษณ์ <strong className="text-indigo-600">Verified Employer</strong> ซึ่งช่วยเพิ่มความเชื่อมั่นและอัตราการคลิกสมัครงาน
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
                  minLength={13}
                  pattern="[0-9]{13}"
                  inputMode="numeric"
                  title="กรุณากรอกตัวเลข 13 หลัก"
                  disabled={verifying || isPending || isVerified}
                  className="w-full rounded-2xl border border-slate-200/90 px-4 py-3 text-xs font-mono font-bold text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition tracking-wider"
                />
              </div>

              {/* Documents Attachment Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    เอกสารแนบประกอบการพิจารณา (Verification Documents)
                  </label>
                  <span className="text-[11px] text-slate-400">PDF, JPG, PNG สูงสุด 5 ไฟล์ รวมไม่เกิน 6MB</span>
                </div>

                <input
                  type="file"
                  ref={docInputRef}
                  multiple
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleDocumentUpload}
                  disabled={documentLoading || verifying || isPending || isVerified}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={documentLoading || verifying || isPending || isVerified}
                  onClick={() => docInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200/90 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group bg-slate-50/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
                    <Paperclip className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    คลิกเพื่อเลือกไฟล์เอกสารแนบ (เช่น หนังสือรับรองบริษัท, ภ.พ.20)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {documentLoading ? 'กำลังอ่านไฟล์...' : 'ต้องแนบเอกสารอย่างน้อย 1 ไฟล์'}
                  </p>
                </button>

                {/* Newly Added Documents to Upload */}
                {documents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      ไฟล์ที่เลือกแนบ ({documents.length})
                    </span>
                    <div className="space-y-2">
                      {documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileCheck2 className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">{doc.name}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({(doc.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(idx)}
                            disabled={documentLoading || verifying || isPending || isVerified}
                            className="p-1 text-slate-400 hover:text-rose-600 transition shrink-0"
                            title="ลบไฟล์นี้"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previously Uploaded Documents */}
                {existingFiles.length > 0 && documents.length === 0 && (
                  <div className="mt-3 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      เอกสารที่เคยยื่นไว้ ({existingFiles.length})
                    </span>
                    <div className="space-y-2">
                      {existingFiles.map((doc: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">{doc.name}</span>
                            {doc.size && (
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({(doc.size / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                          {doc.dataUrl && (
                            <a
                              href={doc.dataUrl}
                              download={doc.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-bold shrink-0"
                            >
                              <span>ดาวน์โหลด</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {verificationError && <p role="alert" className="text-xs font-semibold text-rose-600">{verificationError}</p>}

              <div className="pt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                  <span>ใช้เวลาตรวจสอบประมาณ 1 วันทำการ</span>
                </span>
                <button
                  type="submit"
                  disabled={documentLoading || verifying || isVerified || isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>
                    {verifying
                      ? 'กำลังส่งคำขอ...'
                      : isVerified
                      ? 'ยืนยันตัวตนแล้ว (Verified)'
                      : isPending
                      ? 'ส่งคำขอแล้ว รอผู้ดูแลตรวจสอบ'
                      : 'ยื่นตรวจสอบสิทธิ์พร้อมเอกสาร (Submit Verification)'}
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
