# ข้อสอบ JavaScript v3 — staging draft

วันที่ 27 ตุลาคม 2569; branch `codex/assessment-quality-review` ยังไม่ push/merge/deploy production

## ขอบเขตและเกณฑ์

แก้ bank เดิมตาม AI review ไม่อ้างว่า Two Sum/Palindrome เป็นโจทย์ต้นฉบับใหม่หรือครอบคลุมความชำนาญ JavaScript ทั้งภาษา การยืนยันความเป็นต้นฉบับและออกแบบข้อสอบตามหน้าที่งานยังเป็นงานต่อยอดสำหรับ expert/pilot

- Two Sum: 10 cases เพิ่ม no-pair, index ซ้ำตาม tie-break, เลขติดลบและขอบเขตจำนวนเต็ม ระบุข้อจำกัดอินพุต
- Palindrome: 12 cases กรอง non-ASCII ก่อน lowercase เพิ่ม Unicode, ตัวเลขปนตัวอักษร, empty string และ false cases
- `returnType` ใน testCases ตรวจ string/boolean ใน JavaScript/TypeScript harness ก่อนพิมพ์ stdout; typed bank ไม่อนุญาตเปลี่ยนเป็น Python ชุดเดิมไม่มี contract ใช้พฤติกรรมเดิม
- Shared readiness validator อนุญาต expectedOutput ว่างเฉพาะ contract แบบ string ที่ระบุชัด ไม่ปล่อยข้อมูลที่ไม่ได้กำหนดผลลัพธ์ให้ผ่าน
- Rubric `CRITERION_GATE_V1`: ได้คะแนนแต่ละองค์ประกอบเมื่อผ่านทุก case ขององค์ประกอบนั้น ถ้าองค์ประกอบจำเป็นผิด จำกัดคะแนนข้อนั้นที่ 30% หรือ 15/50 เก็บ breakdown ใน executionResult.rubricResult พร้อม snapshot เกณฑ์ของรอบนั้น หน้าข้อสอบแสดงน้ำหนักและเพดานให้ผู้สอบทราบ
- Two Sum น้ำหนัก pair/tie/absent = 40/30/30; palindrome normalization/symmetry = 50/50 ทุกองค์ประกอบเป็น essential รุ่นร่างนี้

เหตุผลของเพดาน: ชุดนี้ 2 ข้อ ข้อละ 50 ผ่านที่ 70 ดังนั้นข้อที่ขาดองค์ประกอบจำเป็นควรชดเชยด้วยอีกข้อเต็มแล้วยังไม่ผ่าน (15+50=65) ค่านี้เป็นข้อเสนอเชิงออกแบบสำหรับ staging ไม่ใช่ cut score ที่ผ่าน standard-setting ต้องให้เจ้าของระบบ/ผู้เชี่ยวชาญพิจารณาความเข้มงวด ความเป็นธรรม และข้อมูล pilot ก่อน production ไม่ใช้เกณฑ์นี้ย้อนหลัง

## API และการเก็บข้อมูล

โครงสร้างหลักของ API ไม่เปลี่ยน: percentage/pointsEarned มาจาก rubric ใหม่เฉพาะข้อที่ opt in `execution.rubricResult` เพิ่มผลรายองค์ประกอบโดยไม่คืน hidden inputs ส่วน run-code ตรวจเฉพาะ visible cases ไม่ใช้ผลดังกล่าวสรุปคะแนนจริง

ข้อมูล rubric/testCases อยู่ใน JSON columns เดิม จึงไม่มี schema migration ใหม่ ก่อนเปลี่ยน bank ต้องมี `assessment_bank_revisions` จาก migration เดิมแล้ว สคริปต์ release ยอมรับรุ่นก่อนหน้า หรือ legacy v1 ที่ผ่านเงื่อนไขเดิม เก็บ archive, ตรวจ hash, drain active attempts/reviews, transaction lock และทำซ้ำแล้วคืน ALREADY_CURRENT

ซ้อมบน local PostgreSQL ที่ hostname localhost และ database prefix `smartcareer_assessment_staging_` เท่านั้น ใช้ `scripts/rehearse-assessment-v3.cjs` ตรวจ v2 → v3 และ hash ทั้งตารางก่อน/หลัง:

| ตาราง | แถวที่รักษาไว้ทุกคอลัมน์ |
|---|---:|
| assessment_attempts | 54 |
| assessment_answers | 79 |
| job_applications | 23 |

