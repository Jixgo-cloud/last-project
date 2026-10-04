'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { UserRole } from '@smartcareer/shared';
import { getSafeInternalRedirect } from '@/lib/navigation';

const POST_LOGIN_REDIRECT_KEY = 'smartcareer_post_login_redirect';

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

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

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
    const role = provider === 'github' ? 'CANDIDATE' : 'COMPANY';
    const redirectPath = role === 'CANDIDATE'
      ? getSafeInternalRedirect(searchParams.get('redirect'))
      : null;
    if (redirectPath) {
      sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectPath);
    } else {
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    window.location.href = `${apiUrl}/auth/${provider}?role=${role}&mode=login&origin=${encodeURIComponent(origin)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      if (res.role === UserRole.ADMIN) {
        router.push('/admin/dashboard');
      } else if (res.role === UserRole.COMPANY) {
        router.push('/company/dashboard');
      } else {
        router.push(getSafeInternalRedirect(searchParams.get('redirect')) || '/profile');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const setDemoCredentials = (role: 'CANDIDATE' | 'COMPANY' | 'ADMIN') => {
    if (role === 'CANDIDATE') {
      setEmail('candidate@smartcareer.dev');
      setPassword('password123');
    } else if (role === 'COMPANY') {
      setEmail('hr@techcorp.co.th');
      setPassword('password123');
    } else {
      setEmail('admin@smartcareer.dev');
      setPassword('admin123');
    }
  };

  const showDemoLogin =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === 'true';

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
              เข้าสู่ระบบ (Sign In)
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] mt-1">
              เข้าถึงแดชบอร์ดอาชีพและเรดาร์ทักษะของคุณ
            </p>
          </div>

          {/* Quick Demo Pre-fills (Fail-Closed: Only in local development with explicit flag) */}
          {showDemoLogin && (
            <div className="mb-5 p-3.5 rounded-2xl bg-[#f9fafb] border border-slate-200/70 text-xs">
              <span className="font-bold text-[#667085] block mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#4f46e5]" />
                ทดลองสลับบทบาทอัตโนมัติ (1-Click Demo):
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('CANDIDATE')}
                  className="py-1.5 px-2 rounded-full bg-white border border-slate-200/80 text-slate-700 font-semibold hover:border-[#6366f1] hover:text-[#4f46e5] hover:bg-[#e8eaff]/50 transition shadow-xs text-center truncate"
                >
                  Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('COMPANY')}
                  className="py-1.5 px-2 rounded-full bg-white border border-slate-200/80 text-slate-700 font-semibold hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition shadow-xs text-center truncate"
                >
                  Company
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('ADMIN')}
                  className="py-1.5 px-2 rounded-full bg-white border border-slate-200/80 text-slate-700 font-semibold hover:border-purple-500 hover:text-purple-700 hover:bg-purple-50 transition shadow-xs text-center truncate"
                >
                  Admin
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Social Sign In Buttons */}
          <div className="space-y-2.5 mb-5">
            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition"
            >
              <GithubIcon />
              <span>เข้าสู่ระบบด้วย GitHub (สำหรับ Candidate)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition"
            >
              <GoogleIcon />
              <span>เข้าสู่ระบบด้วย Google (สำหรับ Company)</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center mb-5">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              หรือระบุอีเมล
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">อีเมล (Email Address)</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#7a8494]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสผ่าน (Password)</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#7a8494]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-full bg-[#6366f1] py-3 text-xs sm:text-sm font-bold text-white shadow-xs shadow-indigo-500/20 hover:bg-[#4f46e5] disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  กำลังตรวจสอบสิทธิ์...
                </>
              ) : (
                <>
                  เข้าสู่ระบบ
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#667085]">
            ยังไม่มีบัญชีผู้ใช้?{' '}
            <Link href="/register" className="font-bold text-[#4f46e5] hover:underline">
              สมัครสมาชิกใหม่
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
          <div className="text-xs font-medium text-[#667085]">กำลังโหลดหน้าเข้าสู่ระบบ...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
