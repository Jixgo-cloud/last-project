# ผลอัปเกรดฐานข้อมูลและทดสอบ Judge0 จริง — 27 ตุลาคม 2569

สถานะ: ทดสอบเส้นทาง local API → Judge0 จริง → PostgreSQL → จับคู่งาน/คอร์ส → หน้าจอสำเร็จ เป็นการตรวจการทำงานของระบบ ไม่ใช่การรับรองคุณภาพข้อสอบหรือการ deploy production

## ฐานข้อมูลและการรักษาข้อมูล

- เป้าหมายที่อัปเกรด: PostgreSQL local ฐาน `smartcareer` ตาม configuration เดิม
- สำรองแบบ PostgreSQL custom format ก่อนแก้ และ restore ไปฐาน QA `smartcareer_live_judge_1793062038486` สำเร็จ
- ตรวจ fingerprint ของ 29 ตาราง รวม 1,491 แถวก่อน/หลัง schema migration: ข้อมูลเดิมไม่เปลี่ยน
- ใช้ `scripts/sql/assessment-framework.sql` เพื่อเติม framework fields ที่ขาด, `202610270001_assessment_matching` เพื่อรองรับคะแนน nullable/assessment snapshot และ `202610270002_skill_categories` เพื่อเติม SALES/COORDINATION/WRITING ซึ่งมีใน schema แต่ยังขาดใน DB
- ตรวจ `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`: `No difference detected.`
- หลังซ่อมข้อสอบเดิม ตรวจอีกครั้ง: ยังคง 1,491 แถว; 27 ตารางอื่นมี fingerprint เดิม; เปลี่ยนเฉพาะ metadata ข้อสอบ 1 ชุดและโจทย์ 2 ข้อเป็นรุ่น 2; เก็บประวัติสอบเดิม 31 รอบและคำตอบเดิม 7 รายการ
- ไม่มี reset, DROP ตาราง, ลบผลสอบ, backfill คะแนน GitHub หรือรัน seed ทับฐานข้อมูล

หลักฐาน local อยู่ใน `%USERPROFILE%\.codex\backups\smartcareer\2026-10-27T00-47-17-501Z\`: `before-upgrade.dump`, `upgrade-report.json`, `enum-upgrade.json`, `final-data-integrity.json` และ backup ข้อสอบก่อนแก้ บัญชี/ผลสอบ QA อยู่เฉพาะฐานสำเนา ตัวแปรเชื่อมต่อและ token เก็บในไฟล์ส่วนตัวนอก repository ไม่รวมในรายงาน

## สภาพแวดล้อมและขอบเขต

- Nest API ที่ `http://localhost:4000/api`; Next.js ที่ `http://localhost:3000` ผ่าน proxy/cookie ของแอปจริง
- Judge0 ใช้ endpoint ที่ตั้งไว้ `https://judge0-ce.p.rapidapi.com`, JavaScript language ID 63 และ credentials เดิม ไม่ใช้ judge adapter จำลองหรือ local fallback ในการทดสอบนี้
- ใช้ dev OAuth เฉพาะสร้าง session บัญชี QA สองบัญชีในฐานสำเนา ไม่ได้ทดสอบ GitHub OAuth จริงหรือ GitHub sync รอบนี้
- ใช้ประกาศงาน/คอร์สที่มีอยู่ในฐานสำเนา ไม่สร้างประกาศงานหรือคะแนนเพื่อทำให้ผลผ่าน
- การทำข้อสอบผ่าน UI ใช้ Monaco, Run Tests, ส่งคำตอบทีละข้อ และ Retake จริง เมื่อส่งครบสองข้อ ระบบปิดรอบและบันทึกผลอัตโนมัติตาม flow เดิม

## ผลแต่ละสถานะ

งานที่ทดสอบ: `Full Stack Developer (Next.js / .NET / Java)` ของ Smart Alliance มีทักษะ 11 รายการ รวม JavaScript เกณฑ์ 70 คะแนน เป้าหมายบัญชี QA คือ Full Stack Developer แผนประเมินเลือกสูงสุด 5 ทักษะจาก 44 งานที่เกี่ยวข้อง; JavaScript ปรากฏใน 33 งาน

