'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

export default function CompanyDevelopmentPlan() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false); setData(null);
    apiRequest('/recommendations/development-plan').then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);
  return <section className="my-8 rounded-2xl border bg-white p-5 space-y-4" aria-label="ผลประเมินบริษัทและแผนพัฒนา">
    <h2 className="text-xl font-bold">ผลประเมินบริษัทและแผนพัฒนา</h2>
    <p className="text-sm text-slate-600">ข้อมูลส่วนตัวสำหรับคุณ อัปเดตจากผลประเมินล่าสุดของแต่ละใบสมัคร คะแนนบริษัทแยกจากคะแนนสอบและหลักฐาน GitHub</p>
    {error ? <p role="alert">โหลดผลประเมินไม่ได้ <button className="underline" onClick={() => setRetry(n => n + 1)}>ลองใหม่</button></p>
      : !data ? <p role="status">กำลังโหลดแผนพัฒนา…</p>
      : !data.evaluations.length ? <p>ยังไม่มีผลประเมินจากบริษัท เมื่อบริษัทประเมินแล้วผลจะแสดงที่นี่</p>
      : data.evaluations.map((evaluation: any) => <article key={evaluation.id} id={`evaluation-${evaluation.id}`} className="border rounded-xl p-4 space-y-3 scroll-mt-16">
        <h3 className="font-bold">{evaluation.company} · {evaluation.job}</h3>
        <p className="text-xs text-slate-500">อัปเดต {new Date(evaluation.updatedAt).toLocaleDateString('th-TH')}</p>
        <p>เทคนิค {evaluation.scores.technical}/5 · แก้ปัญหา {evaluation.scores.problemSolving}/5 · สื่อสาร {evaluation.scores.communication}/5 · ทำงานเป็นทีม {evaluation.scores.teamwork}/5</p>
        <p className="whitespace-pre-wrap">{evaluation.overallFeedback}</p>
        {!!evaluation.strengths.length && <p>จุดแข็ง: {evaluation.strengths.join(' · ')}</p>}
        {evaluation.note && <p className="whitespace-pre-wrap">เป้าหมายจากบริษัท: {evaluation.note}</p>}
        {evaluation.legacy && <p className="text-amber-800">ผลประเมินเดิมยังไม่มีการระบุทักษะพัฒนาแบบใหม่ จึงยังไม่สร้างแผนเฉพาะทักษะจากข้อมูลนี้</p>}
        {!evaluation.legacy && !evaluation.skills.length && <p>บริษัทไม่ได้ระบุทักษะเพิ่มเติม โปรดใช้ข้อเสนอแนะด้านบนประกอบการพัฒนา</p>}
        {evaluation.skills.map((skill: any) => <div key={skill.id} className="bg-slate-50 rounded-xl p-4 space-y-2">
          <h4 className="font-bold">แผนการเรียนรู้: {skill.name}</h4>
          <p className="text-xs">ขั้นตอนแนะนำ ยังไม่ใช่หลักฐานว่าเรียนสำเร็จ</p>
          <ol className="list-decimal pl-5">{skill.steps.map((step: string) => <li key={step}>{step}</li>)}</ol>
          {skill.recommendedCourses.length ? <ul className="list-disc pl-5">{skill.recommendedCourses.map((course: any) => <li key={course.id}><a href={course.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">{course.title} ({course.provider})</a></li>)}</ul>
            : <p>ยังไม่มีคอร์สที่ตรงทักษะนี้ในระบบ</p>}
        </div>)}
      </article>)}
    <Link href="/courses" className="text-indigo-700 underline">ดูคอร์สและช่องว่างทักษะตามเป้าหมายอาชีพ</Link>
  </section>;
}
