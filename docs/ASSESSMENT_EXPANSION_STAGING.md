# ขยายข้อสอบ JavaScript 1 → 2 ข้อและตรวจ staging — 27 ตุลาคม 2569

ขอบเขตที่เจ้าของระบบเลือก: เตรียมชุดสองข้อโดยรักษาผลเดิม และทดสอบ migration/Judge0/API/หน้าจอบน staging แยกจาก production **ยังไม่ deploy หรือ merge** การทดสอบนี้ไม่ใช่การรับรองคุณภาพข้อสอบหรืออนุมัติเปิด pilot

## การเปลี่ยนแปลง

- เพิ่ม SQL `202610270003_assessment_bank_revisions` และ model `AssessmentBankRevision` เก็บโจทย์/เกณฑ์/เฉลยรุ่นเดิมพร้อม hash แยกจาก attempt เดิม เปิด RLS และถอนสิทธิ์ PUBLIC/anon/authenticated; อ่านได้ผ่าน backend ตามสิทธิ์ผู้ตรวจ ไม่รวมใน candidate/public API
- เพิ่ม `--expand-single-question` ใน release script ต้องเป็น platform JavaScript รุ่น 1 ที่มี Two Sum แบบ automated 50 คะแนนหนึ่งข้อ และต้องใช้ hash จากแผนล่าสุดก่อน apply พร้อม backup ส่วนตัว สคริปต์ไม่โหลด `.env` ของ QA
- ใน transaction เดียว: ตรวจ hash/ล็อกตาราง/ตรวจงานค้าง → archive รุ่น 1 → ปรับ Two Sum โดยคง ID → เพิ่ม Palindrome 50 คะแนน → เลื่อนรุ่นเป็น 2 การรันซ้ำให้ `ALREADY_CURRENT` ไม่เพิ่มข้อซ้ำ ไม่มี seed หรือการ rewrite ผลสอบ
- เก็บ score, maxScore, percentage, passed, assessmentVersion, snapshot, answers และใบสมัครเดิมครบ ผล 50/50 รุ่น 1 ยังคง 100%; รอบใหม่ใช้สองข้อ รวม 100 คะแนน ไม่มีการเติม skill provenance ย้อนหลังให้ผลเก่า
- API ตรวจ version mismatch แม้รอบเก่าไม่มี criteria hash; ไม่ตรวจคำตอบเก่าด้วยโจทย์ใหม่ ผู้ตรวจอ่านโจทย์จาก archive ผู้สมัครเห็นรุ่น/จำนวนข้อ/คะแนนเต็มเดิมโดยไม่เห็นเฉลย หากไม่มี archive ไม่แสดงโจทย์ปัจจุบันเป็นโจทย์ในอดีต
- เพิ่ม `ENABLE_SCHEDULED_JOBS=false` สำหรับปิด scheduler เมื่อเริ่ม process และ `HOST=127.0.0.1` สำหรับ staging เฉพาะเครื่อง ไม่ใช่สวิตช์หยุดงานที่รันอยู่แล้ว

API `GET /assessments/my-attempts` และ `GET /assessments/attempts/:id/review` สำหรับเจ้าของผล เพิ่ม `resultScope` ได้แก่ `assessmentVersion`, `questionCount`, `maxScore`, `historicalCriteriaArchived` และ `historicalCriteriaUnavailable` จำนวนข้อที่พิสูจน์ไม่ได้เป็น null ไม่เดาจากชุดปัจจุบัน ฝั่งผู้ตรวจที่มีสิทธิ์อ่าน `assessment.questions` รุ่นเดิมจาก archive ได้; ผู้สมัครไม่มี field นี้ในผลสอบย้อนหลัง

ตารางใหม่ใช้ primary key `(assessmentId, version)` อ้างอิง Assessment แบบ `ON DELETE RESTRICT` เพื่อไม่ลบชุดข้อสอบที่มี archive โดย cascade ไม่มีการเปลี่ยน foreign key ของ attempts/answers หรือย้ายผลไป assessment ใหม่

## สภาพแวดล้อมและข้อมูลตั้งต้น

