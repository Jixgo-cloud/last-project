'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Building2, ArrowRight, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { UserRole } from '@smartcareer/shared';

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [role, setRole] = useState<UserRole>(UserRole.CANDIDATE);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [targetCareer, setTargetCareer] = useState('Full Stack Developer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    window.location.href = `${apiUrl}/auth/${provider}?role=${role}&mode=register`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await register({
        email,
        password,
        role,
        fullName: role === UserRole.CANDIDATE ? fullName : undefined,
        companyName: role === UserRole.COMPANY ? companyName : undefined,
        targetCareer: role === UserRole.CANDIDATE ? targetCareer : undefined,
      });

      if (res.role === UserRole.COMPANY) {
        router.push('/company/dashboard');
      } else {
        router.push('/profile');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 my-6">
        <div className="w-full max-w-md rounded-[24px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8eaff] text-[#4f46e5] font-extrabold text-base mb-3 shadow-xs">
              SC
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              สร้างบัญชีใหม่ (Create Account)
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] mt-1">
              เข้าร่วมเครือข่ายอัจฉริยะ SmartCareer
            </p>
          </div>

          {/* Role Selector Tabs (Candidate vs Company) */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#f4f5fa] border border-slate-200/70 rounded-full mb-5">
            <button
              type="button"
              onClick={() => {
                setRole(UserRole.CANDIDATE);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-full transition ${
                role === UserRole.CANDIDATE
                  ? 'bg-white text-[#4f46e5] shadow-xs'
                  : 'text-[#667085] hover:text-slate-900'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              ผู้หางาน (Candidate)
            </button>
            <button
              type="button"
              onClick={() => {
                setRole(UserRole.COMPANY);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-full transition ${
                role === UserRole.COMPANY
                  ? 'bg-white text-[#4f46e5] shadow-xs'
                  : 'text-[#667085] hover:text-slate-900'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              บริษัท/ผู้ว่าจ้าง (Company)
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Social Sign Up Buttons */}
          <div className="space-y-2.5 mb-5">
            {role === UserRole.CANDIDATE ? (
              <>
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('github')}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition"
                >
                  <GithubIcon />
                  <span>สมัครสมาชิกด้วย GitHub (สำหรับ Candidate)</span>
                </button>

                <div className="p-3 rounded-2xl bg-[#e8eaff]/50 border border-[#dce0ff] flex items-center gap-2 text-[11px] text-[#4f46e5]">
                  <Info className="h-4 w-4 shrink-0 text-[#4f46e5]" />
                  <span>แนะนำสมัครด้วย GitHub เพื่อนำ Repositories มาคำนวณเรดาร์ทักษะได้ทันที</span>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition"
                >
                  <GoogleIcon />
                  <span>สมัครสมาชิกด้วย Google (สำหรับ Company)</span>
                </button>

                <div className="p-3 rounded-2xl bg-[#f4f5fa] border border-slate-200/70 flex items-center gap-2 text-[11px] text-[#667085]">
                  <Info className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>บัญชีประเภทบริษัทสามารถลงทะเบียนผ่าน Google หรืออีเมลองค์กร</span>
                </div>
              </>
            )}
          </div>

          <div className="relative flex items-center justify-center mb-5">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              หรือกรอกข้อมูล
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === UserRole.CANDIDATE ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อ-นามสกุล (Full Name)</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">เป้าหมายสายงาน (Target Career)</label>
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
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อบริษัท / องค์กร (Company Name)</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="เช่น บริษัท สยามเทค อินโนเวชั่น จำกัด"
                  className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">อีเมล (Email Address)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสผ่าน (Password)</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-full bg-[#6366f1] py-3 text-xs sm:text-sm font-bold text-white shadow-xs shadow-indigo-500/20 hover:bg-[#4f46e5] disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  กำลังลงทะเบียน...
                </>
              ) : (
                <>
                  สร้างบัญชีผู้ใช้
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#667085]">
            มีบัญชีผู้ใช้อยู่แล้ว?{' '}
            <Link href="/login" className="font-bold text-[#4f46e5] hover:underline">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
          <div className="text-xs font-medium text-[#667085]">กำลังโหลดหน้าสมัครสมาชิก...</div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
