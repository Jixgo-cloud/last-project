'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CompanyDevelopmentPlan from '@/components/CompanyDevelopmentPlan';
import { useAuth } from '@/lib/auth-context';

export default function LearningPlanPage() {
  const { user } = useAuth();
  return <div className="min-h-screen flex flex-col bg-slate-50"><Navbar />
    <main className="w-full max-w-5xl mx-auto px-4 py-8 flex-1">
      <h1 className="text-2xl font-bold">แผนพัฒนาจากผลประเมินบริษัท</h1>
      {user?.role === 'CANDIDATE' ? <CompanyDevelopmentPlan /> : <p className="my-6">กรุณาเข้าสู่ระบบด้วยบัญชีผู้สมัครเพื่อดูแผนส่วนตัว <Link href="/login?redirect=%2Flearning-plan" className="underline">เข้าสู่ระบบ</Link></p>}
    </main><Footer /></div>;
}
