'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Briefcase, ArrowLeft, Plus, Trash2, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function NewJobPage() {
  const router = useRouter();
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [companyAssessments, setCompanyAssessments] = useState<any[]>([]);
  const [customAssessmentId, setCustomAssessmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('กรุงเทพมหานคร, ประเทศไทย');
  const [isRemote, setIsRemote] = useState(false);
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [salaryMin, setSalaryMin] = useState('60000');
  const [salaryMax, setSalaryMax] = useState('110000');
  const [acceptedQuota, setAcceptedQuota] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [benefits, setBenefits] = useState('');

  const [selectedSkills, setSelectedSkills] = useState<
    Array<{ skillId: string; isRequired: boolean; minimumScore: number }>
  >([]);

  useEffect(() => {
    apiRequest('/skills').then((data) => {
      setSkillsList(data);
      if (data.length > 0) {
        setSelectedSkills([
          { skillId: data[0].id, isRequired: true, minimumScore: 70 },
        ]);
      }
    });

    apiRequest('/company/assessments')
      .then((data) => setCompanyAssessments(data || []))
      .catch(() => []);
  }, []);

  const handleAddSkill = () => {
    if (skillsList.length === 0) return;
    setSelectedSkills((prev) => [
      ...prev,
      { skillId: skillsList[0].id, isRequired: true, minimumScore: 65 },
    ]);
  };

  const handleRemoveSkill = (index: number) => {
    setSelectedSkills((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSkillChange = (index: number, field: string, value: any) => {
    setSelectedSkills((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/company/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title,
          location,
          isRemote,
          employmentType,
          salaryMin,
          salaryMax,
          acceptedQuota: acceptedQuota ? parseInt(acceptedQuota) : null,
          description,
          requirements,
          benefits,
          customAssessmentId: customAssessmentId || null,
          skills: selectedSkills,
        }),
      });
      router.push('/company/dashboard');
    } catch (err: any) {
      alert(`Job creation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-8 max-w-4xl mx-auto w-full">
        <Link
          href="/company/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#4f46e5] mb-6 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> กลับสู่แดชบอร์ดบริษัท
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3.5 py-1 text-[11px] font-[750] text-[#4f46e5] mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Recruitment Publisher · สร้างประกาศงานใหม่
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            ลงประกาศรับสมัครงาน
          </h1>
          <p className="text-[13px] text-[#667085] mt-1.5">
            ระบุรายละเอียดตำแหน่งงานและกำหนดเกณฑ์ทักษะที่ต้องการ เพื่อให้ระบบจับคู่ Candidate ตามคะแนน Match Score 70/20
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)] space-y-6"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ชื่อตำแหน่งงาน (Job Title)
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น Senior Full Stack Developer (Next.js & NestJS)"
              className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">สถานที่ทำงาน (Location)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">รูปแบบการจ้าง (Type)</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition cursor-pointer"
              >
                <option value="FULL_TIME">งานประจำ (Full Time)</option>
                <option value="CONTRACT">สัญญาจ้าง (Contract)</option>
                <option value="INTERNSHIP">ฝึกงาน (Internship)</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRemote}
                  onChange={(e) => setIsRemote(e.target.checked)}
                  className="rounded text-[#6366f1] focus:ring-[#6366f1]"
                />
                เปิดรับทำงานแบบ Remote
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">เงินเดือนขั้นต่ำ (บาท)</label>
              <input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">เงินเดือนสูงสุด (บาท)</label>
              <input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>โควตารับสมัคร (Accepted Quota)</span>
                <span className="text-[10px] text-slate-400 font-normal">Auto-Close</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="เช่น 1 หรือ 2 (ไม่จำกัดให้เว้นว่าง)"
                value={acceptedQuota}
                onChange={(e) => setAcceptedQuota(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              รายละเอียดและหน้าที่รับผิดชอบ (Job Description)
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุหน้าที่หลักในแต่ละวัน ความท้าทาย และโครงสร้างทีม..."
              className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] p-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              คุณสมบัติที่ต้องการ (Requirements / Qualifications)
            </label>
            <textarea
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="เช่น ประสบการณ์ 3 ปีขึ้นไป, ความเข้าใจในสถาปัตยกรรม Microservices..."
              className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] p-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">สวัสดิการ (Benefits)</label>
            <textarea
              rows={2}
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="เช่น ประกันสุขภาพกลุ่ม, เวลาทำงานยืดหยุ่น, กองทุนสำรองเลี้ยงชีพ..."
              className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] p-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition leading-relaxed"
            />
          </div>

          {/* Skill Requirements Configuration */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ทักษะที่ต้องการสำหรับคำนวณ Match Score (70/20 Algorithm)
                </h3>
                <p className="text-xs text-[#667085]">
                  ระบบจะนำทักษะที่กำหนดไปประเมินกับหลักฐานและคะแนนเรดาร์ของ Candidate
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSkill}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e8eaff] hover:bg-[#dce0ff] text-[#4f46e5] text-xs font-bold transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> เพิ่มทักษะ
              </button>
            </div>

            <div className="space-y-3">
              {selectedSkills.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#f9fafb] border border-slate-200/80"
                >
                  <div className="flex-1">
                    <select
                      value={item.skillId}
                      onChange={(e) => handleSkillChange(index, 'skillId', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition cursor-pointer"
                    >
                      {skillsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-medium text-[#667085]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        onChange={(e) => handleSkillChange(index, 'isRequired', e.target.checked)}
                        className="rounded text-[#6366f1] focus:ring-[#6366f1]"
                      />
                      <span>จำเป็น (Required 70%)</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <span>เกณฑ์คะแนนขั้นต่ำ:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.minimumScore}
                        onChange={(e) => handleSkillChange(index, 'minimumScore', Number(e.target.value))}
                        className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1 text-center font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20"
                      />
                      <span>%</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(index)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition ml-1"
                      title="ลบทักษะนี้"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Assessment Link */}
          <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#6366f1]" />
                แบบทดสอบคัดกรองเฉพาะตำแหน่ง (Technical Assessment)
              </h2>
              <span className="text-[10px] font-bold bg-[#f5f3ff] text-[#7c3aed] px-2.5 py-0.5 rounded-full border border-[#ddd6fe]">
                ตัวเลือกเสริม (Optional)
              </span>
            </div>
            <p className="text-xs text-[#667085] mb-4 leading-relaxed">
              ผู้สมัครในตำแหน่งนี้จะได้รับมอบหมายให้ทำแบบทดสอบเพื่อพิสูจน์ทักษะจริงผ่าน Judge0 Sandbox
            </p>

            <select
              value={customAssessmentId}
              onChange={(e) => setCustomAssessmentId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition cursor-pointer"
            >
              <option value="">-- ไม่แนบแบบทดสอบ (ใช้การคัดกรองโปรไฟล์และเรดาร์ปกติ) --</option>
              {companyAssessments.map((ca) => (
                <option key={ca.id} value={ca.id}>
                  {ca.title} ({ca.type === 'PRACTICAL_CODING' ? 'Coding Sandbox' : 'Theory'}, {ca.timeLimitMinutes} นาที, เกณฑ์ {ca.passingScore}%)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-xs shadow-indigo-500/20 disabled:opacity-50 transition"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  กำลังลงประกาศ...
                </>
              ) : (
                'ยืนยันการลงประกาศงาน'
              )}
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
