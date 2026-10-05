'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Code2,
  FileQuestion,
  Clock,
  Award,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { AssessmentType, getAttemptPercentage, formatAttemptScore } from '@smartcareer/shared';

export default function AssessmentsPage() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [myAttempts, setMyAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPromises: Promise<any>[] = [apiRequest('/assessments')];
    if (user) {
      fetchPromises.push(apiRequest('/assessments/my-attempts').catch(() => []));
    }

    Promise.all(fetchPromises)
      .then(([assessData, attemptsData]) => {
        setAssessments(assessData || []);
        if (attemptsData) setMyAttempts(attemptsData);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [user]);

  // Map latest attempt per assessment ID
  const latestAttemptsByAssessmentId = React.useMemo(() => {
    const map = new Map<string, any>();
    myAttempts.forEach((att) => {
      // First one encountered is latest due to orderBy startedAt desc
      if (!map.has(att.assessmentId)) {
        map.set(att.assessmentId, att);
      }
    });
    return map;
  }, [myAttempts]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-8 max-w-[1216px] mx-auto w-full">
        {/* Header */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce0ff] bg-[#e8eaff] px-3.5 py-1 text-[11px] font-[750] text-[#4f46e5] mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Skill Verification Center · ศูนย์ทดสอบทักษะแบบเข้มงวด
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            แบบทดสอบทักษะ &amp;{' '}
            <span className="relative text-[#4f46e5]">
              Strict Coding Sandbox
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-[#818cf8] opacity-60" />
            </span>
          </h1>
          <p className="text-[13px] text-[#667085] mt-2 leading-relaxed">
            พิสูจน์ความสามารถของคุณผ่านแบบทดสอบเชิงทฤษฎี และโจทย์เขียนโค้ด Sandbox พร้อมตรวจ Test Cases จริงทุกข้อ 100% ผ่านระบบ Safe Sandbox เพื่อรับเหรียญทักษะยืนยันสำหรับโปรไฟล์
          </p>
        </div>

        {loading ? (
          <div className="py-28 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-[#667085]">กำลังโหลดรายการแบบทดสอบ...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assessments.map((a) => {
              const latestAttempt = latestAttemptsByAssessmentId.get(a.id);

              return (
                <div
                  key={a.id}
                  className="rounded-[22px] border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          a.type === AssessmentType.PRACTICAL_CODING
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-[#e8eaff] text-[#4f46e5] border border-[#dce0ff]'
                        }`}
                      >
                        {a.type === AssessmentType.PRACTICAL_CODING ? (
                          <>
                            <Code2 className="h-3.5 w-3.5" /> Practical Coding Sandbox
                          </>
                        ) : (
                          <>
                            <FileQuestion className="h-3.5 w-3.5" /> Theory Assessment
                          </>
                        )}
                      </span>

                      {a.skill && (
                        <span className="text-[11px] font-semibold text-slate-700 bg-[#f4f5fa] border border-slate-200/70 px-3 py-1 rounded-full">
                          {a.skill.name}
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {a.title}
                    </h2>
                    <p className="text-xs text-[#667085] mt-2 line-clamp-3 leading-relaxed">
                      {a.description}
                    </p>

                    {/* Attempt Status Badge */}
                    {latestAttempt && (
                      <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">ผลการสอบรอบล่าสุด:</span>
                        <span
                          className={`font-bold inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${
                            latestAttempt.passed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {getAttemptPercentage(latestAttempt) === null ? (
                            <><Clock className="h-3.5 w-3.5" />{latestAttempt.status === 'IN_PROGRESS' ? 'กำลังทำข้อสอบ' : 'รอตรวจ'}</>
                          ) : latestAttempt.passed ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ผ่านแล้ว ({formatAttemptScore(latestAttempt)})
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-600" />
                              ยังไม่ผ่าน ({formatAttemptScore(latestAttempt)})
                            </>
                          )}
                        </span>
                      </div>
                    )}

                    <div className="mt-5 flex items-center gap-4 text-xs text-[#667085] pt-4 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {a.timeLimitMinutes} นาที
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3.5 w-3.5 text-slate-400" />
                        เกณฑ์ผ่าน: {a.passingScore}%
                      </span>
                      <span className="text-slate-400 ml-auto">
                        {a._count?.questions || 1} ข้อ
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <Link
                      href={`/assessments/${a.id}`}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] py-2.5 text-xs font-bold text-white shadow-xs shadow-indigo-500/20 transition"
                    >
                      {latestAttempt ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          ดูผล / สอบใหม่ (Result / Retake)
                        </>
                      ) : (
                        <>
                          เริ่มทำแบบทดสอบ
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