| กรณี | คะแนนสอบ JavaScript | จับคู่งาน | คอร์ส/ช่องว่าง | API และ UI |
|---|---:|---|---|---|
| ยังไม่มีผล | `null` | `AWAITING_ASSESSMENT`, คะแนน `null`, 0/11 | ไม่มี gap; เสนอแบบทดสอบก่อน | ผ่าน |
| ผ่านข้อแรกทั้งหมด แต่ข้อสองผิดทั้งหมด | 50/100 | `PRELIMINARY`, 71%, 1/11 (9%) | GAP 20 คะแนนเทียบเกณฑ์ 70; API แผนแนะนำ 3 คอร์ส; หน้างานมี 5 คอร์สที่เกี่ยวข้อง | ผ่าน |
| Retake ผ่าน UI และตอบถูกครบ | 100/100 | `PRELIMINARY`, 100%, 1/11 (9%) | JavaScript เปลี่ยนเป็น ASSESSED; ไม่มี measured gap/คอร์สปิด gap; อีก 4 ทักษะในแผนยังเสนอสอบก่อน | ผ่าน |

คะแนนจับคู่ 71 มาจากการปัด `50/70 × 100` ของทักษะที่ประเมินแล้ว ไม่ใช่คะแนนความชำนาญทั้งหมด คะแนนจับคู่ 100 ในรอบผ่านยังเป็นข้อมูลเบื้องต้นเพราะอีก 10 ทักษะไม่มีผล ไม่เติมคะแนน 0 หรือ 100 ให้ทักษะเหล่านั้น

ตรวจความตรงกันของ `/jobs/:id/match`, `/jobs/:id/detail`, รายการ `/jobs`, `/candidate/profile` และ `/recommendations/skill-gaps` รวมทั้ง persisted attempts/answers ใน PostgreSQL ทั้งสองโจทย์มี `engine=Judge0-Isolated-Container`; รอบผ่านตรวจได้ 5/5 และ 6/6 รวม 11/11 test cases มีเวลา execution จริง ผล API สำหรับผู้สอบไม่เปิด solutionCode หรืออินพุต/expected output ของ hidden cases

หน้าจอที่ตรวจ: หน้าสอบและผลสอบ, โปรไฟล์/หมวดเรดาร์, ค้นหารายการงาน, รายละเอียดงาน, คอร์ส/แผนประเมินก่อนสอบและหลังสอบ ตรวจ browser console ตอนจบไม่พบ error/warning ในหน้าคอร์ส

รายงาน JSON: `live-api-before.json`, `live-api-gap.json`, `live-api-pass.json` ในโฟลเดอร์หลักฐานเดียวกัน ภาพอยู่ใน `screenshots/`:

- `01-job-unassessed.png`: รอผลประเมิน 0/11
- `04-judge0-palindrome-accepted.png`: Run Tests ผ่าน Judge0 จริง
- `05-exam-passed-100.png`: ผลสอบผ่าน 100/100
- `06-job-preliminary-pass.png`: คะแนนเบื้องต้น 100 พร้อม coverage 1/11
- `07-courses-after-pass.png`: ไม่มีช่องว่าง JavaScript หลังสอบผ่าน
- `08-profile-assessed.png`, `09-job-list-coverage.png`: โปรไฟล์และรายการงาน
- `10-job-gap-courses-corrected.png`, `11-courses-gap-final.png`: ช่องว่างและคอร์สหลังแก้การตรวจความเกี่ยวข้อง

## ปัญหาที่พบและแก้ระหว่างทดสอบ

