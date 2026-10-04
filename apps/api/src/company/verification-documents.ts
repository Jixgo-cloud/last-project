import { BadRequestException } from '@nestjs/common';
import { VERIFICATION_MAX_BYTES } from '@smartcareer/shared';
import { VerificationDocumentsDto } from './dto/company-profile.dto';

export function validateVerificationDocuments(documents: VerificationDocumentsDto) {
  let total = 0;
  for (const file of documents.files) {
    const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(file.dataUrl);
    if (!match || match[1] !== file.type) {
      throw new BadRequestException('ข้อมูลไฟล์เอกสารไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่');
    }
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length !== file.size || bytes.toString('base64') !== match[2]) {
      throw new BadRequestException('ข้อมูลไฟล์เอกสารไม่ครบ กรุณาเลือกไฟล์ใหม่');
    }
    const validHeader = file.type === 'application/pdf'
      ? bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
      : file.type === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    if (!validHeader) throw new BadRequestException('เนื้อหาไฟล์ไม่ตรงกับชนิด PDF, JPG หรือ PNG');
    total += bytes.length;
    if (total > VERIFICATION_MAX_BYTES) throw new BadRequestException('เอกสารทั้งหมดรวมกันต้องไม่เกิน 3MB');
  }
  return { files: documents.files.map(file => ({ name: file.name, type: file.type, size: file.size, dataUrl: file.dataUrl })) };
}
