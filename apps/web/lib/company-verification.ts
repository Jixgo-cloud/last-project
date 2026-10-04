import { VerificationStatus } from '@smartcareer/shared';

type CompanyVerification = {
  verificationStatus?: VerificationStatus;
  verifications?: { id: string }[];
};

// Legacy company rows default to PENDING before any request exists.
// Only a persisted request belongs in the administrator's review queue.
export function getCompanyVerificationState(company: CompanyVerification | null) {
  if (company?.verificationStatus === VerificationStatus.VERIFIED) return VerificationStatus.VERIFIED;
  if (company?.verificationStatus === VerificationStatus.REJECTED) return VerificationStatus.REJECTED;
  return company?.verifications?.length ? VerificationStatus.PENDING : 'NOT_SUBMITTED';
}

export const companyVerificationLabels = {
  NOT_SUBMITTED: 'ยังไม่ส่งเอกสาร',
  PENDING: 'รอตรวจสอบเอกสาร',
  VERIFIED: 'ยืนยันแล้ว',
  REJECTED: 'คำขอไม่ผ่านการตรวจสอบ',
} as const;
