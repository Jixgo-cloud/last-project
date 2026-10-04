'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import {
  Users,
  Shield,
  User,
  Building2,
  Search,
} from 'lucide-react';
import { UserRole } from '@smartcareer/shared';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    apiRequest('/admin/users')
      .then((data) => setUsers(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const entityName =
        u.candidateProfile?.fullName ||
        u.companyMembers?.[0]?.company?.name ||
        '';
      const matchesSearch =
        searchQuery === '' ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entityName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Role counts
  const counts = useMemo(() => {
    const total = users.length;
    const candidates = users.filter((u) => u.role === UserRole.CANDIDATE).length;
    const companies = users.filter((u) => u.role === UserRole.COMPANY).length;
    const admins = users.filter((u) => u.role === UserRole.ADMIN).length;
    return { total, candidates, companies, admins };
  }, [users]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe] shadow-xs mb-3">
            <Users className="h-3.5 w-3.5" />
            <span>ทำเนียบบัญชีผู้ใช้ · User Account Directory</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            รายชื่อบัญชีผู้ใช้งานระบบทั้งหมด
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            ตรวจสอบและจัดการบัญชีผู้ใช้งานแพลตฟอร์ม ครอบคลุมผู้หางาน (Candidate), บริษัทนายจ้าง (Employer) และผู้ดูแลระบบ (Admin)
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white/95 border border-slate-200/90 rounded-[24px] p-4 mb-6 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาด้วยอีเมล หรือชื่อนิติบุคคล/ผู้ใช้..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-full border border-slate-200/80 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                roleFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({counts.total})
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.CANDIDATE)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === UserRole.CANDIDATE
                  ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              <User className="h-3 w-3" />
              <span>ผู้หางาน ({counts.candidates})</span>
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.COMPANY)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === UserRole.COMPANY
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
              }`}
            >
              <Building2 className="h-3 w-3" />
              <span>บริษัท ({counts.companies})</span>
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.ADMIN)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === UserRole.ADMIN
                  ? 'bg-purple-600 text-white shadow-xs shadow-purple-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-purple-300'
              }`}
            >
              <Shield className="h-3 w-3" />
              <span>ผู้ดูแล ({counts.admins})</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mb-3"></div>
            <p className="text-sm font-semibold text-slate-500">กำลังโหลดรายชื่อผู้ใช้... (Loading users directory)</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white/95 border border-slate-200/90 rounded-[28px] p-12 text-center max-w-lg mx-auto shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">ไม่พบบัญชีผู้ใช้ที่ตรงกับเงื่อนไข</h3>
            <p className="text-xs text-slate-500 mt-1">
              ลองปรับคำค้นหา หรือเปลี่ยนตัวกรองบทบาทผู้ใช้งาน
            </p>
          </div>
        ) : (
          <div className="bg-white/95 border border-slate-200/90 rounded-[28px] overflow-hidden shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/70">
                    <th className="py-4 px-6 font-bold">อีเมลบัญชี (User Account)</th>
                    <th className="py-4 px-6 font-bold">บทบาท (Role)</th>
                    <th className="py-4 px-6 font-bold">ข้อมูลโปรไฟล์ / องค์กรที่สังกัด</th>
                    <th className="py-4 px-6 font-bold">สถานะ (Status)</th>
                    <th className="py-4 px-6 font-bold">วันที่ลงทะเบียน (Registered)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90">
                  {filteredUsers.map((u) => {
                    const entityName =
                      u.candidateProfile?.fullName ||
                      u.companyMembers?.[0]?.company?.name ||
                      'System Superadmin';
                    const initials = (u.email?.[0] || 'U').toUpperCase();

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{u.email}</div>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {u.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span
                            className={`font-black px-3 py-1 rounded-full text-[10px] inline-flex items-center gap-1 border ${
                              u.role === UserRole.ADMIN
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.role === UserRole.COMPANY
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-[#e8eaff] text-[#4f46e5] border-[#dce0ff]'
                            }`}
                          >
                            {u.role === UserRole.ADMIN && <Shield className="h-3 w-3" />}
                            {u.role === UserRole.COMPANY && <Building2 className="h-3 w-3" />}
                            {u.role === UserRole.CANDIDATE && <User className="h-3 w-3" />}
                            <span>{u.role}</span>
                          </span>
                        </td>

                        <td className="py-4 px-6 text-slate-700 font-medium">
                          {entityName}
                        </td>

                        <td className="py-4 px-6">
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        </td>

                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>แสดงทั้งหมด {filteredUsers.length} รายการ</span>
              <span className="text-[11px] text-slate-400">ระบบซิงก์ฐานข้อมูลเรียลไทม์</span>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