- staging ในเครื่อง: API `http://127.0.0.1:4100/api`, เว็บ `http://localhost:3100`; proxy ชี้ API นี้ชัดเจน ไม่ใช้ fallback ของ Vercel preview
- ฐาน `smartcareer_assessment_staging_1793069706488` แยกจาก production และฐานพัฒนาเดิม บัญชี QA ใช้ development-only OAuth session; ไม่ได้ทดสอบ OAuth จริงหรือเปลี่ยน production login
- ใช้ archive production ที่มีอยู่จาก 16 ตุลาคม 2569 เวลา 00:06:50 ICT; SHA-256 `9e1ab6a030048456a1b669b3fef7e5e2132b0fc63d6b59e7946f26330b23074d` ไม่อ้างว่าเป็น backup สด ณ วัน release
- restore เฉพาะ public application schema ด้วย `--no-owner --no-acl`: 29 ตาราง / 4,414 แถว ไม่ครอบคลุม Supabase-managed schemas, Storage object files หรือการ restore grants/owners
- Judge0 จริง `https://ce.judge0.com`, JavaScript 63 ไม่มี API key หรือ fixture เป็น endpoint เดียวกับที่ production เลือกจาก configuration ที่ตรวจไว้ แต่การเชื่อมต่อครั้งนี้ออกจาก staging ในเครื่อง ไม่ใช่ Railway
- ปิด scheduled jobs และไม่ส่งต่อ OAuth/ingestion/provider secrets จาก production สร้าง signing key ของ staging แยก ไม่มีการเรียก seed หรือเขียน production

## Migration และการรักษาผลเดิม

ใช้ framework prerequisite และ incremental SQL ทั้งสามตาม [คู่มือ release](PRODUCTION_ASSESSMENT_UPGRADE.md) รันซ้ำทุกไฟล์ได้ Prisma schema diff เป็น `No difference detected.` ก่อนแก้ bank ตรวจ count/fingerprint ข้อมูลเดิมทุกตารางตรงกัน หลัง bank patch มีเพิ่ม question หนึ่งแถวและ archive หนึ่งแถว เปลี่ยนเฉพาะ assessment metadata และ Two Sum เดิม

ผลสอบของ bank เดิมทั้ง 6 รอบและคำตอบ 2 รายการตรงก่อนแก้ทุก field รวมผล COMPLETED สองรอบที่เป็น 50/50 = 100% เดิม สถานะ EXPIRED/SYSTEM_ERROR/IN_PROGRESS เดิมไม่ถูก migration เปลี่ยนหรือแปลงเป็นผลวัดทักษะ หลังทดสอบ QA ตรวจ fingerprint ผลสอบเดิมทั้งระบบ 50 รอบ คำตอบเดิม 73 รายการ และใบสมัครเดิม 23 รายการอีกครั้ง โดยตัดออกเฉพาะบัญชี QA ที่สร้างบน staging: ตรงกับก่อน migration

API ฝั่งผู้ตรวจแสดงโจทย์รุ่น 1 หนึ่งข้อและ prompt เดิม ไม่ใช่ชุดรุ่น 2 ฝั่งผู้สมัครไม่มี snapshot, answers, solutionCode หรือ hidden case จาก archive ใช้สำเนาผลเดิมที่ระบุเป็น QA fixture เพื่อทดสอบหน้าประวัติ โดยไม่ลงชื่อเข้าใช้บัญชีบุคคลจริง

## ผล flow จริง

ใช้ประกาศงานเดิม `Full Stack Developer (Next.js / NestJS)` ซึ่งกำหนด 7 ทักษะ JavaScript ขั้นต่ำ 70 และใช้คอร์สในฐานสำเนาเดิม ไม่มีการสร้างงาน/คอร์สเพื่อทำให้ผลผ่าน แผนเป้าหมาย Full Stack พบงานเกี่ยวข้อง 63 งาน และ JavaScript ใน 48 งาน

| สถานะ | ผล API/ฐานข้อมูล | การจับคู่งาน/คอร์ส |
| --- | --- | --- |
| ยังไม่มีผลที่เข้าเกณฑ์รุ่นนโยบาย | `NOT_ASSESSED`, score null แม้มีประวัติ legacy 100% | `AWAITING_ASSESSMENT`, 0/7, ไม่มี gap ที่แต่งขึ้น |
| ส่ง Two Sum ถูก และ Palindrome ผิด | COMPLETED, 50/100, snapshot รุ่น 2 สองข้อ; Judge0 5/5 และ 0/6 | `PRELIMINARY`, ประเมิน 1/7; คะแนนเทียบเกณฑ์งาน 71%; gap JavaScript และ API แนะนำ 3 คอร์สตามเป้าหมาย |
| Retake ผ่าน UI | Run Tests 3/3 ต่อข้อ; ส่งจริง 5/5 + 6/6; COMPLETED 100/100 | คะแนนงาน 100% แต่ยัง `PRELIMINARY` 1/7 (14%); JavaScript gap หาย อีก 6 ทักษะยัง unknown |
| ผลเก่ารุ่น 1 | 50/50 = 100% และจำนวนข้อ 1 คงเดิม | ไม่เติม provenance ให้กลายเป็นคะแนนทักษะใหม่ |

