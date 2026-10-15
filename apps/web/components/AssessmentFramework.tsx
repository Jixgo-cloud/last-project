'use client';

import { useId } from 'react';
import {
  AZ204_FRAMEWORK, FrameworkAssessment, FrameworkQuestion, frameworkMetadata,
  getFrameworkCoverage, getFrameworkTopic,
} from '@smartcareer/shared';

type Selection = ReturnType<typeof frameworkMetadata>;
type Coverage = ReturnType<typeof getFrameworkCoverage>;
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm disabled:bg-slate-100';

export function AssessmentFrameworkCoverage({ assessment, report }: { assessment: FrameworkAssessment; report?: Coverage }) {
  if (!assessment.frameworkCode) return null;
  const coverage = report === undefined ? getFrameworkCoverage(assessment) : report;
  if (!coverage) return <p role="alert">ไม่รองรับกรอบหรือฉบับอ้างอิงนี้ กรุณาเลือกฉบับที่รองรับ</p>;
  return <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800" aria-label="ความครอบคลุม AZ-204">
    <p className="font-bold">อ้างอิง AZ-204 ฉบับ {coverage.version} · {assessment.frameworkScope === 'FULL_BLUEPRINT' ? 'ครอบคลุมทั้งกรอบ' : 'ฝึกเฉพาะหัวข้อ'}</p>
    <p>อ้างอิงเพื่อการเรียนรู้: ข้อสอบ Microsoft AZ-204 ยุติเมื่อ {coverage.retiredOn} ผลสอบและ Badge ของ SmartCareer ไม่ใช่ใบรับรองจาก Microsoft</p>
    <a className="text-blue-700 underline" href={coverage.sourceUrl} target="_blank" rel="noopener noreferrer">อ่านกรอบต้นฉบับจาก Microsoft Learn</a>
    <p>เชื่อมหัวข้อแล้ว {coverage.coveredTopics}/{coverage.totalTopics} หัวข้อ ({coverage.topicCoveragePercentage.toFixed(1)}%) · คะแนนเต็ม {coverage.totalPoints}</p>
    <p>{coverage.meetsBlueprint ? 'ครบหัวข้อและสัดส่วนคะแนนตามกรอบที่อ้างอิง' : 'ยังไม่ครบหัวข้อหรือสัดส่วนคะแนนของทั้งกรอบ'}</p>
    <p className="text-xs">ตรวจจากหัวข้อหลักที่ผู้สร้างเลือกและคะแนนเต็มของแต่ละข้อ ข้อละหนึ่งหัวข้อ ไม่ใช่การรับรองคุณภาพเนื้อหา หรือความครอบคลุมทักษะย่อยทุกข้อ ผู้เชี่ยวชาญควรตรวจโจทย์เทียบกับต้นฉบับ</p>
    <details>
      <summary className="cursor-pointer font-semibold">ดูหมวดคะแนนและหัวข้อที่ยังขาด</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">สัดส่วนคะแนนเต็มที่จัดให้แต่ละหมวด เทียบช่วงจากกรอบอ้างอิง</caption>
          <thead><tr><th scope="col">หมวด</th><th scope="col">ช่วงอ้างอิง</th><th scope="col">สัดส่วนจริง</th><th scope="col">ผล</th></tr></thead>
          <tbody>{coverage.domains.map(d => <tr key={d.id} className="border-t border-blue-200"><th scope="row" className="py-2 font-normal">{d.name}</th><td>{d.min}–{d.max}%</td><td>{d.percentage.toFixed(1)}%</td><td>{d.withinRange ? 'อยู่ในช่วง' : 'นอกช่วง'}</td></tr>)}</tbody>
        </table>
      </div>
      {coverage.missingTopics.length > 0 && <p className="mt-2">หัวข้อที่ยังขาด: {coverage.missingTopics.map(t => t.name).join(' · ')}</p>}
      {coverage.unmappedQuestions.length > 0 && <p className="mt-2">ยังไม่เลือกหัวข้อ: ข้อ {coverage.unmappedQuestions.join(', ')}</p>}
      {coverage.missingMappingNotes.length > 0 && <p className="mt-2">ยังอธิบายความเชื่อมโยงไม่ครบ: ข้อ {coverage.missingMappingNotes.join(', ')}</p>}
    </details>
  </section>;
}

