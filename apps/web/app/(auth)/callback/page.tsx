'use client';

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, SessionUser } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import { UserRole } from '@smartcareer/shared';
import { Loader2, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { OAUTH_VERIFIER_KEY } from '@/lib/oauth';
import { getSafeInternalRedirect } from '@/lib/navigation';

const POST_LOGIN_REDIRECT_KEY = 'smartcareer_post_login_redirect';

function consumePostLoginRedirect() {
  const redirectPath = getSafeInternalRedirect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY));
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return redirectPath;
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = searchParams.get('code');
    const err = searchParams.get('error');
    const mock = searchParams.get('mock') === '1';
    window.history.replaceState(null, '', '/callback');
    if (err) { setError(err); return; }
    if (!code && !mock) { setError('กรุณาเริ่มเข้าสู่ระบบใหม่อีกครั้ง'); return; }
    const verifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
    (async () => {
      if (code) {
        if (!verifier) throw new Error('การเข้าสู่ระบบหมดอายุ กรุณาลองอีกครั้ง');
        await apiRequest('/auth/oauth/exchange', { method: 'POST', body: JSON.stringify({ code, verifier }) });
      }
      const userData = await apiRequest<SessionUser>('/auth/me');
      setUser(userData);
      const redirectPath = consumePostLoginRedirect();
      router.replace(userData.role === UserRole.COMPANY ? '/company/dashboard'
        : userData.role === UserRole.ADMIN ? '/admin/dashboard' : redirectPath || '/profile');
    })().catch(() => setError('ไม่สามารถยืนยันบัญชีได้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'));
  }, [searchParams, router, setUser]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4 my-6">
          <div className="w-full max-w-md bg-white/95 border border-rose-200 rounded-[24px] p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)] text-center animate-in zoom-in-95 duration-200">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4 border border-rose-200">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">การยืนยันตัวตนไม่สำเร็จ</h2>
            <p className="text-xs text-rose-700 mb-6 bg-rose-50 p-3 rounded-xl border border-rose-200 leading-relaxed">
              {error}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2.5 px-5 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-full text-xs font-bold shadow-xs shadow-indigo-500/20 transition"
            >
              กลับสู่หน้าเข้าสู่ระบบ
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4 my-6">
        <div className="w-full max-w-md bg-white/95 border border-slate-200/90 rounded-[24px] p-8 sm:p-10 shadow-[0_16px_40px_rgba(15,23,42,0.06)] text-center animate-in zoom-in-95 duration-200">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8eaff] text-[#4f46e5] font-extrabold text-xl mb-4 shadow-xs animate-pulse">
            SC
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-1.5 tracking-tight">
            กำลังยืนยันตัวตนเข้าสู่ระบบ
          </h2>
          <p className="text-xs text-[#667085] mb-6 leading-relaxed">
            ระบบกำลังจัดเตรียมเซสชันที่ปลอดภัยและพาคุณเข้าสู่แดชบอร์ด...
          </p>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#4f46e5] bg-[#e8eaff]/50 border border-[#dce0ff] py-2 px-4 rounded-full w-fit mx-auto">
            <Loader2 className="h-4 w-4 animate-spin text-[#4f46e5]" />
            <span>กำลังเชื่อมต่อบัญชี...</span>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8]">
          <div className="flex items-center gap-2 text-xs font-medium text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin text-[#4f46e5]" />
            <span>กำลังโหลดการยืนยันตัวตน...</span>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
