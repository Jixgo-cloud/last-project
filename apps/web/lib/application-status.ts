export type DisplayLanguage = 'TH' | 'EN';
const labels: Record<string, [string, string]> = {
  APPLIED: ['ยื่นใบสมัครแล้ว', 'Applied'],
  REVIEWING: ['กำลังพิจารณา', 'Reviewing'],
  INTERVIEW: ['นัดสัมภาษณ์', 'Interview'],
  TECHNICAL_TEST: ['ทดสอบทักษะ', 'Technical test'],
  OFFER: ['ได้รับข้อเสนอ', 'Offer'],
  ACCEPTED: ['รับเข้าทำงานแล้ว', 'Accepted'],
  REJECTED: ['ไม่ผ่านการคัดเลือก', 'Rejected'],
  CANCELLED: ['ยกเลิกใบสมัครแล้ว', 'Cancelled'],
};
export function applicationStatusLabel(status: string, language: DisplayLanguage = 'TH'): string {
  return labels[status]?.[language === 'EN' ? 1 : 0] ?? status;
}
/** Translate only known machine-generated notes; preserve company-authored text. */
export function applicationHistoryNote(note: string, language: DisplayLanguage): string {
  const match = /^Status updated to ([A-Z_]+)$/.exec(note);
  if (match && labels[match[1]]) return language === 'EN'
    ? `Status updated to ${applicationStatusLabel(match[1], language)}`
    : `เปลี่ยนสถานะเป็น${applicationStatusLabel(match[1], language)}`;
  if (note === 'Application cancelled by candidate' && language === 'TH') return 'ผู้สมัครยกเลิกใบสมัคร';
  return note;
}
