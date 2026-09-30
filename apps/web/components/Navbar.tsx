'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@smartcareer/shared';
import {
  ChevronDown,
  LogOut,
  Briefcase,
  Code2,
  BookOpen,
  User,
  Building2,
  ShieldCheck,
  Users,
  Layers,
  Activity,
  FileCheck2,
  Home,
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Navigation Dropdown State (3 core items: Home, Jobs, Courses)
  const [navOpen, setNavOpen] = useState(false);
  // User Account Dropdown State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [lang, setLang] = useState<'TH' | 'EN'>('TH');

  const navDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navDropdownRef.current && !navDropdownRef.current.contains(event.target as Node)) {
        setNavOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  const dropdownItemClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition font-medium ${
      active
        ? 'bg-[#e8eaff] text-[#4f46e5] font-semibold'
        : 'text-slate-700 hover:text-[#4f46e5] hover:bg-[#f5f6ff]'
    }`;
  };

  const userMenuItemClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition font-medium ${
      active
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
        : 'text-slate-700 hover:text-indigo-600 hover:bg-slate-50'
    }`;
  };

  const getCurrentNavLabel = () => {
    if (pathname === '/') return 'หน้าหลัก';
    if (pathname.startsWith('/jobs')) return 'งาน';
    if (pathname.startsWith('/courses')) return 'คอร์สเรียน';
    return 'เมนูนำทาง';
  };

  const getRoleBadgeStyle = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case UserRole.COMPANY:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[82px] max-w-[1216px] items-center justify-between gap-7 px-4 sm:px-8">
        {/* Brand */}
        <Link href="/" className="inline-flex items-center gap-3 flex-shrink-0" aria-label="Smart Career หน้าหลัก">
          <span className="grid place-items-center w-9 h-9 rounded-xl font-extrabold text-[13px] text-[#4f46e5] bg-[#e8eaff]">
            SC
          </span>
          <div className="leading-tight">
            <span className="block text-[17px] font-[750] text-[#111827]">Smart Career</span>
            <span className="block text-[10px] text-[#667085]">แพลตฟอร์มอาชีพอัจฉริยะ</span>
          </div>
        </Link>

        {/* Header Actions */}
        <div className="flex items-center justify-end gap-3">
          {/* Core Nav Dropdown (Home, Jobs, Courses only) */}
          <nav className="flex items-center gap-1.5" aria-label="เมนูหลัก">
            <div className="relative" ref={navDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setNavOpen(!navOpen);
                  setUserMenuOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-2 text-[13px] text-[#667085] hover:text-[#4f46e5] hover:bg-[#e8eaff] transition whitespace-nowrap"
                aria-expanded={navOpen}
              >
                <span>{getCurrentNavLabel()}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${navOpen ? 'rotate-180' : ''}`} />
              </button>

              {navOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 z-30 flex flex-col w-48 p-1.5 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
                  <Link
                    href="/"
                    onClick={() => setNavOpen(false)}
                    className={dropdownItemClass('/')}
                  >
                    <Home className="h-3.5 w-3.5" />
                    <span>หน้าหลัก (Home)</span>
                  </Link>

                  <Link
                    href="/jobs"
                    onClick={() => setNavOpen(false)}
                    className={dropdownItemClass('/jobs')}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>งาน (Jobs)</span>
                  </Link>

                  <Link
                    href="/courses"
                    onClick={() => setNavOpen(false)}
                    className={dropdownItemClass('/courses')}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>คอร์สเรียน (Courses)</span>
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Auth Actions (Guest vs Signed-In) */}
          <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-slate-200">
            {/* Language Switch */}
            <div className="flex items-center p-0.5 border border-slate-200 rounded-full bg-white">
              <button
                type="button"
                onClick={() => setLang('TH')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                  lang === 'TH' ? 'bg-[#6366f1] text-white shadow-sm' : 'text-[#667085] hover:text-[#111827]'
                }`}
              >
                TH
              </button>
              <button
                type="button"
                onClick={() => setLang('EN')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                  lang === 'EN' ? 'bg-[#6366f1] text-white shadow-sm' : 'text-[#667085] hover:text-[#111827]'
                }`}
              >
                EN
              </button>
            </div>

            <span className="w-px h-5 bg-slate-200" aria-hidden="true" />

            {/* Guest: Sign in / Register */}
            {!user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 hover:text-[#4f46e5] hover:bg-[#e8eaff] transition whitespace-nowrap"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-2 rounded-full text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#4f46e5] shadow-sm shadow-indigo-500/20 transition whitespace-nowrap"
                >
                  สมัครสมาชิก
                </Link>
              </div>
            ) : (
              /* Signed-in Interactive Account Status Capsule & Dropdown */
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setNavOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 px-2.5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition cursor-pointer"
                  aria-expanded={userMenuOpen}
                >
                  <span className="grid place-items-center w-6 h-6 rounded-full bg-[#6366f1] text-white text-[11px] font-bold">
                    {(user.candidateProfile?.fullName || user.company?.name || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate hidden sm:inline">
                    {user.candidateProfile?.fullName || user.company?.name || user.email}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(user.role)}`}>
                    {user.role}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Floating User Account & Role Workspace Dropdown */}
                {userMenuOpen && (
                  <div className="absolute top-[calc(100%+8px)] right-0 z-50 flex flex-col w-64 p-2 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
                    {/* User Identity Header */}
                    <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#6366f1] text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {(user.candidateProfile?.fullName || user.company?.name || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {user.candidateProfile?.fullName || user.company?.name || 'ผู้ใช้งาน'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      </div>
                    </div>

                    {/* Role-Specific Navigation Links */}
                    <div className="py-1.5 space-y-0.5">
                      <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {user.role === UserRole.COMPANY
                          ? 'จัดการองค์กร · Company'
                          : user.role === UserRole.ADMIN
                          ? 'ศูนย์ควบคุมระบบ · Admin'
                          : 'เมนูของฉัน · My Workspace'}
                      </div>

                      {/* Candidate Links */}
                      {user.role === UserRole.CANDIDATE && (
                        <>
                          <Link
                            href="/assessments"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/assessments')}
                          >
                            <Code2 className="h-3.5 w-3.5 text-indigo-500" />
                            <span>ทดสอบทักษะ (Assessments)</span>
                          </Link>
                          <Link
                            href="/applications"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/applications')}
                          >
                            <FileCheck2 className="h-3.5 w-3.5 text-indigo-500" />
                            <span>การสมัครของฉัน (Applications)</span>
                          </Link>
                          <Link
                            href="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/profile')}
                          >
                            <User className="h-3.5 w-3.5 text-indigo-500" />
                            <span>โปรไฟล์ส่วนตัว (Profile)</span>
                          </Link>
                        </>
                      )}

                      {/* Company Links */}
                      {user.role === UserRole.COMPANY && (
                        <>
                          <Link
                            href="/company/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/company/dashboard')}
                          >
                            <Activity className="h-3.5 w-3.5 text-emerald-500" />
                            <span>แดชบอร์ดภาพรวม (Overview)</span>
                          </Link>
                          <Link
                            href="/company/jobs"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/company/jobs')}
                          >
                            <Briefcase className="h-3.5 w-3.5 text-emerald-500" />
                            <span>ตำแหน่งงานของบริษัท (Our Jobs)</span>
                          </Link>
                          <Link
                            href="/company/applications"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/company/applications')}
                          >
                            <Users className="h-3.5 w-3.5 text-emerald-500" />
                            <span>ผู้สมัครงาน (Applicants Pipeline)</span>
                          </Link>
                          <Link
                            href="/company/assessments"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/company/assessments')}
                          >
                            <Code2 className="h-3.5 w-3.5 text-purple-500" />
                            <span>ข้อสอบคัดกรอง (Technical Tests)</span>
                          </Link>
                          <Link
                            href="/company/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/company/profile')}
                          >
                            <Building2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span>โปรไฟล์บริษัท (Company Profile)</span>
                          </Link>
                        </>
                      )}

                      {/* Admin Links */}
                      {user.role === UserRole.ADMIN && (
                        <>
                          <Link
                            href="/admin/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/admin/dashboard')}
                          >
                            <Activity className="h-3.5 w-3.5 text-purple-500" />
                            <span>ศูนย์ควบคุมระบบ (Dashboard)</span>
                          </Link>
                          <Link
                            href="/admin/assessments"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/admin/assessments')}
                          >
                            <Code2 className="h-3.5 w-3.5 text-purple-500" />
                            <span>จัดการแบบทดสอบ (Assessments)</span>
                          </Link>
                          <Link
                            href="/admin/verifications"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/admin/verifications')}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                            <span>ตรวจเอกสารนิติบุคคล (Verifications)</span>
                          </Link>
                          <Link
                            href="/admin/users"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/admin/users')}
                          >
                            <Users className="h-3.5 w-3.5 text-purple-500" />
                            <span>จัดการผู้ใช้งาน (Users)</span>
                          </Link>
                          <Link
                            href="/admin/skills"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/admin/skills')}
                          >
                            <Layers className="h-3.5 w-3.5 text-purple-500" />
                            <span>คลังคำศัพท์ทักษะ (Skills)</span>
                          </Link>
                          <Link
                            href="/admin/ingestion"
                            onClick={() => setUserMenuOpen(false)}
                            className={userMenuItemClass('/admin/ingestion')}
                          >
                            <Activity className="h-3.5 w-3.5 text-amber-500" />
                            <span>ระบบดึงข้อมูลงาน (Ingestion)</span>
                          </Link>
                        </>
                      )}
                    </div>

                    {/* Divider & Logout Action */}
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>ออกจากระบบ (Log out)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
