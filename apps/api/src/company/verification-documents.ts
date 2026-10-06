import { BadRequestException, NotFoundException, StreamableFile } from '@nestjs/common';
import { VERIFICATION_MAX_BYTES } from '@smartcareer/shared';
import { VerificationDocumentsDto, VerificationFileDto } from './dto/company-profile.dto';

export function validateVerificationDocuments(documents: VerificationDocumentsDto) {
  let total = 0;
  for (const file of documents.files) {
    const bytes = decodeVerificationFile(file);
    total += bytes.length;
    if (total > VERIFICATION_MAX_BYTES) throw new BadRequestException('เอกสารทั้งหมดรวมกันต้องไม่เกิน 3MB');
  }
  return { files: documents.files.map(file => ({ name: file.name, type: file.type, size: file.size, dataUrl: file.dataUrl })) };
}

export function decodeVerificationFile(file: VerificationFileDto): Buffer {
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
    return bytes;
}

export function streamVerificationDocument(documents: any, index: number): StreamableFile {
  if (!Number.isSafeInteger(index) || index < 0) throw new BadRequestException('Invalid document index');
  const file = Array.isArray(documents?.files) ? documents.files[index] : undefined;
  if (!file || typeof file.dataUrl !== 'string' || typeof file.name !== 'string' || typeof file.type !== 'string' || !Number.isSafeInteger(file.size)) {
    throw new NotFoundException('ไม่พบเอกสารนี้');
  }
  if (file.dataUrl.length > 14 * 1024 * 1024) throw new BadRequestException('ไฟล์เอกสารมีขนาดใหญ่เกินกว่าที่ระบบรองรับ');
  const bytes = decodeVerificationFile(file);
  const filename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 255) || 'document';
  return new StreamableFile(bytes, {
    type: file.type,
    disposition: `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase())}`,
    length: bytes.length,
  });
}