1. **starter code เปิดเฉลยอยู่แล้ว**: แยก reference solution ไป `solutionCode`, ให้ starter เป็นโครงฟังก์ชัน และเพิ่ม rubric ใน canonical bank `prisma/assessment-bank/javascript-sandbox.json` ทั้งสอง seed อ่านชุดเดียวกัน
2. **palindrome ถูกตรวจผิดจากรูปแบบอินพุต**: Judge0 จริงกับข้อมูลเดิมทำให้คำตอบถูกต้องผ่านตัวอย่างเพียง 1/3 เพราะ comma และ whitespace ถูก parser ตีความเป็น argument อื่น แก้ข้อมูลชุดนี้เป็น JSON argument arrays จึงผ่าน 3/3 ตัวอย่างและ 6/6 ตอนส่งจริง ไม่เปลี่ยน parser ของข้อสอบอื่นโดยเงียบ ๆ
3. **สถานะ provider อาจกลายเป็นศูนย์ของผู้สอบ**: แก้ `judge0.client.ts` ให้ Internal Error (13), queued/processing และ unknown status เป็น `JUDGE_UNAVAILABLE` แทนคะแนนผู้สอบ พร้อมให้ harness คืน exit code ไม่สำเร็จเมื่อ solution มี runtime error กรณี provider errors ตรวจด้วย regression จำลองแยกจากหลักฐาน live ข้างต้น
4. **คอร์ส HTML-only มี tag JavaScript เดิม**: หน้างาน/คำแนะนำ gap ต้องพบชื่อทักษะหรือ alias ในชื่อ/คำอธิบายคอร์สก่อนอ้างว่าช่วยปิด gap ไม่ใช้ tag เดิมหรือ fallback ชื่อทักษะแรกมาสร้างคำแนะนำ ข้อมูล catalog เดิมยังอยู่ วิธีนี้อาจพลาดคอร์สที่คำอธิบายไม่ครบ จึงต้องให้ผู้ดูแลตรวจ metadata ต่อ
5. **ข้อความเหรียญใช้เกณฑ์ 60% ตายตัว**: ปรับหน้าโปรไฟล์ให้อ้างเกณฑ์ของข้อสอบจริง

ไม่สร้างโจทย์ใหม่เพื่ออ้างว่าเป็นข้อสอบมาตรฐาน เป็นการซ่อมสองโจทย์เดิมและใช้ทักษะนำร่องจากความต้องการที่ตรวจในระบบ รุ่น 2 ยังเป็น `PENDING_EXPERT_REVIEW_AND_PILOT` การผ่าน test cases ไม่ใช่หลักฐานความเที่ยงตรง/ความเชื่อมั่นของการวัด JavaScript ทั้งภาษา

