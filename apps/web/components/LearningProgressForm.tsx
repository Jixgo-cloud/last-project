'use client';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function LearningProgressForm({ evaluation, skill, onSaved, onReload }: { evaluation: any; skill: any; onSaved: (progress: any) => void; onReload: () => void }) {
  const [status, setStatus] = useState(skill.progress.status);
  const [note, setNote] = useState(skill.progress.note);
  const [evidenceUrl, setEvidenceUrl] = useState(skill.progress.evidenceUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [failed, setFailed] = useState(false);
  return <form aria-label={`ความคืบหน้า ${skill.name}`} className="space-y-3 border-t pt-3" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setMessage(''); setFailed(false);
    try {
      const progress = await apiRequest(`/recommendations/development-plan/${evaluation.id}/skills/${skill.id}/progress`, {
        method: 'PATCH', body: JSON.stringify({ status, note, evidenceUrl, revision: evaluation.updatedAt, expectedUpdatedAt: skill.progress.updatedAt }),
      });
      onSaved(progress); setMessage('บันทึกความคืบหน้าแล้ว');
    } catch (error: any) { setFailed(true); setConflict(error.status === 409); setMessage(error.message || 'บันทึกไม่ได้ กรุณาลองใหม่'); }
    finally { setSaving(false); }
  }}>
    <h5 className="font-semibold">ติดตามความคืบหน้า</h5>
    <p className="text-xs text-slate-600">สถานะที่คุณบันทึกเอง ไม่ใช่การรับรองทักษะหรือการเพิ่มคะแนนสอบ</p>
    {skill.needsReview && <p role="status" className="text-amber-800">บริษัทแก้ผลประเมินหลังบันทึกครั้งล่าสุด โปรดทบทวนเป้าหมายใหม่ ความคืบหน้าเดิมยังอยู่</p>}
    <label className="block">สถานะการเรียนรู้ {skill.name}
      <select className="block border rounded p-2 w-full" value={status} onChange={e => setStatus(e.target.value)} disabled={saving}>
        <option value="NOT_STARTED">ยังไม่เริ่ม</option><option value="IN_PROGRESS">กำลังเรียน</option><option value="COMPLETED">เสร็จแล้ว</option>
      </select>
    </label>
    <label className="block">บันทึกการเรียนรู้ {skill.name}
      <textarea className="block border rounded p-2 w-full" rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} disabled={saving} />
    </label>
    <label className="block">ลิงก์ผลงาน {skill.name} (ไม่บังคับ)
      <input type="url" placeholder="https://github.com/..." className="block border rounded p-2 w-full" maxLength={2000} value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} disabled={saving} />
    </label>
    {skill.progress.updatedAt && <p className="text-xs">บันทึกล่าสุด {new Date(skill.progress.updatedAt).toLocaleString('th-TH')}</p>}
    {skill.progress.completedAt && <p className="text-xs">ระบุว่าเสร็จเมื่อ {new Date(skill.progress.completedAt).toLocaleString('th-TH')}</p>}
    {skill.progress.evidenceUrl && /^https:\/\//i.test(skill.progress.evidenceUrl) && <a className="underline text-indigo-700 block" href={skill.progress.evidenceUrl} target="_blank" rel="noopener noreferrer">เปิดผลงานที่บันทึก</a>}
    <button className="rounded bg-indigo-600 text-white px-4 py-2 disabled:opacity-50" disabled={saving || conflict}>{saving ? 'กำลังบันทึก…' : `บันทึกความคืบหน้า ${skill.name}`}</button>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    {conflict && <button type="button" className="underline" onClick={onReload}>โหลดแผนล่าสุด (ข้อมูลที่ยังไม่บันทึกจะถูกแทนที่)</button>}
  </form>;
}