export function AssessmentFrameworkEditor({ value, questions, onChange, disabled = false }: {
  value: Selection; questions: FrameworkQuestion[]; onChange: (value: Selection) => void; disabled?: boolean;
}) {
  const id = useId();
  return <div className="space-y-3 rounded-xl border border-slate-200 p-4">
    <label htmlFor={`${id}-framework`} className="block text-sm font-semibold">กรอบอ้างอิงของข้อสอบ
      <select id={`${id}-framework`} value={value.frameworkCode || ''} disabled={disabled} className={fieldClass}
        onChange={e => onChange(e.target.value ? { frameworkCode: AZ204_FRAMEWORK.code, frameworkVersion: AZ204_FRAMEWORK.version, frameworkScope: 'TOPIC_PRACTICE' } : frameworkMetadata({}))}>
        <option value="">ไม่อ้างอิงกรอบภายนอก</option>
        <option value="AZ-204">Microsoft AZ-204 · ฉบับ 2026-01-14 (ยุติแล้ว)</option>
      </select>
    </label>
    {value.frameworkCode && <>
      <label htmlFor={`${id}-scope`} className="block text-sm font-semibold">ขอบเขตการอ้างอิง
        <select id={`${id}-scope`} value={value.frameworkScope || ''} disabled={disabled} className={fieldClass}
          onChange={e => onChange({ ...value, frameworkScope: e.target.value })}>
          <option value="TOPIC_PRACTICE">ฝึกเฉพาะหัวข้อ — ไม่จำเป็นต้องครบทั้งกรอบ</option>
          <option value="FULL_BLUEPRINT">ครอบคลุมทั้งกรอบ — ต้องครบ 11 หัวข้อและสัดส่วนทั้ง 5 หมวด</option>
        </select>
      </label>
      <AssessmentFrameworkCoverage assessment={{ ...value, questions }} />
    </>}
    {disabled && <p className="text-xs text-amber-800">มีผู้เริ่มสอบแล้ว จึงเปลี่ยนกรอบและการเชื่อมหัวข้อไม่ได้ กรุณาสร้างชุดใหม่</p>}
  </div>;
}

export function QuestionFrameworkEditor({ question, onChange, disabled = false }: {
  question: FrameworkQuestion;
  onChange: (update: { frameworkTopicId?: string; frameworkMappingNote?: string }) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const topic = getFrameworkTopic(question.frameworkTopicId);
  return <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
    <label htmlFor={`${id}-topic`} className="block text-xs font-semibold">หัวข้อ AZ-204 ที่โจทย์นี้วัดเป็นหลัก
      <select id={`${id}-topic`} required disabled={disabled} value={String(question.frameworkTopicId || '')} className={fieldClass}
        onChange={e => onChange({ frameworkTopicId: e.target.value })}>
        <option value="">เลือกหัวข้ออ้างอิง</option>
        {AZ204_FRAMEWORK.domains.map(domain => <optgroup key={domain.id} label={domain.name}>
          {AZ204_FRAMEWORK.topics.filter(t => t.domain === domain.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </optgroup>)}
      </select>
    </label>
    {topic && <a className="text-xs text-blue-700 underline" href={`${AZ204_FRAMEWORK.sourceUrl}#${topic.anchor}`} target="_blank" rel="noopener noreferrer">อ่านรายละเอียดหัวข้อจาก Microsoft Learn</a>}
    <label htmlFor={`${id}-note`} className="block text-xs font-semibold">โจทย์และเกณฑ์ตรวจวัดหัวข้อนี้อย่างไร (สำหรับผู้สร้างและผู้ตรวจ)
      <textarea id={`${id}-note`} required minLength={20} maxLength={2000} rows={3} disabled={disabled} className={fieldClass}
        placeholder="ระบุสิ่งที่ผู้สอบต้องทำและหลักฐานในคำตอบที่ใช้ตรวจ เช่น การใช้ Managed Identity เพื่อเข้าถึง Key Vault โดยไม่ฝังข้อมูลลับในโค้ด"
        value={String(question.frameworkMappingNote || '')} onChange={e => onChange({ frameworkMappingNote: e.target.value })} />
    </label>
    <p className="text-xs text-slate-600">เลือกตามเนื้อหาโจทย์จริง การใช้ภาษา Node.js หรือ Docker เพียงอย่างเดียวไม่ได้ยืนยันว่าครอบคลุม Azure</p>
  </div>;
}
