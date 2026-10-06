interface Choice { id: string; text: string; isCorrect: boolean }
interface Question { id: string; title: string; prompt: string; points: number; choices?: Choice[] }
interface Answer { questionId: string; selectedChoiceId?: string | null; isCorrect: boolean; pointsEarned: number }
interface TheoryReview {
  assessment: { questions?: Question[] };
  answers?: Answer[];
  snapshot?: { questions?: Array<{ id: string; title?: string; points?: number }> } | null;
}

/** This view is company-only. Candidate result endpoints continue to remove answer keys. */
export default function TheoryAttemptReview({ attempt }: { attempt: TheoryReview }) {
  const questions = attempt.assessment.questions ?? [];
  const snapshot = attempt.snapshot?.questions ?? [];
  const ordered = snapshot.length ? snapshot.map(q => questions.find(current => current.id === q.id)).filter((q): q is Question => Boolean(q)) : questions;
  return (
    <section className="space-y-3" aria-label="คำตอบปรนัยของผู้สมัคร">
      <h3 className="text-sm font-bold text-slate-900">คำตอบปรนัยของผู้สมัคร</h3>
      <p className="text-xs text-slate-500">ผลรายข้อเป็นคะแนนที่ระบบตรวจจากคำตอบ คะแนนรวมหลังผู้ตรวจประเมินอาจต่างจากคะแนนดิบ</p>
      {ordered.length === 0 && <p className="text-xs text-slate-500">ไม่พบรายละเอียดคำถามของรอบสอบนี้</p>}
      {ordered.map((question, index) => {
        const answer = attempt.answers?.find(a => a.questionId === question.id);
        const original = snapshot.find(q => q.id === question.id);
        const selected = question.choices?.find(c => c.id === answer?.selectedChoiceId);
        const correct = question.choices?.find(c => c.isCorrect);
        const response = !answer?.selectedChoiceId ? 'ไม่ได้เลือกคำตอบ' : selected?.text ?? 'ไม่พบข้อความของตัวเลือกเดิม';
        return <article key={question.id} className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
          <h4 className="font-bold text-slate-900">ข้อ {index + 1}: {original?.title ?? question.title}</h4>
          <p className="whitespace-pre-wrap text-slate-600">{question.prompt}</p>
          <p><strong>คำตอบที่เลือก:</strong> {response}</p>
          <p><strong>คำตอบที่ถูก:</strong> {correct?.text ?? 'ไม่พบเฉลยของคำถามนี้'}</p>
          <p className={answer?.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
            {answer?.isCorrect ? 'ตอบถูก' : 'ยังไม่ได้คะแนนข้อนี้'} · {answer?.pointsEarned ?? 0} / {original?.points ?? question.points} คะแนน
          </p>
        </article>;
      })}
    </section>
  );
}
