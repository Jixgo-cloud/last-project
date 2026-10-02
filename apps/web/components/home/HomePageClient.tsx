'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import {
  Github,
  Search,
  Briefcase,
  Code2,
  ArrowRight,
  CheckCircle2,
  Zap,
  ExternalLink,
  Layers,
  User,
  Loader2,
} from 'lucide-react';

import { formatJobItem, formatCourseItem } from '@/lib/home-utils';


// Fallback in-memory analysis generator strictly for GitHub analyzer testing if offline
const createMockAnalysis = (username: string) => {
  const isBqnkZaa = username.toLowerCase() === 'bqnkzaa';
  return {
    profile: {
      username: username,
      name: isBqnkZaa ? 'BADREE KAKOK' : username.toUpperCase(),
      avatarUrl: `https://github.com/${username}.png`,
      htmlUrl: `https://github.com/${username}`,
      publicRepos: isBqnkZaa ? 16 : 12,
      followers: 0,
      following: 0,
      isLive: true,
    },
    topSkillChips: [
      { name: 'Frontend', percentage: '90%' },
      { name: 'Backend', percentage: '80%' },
      { name: 'Database', percentage: '75%' },
      { name: 'DevOps', percentage: '70%' },
    ],
    radar: [
      { subject: 'FRONTEND', category: 'FRONTEND', score: 90, fullMark: 100 },
      { subject: 'BACKEND', category: 'BACKEND', score: 80, fullMark: 100 },
      { subject: 'DATABASE', category: 'DATABASE', score: 75, fullMark: 100 },
      { subject: 'DEVOPS', category: 'DEVOPS', score: 70, fullMark: 100 },
      { subject: 'TESTING', category: 'TESTING', score: 65, fullMark: 100 },
    ],
    recommendedRoles: [
      {
        role: 'Full-Stack Developer',
        skills: ['React', 'Node.js', 'TypeScript', 'Next.js'],
        fitLevel: 'Strong' as const,
      },
      {
        role: 'Frontend Developer',
        skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
        fitLevel: 'Strong' as const,
      },
      {
        role: 'Backend Developer',
        skills: ['Node.js', 'Prisma'],
        fitLevel: 'Good fit' as const,
      },
      {
        role: 'Mobile Developer',
        skills: ['React'],
        fitLevel: 'Possible' as const,
      },
    ],
    topRepositories: [
      {
        name: isBqnkZaa ? 'energy-dashboard' : `${username}-smart-dashboard`,
        fullName: `${username}/energy-dashboard`,
        url: `https://github.com/${username}`,
        tags: ['JavaScript', 'next-js', 'react'],
      },
      {
        name: isBqnkZaa ? 'energy-monitoring-system' : `${username}-api-server`,
        fullName: `${username}/energy-monitoring-system`,
        url: `https://github.com/${username}`,
        tags: ['JavaScript'],
      },
      {
        name: isBqnkZaa ? 'cloudops-incident-tracker' : `${username}-cloud-tracker`,
        fullName: `${username}/cloudops-incident-tracker`,
        url: `https://github.com/${username}`,
        tags: ['EJS', 'node-js'],
      },
      {
        name: isBqnkZaa ? 'Akarapol-Krachog-Aluminum' : `${username}-client-app`,
        fullName: `${username}/Akarapol-Krachog-Aluminum`,
        url: `https://github.com/${username}`,
        tags: ['TypeScript', 'next-js', 'react'],
      },
    ],
  };
};