ตรวจหน้าจอผลสอบ/โปรไฟล์/รายละเอียดงาน/คอร์ส และการส่งคำตอบสองข้อผ่าน Monaco → Run Tests → Submit จริง บันทึก screenshots ไว้ใน evidence ส่วนตัว ทักษะที่ยังไม่ประเมินแสดงข้อเสนอให้ทำแบบทดสอบก่อนเสมอ

ระหว่าง Run Tests ผ่าน UI พบ public Judge0 timeout 9 วินาทีหนึ่งครั้ง ระบบเก็บ draft และแสดง sandbox unavailable โดยไม่ให้คะแนน 0 แทนบริการขัดข้อง การลองใหม่ผ่านและทำต่อจนจบรอบได้ ข้อนี้เป็นหลักฐานเรื่อง recovery ไม่ใช่ข้อพิสูจน์ SLA/capacity ของ public service

## วิธีทำซ้ำและหลักฐาน

ตั้ง `DATABASE_URL` ของ PostgreSQL **local เท่านั้น** และ `STAGING_BACKUP_FILE` ผ่าน private environment แล้วรันจาก root:

```text
node scripts/prepare-assessment-staging.cjs
npm run build:api
node scripts/start-assessment-staging.cjs
node scripts/verify-assessment-staging.cjs history
node scripts/verify-assessment-staging.cjs before
node scripts/verify-assessment-staging.cjs gap
node scripts/verify-assessment-staging.cjs pass
```

`prepare` สร้างฐานใหม่ทุกครั้งและ apply เฉพาะฐานนั้น ไม่มีการแก้ source DB; `start` ปฏิเสธพอร์ตที่มีผู้ใช้งาน; `verify ... pass --check-only` ตรวจผลที่ส่งผ่าน UI โดยไม่ส่งรอบใหม่ กรณีรัน flow ซ้ำให้สร้าง staging ใหม่ ไม่แก้คะแนนเพื่อย้อนสถานะ

หลักฐานส่วนตัว: `%USERPROFILE%/.codex/backups/smartcareer/smartcareer_assessment_staging_1793069706488/` มี migration evidence, bank backup, live API reports, logs และ screenshots ไม่ commit database dump, token, private configuration หรือข้อมูลผู้สมัคร

Integration test `verify-assessment-release.cjs` และ `--single` ตรวจทั้งเส้นทางเดิมและ 1 → 2: plan ไม่เขียน, scope flag, stale hash, active attempt rejection/rollback, RLS/PUBLIC grants, archive, ID/history preservation, idempotency และการไม่ทับรุ่นใหม่ Tests ใน `assessment-history.spec.cjs` ตรวจสิทธิ์ผู้ตรวจ/ผู้สมัคร, การไม่รั่วเฉลย, archive หาย และ legacy round ไม่มี hash

การตรวจ local: build API/web และ lint ผ่าน; security 20 + UAT 157 = 177 tests ผ่าน; release integration ทั้งสองเส้นทางผ่าน; browser/API regression เดิมผ่าน 44 checks ไม่พบ browser runtime errors หรือ failed API requests และฐาน staging ที่ใช้เป็น source ไม่เปลี่ยน (`output/core-regression/smartcareer_regression_1793071112418/results.json`) การทดสอบ Judge0 จริงและ screenshots ข้างต้นแยกจาก regression ที่ใช้ fixture

## เงื่อนไขก่อน production

ยังต้อง backup สดและ restore/rehearse พร้อมสิทธิ์จริง, pin commit/build, drain ทุก writer/cron, apply SQL รวม revision archive, ทบทวน fresh plan hash, จัดการ Railway trial/maintenance และทดสอบจาก runtime production ในหน้าต่าง release ที่อนุมัติ ข้อสอบ/rubric/passing threshold ยังคง `PENDING_EXPERT_REVIEW_AND_PILOT`; การเลือกเตรียมชุดสองข้อไม่ได้อนุมัติการใช้งานคัดเลือกหรือ rollout