อ้างอิงการแก้อินพุตและสถานะ: [MDN JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse), [Judge0 status และ submission API](https://ce.judge0.com/#statuses-and-languages-status)

## ทำซ้ำและตรวจ regression

### ตรวจชุดเปลี่ยนแปลงก่อน commit (27 ตุลาคม 2569)

แยกเฉพาะงาน assessment-based matching ไปยัง worktree สะอาดจาก `dac6fc83` โดยไม่รวม UI/คำแปลที่ค้างอยู่นอกขอบเขต แล้วติดตั้ง dependencies ใหม่และตรวจดังนี้:

- `npm run build` ผ่าน API และ Next.js; `npm test` ผ่าน 172 รายการ; `npm run lint` ผ่าน
- `node scripts/verify-core-regression.cjs` ผ่าน 44 checks ครอบคลุม browser → API → ฐานข้อมูลที่สร้างแยก และยืนยันฐานข้อมูลต้นทางไม่เปลี่ยน ชุดนี้ใช้ Judge0 fixture จึงแยกจากผลทดสอบ Judge0 จริงที่รายงานไว้ด้านบน
- `node scripts/verify-assessment-migration.cjs` ผ่าน โดยเก็บคะแนนเดิม 85, ให้ค่าใหม่เป็น null และ rollback ตารางชั่วคราว
- `node scripts/verify-assessment-release.cjs` ผ่านบนฐานข้อมูล local ที่สร้างและลบทิ้งเฉพาะการทดสอบ: dry run, hash เก่า, backup, version update, idempotency, question IDs/attempts/answers เดิม และการปฏิเสธรุ่นที่ใหม่กว่า
- แก้ release startup ไม่ให้ Docker/npm start รัน `db push` และเพิ่ม [คู่มือ production](PRODUCTION_ASSESSMENT_UPGRADE.md) พร้อม bank patch แบบวางแผนก่อนเขียน ยังไม่ได้ deploy หรือเปลี่ยนฐานข้อมูล production

### ทำซ้ำการทดสอบ Judge0 จริงใน local

คำสั่งจาก repository root สำหรับ local เท่านั้น (ต้องมี PostgreSQL tools, credentials Judge0 เดิม และ ports 3000/4000 ว่าง):

```powershell
node scripts/upgrade-assessment-database.cjs
node scripts/repair-javascript-assessment.cjs --qa
npm run build:app --workspace=@smartcareer/api
node scripts/start-live-assessment-qa.cjs
node scripts/verify-live-assessment.cjs before
node scripts/verify-live-assessment.cjs gap
# ล็อกอินบัญชี QA ผ่าน /mock-oauth แล้ว Retake ในหน้าสอบจนผ่าน
node scripts/verify-live-assessment.cjs pass
# หลังตรวจชุดแก้แล้ว จึงใช้กับฐาน local หลัก; script สำรองโจทย์และตรวจรุ่นก่อนเขียน
node scripts/repair-javascript-assessment.cjs
```

`gap` ส่งโค้ดไป Judge0 จริงและใช้ quota ของบัญชี; `--check-only` อ่านผลที่มีอยู่โดยไม่ส่งข้อสอบซ้ำ `--gap-user` ใช้บัญชี QA แยกเพื่อเก็บกรณีคะแนน 50 ไว้คู่กับบัญชีที่ Retake ผ่าน หยุดเฉพาะ process IDs ของ QA ที่สคริปต์บันทึกเมื่อทดสอบเสร็จ; ไฟล์ `.env` เดิมไม่ถูกแก้

Regression: `npm test` ผ่าน 172 รายการ (security 20 + UAT 152) รวมการแยก unknown/zero, latest eligible result, single/batch parity, criteria hash, hidden cases, provider internal errors, ข้อมูลข้อสอบ JSON และ tag คอร์สที่ผิด ทดสอบ reference fixtures ใน unit test แยกจากการรันโค้ดผู้สอบจริงผ่าน Judge0

API build, Next.js production build (รวม lint/type checking และสร้าง 28 หน้า), TypeScript check ของ seed ทั้งสองไฟล์ และ `git diff --check` ผ่าน หลังเก็บหลักฐานปิด API/Next process ของ QA แล้ว ไม่เหลือ listener ของการทดสอบบน ports 3000/4000; เก็บฐานสำเนาและ backup ไว้ตรวจย้อนหลัง ไฟล์ `.env` เดิมไม่ได้เปิด dev mock auth ค้างไว้

## ไฟล์ที่เพิ่มหรือปรับในรอบทดสอบจริง

| กลุ่ม | ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|---|
| อัปเกรด/สำรอง | `scripts/upgrade-assessment-database.cjs`, `prisma/migrations/202610270002_skill_categories/migration.sql` | Backup/restore/fingerprints และ enum ที่ขาด |
| ข้อสอบ | `prisma/assessment-bank/javascript-sandbox.json`, `prisma/seed.ts`, `prisma/seed-production.ts`, `scripts/repair-javascript-assessment.cjs` | Canonical bank, JSON arguments, starter/rubric/solution แยกกัน, version/backup/idempotency |
| Judge0 | `apps/api/src/assessments/judge0.client.ts` | แยก provider error ออกจากผลผู้สอบ และคืน runtime failure ให้ถูกต้อง |
| คอร์ส | `apps/api/src/jobs/jobs.service.ts`, `apps/api/src/recommendations/recommendations.service.ts` | ตรวจชื่อ/คำอธิบายประกอบการแนะนำคอร์สจาก measured gap |
| หน้าจอ | `apps/web/app/profile/page.tsx` | อ้างเกณฑ์เหรียญตามข้อสอบ ไม่ใช้ 60% ตายตัว |
| ตรวจซ้ำ | `scripts/start-live-assessment-qa.cjs`, `scripts/verify-live-assessment.cjs`, `tests/security.spec.cjs`, `tests/skill-assessment.spec.cjs` | เปิดระบบ QA แยก, live assertions, regression ใหม่ |
| เอกสาร | `README.md`, `docs/ASSESSMENT_POLICY_IMPLEMENTATION.md`, เอกสารนี้ | เปลี่ยนสถานะจากรอ migration/ทดสอบจำลองเป็นผลที่ตรวจจริง พร้อมข้อจำกัด |

ยังต้องให้ผู้เชี่ยวชาญตรวจเนื้อหา/rubric/ความครอบคลุม สอบเทียบเกณฑ์ข้อสอบกับเกณฑ์งาน และทดลองกับกลุ่มผู้สมัคร เจ้าของระบบต้องกำหนดอายุผลสอบ/นโยบายสอบซ้ำและ baseline สำหรับ rollout สภาพแวดล้อมอื่นก่อนใช้งานจริง