เก็บ archive v2 สำเร็จและ dry-run ซ้ำเป็น ALREADY_CURRENT ประวัติ v1 ผ่าน review API ยังเป็น 1 ข้อ 50/50=100% ไม่ถูกหารด้วยคะแนนเต็มใหม่ ผลสอบ QA ใหม่เพิ่มหลังตรวจ preservation เท่านั้น

## ผลทดสอบ

การทดสอบ API ใช้ dev OAuth เฉพาะ localhost และ Judge0 CE จริง ไม่มี mock execution และไม่ได้ทดสอบ OAuth production รอบใหม่:

| สถานการณ์ | ผลที่ตรวจ |
|---|---|
| ยังไม่ประเมิน | matchScore=null, AWAITING_ASSESSMENT, coverage 0/7, ไม่มี course gaps |
| ทำถูกหนึ่งข้อ | 50/100, GAP, coverage 1/7, PRELIMINARY, JavaScript courses 3 รายการจาก API |
| ทำถูกทั้งสองข้อ | 100/100, ASSESSED สำหรับ JavaScript, match100 แบบ PRELIMINARY, coverage1/7, ไม่มี measured gaps |
| ประวัติเดิม | v1 50/50=100%, ใช้ archive เดิม, ไม่มีการสร้างผลทักษะย้อนหลัง |
| ส่งผ่าน UI: ผิด tie-break + palindrome ถูก | 15+50=65/100, ไม่ผ่าน70, API/profile65, GAP และคอร์ส3รายการ |
| Judge0 timeout จริงระหว่างส่งผ่าน UI | แสดง SYSTEM_ERROR, ไม่ใช้ผลรอบที่ไม่สมบูรณ์แทนผล100เดิม; เริ่มรอบใหม่แล้วจบ65ได้ |

เฉลย v3 ผ่าน Judge0 22/22; mutation แบบเลือก index แรกผิดได้ 9/10 cases แต่คะแนนข้อละ 15 ตาม rubric แทน 45/50; จับข้อผิดพลาด probe ได้จริง ผลจำลองอื่น: no-pair ผิด 15, ละเลย digits 15, always-true 0, string boolean 0 คะแนนต่อข้อ ทุกแบบเมื่อรวมอีกข้อเต็มไม่ถึง 70

Unit tests ตรวจ rubric, legacy formula, invalid rubric, empty-output readiness, typed harness และจำลอง Judge0 outage ให้เป็น SYSTEM_ERROR โดยไม่สร้างคะแนน/คำตอบ การทดสอบ outage เป็นการจำลองที่ชั้น service ไม่ใช่การทำให้บริการ Judge0 จริงล่ม

ระหว่างทดลอง UI พบ timeout จริงเพิ่มเติม (ไม่ได้จงใจทำให้บริการล่ม) และแก้ป้ายรายการข้อสอบจาก “รอตรวจ” เป็น “บริการตรวจข้อสอบขัดข้อง — กรุณาเริ่มใหม่” สำหรับ SYSTEM_ERROR ตรวจ API หลัง outage ยืนยัน matching ยังใช้ผล100เดิมที่สมบูรณ์ จากนั้น retry ผ่าน UI สำเร็จได้65 คะแนน ตรวจหน้าจอ profile50, ข้อสอบและ rubric, ผลสอบ100/65, matching100พร้อม coverage1/7 และ courses50/65 ที่แยก unknown ออกจาก gaps บัญชี QA เป็นบัญชีสังเคราะห์เฉพาะ staging

Checks: API build ผ่าน; web production build ผ่าน; lint ผ่าน; automated tests188รายการ (security20 + UAT168) ผ่าน รวม6กรณีใหม่; release integration ทั้ง1→2ข้อและ2→2ข้อผ่าน (ทดสอบ stale hash, active attempt, archive, idempotency, newer-version rejection, preservation) ตรวจ React changes: ไม่มี effect/fetch/dependency ใหม่, ใช้ semantic list/stable criterion keys, ไม่เปิดเผย hidden cases

หลักฐานที่ไม่รวม credentials อยู่ใน `output/assessment-quality-review/`: v3-migration.json, v3-local.json, v3-live-two-first-earlier.json, tests-v3.log และ build logs ผล API สดอยู่ใน directory staging ส่วนตัวตาม config (ไม่ commit config/token)

