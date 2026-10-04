'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import {
  BookOpen,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Search,
  RotateCcw,
  Briefcase,
  Layers,
  Video,
  GraduationCap,
} from 'lucide-react';
import { SkillGapItem, CourseSource, CAREER_TRACK_LABELS } from '@smartcareer/shared';

export default function CoursesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<{ targetCareer: string; gaps: SkillGapItem[] } | null>(null);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Filters
  const [keyword, setKeyword] = useState('');
  const keywordRef = useRef('');
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');
  const [selectedCareer, setSelectedCareer] = useState<string>('ALL');
  const [selectedSkillId, setSelectedSkillId] = useState<string>('ALL');

  // Load initial gap data and skills
  useEffect(() => {
    const promises = [apiRequest('/skills').catch(() => [])];
    if (user) {
      promises.push(apiRequest('/recommendations/skill-gaps').catch(() => null));
    }

    Promise.all(promises)
      .then(([skills, gapData]) => {
        if (skills) setSkillsList(skills);
        if (gapData) setData(gapData);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [user]);

  // Fetch courses whenever filters change
  const fetchFilteredCourses = useCallback(async (filters: {
    keyword: string;
    provider: string;
    career: string;
    skillId: string;
  }) => {
    try {
      setCoursesLoading(true);
      const params = new URLSearchParams();
      if (filters.keyword.trim()) params.append('keyword', filters.keyword.trim());
      if (filters.provider !== 'ALL') params.append('provider', filters.provider);
      if (filters.career !== 'ALL') params.append('career', filters.career);
      if (filters.skillId !== 'ALL') params.append('skillId', filters.skillId);

      const courses = await apiRequest(`/recommendations/courses?${params.toString()}`);
      setAllCourses(courses || []);
    } catch (e) {
      console.error(e);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFilteredCourses({
      keyword: keywordRef.current,
      provider: selectedProvider,
      career: selectedCareer,
      skillId: selectedSkillId,
    });
  }, [fetchFilteredCourses, selectedProvider, selectedCareer, selectedSkillId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchFilteredCourses({
      keyword,
      provider: selectedProvider,
      career: selectedCareer,
      skillId: selectedSkillId,
    });
  };

  const handleResetFilters = () => {
    setKeyword('');
    keywordRef.current = '';
    setSelectedProvider('ALL');
    setSelectedCareer('ALL');
    setSelectedSkillId('ALL');
    setCoursesLoading(true);
    apiRequest('/recommendations/courses')
      .then((courses) => setAllCourses(courses || []))
      .catch(console.error)
      .finally(() => setCoursesLoading(false));
  };

  const hasActiveFilters =
    keyword.trim() !== '' ||
    selectedProvider !== 'ALL' ||
    selectedCareer !== 'ALL' ||
    selectedSkillId !== 'ALL';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        {/* Header Section */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3.5 py-1 text-[11px] font-[750] text-[#4f46e5] mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Career Growth Engine · วิเคราะห์ช่องว่างทักษะ &amp; คอร์สเรียน
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            คอร์สเรียนแนะนำ{' '}
            <span className="relative text-[#4f46e5]">
              เพื่อปิด Skill Gap
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[#818cf8] opacity-60" />
            </span>
          </h1>
          <p className="text-[13px] text-[#667085] mt-2 leading-relaxed">
            เส้นทางการเรียนรู้ที่คัดสรรจาก YouTube และ Udemy เพื่อช่วยยกระดับทักษะที่คุณยังขาดสำหรับเป้าหมาย{' '}
            <span className="font-bold text-[#4f46e5]">{data?.targetCareer || 'เป้าหมายอาชีพของคุณ'}</span>
          </p>
        </div>

        {loading ? (
          <div className="py-28 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-[#667085]">กำลังวิเคราะห์ช่องว่างทักษะและคัดเลือกคอร์สเรียน...</span>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Skill Gaps Section (if candidate logged in & has gaps) */}
            {data && data.gaps && data.gaps.length > 0 && (
              <section className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                      <TrendingUp className="h-5 w-5 text-[#4f46e5]" />
                      ทักษะสำคัญที่ควรพัฒนาเร่งด่วน (Priority Skill Gaps)
                    </h2>
                    <p className="text-xs text-[#667085] mt-1">
                      เปรียบเทียบระหว่างคะแนนที่ได้รับการยืนยันของคุณกับเกณฑ์มาตรฐานของตำแหน่ง {data.targetCareer}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {data.gaps.map((item) => (
                    <div
                      key={item.skillName}
                      className="rounded-2xl border border-slate-200/80 bg-[#fbfcfd] p-5 flex flex-col justify-between hover:border-[#6366f1]/40 hover:shadow-xs transition duration-200"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-[#667085]">{item.category}</span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              item.priority === 'HIGH'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {item.priority === 'HIGH' ? 'ความสำคัญสูง' : 'ระดับปานกลาง'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mb-2.5">{item.skillName}</h3>

                        {/* Gap Progress Meter */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-xs text-[#667085]">
                            <span>คะแนนปัจจุบัน: <b>{item.currentLevel}%</b></span>
                            <span>เป้าหมาย: <b>{item.requiredLevel}%</b></span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-200/70 overflow-hidden">
                            <div
                              className="h-full bg-[#6366f1] rounded-full transition-all duration-500"
                              style={{ width: `${item.currentLevel}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-amber-600 font-semibold mt-1">
                            Δ ขาดอีก {item.gap}% เพื่อบรรลุเป้าหมาย
                          </p>
                        </div>

                        {/* Top Recommended Course */}
                        {item.recommendedCourses && item.recommendedCourses.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                              คอร์สแนะนำเพื่อปิด Gap
                            </span>
                            <a
                              href={item.recommendedCourses[0].url}
                              target="_blank"
                              rel="noreferrer"
                              className="group block p-3 rounded-xl bg-white hover:bg-[#e8eaff]/50 border border-slate-200 hover:border-[#6366f1]/40 transition"
                            >
                              <p className="text-xs font-bold text-slate-800 group-hover:text-[#4f46e5] line-clamp-1">
                                {item.recommendedCourses[0].title}
                              </p>
                              <span className="text-[10px] text-[#667085] mt-1 inline-flex items-center gap-1">
                                {item.recommendedCourses[0].provider} <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
                              </span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Complete Course Catalog with Enhanced Filters */}
            <section>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                    <BookOpen className="h-5 w-5 text-[#4f46e5]" />
                    คลังคอร์สเรียนเทคโนโลยี (Curated Course Catalog)
                  </h2>
                  <p className="text-xs text-[#667085] mt-1">
                    ค้นหาและเลือกเรียนคอร์สออนไลน์คุณภาพสูงเพื่อพัฒนาทักษะเฉพาะด้านตามสายงานที่คุณต้องการ
                  </p>
                </div>

                {/* Results count & Reset */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#667085] bg-white/95 border border-slate-200/90 px-3.5 py-1.5 rounded-full shadow-xs">
                    พบ <span className="font-bold text-slate-900">{allCourses.length}</span> คอร์สเรียน
                  </span>
                  {hasActiveFilters && (
                    <button
                      onClick={handleResetFilters}
                      className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3.5 py-1.5 rounded-full transition"
                    >
                      <RotateCcw className="h-3 w-3" /> ล้างตัวกรอง
                    </button>
                  )}
                </div>
              </div>

              {/* Course Search & Filter Bar */}
              <div className="rounded-[20px] border border-slate-200/90 bg-white/95 p-4 sm:p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] mb-8 space-y-4">
                {/* Search Input Row */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="flex-1 relative flex items-center">
                    <Search className="absolute left-3.5 h-4 w-4 text-[#7a8494]" />
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => {
                        keywordRef.current = e.target.value;
                        setKeyword(e.target.value);
                      }}
                      placeholder="ค้นหาชื่อคอร์ส, หัวข้อ หรือเทคโนโลยี (เช่น Next.js, Docker, Microservices, Python)..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold shadow-xs shadow-indigo-500/20 transition whitespace-nowrap"
                  >
                    ค้นหาคอร์ส
                  </button>
                </form>

                {/* Filter Controls Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  {/* Provider Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pr-1">
                      แพลตฟอร์ม:
                    </span>
                    <button
                      onClick={() => setSelectedProvider('ALL')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                        selectedProvider === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-[#f4f5fa] border border-slate-200/70 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ทั้งหมด (All)
                    </button>
                    <button
                      onClick={() => setSelectedProvider(CourseSource.YOUTUBE)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                        selectedProvider === CourseSource.YOUTUBE
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Video className="h-3.5 w-3.5" /> YouTube (ฟรี)
                    </button>
                    <button
                      onClick={() => setSelectedProvider(CourseSource.UDEMY)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                        selectedProvider === CourseSource.UDEMY
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      <GraduationCap className="h-3.5 w-3.5" /> Udemy (Certificate)
                    </button>
                  </div>

                  {/* Dropdowns (Career & Skill) */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Career Track Filter */}
                    <div className="flex items-center gap-1.5 bg-[#f9fafb] border border-slate-200/80 rounded-full px-3.5 py-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-semibold text-[#667085]">สายงาน:</span>
                      <select
                        value={selectedCareer}
                        onChange={(e) => setSelectedCareer(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">ทุกสายงาน (All Fields)</option>
                        {Object.entries(CAREER_TRACK_LABELS).map(([trackKey, trackLabel]) => (
                          <option key={trackKey} value={trackKey}>
                            {trackLabel}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Specific Skill Filter */}
                    <div className="flex items-center gap-1.5 bg-[#f9fafb] border border-slate-200/80 rounded-full px-3.5 py-1.5">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-semibold text-[#667085]">ทักษะ:</span>
                      <select
                        value={selectedSkillId}
                        onChange={(e) => setSelectedSkillId(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
                      >
                        <option value="ALL">ทุกทักษะ (All Skills)</option>
                        {skillsList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Catalog Grid */}
              {coursesLoading ? (
                <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
                  <span className="text-xs font-medium text-[#667085]">กำลังกรองข้อมูลคอร์สเรียน...</span>
                </div>
              ) : allCourses.length === 0 ? (
                <div className="py-20 text-center text-slate-500 bg-white/95 rounded-[20px] border border-slate-200/90 p-8 shadow-xs">
                  <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-800 mb-1">ไม่พบคอร์สเรียนที่ตรงกับเงื่อนไข</p>
                  <p className="text-xs text-[#667085] mb-4">
                    ลองปรับคำค้นหา หรือเลือกสายงาน/ทักษะอื่นเพื่อดูคอร์สเพิ่มเติม
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="px-5 py-2 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allCourses.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-[20px] border border-slate-200/90 bg-white/95 overflow-hidden shadow-[0_12px_32px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Course Thumbnail */}
                        <div className="h-44 w-full bg-[#f4f5fa] relative overflow-hidden">
                          {c.thumbnailUrl ? (
                            <Image src={c.thumbnailUrl} alt={c.title} width={640} height={352} unoptimized className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-tr from-[#4f46e5] to-[#6366f1] text-white">
                              <BookOpen className="h-10 w-10 opacity-70" />
                            </div>
                          )}
                          <span
                            className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs ${
                              c.provider === 'UDEMY'
                                ? 'bg-purple-700 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {c.provider}
                          </span>
                          {c.level && (
                            <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900/80 text-white backdrop-blur-xs">
                              {c.level}
                            </span>
                          )}
                        </div>

                        {/* Course Body */}
                        <div className="p-5">
                          <h3 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2 leading-snug">
                            {c.title}
                          </h3>
                          <p className="text-xs text-[#667085] line-clamp-2 leading-relaxed mb-4">
                            {c.description}
                          </p>

                          {/* Tagged Skills */}
                          {c.skills && c.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {c.skills.map((cs: any) => (
                                <span
                                  key={cs.id || cs.skillId}
                                  className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff]"
                                >
                                  {cs.skill?.name || cs.name}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-[#667085] pt-3 border-t border-slate-100">
                            <span>{c.duration || 'Self-paced'}</span>
                            {c.rating ? (
                              <span className="font-bold text-amber-500 flex items-center gap-1">
                                ★ {c.rating}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Verified Content</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-5 pt-0">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold py-2.5 transition shadow-xs shadow-indigo-500/20"
                        >
                          เริ่มเรียนคอร์สนี้ <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
