'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { JobSource } from '@smartcareer/shared';

type Preview = { source: JobSource; count: number; newCount: number; duplicateCount: number; collectedAt: string; jobs: { title: string; company: string; url: string }[] };
type Tracking = { id?: string; requestKey: string; source: JobSource; quota: number };

export default function LocalJobImport({ busy, pending, onRequest, onRun, onRejected }: {
  busy: boolean; pending: Tracking | null; onRequest: (tracking: Tracking) => void;
  onRun: (run: any) => void; onRejected: (requestKey: string) => void;
}) {
  const [batch, setBatch] = useState<unknown>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const localPending = pending?.requestKey.startsWith('local-');
  const readFile = async (file?: File) => {
    setBatch(null); setPreview(null); setError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') || file.size > 256 * 1024) { setError('เลือกไฟล์ JSON ขนาดไม่เกิน 256 KB'); return; }
    setWorking(true);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(await file.text()); } catch { throw new Error('อ่านไฟล์ JSON ไม่ได้'); }
      const result = await apiRequest('/ingestion/local-jobs/preview', { method: 'POST', body: JSON.stringify(parsed) });
      setBatch(parsed); setPreview(result);
    } catch (err: any) { setError(err.message || 'ตรวจไฟล์ไม่สำเร็จ'); }
    finally { setWorking(false); }
  };
  const submit = async () => {
    if (!preview || !batch) return;
    const tracking = localPending && pending ? pending : {
      requestKey: `local-${crypto.randomUUID()}`, source: preview.source,
      quota: Math.max(preview.source === JobSource.JOBSDB ? 10 : 5, preview.count),
    };
    setWorking(true); setError(''); onRequest(tracking);
    try {
      const run = await apiRequest('/ingestion/local-jobs', { method: 'POST', body: JSON.stringify({ batch, requestKey: tracking.requestKey.slice(6) }) });
      onRun(run);
    } catch (err: any) {
      if ([400, 401, 403, 409].includes(err.status)) onRejected(tracking.requestKey);
      setError(err.message || 'ยังยืนยันคำขอไม่ได้ เลือกไฟล์เดิมแล้วส่งซ้ำเพื่อติดตามรอบเดิม');
    } finally { setWorking(false); }
  };
  return <section className="mb-6 rounded-2xl border border-indigo-200 bg-white p-5" aria-labelledby="local-import-title">
    <h2 id="local-import-title" className="font-bold text-slate-900">นำเข้างานที่ดึงจากเครื่อง</h2>
    <p className="my-2 text-sm text-slate-600">เลือกไฟล์ JobsDB หรือ Blognone ที่ตัวดึงสร้างไว้ ตรวจรายการก่อนนำเข้า ข้อมูลไม่เกิน 7 วันและ 60 งาน ไม่มีการลบหรือแทนที่งานเดิม</p>
    <label className="block text-sm font-semibold" htmlFor="local-job-file">ไฟล์งาน JSON</label>
    <input id="local-job-file" type="file" accept=".json,application/json" disabled={working || (busy && !localPending)} onChange={event => { void readFile(event.target.files?.[0]); }} className="my-2 block w-full text-sm" />
    {error && <p role="alert" className="my-2 text-sm text-red-700">{error}</p>}
    {working && <p role="status" className="text-sm">กำลังตรวจหรือส่งไฟล์…</p>}
    {localPending && <p className="my-2 text-sm">หากโหลดหน้าใหม่และยังไม่พบรอบ ให้เลือกไฟล์เดิมเพื่อส่งคำขอเดิมอีกครั้ง</p>}
    {preview && <>
      <p className="my-2 text-sm">{preview.source}: {preview.count} งาน · คาดว่าเพิ่มใหม่ {preview.newCount} · มีอยู่แล้ว {preview.duplicateCount} · ดึงเมื่อ {new Date(preview.collectedAt).toLocaleString('th-TH')}</p>
      <p className="text-xs text-slate-500">จำนวนอาจเปลี่ยนระหว่างตรวจไฟล์กับบันทึก ระบบตรวจงานซ้ำอีกครั้งขณะนำเข้า</p>
      <ul className="my-3 max-h-60 overflow-y-auto text-sm">{preview.jobs.map(job => <li key={job.url} className="border-b py-2"><a href={job.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">{job.title}</a> — {job.company}</li>)}</ul>
      <button type="button" onClick={() => { void submit(); }} disabled={working || (busy && !localPending) || !!pending?.id} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{localPending ? 'ส่งไฟล์เดิมอีกครั้ง' : 'ยืนยันนำเข้าไฟล์นี้'}</button>
    </>}
  </section>;
}