สำเนารายงาน API สำหรับรอบนี้: `v3-api-before.json`, `v3-api-gap.json`, `v3-api-pass.json`, `v3-api-history.json`, `v3-api-criterion.json`; หลักฐาน UI เป็นไฟล์ `v3-ui-*.txt/png` รวมภาพผล65และtimeout สคริปต์ตรวจหลังส่ง UI: `node scripts/verify-assessment-staging.cjs criterion --check-only`

หน้ารายละเอียดงานหลังผล65แสดง match93% เพราะเทียบกับเกณฑ์งาน70 (65/70) พร้อมป้ายเบื้องต้น coverage1/7 (14%) และ JavaScript gap คอร์สในหน้ารายละเอียดงานมี6รายการซึ่งใช้การคัดเลือกต่างจาก endpoint skill-gaps ที่คืน3 พบข้อมูลชื่อ/URLคอร์สซ้ำใน catalog ที่สำเนามา ไม่ได้ลบหรือปรับ catalog ในงานแก้ข้อสอบนี้ ควรจัดการ deduplication เป็นงานคุณภาพข้อมูลต่อไป ไม่ตีความจำนวนรายการเป็นจำนวนคอร์สไม่ซ้ำ

## ไฟล์ที่เปลี่ยน

| ส่วน | ไฟล์หลักและหน้าที่ |
|---|---|
| Bank | `prisma/assessment-bank/javascript-sandbox.json`: รุ่น3, constraints, rubric, cases, reference normalization |
| API | `automated-rubric.ts`, `assessments.service.ts`, `judge0.client.ts`: คำนวณคะแนนและเก็บ breakdown, typed return contract |
| Validation | `packages/shared/src/assessment-validation.ts`: รองรับ empty string ที่ตั้งใจ |
| UI | `apps/web/app/assessments/[id]/page.tsx`: แสดง rubric; `assessments/page.tsx`: แยก SYSTEM_ERROR จากรอตรวจ |
| Release/staging | `release-javascript-assessment.cjs`, `rehearse-assessment-v3.cjs`, `prepare-assessment-staging.cjs`, `start-assessment-staging.cjs`, `verify-assessment-staging.cjs`, `verify-assessment-release.cjs`: archive/preservation/version checks และรัน QA แยกสภาพแวดล้อม |
| Tests | `tests/assessment-v3.spec.cjs`, `scripts/review-assessment-quality.cjs`, `package.json`: regression, mutation และ live probes |
| เอกสาร | README, ASSESSMENT_POLICY_IMPLEMENTATION, AI review และรายงานฉบับนี้ |

## ก่อน rollout จริง

1. ให้ผู้เชี่ยวชาญทบทวน blueprint, originality, rubric/เพดาน 15, เกณฑ์70 และเวลา30นาที ทดลองกับคนจริงตามแผนในรายงาน AI review คง `PENDING_EXPERT_REVIEW_AND_PILOT`
2. ตรวจ CI และ diff ของ code + bank เดียวกันก่อน release เก็บหลักฐานอนุมัติรุ่นนี้โดยเฉพาะ
3. ใช้คู่มือ production เดิม ตรวจ schema/revision archive และหยุดรับการเริ่มสอบ/ส่งคำตอบระหว่างเปลี่ยน bank รัน release แบบ plan ก่อน แล้ว apply ด้วย expected-hash ที่ตรวจใหม่และนโยบาย backup ของเจ้าของระบบ ห้ามรัน seed ทับข้อมูล
4. Deploy code ที่รองรับ rubric/typed contract คู่กับ bank v3 ก่อนเปิดรับการสอบใหม่ ห้ามให้โค้ดเก่าตรวจ bank ใหม่ (จะใช้สูตรสัดส่วน cases ทำให้คะแนนผิด) หากต้อง rollback หลังมีผล v3 ให้รักษาผล/archives และออก revision ใหม่ตามกระบวนการ ไม่ย้อนเปลี่ยนคะแนนเดิมหรือ deploy old grader ทับ bank v3
5. ตรวจ healthy API/web, reference/mutation, unknown/gap/pass และประวัติเก่าอีกครั้งก่อนเปิดใช้

ยังไม่ประเมินยังคงเป็น null และแนะนำสอบก่อน ไม่เติม0/100 ไม่สร้าง gap จาก GitHub การมีผล v3 หมายถึงมีหลักฐานจากข้อสอบร่าง ไม่ใช่การรับรองความชำนาญทั้งหมด
