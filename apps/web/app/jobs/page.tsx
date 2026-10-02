'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  MapPin,
  Building2,
  ArrowRight,
  Sparkles,
  Globe,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowUpDown,
  Briefcase,
  Zap,
  Heart,
} from 'lucide-react';
import { JobSource, CAREER_TRACK_LABELS } from '@smartcareer/shared';

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

export default function JobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedCareer, setSelectedCareer] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('recent'); // 'recent' | 'matchScore' | 'salary'
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      if (favoritesOnly) {
        if (!user) {
          setJobs([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        const data = await apiRequest('/jobs/favorites/me');
        setJobs(data || []);
        setTotal(data?.length || 0);
        setTotalPages(1);
        return;
      }

      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (location) params.append('location', location);
      if (isRemote) params.append('isRemote', 'true');
      if (selectedSource !== 'ALL') params.append('source', selectedSource);
      if (selectedCareer !== 'ALL') params.append('career', selectedCareer);
      if (sortBy) params.append('sortBy', sortBy);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const data = await apiRequest(`/jobs?${params.toString()}`);
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, limit, isRemote, selectedSource, selectedCareer, sortBy, favoritesOnly]);

  const handleToggleFavorite = async (e: React.MouseEvent, jobId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      alert('กรุณาเข้าสู่ระบบเพื่อบันทึกงานที่คุณสนใจ');
      return;
    }
    try {
      const res = await apiRequest(`/jobs/${jobId}/favorite`, { method: 'POST' });
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, isFavorited: res.isFavorited } : j))
      );
      if (favoritesOnly && !res.isFavorited) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถบันทึกตำแหน่งงานได้');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const handleSourceTab = (source: string) => {
    if (source === 'FAVORITES') {
      setFavoritesOnly(true);
      setSelectedSource('ALL');
    } else {
      setFavoritesOnly(false);
      setSelectedSource(source);
    }
    setPage(1);
  };

  const handleCareerTab = (career: string) => {
    setSelectedCareer(career);
    setPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        {/* Header Title & Sorting controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3.5 py-1 text-[11px] font-[750] text-[#4f46e5] mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Intelligent Marketplace · แหล่งรวมงานเทคโนโลยี
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              ค้นหาตำแหน่งงาน{' '}
              <span className="relative text-[#4f46e5]">
                ที่ตรงกับทักษะคุณ
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[#818cf8] opacity-60" />
              </span>
            </h1>
            <p className="text-[13px] text-[#667085] mt-2 max-w-2xl leading-relaxed">
              รวบรวมตำแหน่งงานสายเทคแบบเรียลไทม์จาก JobsDB Thailand, JobThai, Blognone, Remotive และ Google Jobs พร้อมประเมิน Match Score อัจฉริยะ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 bg-white/95 border border-slate-200/90 rounded-full px-4 py-2 shadow-xs">
              <ArrowUpDown className="h-3.5 w-3.5 text-[#4f46e5]" />
              <span className="text-[11px] font-semibold text-[#667085]">เรียงตาม:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="recent">🕒 ล่าสุด (Newest)</option>
                <option value="matchScore">🌟 Best Match (ตรงกับทักษะคุณ)</option>
                <option value="salary">💰 เงินเดือนสูงสุด (Highest)</option>
              </select>
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-2 bg-white/95 border border-slate-200/90 rounded-full px-4 py-2 shadow-xs">
              <span className="text-[11px] font-semibold text-[#667085]">แสดง:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={20}>20 งาน</option>
                <option value={50}>50 งาน</option>
                <option value={100}>100 งาน</option>
              </select>
            </div>
          </div>
        </div>

        {/* Unauthenticated notice when Best Match is chosen */}
        {sortBy === 'matchScore' && !user && (
          <div className="mb-6 rounded-[20px] bg-gradient-to-r from-[#e8eaff]/70 to-[#eff1ff]/70 border border-[#dce0ff] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#6366f1] text-white flex items-center justify-center flex-shrink-0 shadow-xs shadow-indigo-500/20">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  ต้องการดู Match Score ตามทักษะจริงของคุณ?
                </p>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  เข้าสู่ระบบในฐานะ Candidate เพื่อให้ระบบคำนวณความตรงกันของทักษะและโปรไฟล์ของคุณกับทุกตำแหน่งงาน
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="px-4 py-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold whitespace-nowrap shadow-xs shadow-indigo-500/20 transition text-center"
            >
              เข้าสู่ระบบตอนนี้
            </Link>
          </div>
        )}

        {/* Platform Source Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-3 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1 mr-1 flex items-center gap-1.5 flex-shrink-0">
            <Globe className="h-3.5 w-3.5" /> แพลตฟอร์ม:
          </span>
          {[
            { id: 'ALL', label: 'ทุกแหล่ง (All Sources)' },
            ...(user
              ? [{ id: 'FAVORITES', label: '❤️ งานที่บันทึกไว้ (Favorites)' }]
              : []),
            { id: JobSource.JOBSDB, label: 'JobsDB (SEEK)' },
            { id: JobSource.JOBTHAI, label: 'JobThai' },
            { id: JobSource.REMOTIVE, label: 'Remotive Global' },
            { id: JobSource.JSEARCH, label: 'Google Jobs' },
            { id: JobSource.BLOGNONE, label: 'Blognone' },
            { id: JobSource.INTERNAL, label: 'SmartCareer Verified' },
          ].map((tab) => {
            const isActive = tab.id === 'FAVORITES' ? favoritesOnly : !favoritesOnly && selectedSource === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSourceTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? tab.id === 'FAVORITES'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-slate-900 text-white shadow-xs'
                    : tab.id === 'FAVORITES'
                    ? 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
                    : 'bg-white/90 border border-slate-200/90 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Career Track Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1 mr-1 flex items-center gap-1.5 flex-shrink-0">
            <Briefcase className="h-3.5 w-3.5" /> สายงาน:
          </span>
          <button
            onClick={() => handleCareerTab('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCareer === 'ALL'
                ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                : 'bg-white/90 border border-slate-200/90 text-slate-600 hover:bg-[#e8eaff]/50 hover:text-[#4f46e5]'
            }`}
          >
            ทุกสายงาน (All Fields)
          </button>
          {Object.entries(CAREER_TRACK_LABELS).map(([trackKey, trackLabel]) => (
            <button
              key={trackKey}
              onClick={() => handleCareerTab(trackKey)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCareer === trackKey
                  ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                  : 'bg-white/90 border border-slate-200/90 text-slate-600 hover:bg-[#e8eaff]/50 hover:text-[#4f46e5]'
              }`}
            >
              {trackLabel}
            </button>
          ))}
        </div>

        {/* Minimal Search & Filter Bar */}
        <form
          onSubmit={handleSearch}
          className="rounded-[20px] border border-slate-200/90 bg-white/95 p-3 sm:p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] mb-7 flex flex-col md:flex-row gap-3"
        >
          <div className="flex-1 relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-[#7a8494]" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ค้นหาชื่อตำแหน่ง, สกิล (React, Node.js, Python), หรือชื่อบริษัท..."
              className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="w-full md:w-64 relative flex items-center border-t md:border-t-0 md:border-l border-slate-200/80 pt-2 md:pt-0 md:pl-4">
            <MapPin className="absolute left-3 md:left-4 h-4 w-4 text-[#7a8494]" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="สถานที่ (เช่น กรุงเทพฯ, BTS)"
              className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200/80 pt-2 md:pt-0 md:pl-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={isRemote}
                onChange={(e) => {
                  setIsRemote(e.target.checked);
                  setPage(1);
                }}
                className="rounded text-[#6366f1] focus:ring-[#6366f1]"
              />
              <Globe className="h-3.5 w-3.5 text-[#6366f1]" />
              Remote
            </label>

            <button
              type="submit"
              className="rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white px-6 py-2.5 text-xs font-bold shadow-xs shadow-indigo-500/20 transition whitespace-nowrap"
            >
              ค้นหางาน
            </button>
          </div>
        </form>

        {/* Results Counter & Active Filters Display */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 px-1 text-xs">
          <div className="flex items-center gap-2 text-[#667085]">
            <span>
              พบ <span className="font-bold text-slate-900">{jobs.length}</span> จากทั้งหมด{' '}
              <span className="font-bold text-slate-900">{total}</span> ตำแหน่ง
            </span>
            {(selectedCareer !== 'ALL' || selectedSource !== 'ALL' || keyword || location || isRemote) && (
              <button
                onClick={() => {
                  setSelectedCareer('ALL');
                  setSelectedSource('ALL');
                  setKeyword('');
                  setLocation('');
                  setIsRemote(false);
                  setPage(1);
                }}
                className="text-[11px] font-bold text-[#4f46e5] hover:underline ml-2"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>

          {totalPages > 1 && (
            <span className="text-[#667085]">
              หน้า {page} จาก {totalPages}
            </span>
          )}
        </div>

        {/* Jobs List Grid */}
        {loading ? (
          <div className="py-28 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-[#667085]">กำลังโหลดตำแหน่งงานคุณภาพ...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center text-slate-500 bg-white/95 rounded-[20px] border border-slate-200/90 p-8 shadow-xs">
            <p className="font-bold text-slate-800 mb-1">ไม่พบตำแหน่งงานที่ตรงกับเงื่อนไข</p>
            <p className="text-xs text-[#667085]">
              ลองปรับคำค้นหา หรือเปลี่ยนตัวกรองสายงาน/แหล่งที่มาเพื่อดูผลลัพธ์เพิ่มเติม
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-[20px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-[#f4f5fa] border border-slate-200/80 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {job.companyLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={job.companyLogoUrl}
                            alt={job.companyName}
                            className="h-full w-full object-contain p-1"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = '<span class="font-bold text-[#4f46e5] text-sm">' + (job.companyName || 'S').charAt(0).toUpperCase() + '</span>';
                              }
                            }}
                          />
                        ) : (
                          <Building2 className="h-6 w-6 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-900 truncate tracking-tight">{job.title}</h2>
                        <span className="text-xs text-[#667085] truncate block mt-0.5">{job.companyName}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          id={`btn-favorite-${job.id}`}
                          onClick={(e) => handleToggleFavorite(e, job.id)}
                          className={`p-1 rounded-full border transition cursor-pointer flex items-center justify-center ${
                            job.isFavorited
                              ? 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100'
                              : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                          }`}
                          title={job.isFavorited ? 'ยกเลิกบันทึกงานนี้' : 'บันทึกงานที่สนใจ'}
                        >
                          <Heart className={`h-3.5 w-3.5 ${job.isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
                        </button>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap border ${
                            job.source === 'JOBSDB'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : job.source === 'JOBTHAI'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : job.source === 'REMOTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : job.source === 'BLOGNONE'
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {job.source}
                        </span>
                      </div>

                      {/* Match Score Badge */}
                      {job.matchScore !== undefined && job.matchScore !== null && (
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border whitespace-nowrap ${
                            job.matchScore >= 80
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                              : job.matchScore >= 60
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          🎯 {job.matchScore}% Match
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#667085] line-clamp-2 mt-2 leading-relaxed">
                    {job.description}
                  </p>

                  {/* Metadata Badges */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 bg-[#f9fafb] border border-slate-200/70 px-2.5 py-1 rounded-full text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {job.location}
                    </span>
                    {job.isRemote && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                        Remote
                      </span>
                    )}
                    {job.salaryMin && (
                      <span className="bg-[#f9fafb] border border-slate-200/70 px-2.5 py-1 rounded-full font-semibold text-slate-800">
                        ฿{job.salaryMin.toLocaleString()} - {job.salaryMax ? `฿${job.salaryMax.toLocaleString()}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Tagged Skills */}
                  {job.skills && job.skills.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
                      {job.skills.map((js: any) => (
                        <span
                          key={js.id || js.skillId}
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                            js.isRequired
                              ? 'bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff]'
                              : 'bg-[#f4f5fa] text-slate-600'
                          }`}
                        >
                          {js.skill?.name || js.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  {job.sourceUrl ? (
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#4f46e5] hover:text-[#4338ca] flex items-center gap-1.5 bg-[#e8eaff] hover:bg-[#dce0ff] border border-[#dce0ff] px-3.5 py-1.5 rounded-full transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                      ยื่นบน {getPlatformName(job.source)}
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      ผู้สมัคร {job._count?.applications || 0} คน
                    </span>
                  )}

                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-1 text-xs font-bold text-[#4f46e5] hover:text-[#4338ca] transition ml-auto"
                  >
                    รายละเอียดงาน
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3.5 py-2 rounded-full border border-slate-200/90 bg-white/95 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
            >
              <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`w-9 h-9 rounded-full text-xs font-bold transition ${
                    page === pNum
                      ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                      : 'bg-white/90 border border-slate-200/90 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3.5 py-2 rounded-full border border-slate-200/90 bg-white/95 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
            >
              ถัดไป <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
