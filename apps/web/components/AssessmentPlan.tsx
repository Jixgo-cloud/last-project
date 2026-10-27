'use client';
import Link from 'next/link';

export type AssessmentPlanItem = {
  skillId: string; skillName: string; status: string; currentLevel: number | null;
  requiredLevel: number; jobIds: string[];
  assessments: { id: string; title: string }[];
};

export default function AssessmentPlan({ items, jobCount }: { items: AssessmentPlanItem[]; jobCount: number }) {
  return <section className="rounded-2xl border border-indigo-100 bg-white p-5 mb-6" aria-label="ทักษะสำคัญและแผนประเมิน">
    <h2 className="font-bold text-lg">ทักษะสำคัญจากงานและเป้าหมายอาชีพ</h2>
    <p className="text-sm text-slate-600 my-2">คัดสูงสุด 5 ทักษะจากประกาศงานที่เกี่ยวข้อง {jobCount} งาน เรียงตามจำนวนงานที่ต้องการ ยังไม่สอบหมายถึงยังไม่ทราบระดับทักษะ</p>
    <p className="text-sm text-amber-800 my-2">แบบทดสอบและเกณฑ์ยังรอผู้เชี่ยวชาญตรวจและทดลองใช้ ผลคะแนนใช้ประกอบการพิจารณาเฉพาะขอบเขตที่ทดสอบ</p>
    {items.length === 0 ? <p className="text-sm">ยังไม่มีข้อมูลประกาศงานที่ตรงเป้าหมายเพียงพอสำหรับเลือกทักษะ กรุณาตรวจเป้าหมายอาชีพในโปรไฟล์</p> :
      <ul className="space-y-3 mt-4">{items.map(item => <li key={item.skillId} className="border-t pt-3 text-sm">
        <strong>{item.skillName}</strong> · {item.status === 'NOT_ASSESSED' ? 'ยังไม่ประเมิน — แนะนำทำแบบทดสอบก่อน' : `${item.currentLevel}% · ${item.status === 'GAP' ? 'พบช่องว่างจากผลประเมิน' : 'มีผลประเมิน'}`}<br />
        <span className="text-slate-600">พบใน {item.jobIds.length} งาน · เกณฑ์สูงสุดที่งานระบุ {item.requiredLevel}%</span>
        <div className="flex gap-3 flex-wrap mt-1">{item.assessments.length ? item.assessments.map(exam =>
          <Link className="text-indigo-700 underline" key={exam.id} href={`/assessments/${exam.id}`}>ทำแบบทดสอบ: {exam.title}</Link>) :
          <span className="text-slate-600">ยังไม่มีแบบทดสอบที่พร้อมสำหรับทักษะนี้ — รอจัดทำและทบทวนข้อสอบ</span>}</div>
      </li>)}</ul>}
  </section>;
}
