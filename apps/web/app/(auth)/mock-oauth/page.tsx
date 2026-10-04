'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { UserRole } from '@smartcareer/shared';
import { ShieldCheck, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

function MockOAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isDevAllowed =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === 'true';

  React.useEffect(() => {
    if (!isDevAllowed) {
      router.replace('/login?error=' + encodeURIComponent('Mock OAuth is disabled.'));
    }
  }, [isDevAllowed, router]);

  const initialProvider = (searchParams.get('provider') || 'google').toLowerCase() as 'google' | 'github';
  const initialRole = (searchParams.get('role') || 'CANDIDATE') as UserRole;

  const [provider, setProvider] = useState<'google' | 'github'>(initialProvider);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState(
    initialProvider === 'github'
      ? 'candidate.github@smartcareer.dev'
      : initialRole === UserRole.COMPANY
      ? 'company.ceo@techcorp.co.th'
      : 'candidate.google@smartcareer.dev',
  );
  const [fullName, setFullName] = useState(
    initialProvider === 'github'
      ? 'Alex Octocat'
      : initialRole === UserRole.COMPANY
      ? 'Siriporn Tech'
      : 'Somchai Sukjai',
  );
  const [githubUsername, setGithubUsername] = useState('alexoctocat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isDevAllowed) {
    return null;
  }

  const handlePreset = (type: 'candidate-google' | 'candidate-github' | 'company-google' | 'company-github') => {
    setError(null);
    if (type === 'candidate-google') {
      setProvider('google');
      setRole(UserRole.CANDIDATE);
      setEmail('somchai.google@smartcareer.dev');
      setFullName('Somchai Sukjai');
    } else if (type === 'candidate-github') {
      setProvider('github');
      setRole(UserRole.CANDIDATE);
      setEmail('alex.dev@github.com');
      setFullName('Alex Developer');
      setGithubUsername('alexdev');
    } else if (type === 'company-google') {
      setProvider('google');
      setRole(UserRole.COMPANY);
      setEmail('kanda.hr@techventures.co.th');
      setFullName('Kanda HR');
    } else if (type === 'company-github') {
      setProvider('github');
      setRole(UserRole.COMPANY);
      setEmail('hr.restricted@company.co.th');
      setFullName('Restricted HR');
      setGithubUsername('hr_restricted');
    }
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiRequest('/auth/dev-callback', {
        method: 'POST',
        body: JSON.stringify({ provider, role, email, fullName,
          githubUsername: provider === 'github' ? githubUsername : undefined }),
      });
      router.push('/callback?mock=1');
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const isGoogle = provider === 'google';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 my-6">
        <div className="w-full max-w-lg rounded-[24px] border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mb-3 shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              Dev / Mock OAuth Simulation Mode
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ยินยอมการเชื่อมต่อสิทธิ์ {isGoogle ? 'Google' : 'GitHub'} (จำลอง)
            </h1>
            <p className="text-xs text-[#667085] mt-1.5 max-w-sm mx-auto leading-relaxed">
              หน้าจำลองขั้นตอนการยินยอมของ OAuth เพื่อให้สามารถทดสอบระบบเชื่อมต่อและสลับบทบาทได้อย่างราบรื่น
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="mb-6 p-3.5 bg-[#f9fafb] border border-slate-200/70 rounded-2xl">
            <span className="text-xs font-bold text-[#667085] block mb-2.5">
              ⚡ เลือกโปรไฟล์จำลองทันที (1-Click Presets):
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handlePreset('candidate-github')}
                className={`p-2.5 rounded-xl border text-left font-medium transition ${
                  provider === 'github' && role === UserRole.CANDIDATE
                    ? 'border-[#6366f1] bg-[#e8eaff]/60 text-[#4f46e5] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="block font-bold">Candidate • GitHub</span>
                <span className="text-[10px] text-[#667085]">ซิงค์ @alexdev</span>
              </button>

              <button
                type="button"
                onClick={() => handlePreset('candidate-google')}
                className={`p-2.5 rounded-xl border text-left font-medium transition ${
                  provider === 'google' && role === UserRole.CANDIDATE
                    ? 'border-rose-400 bg-rose-50/60 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="block font-bold text-rose-600">Candidate • Google 🚫</span>
                <span className="text-[10px] text-[#667085]">ทดสอบการจำกัดสิทธิ์</span>
              </button>

              <button
                type="button"
                onClick={() => handlePreset('company-google')}
                className={`p-2.5 rounded-xl border text-left font-medium transition ${
                  provider === 'google' && role === UserRole.COMPANY
                    ? 'border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="block font-bold text-emerald-700">Company • Google</span>
                <span className="text-[10px] text-[#667085]">Kanda HR&apos;s Org</span>
              </button>

              <button
                type="button"
                onClick={() => handlePreset('company-github')}
                className={`p-2.5 rounded-xl border text-left font-medium transition ${
                  provider === 'github' && role === UserRole.COMPANY
                    ? 'border-rose-400 bg-rose-50/60 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="block font-bold text-rose-600">Company • GitHub 🚫</span>
                <span className="text-[10px] text-[#667085]">ทดสอบการจำกัดสิทธิ์</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">ระบบตรวจสอบไม่อนุญาตให้ดำเนินการ</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleAuthorize} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ผู้ให้บริการ (Provider)</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition cursor-pointer"
                >
                  <option value="google">Google</option>
                  <option value="github">GitHub</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">บทบาทบัญชี (Role)</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition cursor-pointer"
                >
                  <option value={UserRole.CANDIDATE}>Candidate (ผู้หางาน)</option>
                  <option value={UserRole.COMPANY}>Company (ผู้ว่าจ้าง)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อแสดงผล (Profile Name)</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น Somchai Sukjai"
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
              {role === UserRole.COMPANY && (
                <p className="text-[11px] text-[#667085] mt-1">
                  🏢 องค์กรจะถูกสร้างอัตโนมัติ: <strong className="text-slate-800">&quot;{fullName || 'User'}&apos;s Organization&quot;</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">อีเมล (Email Address)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
              />
            </div>

            {provider === 'github' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้ GitHub (Username)</label>
                <input
                  type="text"
                  required
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="เช่น octocat"
                  className="w-full rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-2 flex items-center justify-center gap-2 rounded-full py-3 text-xs sm:text-sm font-bold text-white shadow-xs transition disabled:opacity-50 ${
                isGoogle
                  ? 'bg-[#6366f1] hover:bg-[#4f46e5] shadow-indigo-500/20'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  กำลังดำเนินการยืนยันสิทธิ์...
                </>
              ) : (
                <>
                  <span>อนุญาตและเข้าสู่ระบบด้วย {isGoogle ? 'Google' : 'GitHub'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-xs text-[#667085] hover:text-[#4f46e5] transition"
            >
              ยกเลิกและกลับสู่หน้าเข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function MockOAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
          <div className="text-xs font-medium text-[#667085]">กำลังโหลดหน้าจำลอง OAuth...</div>
        </div>
      }
    >
      <MockOAuthContent />
    </Suspense>
  );
}
