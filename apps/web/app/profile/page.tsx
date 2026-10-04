'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  Briefcase,
  Github,
  Save,
  CheckCircle2,
  Lock,
  Sparkles,
  RefreshCw,
  Layers,
  Award,
  ExternalLink,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import { RadarChartDataPoint, CandidateEarnedBadge } from '@smartcareer/shared';

function ProfileHubLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
        <div className="h-9 w-9 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-[#667085]">กำลังเตรียมข้อมูลโปรไฟล์และเรดาร์ทักษะ...</span>
      </main>
      <Footer />
    </div>
  );
}

function ProfileHubContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab state: default to 'skills' unless ?tab=edit is explicitly requested
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'skills' | 'edit'>('skills');

  useEffect(() => {
    if (tabParam === 'edit') {
      setActiveTab('edit');
    } else {
      setActiveTab('skills');
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'skills' | 'edit') => {
    setActiveTab(tab);
    router.replace(`/profile?tab=${tab}`, { scroll: false });
  };

  // Profile data states
  const [profile, setProfile] = useState<any>(null);
  const [radarData, setRadarData] = useState<RadarChartDataPoint[]>([]);
  const [badges, setBadges] = useState<CandidateEarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form states
  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [targetCareer, setTargetCareer] = useState('Full Stack Developer');
  const [githubUsername, setGithubUsername] = useState('');
  const [isGithubLocked, setIsGithubLocked] = useState(false);

  // Action states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Fetch candidate profile & radar data simultaneously
  const fetchData = async () => {
    try {
      setLoading(true);
      const [profData, radar, badgesData] = await Promise.all([
        apiRequest('/candidate/profile'),
        apiRequest('/candidate/radar').catch(() => []),
        apiRequest('/assessments/my-badges').catch(() => []),
      ]);

      setProfile(profData);
      setRadarData(radar || []);
      setBadges(badgesData || []);

      setFullName(profData.fullName || '');
      setHeadline(profData.headline || '');
      setBio(profData.bio || '');
      setTargetCareer(profData.targetCareer || 'Full Stack Developer');
      setGithubUsername(profData.githubUsername || '');
      setIsGithubLocked(Boolean(profData.githubUsername));
    } catch (e: any) {
      console.error('Failed to load profile data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save profile info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    try {
      const payload: any = {
        fullName,
        headline,
        bio,
        targetCareer,
      };
      if (!isGithubLocked && githubUsername.trim()) {
        payload.githubUsername = githubUsername.trim();
      }

      await apiRequest('/candidate/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setSaveSuccess('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว!');
      if (payload.githubUsername) {
        setIsGithubLocked(true);
      }
      await fetchData();
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Sync GitHub repositories
  const handleSyncGithub = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetUser = (profile?.githubUsername || githubUsername || '').trim();
    if (!targetUser) return;

    try {
      setSyncing(true);
      setSyncSuccess(null);
      setSyncError(null);
      await apiRequest('/github/sync', {
        method: 'POST',
        body: JSON.stringify({ username: targetUser }),
      });
      setSyncSuccess(`วิเคราะห์และซิงค์หลักฐานจาก GitHub @${targetUser} สำเร็จเรียบร้อย!`);
      await fetchData();
    } catch (err: any) {
      setSyncError(err.message || 'ซิงค์ GitHub ไม่สำเร็จ กรุณาลองใหม่ ข้อมูลเดิมยังคงอยู่');
    } finally {
      setSyncing(false);
    }
  };

  // Quick Stats Calculations
  const verifiedSkillsCount = profile?.skills?.length || 0;
  const reposCount = profile?.githubRepos?.length || 0;
  const avgRadarScore = radarData.length > 0
    ? Math.round(radarData.reduce((acc, curr) => acc + curr.score, 0) / radarData.length)
    : 0;

  const displayName = fullName || profile?.fullName || user?.email?.split('@')[0] || 'นักพัฒนา';
  const initialLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-10 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        {/* ======================================================== */}
        {/* UNIFIED HERO HEADER                                      */}
        {/* ======================================================== */}
        <section className="mb-7 rounded-[24px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-100/50 to-purple-100/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Avatar + Identity Info */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#6366f1] via-[#4f46e5] to-[#4338ca] text-white flex items-center justify-center text-2xl sm:text-3xl font-black shadow-md shadow-indigo-500/20">
                  {initialLetter}
                </div>
                <span className="absolute -bottom-1 -right-1 grid place-items-center w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] ring-2 ring-white">
                  ✓
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-snug">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-0.5 rounded-full bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff]">
                    <Briefcase className="h-3 w-3" />
                    {targetCareer || profile?.targetCareer || 'Full Stack Developer'}
                  </span>
                </div>

                <p className="text-xs sm:text-[13px] text-[#667085] leading-relaxed max-w-xl">
                  {headline || 'ยังไม่มีการระบุ Headline ทางอาชีพ — สามารถตั้งค่าได้ที่แท็บแก้ไขข้อมูล'}
                </p>

                {/* GitHub Capsule & Quick Sync */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  {profile?.githubUsername ? (
                    <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-[#f8fafc] px-3 py-1 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-slate-800 text-xs font-semibold">
                        <Github className="h-3.5 w-3.5 text-slate-900" />
                        <span>@{profile.githubUsername}</span>
                        <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          <Lock className="h-2.5 w-2.5 text-emerald-600" /> ผูกแล้ว
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSyncGithub()}
                        disabled={syncing}
                        className="inline-flex items-center gap-1 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white px-3 py-1 text-[11px] font-bold transition disabled:opacity-50 shadow-xs shadow-indigo-500/20"
                      >
                        <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'กำลังซิงค์...' : 'ซิงค์ Repos'}
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                      <Github className="h-3.5 w-3.5 text-amber-700" />
                      <span>ยังไม่ได้ผูก GitHub (ไปที่แท็บแก้ไขเพื่อผูกบัญชี)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Stats Badges */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-[#f9fafb] border border-slate-200/70 text-center min-w-[95px] sm:min-w-[105px]">
                <div className="flex items-center justify-center gap-1 text-[#4f46e5] mb-0.5">
                  <Award className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Skills</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-900">{verifiedSkillsCount}</p>
                <span className="text-[10px] text-slate-400">ทักษะที่ตรวจแล้ว</span>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-[#f9fafb] border border-slate-200/70 text-center min-w-[95px] sm:min-w-[105px]">
                <div className="flex items-center justify-center gap-1 text-slate-800 mb-0.5">
                  <Github className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Repos</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-900">{reposCount}</p>
                <span className="text-[10px] text-slate-400">คลังหลักฐาน</span>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-[#f9fafb] border border-slate-200/70 text-center min-w-[95px] sm:min-w-[105px]">
                <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Score</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-emerald-600">{avgRadarScore}</p>
                <span className="text-[10px] text-slate-400">คะแนนเฉลี่ย</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sync Success Notification */}
        {syncError && (
          <div role="alert" className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm">
            {syncError}
          </div>
        )}
        {syncSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 animate-in fade-in duration-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{syncSuccess}</span>
          </div>
        )}

        {/* Save Success Notification */}
        {saveSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 animate-in fade-in duration-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{saveSuccess}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB NAVIGATION SWITCHER                                  */}
        {/* ======================================================== */}
        <div className="flex items-center justify-start gap-2 mb-6 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => handleTabChange('skills')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'skills'
                ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/25'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>เรดาร์ทักษะ &amp; หลักฐาน (Skill Radar)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-extrabold">Default</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('edit')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/25'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>แก้ไขข้อมูลโปรไฟล์ (Settings)</span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-[#667085]">กำลังประมวลผลข้อมูลโปรไฟล์...</span>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* TAB 2: SKILL RADAR & EVIDENCE (DEFAULT TAB)              */}
            {/* ======================================================== */}
            {activeTab === 'skills' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 animate-in fade-in duration-200">
                {/* Radar Chart Card (Left 6 cols) */}
                <div className="lg:col-span-6 rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid place-items-center w-8 h-8 rounded-xl bg-[#e8eaff] text-[#4f46e5]">
                          <Layers className="h-4 w-4" />
                        </span>
                        <div>
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">
                            การกระจายตัวของทักษะ (Skill Competency Radar)
                          </h2>
                          <span className="text-[11px] text-[#667085]">วิเคราะห์ความครอบคลุมและศักยภาพจากผลงานจริง</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-[#f4f5fa] border border-slate-200/80 px-3 py-1 text-[11px] font-semibold text-slate-700">
                        เป้าหมาย: {profile?.targetCareer || targetCareer}
                      </span>
                    </div>

                    {/* Radar Graphic */}
                    <div className="h-[340px] w-full flex items-center justify-center my-2">
                      {radarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="78%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <PolarAngleAxis
                              dataKey="subject"
                              tick={{ fill: '#475467', fontSize: 11, fontWeight: 600 }}
                            />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" tick={{ fontSize: 10 }} />
                            <Radar
                              name="Score"
                              dataKey="score"
                              stroke="#6366f1"
                              strokeWidth={2}
                              fill="#818cf8"
                              fillOpacity={0.35}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center text-slate-400 py-12 text-xs">
                          ยังไม่มีข้อมูลเรดาร์ทักษะ กรุณาซิงค์ GitHub หรือทำแบบทดสอบทักษะ
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score Badges Footer */}
                  <div className="grid grid-cols-5 gap-2 pt-4 border-t border-slate-100 text-center">
                    {radarData.map((d) => {
                      const isHigh = d.score >= 80;
                      return (
                        <div
                          key={d.category}
                          className={`p-2.5 rounded-xl border transition ${
                            isHigh
                              ? 'bg-indigo-50/70 border-indigo-200/80 shadow-2xs'
                              : 'bg-[#f9fafb] border-slate-100/80'
                          }`}
                        >
                          <p className="text-[9px] uppercase font-bold text-[#667085] tracking-wider truncate">{d.category}</p>
                          <p className={`text-base font-extrabold mt-0.5 ${isHigh ? 'text-[#4338ca]' : 'text-[#4f46e5]'}`}>
                            {d.score}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Verified Skills & Supporting Evidence (Right 6 cols) */}
                <div className="lg:col-span-6 space-y-7">
                  {/* Verified Badges */}
                  <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid place-items-center w-8 h-8 rounded-xl bg-indigo-50 text-[#4f46e5]">
                          <Award className="h-4 w-4" />
                        </span>
                        <div>
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">
                            เหรียญทักษะที่ผ่านการตรวจ (Verified Skills)
                          </h2>
                          <span className="text-[11px] text-[#667085]">เกณฑ์ 3 เสาหลัก: Git 50% + Quiz 20% + Code 30%</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#4f46e5] bg-[#e8eaff] px-2.5 py-1 rounded-full">
                        {profile?.skills?.length || 0} ทักษะ
                      </span>
                    </div>

                    {profile?.skills && profile.skills.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                          {profile.skills.map((cs: any) => (
                            <div
                              key={cs.id}
                              className="p-3.5 rounded-xl border border-slate-200/80 bg-[#fbfcfd] hover:bg-white hover:border-[#6366f1]/40 hover:shadow-xs transition duration-150"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{cs.skill.name}</span>
                                    {cs.isVerified ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                        <CheckCircle2 className="h-2.5 w-2.5" /> ยืนยันแล้ว
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200" title="ทำแบบทดสอบ Quiz/Code เพื่อเพิ่มคะแนนยืนยัน">
                                        รอสอบยืนยัน
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-medium text-[#667085]">{cs.skill.category}</span>
                                </div>
                                <div className="text-right">
                                  <span className={`text-sm sm:text-base font-extrabold ${cs.isVerified ? 'text-emerald-600' : 'text-[#4f46e5]'}`}>
                                    {cs.verifiedScore}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">/ 100</span>
                                </div>
                              </div>

                              {/* Score breakdown pills */}
                              <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] pt-2 border-t border-slate-100 text-[#667085]">
                                <div>Git: <span className="font-bold text-slate-800">{cs.practicalScore}%</span></div>
                                <div>Quiz: <span className="font-bold text-slate-800">{cs.theoryScore}%</span></div>
                                <div>Code: <span className="font-bold text-slate-800">{cs.codingScore}%</span></div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Verification Guidance Note */}
                        <div className="mt-3.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#4338ca]">
                          <span className="font-medium">
                            💡 <strong>เกณฑ์ Verified Badge:</strong> คะแนนรวมต้องได้ 60+ (ทำแบบทดสอบ Quiz และ Coding เพื่อปลดล็อก)
                          </span>
                          <Link
                            href="/assessments"
                            className="inline-flex items-center gap-1 font-bold text-[#4f46e5] hover:text-[#3730a3] hover:underline shrink-0"
                          >
                            <span>ทำแบบทดสอบ</span>
                            <span aria-hidden="true">&rarr;</span>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-400">
                        ยังไม่มีทักษะที่ผ่านการยืนยัน ทำแบบทดสอบในหน้า Assessments เพื่อรับเหรียญทักษะ
                      </div>
                    )}
                  </div>

                  {/* Assessment Badges & Certifications Showcase */}
                  <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid place-items-center w-8 h-8 rounded-xl bg-amber-50 text-amber-600">
                          <Award className="h-4 w-4" />
                        </span>
                        <div>
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">
                            เหรียญรางวัลรายบททดสอบ (Assessment Badges)
                          </h2>
                          <span className="text-[11px] text-[#667085]">เหรียญรับรองมาตรฐานแยกตามการทดสอบที่ผ่านจริง</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full">
                        {badges.length} เหรียญ
                      </span>
                    </div>

                    {badges.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                        {badges.map((b) => (
                          <div
                            key={b.attemptId}
                            className="p-3.5 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 shadow-2xs hover:shadow-xs transition"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="text-2xl select-none">
                                {b.type === 'PRACTICAL_CODING' ? '🥇' : '🥉'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h3 className="font-bold text-slate-900 text-xs truncate" title={b.title}>
                                    {b.title}
                                  </h3>
                                  <span className="text-xs font-black text-amber-700 shrink-0">
                                    {b.score}%
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-[#667085]">
                                  <span className="font-semibold text-slate-700 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/80">
                                    {b.type === 'PRACTICAL_CODING' ? 'Live Coding' : 'Theory Quiz'}
                                  </span>
                                  {b.skillName && (
                                    <span className="text-[#4f46e5] font-bold">
                                      {b.skillName}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-[9px] text-slate-400">
                                  ผ่านเมื่อ {new Date(b.passedAt).toLocaleDateString('th-TH')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 bg-[#fbfcfd]">
                        <p className="text-xs text-slate-500 font-medium">ยังไม่มีเหรียญรางวัลรายบททดสอบ</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          เมื่อทำแบบทดสอบ Quiz หรือ Coding Challenge ผ่าน 60% จะได้รับเหรียญรับรองเฉพาะวิชานั้นทันที
                        </p>
                        <Link
                          href="/assessments"
                          className="mt-3 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] shadow-xs transition"
                        >
                          <span>ไปที่คลังแบบทดสอบ</span>
                          <span>&rarr;</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* GitHub Repositories Supporting Evidence */}
                  <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid place-items-center w-8 h-8 rounded-xl bg-slate-100 text-slate-800">
                          <Github className="h-4 w-4" />
                        </span>
                        <div>
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">
                            หลักฐานผลงาน GitHub (Repository Evidence)
                          </h2>
                          <span className="text-[11px] text-[#667085]">วิเคราะห์ภาษาและไลบรารีจากข้อมูล GitHub</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                        {profile?.githubRepos?.length || 0} Repos
                      </span>
                    </div>

                    {profile?.githubRepos && profile.githubRepos.length > 0 ? (
                      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                        {profile.githubRepos.map((repo: any) => (
                          <div
                            key={repo.id}
                            className="p-3.5 rounded-xl border border-slate-100 bg-[#fbfcfd] hover:bg-white hover:border-slate-200 transition flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-3">
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-xs sm:text-sm text-slate-900 hover:text-[#4f46e5] transition flex items-center gap-1.5 truncate"
                              >
                                <span className="truncate">{repo.fullName}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0 text-slate-400" />
                              </a>
                              <p className="text-[11px] text-[#667085] mt-0.5 line-clamp-1">
                                {repo.description || 'ไม่มีคำอธิบายโครงการ'}
                              </p>
                              <div className="flex items-center gap-2.5 mt-2">
                                <span className="inline-flex items-center text-[10px] font-semibold bg-[#e8eaff] text-[#4f46e5] px-2 py-0.5 rounded-full">
                                  {repo.language || 'Code'}
                                </span>
                                <span className="text-[10px] text-[#667085]">
                                  ★ {repo.stargazersCount} stars
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-400">
                        {profile?.githubUsername
                          ? 'ยังไม่มี Repositories ที่วิเคราะห์ กดปุ่ม "ซิงค์ Repos" เพื่อดึงข้อมูล'
                          : 'กรุณาผูกบัญชี GitHub ที่แท็บแก้ไขเพื่อนำหลักฐานโค้ดมาวิเคราะห์'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 1: EDIT PROFILE FORM                                 */}
            {/* ======================================================== */}
            {activeTab === 'edit' && (
              <form
                onSubmit={handleSaveProfile}
                className="rounded-[24px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)] space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    แก้ไขข้อมูลโปรไฟล์ &amp; เป้าหมายอาชีพ
                  </h2>
                  <p className="text-xs text-[#667085] mt-1">
                    ปรับปรุงข้อมูลส่วนตัวและความเชี่ยวชาญ เพื่อให้ระบบแนะนำงานที่ตรงเป้าหมายที่สุด
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      ชื่อ-นามสกุล (Full Name)
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="เช่น สมชาย ใจดี"
                      className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      เป้าหมายสายงาน (Target Career Goal)
                    </label>
                    <select
                      value={targetCareer}
                      onChange={(e) => setTargetCareer(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition cursor-pointer"
                    >
                      <option value="Full Stack Developer">Full Stack Developer</option>
                      <option value="Frontend Developer">Frontend Developer</option>
                      <option value="Backend Developer">Backend Developer</option>
                      <option value="DevOps Engineer">DevOps Engineer</option>
                      <option value="Mobile Developer">Mobile Developer</option>
                      <option value="Data Engineer">Data Engineer</option>
                      <option value="AI / ML Engineer">AI / ML Engineer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    หัวข้อแนะนำตัวทางอาชีพ (Professional Headline)
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="เช่น Full Stack Engineer (Next.js, Node.js) · Passionate in System Architecture"
                    className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ประวัติย่อ / ประสบการณ์ (Bio)
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="สรุปประสบการณ์ ความสนใจ และความถนัดทางเทคโนโลยีของคุณ..."
                    className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] p-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition leading-relaxed"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ชื่อผู้ใช้ GitHub (GitHub Username)
                    </label>
                    {isGithubLocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <Lock className="h-2.5 w-2.5 text-emerald-600" /> ผูกบัญชีถาวรแล้ว (Locked)
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Github className="absolute left-3.5 top-3 h-4 w-4 text-[#7a8494]" />
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={(e) => !isGithubLocked && setGithubUsername(e.target.value)}
                      readOnly={isGithubLocked}
                      placeholder="เช่น octocat"
                      className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-xs sm:text-sm transition ${
                        isGithubLocked
                          ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                          : 'border-slate-200 bg-[#fbfcfd] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]'
                      }`}
                    />
                  </div>
                  {isGithubLocked ? (
                    <p className="text-[11px] text-[#667085] mt-1.5 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-slate-400" />
                      บัญชี GitHub ได้รับการยืนยันแบบ 1-ต่อ-1 แล้ว เพื่อรักษาความน่าเชื่อถือของผลงาน
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#667085] mt-1.5">
                      ใส่ชื่อผู้ใช้ GitHub เพื่อดึง Repositories มาวิเคราะห์เป็นหลักฐานทักษะ เมื่อยืนยันแล้วจะถูกล็อกไว้กับบัญชีนี้
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleTabChange('skills')}
                    className="text-xs font-semibold text-[#4f46e5] hover:underline"
                  >
                    ← กลับไปยังแท็บเรดาร์ทักษะ
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] px-7 py-2.5 text-xs font-bold text-white shadow-xs shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        บันทึกข้อมูลโปรไฟล์
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileHubLoading />}>
      <ProfileHubContent />
    </Suspense>
  );
}
