'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import {
  Building2,
  MapPin,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Send,
  Globe,
  ExternalLink,
  BookOpen,
  PlayCircle,
  Clock,
  X,
  Heart,
  Code2,
} from 'lucide-react';

import Link from 'next/link';

const getPlatformName = (source?: string) => {
  switch (source) {
    case 'JOBSDB':
      return 'JobsDB';
    case 'JOBTHAI':
      return 'JobThai';
    case 'REMOTIVE':
      return 'Remotive';
    case 'BLOGNONE':
      return 'Blognone';
    case 'JSEARCH':
      return 'Google Jobs';
    case 'INTERNAL':
      return 'SmartCareer';
    default:
      return source ? source.charAt(0).toUpperCase() + source.slice(1).toLowerCase() : 'Platform';
  }
};

const FormattedJobContent = ({ content }: { content?: string }) => {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');

  return (
    <div className="space-y-1.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-2" />;
        }

        // 1. Bold or Markdown Subheading (**Heading**, ### Heading, or short header ending with :)
        const isBoldMarkdown = line.startsWith('**') && line.endsWith('**') && line.length > 4;
        const isHashHeading = /^#{1,4}\s+/.test(line);
        const isHeaderPattern = line.length < 60 && (
          line.endsWith(':') ||
          /^(key responsibilities|responsibilities|qualifications|requirements|preferred qualifications|tools|soft skills|benefits|หน้าที่ความรับผิดชอบ|คุณสมบัติ|สวัสดิการ|เกี่ยวกับงาน|สวัสดิการ:)/i.test(line)
        );

        if (isBoldMarkdown || isHashHeading || isHeaderPattern) {
          const cleanHeading = line
            .replace(/^#{1,4}\s+/, '')
            .replace(/^\*\*/, '')
            .replace(/\*\*$/, '')
            .trim();

          return (
            <h4
              key={idx}
              className="text-sm sm:text-base font-bold text-slate-900 pt-3 pb-1 tracking-tight border-b border-slate-100 mb-1"
            >
              {cleanHeading}
            </h4>
          );
        }

        // 2. Bullet point line (starts with •, -, *, ·)
        const bulletMatch = line.match(/^[-•*·]\s*(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1 py-0.5">
              <span className="text-[#6366f1] font-bold select-none text-xs mt-1">•</span>
              <span className="flex-1 leading-relaxed text-slate-700">{bulletMatch[1]}</span>
            </div>
          );
        }

        // 3. Numbered list item (e.g. 1. , 2. , 1) , etc.)
        const numMatch = line.match(/^(\d+)[\.\)]\s*(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1 py-0.5">
              <span className="font-semibold text-slate-800 select-none min-w-[20px] text-xs sm:text-sm">
                {numMatch[1]}.
              </span>
              <span className="flex-1 leading-relaxed text-slate-700">{numMatch[2]}</span>
            </div>
          );
        }

        // 4. Regular line
        return (
          <p key={idx} className="py-0.5 text-slate-700">
            {line}
          </p>
        );
      })}
    </div>
  );
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [userApplication, setUserApplication] = useState<any>(null);

  const fetchJobDetails = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setUserApplication(null);
    setApplied(false);
    const endpoint = user ? `/jobs/${id}/detail` : `/jobs/${id}`;
    apiRequest(endpoint)
      .then((data) => {
        setJob(data);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));

    if (user) {
      apiRequest('/candidate/applications')
        .then((apps: any[]) => {
          if (Array.isArray(apps)) {
            const myApps = apps
              .filter((a) => a.jobId === id)
              .sort((a, b) => (b.roundNumber || 1) - (a.roundNumber || 1));
            const latestApp = myApps[0];
            if (latestApp) {
              setUserApplication(latestApp);
              if (latestApp.status !== 'CANCELLED' && latestApp.status !== 'REJECTED') {
                setApplied(true);
              } else {
                setApplied(false);
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [id, user]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  const handleToggleFavorite = async () => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบเพื่อบันทึกงานที่คุณสนใจ');
      return;
    }
    try {
      const res = await apiRequest(`/jobs/${id}/favorite`, { method: 'POST' });
      setJob((prev: any) => (prev ? { ...prev, isFavorited: res.isFavorited } : prev));
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถบันทึกตำแหน่งงานได้');
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      setApplying(true);
      await apiRequest(`/applications/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverLetter }),
      });
      setApplied(true);
      setShowApplyModal(false);
      fetchJobDetails();
    } catch (err: any) {
      alert(`Application error: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  const handleOpenApplyModal = () => {
    if (!user) {
      const returnToJob = `/jobs/${encodeURIComponent(String(id))}`;
      router.push(`/login?redirect=${encodeURIComponent(returnToJob)}`);
      return;
    }

    setShowApplyModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-[#667085]">กำลังโหลดรายละเอียดตำแหน่งงาน...</span>
        </div>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="font-bold text-slate-800 text-lg mb-2">ไม่พบตำแหน่งงานที่คุณระบุ</p>
          <p className="text-xs text-[#667085] mb-5">ตำแหน่งงานนี้อาจถูกปิดรับสมัครแล้ว หรือลิงก์ไม่ถูกต้อง</p>
          <Link
            href="/jobs"
            className="px-5 py-2.5 rounded-full bg-[#6366f1] text-white text-xs font-semibold hover:bg-[#4f46e5] transition shadow-xs"
          >
            กลับสู่หน้ารายการงาน
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const match = job.matchScore;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-10 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        {/* Back Link */}
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#4f46e5] mb-6 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> ย้อนกลับหน้ารวมงาน (Jobs Marketplace)
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          {/* Main Job Details (Left 8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-[#f4f5fa] border border-slate-200/80 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {job.companyLogoUrl ? (
                      <Image
                        src={job.companyLogoUrl}
                        alt={job.companyName}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-full w-full object-contain p-2"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.innerHTML = '<span class="font-bold text-[#4f46e5] text-lg">' + (job.companyName || 'S').charAt(0).toUpperCase() + '</span>';
                          }
                        }}
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                      {job.title}
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-[#667085] mt-1">{job.companyName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start">
                  <button
                    id="btn-favorite-job-detail"
                    onClick={handleToggleFavorite}
                    className={`p-2 rounded-full border transition cursor-pointer flex items-center justify-center ${
                      job.isFavorited
                        ? 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                    }`}
                    title={job.isFavorited ? 'ยกเลิกบันทึกงานนี้' : 'บันทึกงานที่สนใจ'}
                  >
                    <Heart className={`h-4 w-4 ${job.isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                  {!job.isActive || (job.expiresAt && new Date(job.expiresAt) <= new Date()) ? (
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      ปิดรับสมัครแล้ว
                    </span>
                  ) : null}
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff]">
                    {job.source}
                  </span>
                </div>
              </div>

              {/* Tags Row */}
              <div className="flex flex-wrap gap-2 text-xs font-medium text-[#667085] mb-6 pb-6 border-b border-slate-100">
                <span className="flex items-center gap-1.5 bg-[#f9fafb] border border-slate-200/70 px-3 py-1.5 rounded-full text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {job.location}
                </span>
                {job.isRemote && (
                  <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
                    <Globe className="h-3.5 w-3.5" /> Remote Option
                  </span>
                )}
                {job.salaryMin && (
                  <span className="flex items-center gap-1.5 bg-[#f9fafb] border border-slate-200/70 px-3 py-1.5 rounded-full text-slate-900 font-bold">
                    ฿{job.salaryMin.toLocaleString()} - {job.salaryMax ? `฿${job.salaryMax.toLocaleString()}` : ''}
                  </span>
                )}
                {job.employmentType && (
                  <span className="flex items-center gap-1.5 bg-[#f9fafb] border border-slate-200/70 px-3 py-1.5 rounded-full">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    {job.employmentType}
                  </span>
                )}
              </div>

              {/* Structured Job Details & Requirements */}
              <div className="space-y-7 border-t border-slate-100 pt-6">
                {/* 1. รายละเอียดงาน */}
                {job.description && (
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 tracking-tight">
                      รายละเอียดงาน (Job Description)
                    </h3>
                    <FormattedJobContent content={job.description} />
                  </div>
                )}

                {/* 2. คุณสมบัติผู้สมัคร */}
                {job.requirements && (
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 tracking-tight">
                      คุณสมบัติผู้สมัคร (Qualifications)
                    </h3>
                    <FormattedJobContent content={job.requirements} />
                  </div>
                )}

                {/* 3. สวัสดิการ */}
                {job.benefits && (
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 tracking-tight">
                      สวัสดิการ (Benefits)
                    </h3>
                    <div className="bg-[#f9fafb] border border-slate-200/70 rounded-2xl p-4 sm:p-5">
                      <FormattedJobContent content={job.benefits} />
                    </div>
                  </div>
                )}

                {/* 4. แบบทดสอบคัดกรองเฉพาะตำแหน่ง (Technical Assessment) */}
                {job.customAssessment && (
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-[#f8f9fd] to-purple-50/40 p-5 sm:p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 pb-3 border-b border-indigo-100/70">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-[#6366f1] text-white flex items-center justify-center shadow-xs shadow-indigo-500/20">
                          <Code2 className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                            Screening Assessment
                          </span>
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                            แบบทดสอบเฉพาะตำแหน่ง: {job.customAssessment.title}
                          </h4>
                        </div>
                      </div>
                      <span className="self-start sm:self-auto text-[11px] font-extrabold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                        {job.customAssessment.type === 'PRACTICAL_CODING' ? '💻 Coding Sandbox' : '📝 Theory Quiz'}
                      </span>
                    </div>

                    {job.customAssessment.description && (
                      <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                        {job.customAssessment.description}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/90 p-3.5 rounded-xl border border-indigo-100/80">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="h-4 w-4 text-indigo-500" />
                        <span>ระยะเวลาในการทำ: <strong className="text-slate-900">{job.customAssessment.timeLimitMinutes} นาที</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>เกณฑ์คะแนนผ่าน: <strong className="text-slate-900">{job.customAssessment.passingScore}%</strong></span>
                      </div>
                    </div>

                    <p className="text-[11px] text-indigo-600/90 font-medium mt-3 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      ผู้สมัครจะได้รับมอบหมายให้ทำแบบทดสอบผ่านระบบ และผลคะแนนจะถูกส่งให้ผู้ว่าจ้างพิจารณาโดยตรง
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar with 70/20/10 Match Score (Right 4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#4f46e5]" />
                  คะแนนความเหมาะสม (Match Score)
                </h3>
                <span className="text-[10px] bg-[#f4f5fa] border border-slate-200/80 px-2 py-0.5 rounded-full text-[#667085] font-semibold">
                  สูตร 70 / 20 / 10
                </span>
              </div>

              {match ? (
                <div>
                  <div className="flex items-baseline gap-2.5 mb-4">
                    <span className="text-4xl sm:text-5xl font-extrabold text-[#4f46e5] tracking-tight">
                      {match.matchScore}%
                    </span>
                    <span className="text-xs font-bold text-[#667085]">
                      {match.matchScore >= 75
                        ? '🔥 ทักษะตรงระดับสูง'
                        : match.matchScore >= 50
                        ? 'ทักษะตรงระดับปานกลาง'
                        : 'มีช่องว่างทักษะที่ควรเสริม'}
                    </span>
                  </div>

                  {/* Formula Breakdown */}
                  <div className="space-y-2 mb-6 text-xs text-[#667085] bg-[#f9fafb] p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between py-0.5">
                      <span>ทักษะจำเป็น (70%):</span>
                      <span className="font-bold text-slate-800">{match.requiredCoverage}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>ทักษะแนะนำ (20%):</span>
                      <span className="font-bold text-slate-800">{match.preferredCoverage}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>ทิศทางสายงาน (10%):</span>
                      <span className="font-bold text-slate-800">{match.careerAlignment}%</span>
                    </div>
                  </div>

                  {/* Matched vs Missing Skills */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800">
                        ทักษะที่คุณมีตรงกับงาน ({match.matchedSkills?.length || 0})
                      </p>
                      {match.verifiedBadgesCount !== undefined && match.verifiedBadgesCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          🎖️ มีเหรียญรับรอง {match.verifiedBadgesCount} ทักษะ
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {match.matchedSkills?.map((s: any) => (
                        <span
                          key={s.skillId}
                          className="flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{s.name} ({s.userScore}%)</span>
                          {s.isVerified && (
                            <span className="inline-flex items-center text-[9px] font-extrabold bg-emerald-200/60 text-emerald-800 px-1 rounded" title="ผ่านการสอบรับรองมาตรฐานแล้ว (Verified Badge)">
                              🎖️ Badge
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {match.missingSkills && match.missingSkills.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-slate-800 mt-4">
                          ทักษะที่ควรเสริมเพิ่มเติม ({match.missingSkills.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {match.missingSkills.map((s: any) => (
                            <span
                              key={s.skillId}
                              className="flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full"
                            >
                              <AlertCircle className="h-3 w-3" />
                              {s.name} (ต้องการ {s.requiredScore}%)
                            </span>
                          ))}
                        </div>
                        {job.recommendedCourses && job.recommendedCourses.length > 0 && (
                          <a
                            href="#recommended-courses"
                            className="mt-3 block p-3 bg-[#e8eaff]/70 hover:bg-[#e8eaff] border border-[#dce0ff] rounded-xl text-xs text-[#4f46e5] font-semibold transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5 text-[#4f46e5]" />
                                มี {job.recommendedCourses.length} คอร์สเรียนช่วยปิด Gap
                              </span>
                              <span className="font-bold underline">ดูคอร์ส ↓</span>
                            </div>
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#667085] py-4 leading-relaxed">
                  <Link href="/login" className="text-[#4f46e5] font-bold hover:underline">
                    เข้าสู่ระบบในฐานะ Candidate
                  </Link>{' '}
                  เพื่อคำนวณคะแนน Match Score 70/20/10 แบบเรียลไทม์ตามทักษะจริงที่คุณได้รับการยืนยัน
                </div>
              )}

              {/* Action Button */}
              <div className="mt-7 pt-4 border-t border-slate-100">
                {!job.isActive || (job.expiresAt && new Date(job.expiresAt) <= new Date()) ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center text-xs font-bold flex flex-col items-center justify-center gap-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 text-rose-700">
                      <AlertCircle className="h-4 w-4" />
                      <span>ตำแหน่งงานนี้ปิดรับสมัครแล้ว</span>
                    </div>
                    <span className="text-[11px] font-normal text-rose-600">
                      (This job posting has closed or expired)
                    </span>
                  </div>
                ) : job.sourceUrl ? (
                  <div>
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] py-3.5 text-xs sm:text-sm font-bold text-white shadow-xs shadow-indigo-500/20 transition"
                    >
                      <ExternalLink className="h-4 w-4" />
                      ยื่นใบสมัครบน {getPlatformName(job.source)}
                    </a>
                    <p className="text-center text-[10px] text-[#667085] mt-2">
                      ระบบจะนำท่านไปยังเว็บไซต์ทางการของ {getPlatformName(job.source)}
                    </p>
                  </div>
                ) : applied ? (
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-center text-xs font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> คุณได้ยื่นใบสมัครตำแหน่งนี้แล้ว
                      {userApplication?.roundNumber > 1 ? ` (รอบที่ ${userApplication.roundNumber})` : ''}
                    </div>
                    <Link
                      href="/applications"
                      className="block text-center text-xs font-semibold text-[#4f46e5] hover:underline"
                    >
                      ดูสถานะใบสมัครในหน้า Dashboard →
                    </Link>
                  </div>
                ) : userApplication && (userApplication.status === 'CANCELLED' || userApplication.status === 'REJECTED') ? (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-center text-xs font-medium">
                      ใบสมัครรอบก่อนหน้า:{' '}
                      <span className="font-bold text-slate-800">
                        {userApplication.status === 'CANCELLED' ? 'ยกเลิกแล้ว' : 'ไม่ผ่านการคัดเลือก'}
                      </span>{' '}
                      (รอบที่ {userApplication.roundNumber || 1})
                    </div>
                    <button
                      id="btn-reapply-job"
                      onClick={handleOpenApplyModal}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] py-3.5 text-xs sm:text-sm font-bold text-white shadow-xs shadow-indigo-500/20 transition cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      สมัครใหม่อีกครั้ง (รอบที่ {(userApplication.roundNumber || 1) + 1})
                    </button>
                  </div>
                ) : (
                  <button
                    id="btn-apply-job"
                    onClick={handleOpenApplyModal}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] py-3.5 text-xs sm:text-sm font-bold text-white shadow-xs shadow-indigo-500/20 transition cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    {user ? 'ยื่นใบสมัครผ่าน SmartCareer' : 'เข้าสู่ระบบเพื่อสมัคร'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Courses to Bridge Skill Gaps */}
        {job.recommendedCourses && job.recommendedCourses.length > 0 && (
          <div id="recommended-courses" className="mt-10 rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3.5 py-1 text-[11px] font-[750] text-[#4f46e5] mb-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  {match?.missingSkills && match.missingSkills.length > 0
                    ? `🎯 คอร์สแนะนำเพื่อปิดช่องว่างทักษะ (${match.missingSkills.length} ทักษะ)`
                    : `📚 คอร์สเสริมทักษะสำคัญสำหรับตำแหน่งนี้`}
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-[#4f46e5]" />
                  คอร์สเรียนแนะนำเพื่อเพิ่มโอกาสการได้งาน
                </h3>
                <p className="text-xs sm:text-sm text-[#667085] mt-1">
                  คัดสรรจาก YouTube และ Udemy ที่ตรงกับ Tech Stack เพื่อช่วยให้คุณพัฒนาทักษะได้ตรงเป้าหมาย
                </p>
              </div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4f46e5] hover:text-[#4338ca] bg-[#e8eaff] hover:bg-[#dce0ff] border border-[#dce0ff] px-4 py-2 rounded-full transition flex-shrink-0"
              >
                ดูคลังคอร์สทั้งหมด <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* 3-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {job.recommendedCourses.map((course: any) => (
                <div
                  key={course.id}
                  className="rounded-2xl border border-slate-200/80 bg-[#fbfcfd] p-4 flex flex-col justify-between hover:border-[#6366f1]/40 hover:shadow-xs transition duration-200 group"
                >
                  <div>
                    {/* Course Thumbnail */}
                    <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-100 mb-3 border border-slate-200/60">
                      {course.thumbnailUrl ? (
                        <Image
                          src={course.thumbnailUrl}
                          alt={course.title}
                          width={640}
                          height={360}
                          unoptimized
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-tr from-[#4f46e5] to-[#6366f1] text-white">
                          <BookOpen className="h-8 w-8 opacity-70" />
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            course.provider === 'YOUTUBE'
                              ? 'bg-rose-600 text-white'
                              : 'bg-purple-600 text-white'
                          }`}
                        >
                          {course.provider === 'YOUTUBE' ? 'YouTube' : 'Udemy'}
                        </span>
                        {course.level && (
                          <span className="text-[9px] font-semibold bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-full">
                            {course.level}
                          </span>
                        )}
                      </div>
                      {course.targetSkill && (
                        <div className="absolute bottom-2 left-2">
                          <span className="text-[9px] font-bold bg-[#6366f1] text-white px-2 py-0.5 rounded-full shadow-xs">
                            🎯 เสริมทักษะ: {course.targetSkill}
                          </span>
                        </div>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-[#4f46e5] transition mb-1">
                      {course.title}
                    </h4>
                    {course.description && (
                      <p className="text-[11px] text-[#667085] line-clamp-2 mb-2 leading-relaxed">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2 text-xs">
                    <span className="text-[11px] text-slate-400">
                      {course.duration || 'Self-paced'}
                    </span>
                    <a
                      href={course.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#4f46e5] hover:text-[#4338ca] transition"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> เริ่มเรียน <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Apply Modal */}
        {showApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[24px] p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">ยื่นใบสมัครตำแหน่ง {job.title}</h3>
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-[#667085] mb-5">{job.companyName}</p>

              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ข้อความแนะนำตัว / สรุปความพร้อมถึงผู้ว่าจ้าง (ไม่บังคับ)
                  </label>
                  <textarea
                    rows={4}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="สรุปจุดเด่นของทักษะที่ผ่านการยืนยัน และเหตุผลที่สนใจร่วมงาน..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-full transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={applying}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] rounded-full shadow-xs shadow-indigo-500/20 transition disabled:opacity-50"
                  >
                    {applying ? 'กำลังส่งข้อมูล...' : 'ยืนยันการสมัคร'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
