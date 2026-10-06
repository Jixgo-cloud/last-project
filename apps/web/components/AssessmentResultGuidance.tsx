import Link from 'next/link';

interface Props {
  percentage: number | null;
  passingScore: number;
  feedbackHidden?: boolean;
  skillName?: string | null;
}

export default function AssessmentResultGuidance({ percentage, passingScore, feedbackHidden, skillName }: Props) {
  if (feedbackHidden || percentage === null || !Number.isFinite(percentage)) return null;
  const passed = percentage >= passingScore;
  return <section className="mt-5 text-left text-xs text-slate-600 space-y-2 max-w-lg mx-auto" aria-label="คำแนะนำทั่วไปจากระบบ">
    <h3 className="font-bold text-slate-900">คำแนะนำทั่วไปจากระบบ</h3>
    <p>{passed
      ? `คะแนน ${percentage}% ถึงเกณฑ์ผ่าน ${passingScore}% แล้ว สามารถฝึกหัวข้อที่เกี่ยวข้องต่อเพื่อพัฒนาทักษะให้คล่องขึ้น`
      : `คะแนน ${percentage}% ยังไม่ถึงเกณฑ์ผ่าน ${passingScore}% แนะนำให้ทบทวน${skillName ? `หัวข้อ ${skillName}` : 'หัวข้อในคำอธิบายแบบทดสอบ'} และฝึกโจทย์เพิ่มเติม`}</p>
    <p>คะแนนนี้เป็นผลของข้อสอบ ไม่ใช่คะแนนความเหมาะสมกับงานหรือการยืนยันรับเข้าทำงาน ผลคัดเลือกดูได้ในประวัติการสมัคร</p>
    <Link href="/courses" className="inline-block font-semibold text-indigo-700 underline">ค้นหาคอร์สเพื่อทบทวนและฝึกเพิ่มเติม</Link>
  </section>;
}
