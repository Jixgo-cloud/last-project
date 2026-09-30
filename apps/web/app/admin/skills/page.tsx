'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiRequest } from '@/lib/api';
import {
  Layers,
  Plus,
  CheckCircle2,
  Award,
  Search,
  BookOpen,
  Sparkles,
  Briefcase,
  ChevronRight,
  Shield,
  Tag,
} from 'lucide-react';
import { SkillCategory } from '@smartcareer/shared';

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<any[]>([]);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSkillName, setNewSkillName] = useState('');
  const [newCategory, setNewCategory] = useState<SkillCategory>(SkillCategory.BACKEND);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [skillSearch, setSkillSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sList, fList] = await Promise.all([
        apiRequest('/admin/skills'),
        apiRequest('/admin/frameworks'),
      ]);
      setSkills(sList);
      setFrameworks(fList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    setCreating(true);
    setMsg(null);
    try {
      await apiRequest('/admin/skills', {
        method: 'POST',
        body: JSON.stringify({ name: newSkillName, category: newCategory }),
      });
      setNewSkillName('');
      setMsg('เพิ่มทักษะหลักเข้าสู่คลังเรียบร้อยแล้ว (Master skill added successfully)');
      setTimeout(() => setMsg(null), 4000);
      fetchData();
    } catch (err: any) {
      alert(`Error creating skill: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchQuery = skillSearch === '' || s.name.toLowerCase().includes(skillSearch.toLowerCase());
      const matchCat = categoryFilter === 'ALL' || s.category === categoryFilter;
      return matchQuery && matchCat;
    });
  }, [skills, skillSearch, categoryFilter]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f9fbfe] via-[#f3f6fb] to-[#eef2f8] text-[#111827] antialiased">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe] shadow-xs mb-3">
            <Layers className="h-3.5 w-3.5" />
            <span>คลังทักษะและมาตรฐานวิชาชีพ · Skill Taxonomy & Frameworks</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            คลังคำศัพท์ทักษะหลัก & กรอบมาตรฐานอุตสาหกรรม
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            จัดการฐานข้อมูลทักษะไอทีส่วนกลาง (Master Skills Dictionary) และกรอบวัดผลมาตรฐานคลาวด์/ความปลอดภัย (AWS, Azure, CompTIA)
          </p>
        </div>

        {/* Success Alert */}
        {msg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Master Skills Management (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Create Skill Card */}
            <form
              onSubmit={handleCreateSkill}
              className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <Plus className="h-4 w-4 text-[#4f46e5]" />
                <h3 className="text-sm font-black text-slate-900">
                  เพิ่มทักษะหลักใหม่ (Add New Master Skill)
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="เช่น GraphQL, Tailwind CSS, Rust..."
                  className="flex-1 rounded-2xl border border-slate-200/90 px-4 py-2.5 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />

                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as SkillCategory)}
                  className="rounded-2xl border border-slate-200/90 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                >
                  {Object.values(SkillCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold shadow-xs shadow-indigo-500/20 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {creating ? 'กำลังบันทึก...' : 'บันทึกทักษะ'}
                </button>
              </div>
            </form>

            {/* Skills Dictionary Card */}
            <div className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#4f46e5]" />
                  <h3 className="text-base font-black text-slate-900">
                    พจนานุกรมทักษะหลัก ({skills.length} รายการ)
                  </h3>
                </div>

                {/* Instant Search in Skills */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อทักษะ..."
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-full border border-slate-200/80 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                    categoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ทั้งหมด
                </button>
                {Object.values(SkillCategory).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-[#6366f1] text-white shadow-xs shadow-indigo-500/20'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400">กำลังโหลดรายการทักษะ...</div>
              ) : filteredSkills.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">ไม่พบทักษะที่ตรงกับการค้นหา</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredSkills.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-indigo-200 hover:bg-white transition flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-1">
                        <p className="font-bold text-xs text-slate-900 truncate group-hover:text-indigo-600 transition">
                          {s.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">{s.category}</p>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-full shrink-0 shadow-2xs">
                        {s._count?.jobSkills || 0} jobs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Industry Skill Frameworks (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white/95 border border-slate-200/90 rounded-[28px] p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
                <Award className="h-5 w-5 text-[#7c3aed]" />
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    กรอบมาตรฐานอุตสาหกรรม (Frameworks)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    เกณฑ์เทียบเคียงทักษะสากล (Global Industry Benchmarks)
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {frameworks.map((fw) => (
                  <div
                    key={fw.id}
                    className="p-5 rounded-[22px] border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-purple-200 transition-all shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {fw.name}
                      </h4>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                        {fw.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{fw.description}</p>

                    <div className="pt-3 border-t border-slate-200/70 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        ทักษะที่เกี่ยวข้องในระบบ (Mapped Competencies)
                      </span>
                      <div className="space-y-1">
                        {fw.items?.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-xs py-1 px-2.5 rounded-xl bg-white/80 border border-slate-100"
                          >
                            <span className="text-slate-600 font-medium text-[11px]">{item.topicName}</span>
                            <span className="font-bold text-[#4f46e5] text-[11px]">
                              {item.skill?.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

