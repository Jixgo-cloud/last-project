export interface IngestionResultSummary {
  status?: string;
  createdCount?: number;
  duplicateCount?: number;
  errorCount?: number;
  errorMessage?: string | null;
}

export function ingestionFeedback(result: IngestionResultSummary, label: string, quotaLabel: string) {
  const counts = `(+${result.createdCount ?? 0} สร้างใหม่, ${result.duplicateCount ?? 0} รายการเดิม, ${result.errorCount ?? 0} ข้อผิดพลาด)`;
  const severity = result.status === 'FAILED' ? 'error'
    : result.status === 'PARTIAL_SUCCESS' || (result.errorCount ?? 0) > 0 ? 'warning' : 'success';
  const outcome = severity === 'error' ? 'ไม่สำเร็จ' : severity === 'warning' ? 'สำเร็จบางส่วน' : 'สำเร็จ';
  const reason = result.errorMessage?.startsWith('No live jobs returned')
    ? 'ต้นทางไม่ส่งรายการงานที่ใช้งานได้ ระบบคงงานเดิมและไม่เพิ่มข้อมูลตัวอย่าง'
    : result.errorMessage;
  return { severity, message: `ดึงข้อมูล${label} ${outcome} ${counts} [${quotaLabel}]${reason ? ` — ${reason}` : ''}` } as const;
}
