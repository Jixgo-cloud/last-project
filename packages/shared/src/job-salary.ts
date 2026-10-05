export function formatJobSalary(job: {salaryMin?: number | null; salaryMax?: number | null; salaryCurrency?: string | null}): string | null {
  const min = typeof job.salaryMin === 'number' && Number.isFinite(job.salaryMin) ? job.salaryMin : null;
  const max = typeof job.salaryMax === 'number' && Number.isFinite(job.salaryMax) ? job.salaryMax : null;
  if (min === null && max === null) return null;
  const currency = job.salaryCurrency || 'THB';
  const format = (value: number) => {
    try { return new Intl.NumberFormat('th-TH', {style:'currency', currency, maximumFractionDigits:0}).format(value); }
    catch { return `${value.toLocaleString('th-TH')} ${currency}`; }
  };
  if (min === null) return `ไม่เกิน ${format(max!)}`;
  if (max === null || min === max) return format(min);
  return `${format(min)} - ${format(max)}`;
}