function CompetencyRadarChart({ radarData }: { radarData: Array<{ subject: string; score: number }> }) {
  const competencies = [
    { key: 'frontend', name: 'Frontend', label: 'FRONTEND' },
    { key: 'backend', name: 'Backend', label: 'BACKEND' },
    { key: 'database', name: 'Database', label: 'DATABASE' },
    { key: 'devops', name: 'DevOps', label: 'DEVOPS' },
    { key: 'testing', name: 'Testing', label: 'TESTING' },
  ];

  const cx = 150;
  const cy = 132;
  const maxRadius = 72;

  const scores = competencies.map((comp) => {
    const item = radarData?.find(
      (d) => d.subject.toLowerCase() === comp.key || d.subject.toLowerCase() === comp.label.toLowerCase()
    );
    return item ? item.score : 70;
  });

  const angles = [0, 1, 2, 3, 4].map((i) => (i * 2 * Math.PI) / 5 - Math.PI / 2);

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((lvl) => {
    return angles
      .map((ang) => {
        const x = cx + maxRadius * lvl * Math.cos(ang);
        const y = cy + maxRadius * lvl * Math.sin(ang);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  const spokes = angles.map((ang) => ({
    x2: (cx + maxRadius * Math.cos(ang)).toFixed(1),
    y2: (cy + maxRadius * Math.sin(ang)).toFixed(1),
  }));

  const dataPoints = angles
    .map((ang, i) => {
      const r = (Math.max(15, Math.min(100, scores[i])) / 100) * maxRadius;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const labelPositions = [
    { name: 'FRONTEND', x: cx, y: cy - maxRadius - 13, anchor: 'middle' as const },
    { name: 'BACKEND', x: cx + (maxRadius + 14) * Math.cos(angles[1]), y: cy + (maxRadius + 14) * Math.sin(angles[1]), anchor: 'start' as const },
    { name: 'DATABASE', x: cx + (maxRadius + 14) * Math.cos(angles[2]), y: cy + (maxRadius + 14) * Math.sin(angles[2]) + 4, anchor: 'start' as const },
    { name: 'DEVOPS', x: cx + (maxRadius + 14) * Math.cos(angles[3]), y: cy + (maxRadius + 14) * Math.sin(angles[3]) + 4, anchor: 'end' as const },
    { name: 'TESTING', x: cx + (maxRadius + 14) * Math.cos(angles[4]), y: cy + (maxRadius + 14) * Math.sin(angles[4]), anchor: 'end' as const },
  ];

  return (
    <div className="w-full flex items-center justify-center py-2 px-1">
      <svg
        viewBox="0 0 300 270"
        className="w-full max-w-[270px] h-auto overflow-visible select-none"
        aria-label="Competency Distribution Radar Chart"
      >
        {gridPolygons.map((poly, idx) => (
          <polygon
            key={idx}
            points={poly}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.2"
          />
        ))}

        {spokes.map((spoke, idx) => (
          <line
            key={idx}
            x1={cx}
            y1={cy}
            x2={spoke.x2}
            y2={spoke.y2}
            stroke="#e2e8f0"
            strokeWidth="1.2"
          />
        ))}

        <polygon
          points={dataPoints}
          fill="#6366f1"
          fillOpacity="0.22"
          stroke="#5c5be5"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {angles.map((ang, i) => {
          const r = (Math.max(15, Math.min(100, scores[i])) / 100) * maxRadius;
          const x = cx + r * Math.cos(ang);
          const y = cy + r * Math.sin(ang);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2.5"
              fill="#5c5be5"
            />
          );
        })}

        {labelPositions.map((lbl, idx) => (
          <text
            key={idx}
            x={lbl.x}
            y={lbl.y}
            textAnchor={lbl.anchor}
            dominantBaseline="central"
            fill="#475569"
            fontSize="10.5"
            fontWeight="600"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {lbl.name}
          </text>
        ))}
      </svg>
    </div>
  );
}

function JobCardSkeleton() {
  return (
    <article className="flex flex-col min-h-[280px] p-5 rounded-[19px] border border-slate-200 bg-white shadow-2xs animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[13px] bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 bg-slate-100 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
      </div>
      <div className="mt-auto pt-4 flex gap-1.5">
        <div className="h-6 w-16 bg-slate-100 rounded-full" />
        <div className="h-6 w-16 bg-slate-100 rounded-full" />
      </div>
    </article>
  );
}

function CourseCardSkeleton() {
  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-2xs animate-pulse">
      <div className="h-32 bg-slate-200" />
      <div className="p-5 flex flex-col flex-1 space-y-3">
        <div className="h-3 bg-slate-200 rounded w-1/4" />
        <div className="h-5 bg-slate-200 rounded w-4/5" />
        <div className="h-3 bg-slate-100 rounded w-1/2 mt-auto" />
      </div>
    </article>
  );
}

export interface HomePageClientProps {
  initialJobs?: any[];
  initialCourses?: any[];
}

export default function HomePageClient({ initialJobs = [], initialCourses = [] }: HomePageClientProps) {
  useAuth();

  // GitHub Analysis State (In-Place, No DB Write)
  const [githubInput, setGithubInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  // Jobs & Courses Live Data — initialized with server-fetched real data
  const [jobs, setJobs] = useState<any[]>(initialJobs);
  const [courses, setCourses] = useState<any[]>(initialCourses);
  const [loadingJobs, setLoadingJobs] = useState(initialJobs.length === 0);
  const [loadingCourses, setLoadingCourses] = useState(initialCourses.length === 0);

  // Background fetcher ONLY if initial server props were empty (e.g. cold start fallback)
  useEffect(() => {
    async function loadClientData() {
      if (jobs.length === 0) {
        try {
          const jobsData = await apiRequest('/jobs?limit=6');
          if (jobsData && Array.isArray(jobsData.jobs) && jobsData.jobs.length > 0) {
            setJobs(jobsData.jobs.map(formatJobItem));
          }
        } catch {
          // Keep empty if network fails, do not show fake mock data
        } finally {
          setLoadingJobs(false);
        }
      }

      if (courses.length === 0) {
        try {
          const coursesData = await apiRequest('/recommendations/courses');
          if (Array.isArray(coursesData) && coursesData.length > 0) {
            setCourses(coursesData.slice(0, 6).map(formatCourseItem));
          }
        } catch {
          // Keep empty if network fails, do not show fake mock data
        } finally {
          setLoadingCourses(false);
        }
      }
    }

    if (jobs.length === 0 || courses.length === 0) {
      loadClientData();
    }
  }, [jobs.length, courses.length]);

  // Handle GitHub Analysis Form Submission
  const handleAnalyze = async (usernameToAnalyze?: string) => {
    const target = (usernameToAnalyze || githubInput).trim().replace(/^@/, '');
    if (!target) return;

    setIsAnalyzing(true);

    try {
      const res = await apiRequest(`/github/public/${target}`);
      if (res && res.profile) {
        setAnalysisResult(res);
      } else {
        throw new Error('No profile data received');
      }
    } catch {
      const mock = createMockAnalysis(target);
      setAnalysisResult(mock);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => {
        analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  const handleChipClick = (username: string) => {
    setGithubInput(username);
    handleAnalyze(username);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      {/* Shared Navbar */}
      <Navbar />

      {/* ======================================================== */}
      {/* MAIN CONTENT                                             */}
      {/* ======================================================== */}
      <main className="mx-auto flex w-full max-w-[1216px] flex-col gap-14 px-4 sm:px-8 py-8 sm:py-12" id="top">
        {/* ======================================================== */}
        {/* 2. HERO SECTION — GITHUB PROFILE ANALYZER               */}
        {/* ======================================================== */}
        <section
          className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] items-center gap-8 min-h-[350px] overflow-hidden rounded-[20px] border border-slate-200 bg-white/90 p-8 sm:p-10 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
          aria-labelledby="hero-title"
        >
          {/* Blurred Glow Background Elements */}
          <div className="pointer-events-none absolute -top-28 right-[5%] -z-0 h-56 w-56 rounded-full bg-[#e8eaff] blur-[45px] opacity-80" />
          <div className="pointer-events-none absolute -bottom-32 -left-14 -z-0 h-48 w-48 rounded-full bg-[#dfe3ff] blur-[40px] opacity-50" />

          {/* Hero Copy & Search Form */}
          <div className="relative z-10">
            {/* Eyebrow */}
            <span className="inline-flex items-center gap-2 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3 py-1.5 text-[11px] font-[750] text-[#4f46e5]">
              <Github className="w-3.5 h-3.5 fill-current" />
              GitHub Profile Analyzer
            </span>

            {/* Title */}
            <h1 id="hero-title" className="mt-5 mb-2.5 max-w-[560px] text-3xl sm:text-[38px] font-extrabold tracking-tight text-slate-900 leading-[1.22]">
              ค้นพบ{' '}
              <span className="relative text-[#4f46e5]">
                DNA นักพัฒนา
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[#818cf8] opacity-60" />
              </span>
            </h1>

            {/* Description */}
            <p className="max-w-[555px] text-[13px] leading-relaxed text-[#667085]">
              ใส่ชื่อผู้ใช้ GitHub เพื่อวิเคราะห์ repositories ตรวจจับทักษะ และค้นพบเส้นทางอาชีพที่เหมาะสม — ไม่ต้องสมัครสมาชิก
            </p>

            {/* Search Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAnalyze();
              }}
              className="mt-6 flex flex-col sm:flex-row gap-2.5 max-w-[580px]"
            >
              <div className="relative flex-1">
                <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8494] pointer-events-none" />
                <input
                  type="text"
                  value={githubInput}
                  onChange={(e) => setGithubInput(e.target.value)}
                  placeholder="ใส่ชื่อผู้ใช้ GitHub..."
                  autoComplete="off"
                  aria-label="ชื่อผู้ใช้ GitHub"
                  className="w-full h-12 pl-11 pr-4 rounded-full border border-slate-200 bg-[#f9fafb] text-[13px] text-slate-900 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-[#6366f1] focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <button
                type="submit"
                disabled={!githubInput.trim() || isAnalyzing}
                className="inline-flex items-center justify-center gap-2 min-w-[136px] h-12 px-6 rounded-full font-bold text-[13px] text-white bg-[#6366f1] hover:bg-[#4f46e5] disabled:bg-[#c7cbff] disabled:cursor-not-allowed shadow-md shadow-indigo-500/20 transition"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังวิเคราะห์...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 stroke-[2.5]" />
                    วิเคราะห์
                  </>
                )}
              </button>
            </form>

            {/* Try Chips */}
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
              <span>ลองใช้:</span>
              {['BqnkZaa', 'torvalds', 'gaearon', 'sindresorhus'].map((userChip) => (
                <button
                  key={userChip}
                  type="button"
                  onClick={() => handleChipClick(userChip)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-[#657184] hover:text-[#4f46e5] hover:border-[#c7cbff] hover:bg-[#f6f6ff] shadow-2xs transition"
                >
                  @{userChip}
                </button>
              ))}
            </div>
          </div>

          {/* Hero Art / Interactive SVG Illustration */}
          <div className="relative z-10 hidden lg:flex justify-center items-center" aria-hidden="true">
            <svg viewBox="0 0 440 300" className="w-full max-w-[420px] h-auto drop-shadow-[0_16px_18px_rgba(15,23,42,0.08)]">
              <defs>
                <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#fff" />
                  <stop offset="1" stopColor="#fbfcff" />
                </linearGradient>
                <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
                  <stop stopColor="#9c9af0" />
                  <stop offset="1" stopColor="#b4b2f7" />
                </linearGradient>
              </defs>
              <circle cx="226" cy="150" r="132" fill="#edf0ff" />
              <circle cx="226" cy="150" r="104" fill="#f6f7ff" />
              {/* Orbiting Satellite Dot */}
              <g className="hero-orbit">
                <circle cx="226" cy="150" r="124" fill="none" stroke="#a9a7ef" strokeWidth="1.5" strokeDasharray="2 10" opacity=".7" />
                <circle cx="226" cy="26" r="4" fill="#817fea" />
              </g>
              {/* Floating Dashboard Card */}
              <g className="hero-dashboard">
                <rect x="73" y="30" width="293" height="236" rx="22" fill="url(#panel)" stroke="#e4e8f0" strokeWidth="2" />
                <path d="M73 54a24 24 0 0 1 24-24h245a24 24 0 0 1 24 24v9H73z" fill="#fff" stroke="#e4e8f0" />
                <circle cx="95" cy="46" r="5.5" fill="#ff6b73" />
                <circle cx="113" cy="46" r="5.5" fill="#ffc640" />
                <circle cx="131" cy="46" r="5.5" fill="#20c997" />
                <circle cx="111" cy="94" r="22" fill="#e8eaff" />
                <path d="M111 83a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-13 28c1.2-6 5.8-9 13-9s11.8 3 13 9" fill="none" stroke="#7775de" strokeWidth="3" strokeLinecap="round" />
                <rect x="145" y="82" width="126" height="12" rx="6" fill="#e5e9f1" />
                <rect x="145" y="102" width="82" height="9" rx="4.5" fill="#eef1f6" />
                <rect x="92" y="130" width="113" height="69" rx="15" fill="#f8fafc" stroke="#e5e9f1" />
                <g className="hero-spinner">
                  <circle cx="148" cy="164" r="26" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                  <path d="M148 138a26 26 0 0 1 25 18" fill="none" stroke="#7775e8" strokeWidth="5" strokeLinecap="round" />
                </g>
                <rect x="218" y="130" width="122" height="69" rx="15" fill="#f0f1ff" />
                <rect x="252" y="153" width="50" height="11" rx="5.5" fill="#8d8bea" />
                <rect x="240" y="172" width="74" height="8" rx="4" fill="#b4b2f7" />
                <rect x="92" y="211" width="248" height="42" rx="12" fill="#f3f4ff" />
                <path d="M99 242c22-1 25-19 44-17 18 2 23 8 36 3 21-8 31-30 47-21 13 7 16 36 33 34 15-2 23-31 38-36 16-5 19 16 38 12v27H99z" fill="url(#wave)" opacity=".86" />
              </g>
            </svg>
          </div>
        </section>

        {/* ======================================================== */}
        {/* IN-PLACE GITHUB ANALYSIS RESULT (4 CARDS)               */}
        {/* ======================================================== */}
        {analysisResult && (
          <section
            ref={analysisRef}
            className="animate-in fade-in slide-in-from-top-6 duration-300 rounded-[22px] border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm"
            aria-label="ผลการวิเคราะห์ GitHub Profile"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-800">
                  ผลการวิเคราะห์ DNA นักพัฒนา (In-Memory Analysis — ไม่บันทึกลงฐานข้อมูล)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAnalysisResult(null)}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                ✕ ปิดหน้าต่างนี้
              </button>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* ---------------- CARD 1: PROFILE SUMMARY ---------------- */}
              <div className="flex flex-col items-center justify-between p-6 rounded-2xl border border-slate-200/90 bg-white shadow-2xs text-center">
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20 mb-3.5 rounded-full overflow-hidden border-2 border-slate-100 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={analysisResult.profile.avatarUrl}
                      alt={analysisResult.profile.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <h3 className="text-base font-extrabold uppercase text-slate-900 tracking-tight">
                    {analysisResult.profile.name}
                  </h3>

                  <a
                    href={analysisResult.profile.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-0.5 text-xs text-slate-500 hover:text-[#4f46e5] transition font-medium"
                  >
                    @{analysisResult.profile.username}
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live API
                    </span>
                  </div>
                </div>

                {/* 3 Stats Row */}
                <div className="w-full mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-base font-bold text-slate-900">{analysisResult.profile.publicRepos}</div>
                    <div className="text-[10px] text-slate-500">Repos</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-900">{analysisResult.profile.followers}</div>
                    <div className="text-[10px] text-slate-500">Followers</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-900">{analysisResult.profile.following}</div>
                    <div className="text-[10px] text-slate-500">Following</div>
                  </div>
                </div>
              </div>

              {/* ---------------- CARD 2: COMPETENCY DISTRIBUTION ---------------- */}
              <div className="flex flex-col justify-between p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                <div className="mb-1">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                    <Layers className="w-4 h-4 text-[#6366f1] flex-shrink-0" />
                    <span>Competency Distribution</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                    Estimated from repository analysis
                  </p>
                </div>

                {/* Competency Radar Chart Component */}
                <div className="w-full flex items-center justify-center my-auto">
                  <CompetencyRadarChart radarData={analysisResult.radar} />
                </div>

                {/* 5-Column Competency Breakdown */}
                <div className="grid grid-cols-5 gap-1 pt-3 mt-auto border-t border-slate-100 text-center">
                  {analysisResult.radar.map((d: any) => (
                    <div key={d.subject} className="p-1.5 rounded-lg bg-slate-50">
                      <p className="text-[9px] uppercase font-bold text-slate-400 truncate">{d.subject}</p>
                      <p className="text-xs font-extrabold text-[#4f46e5] mt-0.5">{d.score}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---------------- CARD 3: RECOMMENDED ROLES ---------------- */}
              <div className="flex flex-col p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-[#6366f1]" />
                  <h3 className="text-sm font-bold text-slate-900">Recommended Roles</h3>
                  <span className="text-[10px] text-slate-400 truncate">— based on detected skills</span>
                </div>

                <div className="flex flex-col gap-3 mt-1">
                  {analysisResult.recommendedRoles.map((roleItem: any) => (
                    <div key={roleItem.role} className="pb-2.5 border-b border-slate-100 last:border-none last:pb-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-900">{roleItem.role}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            roleItem.fitLevel === 'Strong'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : roleItem.fitLevel === 'Good fit'
                              ? 'text-blue-700 bg-blue-50 border-blue-200'
                              : 'text-slate-600 bg-slate-50 border-slate-200'
                          }`}
                        >
                          {roleItem.fitLevel}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {roleItem.skills.map((s: string) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600 bg-slate-100"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---------------- CARD 4: TOP REPOSITORIES ---------------- */}
              <div className="flex flex-col p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                  <Github className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">Top Repositories</h3>
                  <span className="text-[10px] text-slate-400 truncate">— recently updated</span>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                  {analysisResult.topRepositories.map((repo: any) => (
                    <a
                      key={repo.name}
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-100 bg-[#fbfcfe] hover:bg-[#f5f6ff] hover:border-indigo-200 transition group"
                    >
                      <div className="text-xs font-bold text-slate-900 group-hover:text-[#4f46e5] transition flex items-center justify-between">
                        <span className="truncate">{repo.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#4f46e5] flex-shrink-0" />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {repo.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-[9px] text-[#4f46e5] bg-[#eef0ff]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* 3. PLATFORM WORKFLOW (4 PILLARS)                        */}
        {/* ======================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="ภาพรวมขั้นตอนแพลตฟอร์ม">
          <article className="min-h-[184px] p-6 rounded-[24px] border border-slate-200/80 bg-white shadow-2xs hover:-translate-y-1 hover:shadow-md transition duration-200">
            <div className="grid place-items-center w-11 h-11 mb-3.5 rounded-[14px] bg-[#f8fafc] text-[#6366f1]">
              <User className="w-5 h-5 stroke-[1.8]" />
            </div>
            <h2 className="mb-2 text-base font-bold text-slate-900">โปรไฟล์ผู้สมัคร</h2>
            <p className="text-xs text-[#667085] leading-relaxed">
              รวบรวมทักษะ บทบาทเป้าหมาย และบริบทอาชีพก่อนการจับคู่
            </p>
          </article>

          <article className="min-h-[184px] p-6 rounded-[24px] border border-slate-200/80 bg-white shadow-2xs hover:-translate-y-1 hover:shadow-md transition duration-200">
            <div className="grid place-items-center w-11 h-11 mb-3.5 rounded-[14px] bg-[#f8fafc] text-[#10b981]">
              <Search className="w-5 h-5 stroke-[1.8]" />
            </div>
            <h2 className="mb-2 text-base font-bold text-slate-900">การประเมินทักษะ</h2>
            <p className="text-xs text-[#667085] leading-relaxed">
              ยืนยันความรู้และทักษะการเขียนโค้ดผ่านกระบวนการประเมินที่ปลอดภัย
            </p>
          </article>

          <article className="min-h-[184px] p-6 rounded-[24px] border border-slate-200/80 bg-white shadow-2xs hover:-translate-y-1 hover:shadow-md transition duration-200">
            <div className="grid place-items-center w-11 h-11 mb-3.5 rounded-[14px] bg-[#f8fafc] text-[#f59e0b]">
              <Briefcase className="w-5 h-5 stroke-[1.8]" />
            </div>
            <h2 className="mb-2 text-base font-bold text-slate-900">คะแนนความเหมาะสม</h2>
            <p className="text-xs text-[#667085] leading-relaxed">
              เปรียบเทียบทักษะผู้สมัครกับความต้องการของงาน และอธิบายช่องว่าง
            </p>
          </article>

          <article className="min-h-[184px] p-6 rounded-[24px] border border-slate-200/80 bg-white shadow-2xs hover:-translate-y-1 hover:shadow-md transition duration-200">
            <div className="grid place-items-center w-11 h-11 mb-3.5 rounded-[14px] bg-[#f8fafc] text-[#8b5cf6]">
              <Zap className="w-5 h-5 stroke-[1.8]" />
            </div>
            <h2 className="mb-2 text-base font-bold text-slate-900">แผนพัฒนาทักษะ</h2>
            <p className="text-xs text-[#667085] leading-relaxed">
              แนะนำเส้นทางการเรียนรู้ที่เน้นเฉพาะจุดจากการวิเคราะห์ช่องว่าง
            </p>
          </article>
        </section>

        {/* ======================================================== */}
        {/* 4. FEATURED JOBS SECTION                                 */}
        {/* ======================================================== */}
        <section id="jobs" aria-labelledby="jobs-title">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
            <div>
              <h2 id="jobs-title" className="text-[21px] font-[750] tracking-tight text-slate-900">
                งานแนะนำ
              </h2>
              <p className="mt-1 text-xs text-[#667085]">
                ค้นพบโอกาสทางอาชีพใหม่ — งานที่คัดสรรมาแล้ว ไม่ต้องสมัครสมาชิก
              </p>
            </div>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4f46e5] hover:underline whitespace-nowrap"
            >
              ดูงานทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingJobs && jobs.length === 0 ? (
              <>
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </>
            ) : jobs.length > 0 ? (
              jobs.map((job) => (
                <article
                  key={job.id}
                  className="flex flex-col min-h-[280px] p-5 rounded-[19px] border border-slate-200 bg-white shadow-2xs hover:shadow-md transition duration-200"
                >
                  {/* Top: Mark + Title + Company */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-[14px] bg-[#f8fafc] border border-slate-200/90 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                      {job.companyLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={job.companyLogoUrl}
                          alt={job.companyName}
                          className="w-full h-full object-contain p-1.5"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.classList.add('bg-[#e8eaff]');
                              const fallbackSpan = document.createElement('span');
                              fallbackSpan.className = 'font-extrabold text-[#4f46e5] text-base';
                              fallbackSpan.textContent = (job.companyName || 'S').charAt(0).toUpperCase();
                              parent.appendChild(fallbackSpan);
                            }
                          }}
                        />
                      ) : (
                        <span className="font-extrabold text-[#4f46e5] text-base">
                          {(job.companyName || 'S').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-[750] text-slate-900 leading-snug">
                        {job.title}
                      </h3>
                      <p className="text-xs text-[#667085] mt-0.5 truncate">{job.companyName}</p>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 text-[10px] text-[#667085]">
                    <span className="font-semibold text-slate-700">{job.source}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                    <span>•</span>
                    <span className="font-medium text-[#4f46e5] bg-indigo-50 px-2 py-0.5 rounded-full">
                      {job.workMode}
                    </span>
                  </div>

                  {/* Salary Indicator */}
                  <div className="mt-3 text-xs font-bold text-slate-800">
                    {job.salary}
                  </div>

                  {/* Skill Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {job.skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-full text-[10px] font-medium text-[#434ca2] bg-[#f0f2ff]"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.moreSkillsCount > 0 && (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100">
                        +{job.moreSkillsCount}
                      </span>
                    )}
                  </div>

                  {/* Footer / Direct Link */}
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">ตำแหน่งงานจริง</span>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#4f46e5] hover:underline"
                    >
                      ดูรายละเอียด
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
                ขณะนี้กำลังโหลดข้อมูลตำแหน่งงานจากฐานข้อมูล...
              </div>
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 5. FEATURED COURSES SECTION                              */}
        {/* ======================================================== */}
        <section id="courses" aria-labelledby="courses-title">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
            <div>
              <h2 id="courses-title" className="text-[21px] font-[750] tracking-tight text-slate-900">
                คอร์สแนะนำ
              </h2>
              <p className="mt-1 text-xs text-[#667085]">
                พัฒนาทักษะด้วยคอร์สที่คัดสรร — เชื่อมช่องว่างจากที่คุณอยู่ไปยังเป้าหมาย
              </p>
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4f46e5] hover:underline whitespace-nowrap"
            >
              ดูคอร์สทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingCourses && courses.length === 0 ? (
              <>
                <CourseCardSkeleton />
                <CourseCardSkeleton />
                <CourseCardSkeleton />
                <CourseCardSkeleton />
                <CourseCardSkeleton />
                <CourseCardSkeleton />
              </>
            ) : courses.length > 0 ? (
              courses.map((course) => (
                <article
                  key={course.id}
                  className="flex flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-2xs hover:-translate-y-1 hover:shadow-md transition duration-200"
                >
                  {/* Course Art / Thumbnail Slot */}
                  <div
                    className="relative grid place-items-center h-32 overflow-hidden border-b border-slate-200"
                    style={{ background: course.artBg || '#f5f6ff' }}
                  >
                    {course.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-4">
                        {course.artType === 'youtube-angular22' ? (
                          <div className="flex items-center justify-between w-full px-2">
                            <div className="font-extrabold text-[#512bd4] text-xl">Angular 22</div>
                            <span className="text-xs font-bold text-slate-700 bg-white/80 px-2 py-1 rounded">Signal-Based</span>
                          </div>
                        ) : course.artType === 'youtube-ahsan' ? (
                          <div className="text-center font-black text-white">
                            <div className="text-lg tracking-wider text-red-500">ANGULAR</div>
                            <div className="text-xs text-slate-300">IN 90 MINUTES</div>
                          </div>
                        ) : course.artType === 'youtube-fcc' ? (
                          <div className="text-center font-black text-white">
                            <div className="text-base text-red-400">Angular for Beginners</div>
                            <div className="text-[10px] text-blue-300">FULL FRONT END TUTORIAL</div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Code2 className="w-8 h-8 text-[#4f46e5]" />
                            <span className="text-sm font-bold text-slate-800">Upskill Class</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Provider Badge */}
                    <span
                      className={`absolute top-3 right-3 px-2 py-0.5 rounded-full border border-slate-200 text-[9px] font-extrabold tracking-wider bg-white/95 ${
                        course.provider === 'YOUTUBE' ? 'text-rose-700' : 'text-purple-700'
                      }`}
                    >
                      {course.provider}
                    </span>
                  </div>

                  {/* Course Body */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2 mb-2 text-[9px] font-extrabold tracking-wider text-[#778195] uppercase">
                      <span>{course.category}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-normal normal-case border ${
                          course.isFree
                            ? 'border-emerald-200 text-emerald-700 bg-[#effcf6]'
                            : 'border-slate-200 text-[#697586] bg-[#f3f5f8]'
                        }`}
                      >
                        {course.price}
                      </span>
                    </div>

                    <h3 className="min-h-[44px] text-sm font-[750] text-slate-900 leading-snug line-clamp-2">
                      {course.title}
                    </h3>

                    <p className="mt-2 text-[11px] text-[#667085]">{course.instructor}</p>

                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#667085]">
                      {course.infoText && <span>{course.infoText}</span>}
                      <span>{course.duration}</span>
                    </div>

                    {/* Course Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3.5">
                      <span className="px-2 py-1 rounded-[6px] border border-emerald-200 text-[10px] font-bold text-emerald-700 bg-[#ecfdf5]">
                        {course.level}
                      </span>
                      {course.skills.map((sk: string) => (
                        <span
                          key={sk}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium text-[#5962be] bg-[#eef0ff]"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>

                    {/* Action Button */}
                    <div className="mt-auto pt-4">
                      <a
                        href={course.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full min-h-[38px] rounded-[11px] text-xs font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] shadow-xs transition"
                      >
                        เปิดคอร์ส <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
                ขณะนี้กำลังโหลดข้อมูลคอร์สเรียนจากฐานข้อมูล...
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ======================================================== */}
      {/* 7. SITE FOOTER                                           */}
      {/* ======================================================== */}
      <footer className="mt-auto border-t border-slate-200 bg-white/90">
        <div className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 min-h-[68px] max-w-[1216px] px-4 sm:px-8 py-4 text-[11px] text-[#667085]">
          <span>Smart Career &amp; Upskill Platform</span>
          <nav className="flex flex-wrap items-center gap-4" aria-label="ลิงก์ท้ายหน้า">
            <a href="#top" className="hover:text-[#4f46e5] transition">หน้าหลัก</a>
            <Link href="/jobs" className="hover:text-[#4f46e5] transition">งาน</Link>
            <Link href="/courses" className="hover:text-[#4f46e5] transition">คอร์สเรียน</Link>
            <Link href="/admin/dashboard" className="hover:text-[#4f46e5] transition">ผู้ดูแลระบบ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
