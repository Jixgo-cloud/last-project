import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/90 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 min-h-[68px] max-w-[1216px] px-4 sm:px-8 py-5 text-[12px] text-[#667085]">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-6 h-6 rounded-lg font-bold text-[11px] text-[#4f46e5] bg-[#e8eaff]">
            SC
          </span>
          <span className="font-semibold text-slate-800">Smart Career</span>
          <span className="text-slate-300">·</span>
          <span>Career Intelligence &amp; Job Matching Platform</span>
        </div>
        <nav className="flex flex-wrap items-center gap-5 text-xs" aria-label="Footer navigation">
          <Link href="/" className="hover:text-[#4f46e5] transition">หน้าหลัก (Home)</Link>
          <Link href="/jobs" className="hover:text-[#4f46e5] transition">ตำแหน่งงาน (Jobs)</Link>
          <Link href="/courses" className="hover:text-[#4f46e5] transition">คอร์สเรียน (Courses)</Link>
          <Link href="/assessments" className="hover:text-[#4f46e5] transition">ทดสอบทักษะ (Assessments)</Link>
        </nav>
      </div>
    </footer>
  );
}
