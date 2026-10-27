# การปรับ SmartCareer ให้ใช้ผลประเมินจริง — 27 ตุลาคม 2569

รายงานนี้อธิบายโค้ดที่ปรับตาม `GITHUB_SKILL_ASSESSMENT_COMPARISON.md` ไม่ใช่การรับรองคุณภาพข้อสอบหรือการยืนยันว่า deploy แล้ว ตรวจ README และเส้นทาง GitHub, Assessment/Judge0, Candidate, Matching, Recommendations, Jobs, Applications และ Company ก่อนแก้ ไม่พบ AGENTS.md ใน repository หรือโฟลเดอร์แม่ที่เกี่ยวข้อง งานที่แก้ค้างอยู่ก่อนเริ่มยังคงไว้

## 1. ผลตรวจเดิมและสิ่งที่เปลี่ยน

| ส่วน | พฤติกรรมที่ตรวจพบก่อนแก้ | พฤติกรรมใหม่ / ไฟล์ |
|---|---|---|
| GitHub | ภาษาให้ 25, dependencies ให้ 20, บวกฐาน 60 แล้วป้อนหลายโมดูล | `apps/api/src/github/github.service.ts` เก็บบริบทอย่างเดียว ไม่มี scoreWeight; contribution ใหม่เป็น 0 ไม่เขียนคะแนนทักษะ |
| สูตรใช้ร่วมกัน | `githubEvidenceScore`, `githubSkillView`, `evidenceWeightedScore` ใช้คะแนน GitHub | ยกเลิกใน `packages/shared/src/candidate-screening.ts`; เพิ่ม `skill-assessment.ts` เป็นแหล่งกติกาผลประเมิน/จับคู่/ข้อความสถานะ; ปรับชนิดข้อมูลใน `index.ts` |
| การสอบ | มี skillId, รุ่น, snapshot, test cases, rubric, Judge0 และสถานะรอตรวจ แต่ snapshot ไม่มี skill binding ที่ชัดพอ | `apps/api/src/assessments/assessments.service.ts` บันทึกทักษะ/เกณฑ์/hash; ตรวจการเปลี่ยนข้อสอบกลางรอบ; Run Code ไม่ fallback ไปเปิด hidden cases; ผู้สอบไม่เปลี่ยนภาษารันด้วยข้อความในคำตอบ |
| ข้อมูลผลสอบ | แต่ละโมดูลอาจอ่าน cache คะแนนเดิม | `assessments/skill-attempt-select.ts` ใช้ projection เฉพาะผลและที่มา ไม่มี source code/คำตอบ/เฉลย |
| โปรไฟล์ | คะแนน/เรดาร์จาก GitHub | `candidate/candidate.service.ts` สร้าง skill views จากผลสอบจริง รวมทักษะที่ไม่มี GitHub และคืน null สำหรับหมวดที่ไม่มีผล |
| จับคู่งาน | ใช้คะแนน GitHub, เติม 0/100, สูตรสองเส้นทาง | `matching/matching.service.ts` เรียกสูตร shared เดียวทั้ง single/batch และคืนสถานะ/coverage |
| งานและคอร์สในหน้างาน | รายการมี fallback 40; คอร์ส fallback จากทุกทักษะ | `jobs/jobs.service.ts` ยกเลิกคะแนน fallback; คอร์สเฉพาะ missingSkills ที่วัดแล้ว |
| เป้าหมายอาชีพ | benchmark คงที่และ fallback Full Stack; ไม่มีผลตีเป็น 0 | `recommendations/recommendations.service.ts` อ่านงานจริง เลือก 5 ทักษะตามความต้องการ คืน assessmentPlan; เฉพาะ GAP จึงค้นคอร์ส |
| ใบสมัคร/บริษัท | เก็บคะแนนเดิมโดยไม่มีนโยบายและความครอบคลุม | `applications/applications.service.ts`, `company/company.service.ts` เก็บ/แสดง snapshot ใหม่; API และ CSV ไม่แสดงคะแนนเก่าเป็นผลจากข้อสอบ |
| ข้อมูล | คะแนนใบสมัครต้องมีค่าและ default 0 | `prisma/schema.prisma`, `prisma/migrations/202610270001_assessment_matching/migration.sql` เปลี่ยน nullable และเพิ่ม JSON snapshot โดยรักษาข้อมูลเดิม |

หน้าจอที่ปรับ: `apps/web/app/profile/page.tsx`, `jobs/page.tsx`, `jobs/[id]/page.tsx`, `courses/page.tsx`, `assessments/page.tsx`, `assessments/[id]/page.tsx`, `company/applications/page.tsx`, `company/jobs/new/page.tsx`, `components/home/HomePageClient.tsx` และ component ใหม่ `components/AssessmentPlan.tsx`

เอกสารที่ปรับ: README หัวข้อ 3, 5, 6, 8 และภาพรวม/วิธีอัปเกรด; comparison ระบุส่วนเดิมว่าเป็นประวัติ; `DATA_STRUCTURE.md`, `PROJECT_OVERVIEW.md`, `MODULE_DATA_FLOWS.md`, `MODULE_INTERACTIONS.md`, `uat/CURRENT_USER_GUIDE.md` และป้ายกำกับคู่มือ UAT รุ่นเก่า 4 บทบาท/กรณีขอบ ผลทดสอบในอดีตไม่ถูกเขียนใหม่ให้ดูเหมือนผ่านนโยบายนี้แล้ว

## 2. สถานะและเกณฑ์ผลประเมิน

| สถานะ | ความหมาย | คะแนน/การดำเนินการ |
|---|---|---|
| `ASSESSED` | มีผลประเมินที่ใช้ได้และถึงเกณฑ์ที่กำลังเทียบ | แสดงผลและ attemptId/เกณฑ์ ไม่เรียกว่าได้รับการรับรองความชำนาญทั้งหมด |
| `GAP` | มีผลประเมินต่ำกว่าเกณฑ์ | ส่วนต่างจริงใช้ค้นคอร์ส |
| `NOT_ASSESSED` | ยังไม่มีผลที่ใช้ได้ | คะแนน null, ไม่มีช่องว่างที่ระบบเดา, เสนอแบบทดสอบหรือแจ้งว่ายังไม่มีข้อสอบ |

ผลที่นำมาใช้: รอบ `COMPLETED`, snapshot `skillAssessmentVersion=1`, `gradingMode=PLATFORM_AUTOMATED`, `assessmentType=PRACTICAL_CODING`, ทักษะและเกณฑ์/criteriaHash ครบ, automated test cases ทุกข้อ หรือ HUMAN_REVIEWED สำหรับชุดที่มี open-ended เลือกผลล่าสุดที่เข้าเงื่อนไขตาม completedAt ต่อ skillId (กรณีเวลาเท่ากันใช้ id เพื่อให้ผลคงที่) ไม่ใช้คะแนนสูงสุดใน CandidateSkill

รอบกำลังทำ รอตรวจ ล้มเหลว หมดเวลา ผลทฤษฎี ผลบริษัท และผลเก่าที่ไม่มี skill binding ไม่ถูกแปลงเป็นคะแนนเชิงปฏิบัติส่วนกลาง ประวัติเหล่านั้นยังคงอยู่และอ่านตามสิทธิ์เดิม รอบที่กำลังทำใหม่ไม่ลบผลเก่าที่เข้าเงื่อนไข ส่วนผลจริง 0 เป็นผลที่ประเมินแล้วและอาจสร้าง GAP ได้

คะแนนผ่านในโปรไฟล์เป็นเกณฑ์ข้อสอบ; matching ใช้ minimumScore ของงาน; แผนตามอาชีพใช้ค่าสูงสุดที่งานที่เกี่ยวข้องระบุ เกณฑ์ต่างกันอาจทำให้สถานะต่างกัน จึงคืนค่าที่ใช้เทียบทุกครั้ง ต้องให้ผู้เชี่ยวชาญสอบเทียบความเทียบเคียงระหว่างข้อสอบต่างชุดในทักษะเดียวกันก่อนใช้ตัดสินจริง

## 3. สัญญา API

- `POST /github/sync`: เก็บ repositories/languagesBreakdown และหลักฐานเครื่องมือ ไม่สร้างคะแนน แสดงผลประเมินแยกตาม skill views
- API public analyzer: คืน detectedSkills เป็นชื่อบริบท, assessmentStatus=NOT_ASSESSED; radar/topSkillChips/recommendedRoles เป็นรายการว่างเพื่อเลิกสรุปความชำนาญหรือ career fit จาก GitHub; topRepositories มี languages และ languageComposition (`language`, `bytes`, `repositoryCodePercentage`)
- `GET /candidate/profile`, profile update และ company profile: `assessmentScore: number|null`, `assessmentStatus`, `assessmentResult` (attemptId, assessmentId, assessmentVersion, assessedAt, criteria, qualityStatus), `hasGithubEvidence`; practicalScore/verifiedScore ใน view เป็น null ส่วนค่าที่เก็บเดิมไม่ถูกลบ
- `GET /candidate/radar`: score เป็น number|null ต่อหมวด หน้าเว็บไม่วาด null เป็นศูนย์ และอธิบายว่าเฉลี่ยเฉพาะผลที่มี
- `GET /jobs`: matchScore เป็น number|null พร้อม `matchAssessment` เต็มรูปแบบสำหรับผู้สมัคร; เรียงคะแนนที่คำนวณไม่ได้ไว้ท้าย ไม่เติม 40
- `GET /jobs/:id`: matchScore เป็น object รายละเอียดเดิม แต่มี `status`, `scoreSource=ASSESSMENT`, `assessedCount`, `totalSkills`, `assessmentCoverage`, `unassessedSkills` เพิ่ม และ matchScore ภายใน nullable
- `matchedSkills`: ผลถึงเกณฑ์งาน; `missingSkills`: มีผลต่ำกว่าเกณฑ์; ทั้งสองมี userScore และ attemptId; `unassessedSkills`: userScore=null พร้อม reason `NO_ELIGIBLE_RESULT` หรือ `INVALID_JOB_CRITERION`
- `requiredCoverage/preferredCoverage`: ค่าเฉลี่ยเครดิตของผลที่มีในกลุ่มนั้น ไม่ใช่ความครอบคลุมการสอบ; กลุ่มไม่มีผลเป็น null ส่วน `assessmentCoverage` จึงเป็นตัวเลขที่ต้องแสดงคู่คะแนน; `careerAlignment=null` ไม่เพิ่มคะแนนจากคำเป้าหมาย
- `GET /recommendations/skill-gaps`: คืน gaps เฉพาะช่องว่างจริง, assessmentPlan, unassessedSkills, relevantJobCount, basis, priorityLimit และ benchmarkPolicy; ไม่มีงานตรงเป้าหมายไม่ fallback ไป Full Stack
- ใบสมัครใหม่เก็บ `matchAssessmentSnapshot` พร้อม policyVersion=1 และข้อมูล matching ทั้งชุด ใบสมัครเก่า snapshot=null: API คืน matchScoreAtApplication=null, UI/CSV แจ้งว่าไม่มีผลจับคู่จากการประเมินของนโยบายใหม่ ข้อมูลเดิมยังอยู่ในฐานข้อมูลเพื่อ audit

สูตร: เครดิตรายทักษะ = min(1, ผล/เกณฑ์)×100; เฉลี่ยแยกกลุ่มจำเป็น/เสริม แล้วถ่วง 0.7/0.2 เฉพาะกลุ่มที่มีผลและหารด้วยผลรวมน้ำหนักที่ใช้ ไม่เติม 0 หรือ 100 ให้ทักษะที่ยังไม่สอบ ไม่มีผลหรือไม่มี requirement คืน null/AWAITING_ASSESSMENT มีบางส่วนคืน PRELIMINARY พร้อม coverage; มีครบคืน ASSESSED ซึ่งไม่ได้แปลว่าผ่านทุกข้อ

ตัวอย่างผลเพียง 1 จาก 2 ทักษะและผ่านเกณฑ์: matchScore=100, status=PRELIMINARY, assessedCount=1, totalSkills=2, assessmentCoverage=50, อีกทักษะ userScore=null ไม่มีคอร์สจากทักษะที่ยังไม่ประเมิน

## 4. หลักฐานเลือกทักษะและการใช้ข้อสอบเดิม

ตรวจฐานข้อมูลที่เครื่องตั้งค่าไว้แบบอ่านอย่างเดียว: งาน isActive 107 งาน มีข้อสอบแพลตฟอร์มที่ active 2 ชุด: ทฤษฎี TypeScript (4 ข้อ) และ practical coding ผูก JavaScript (2 ข้อ) ไม่ได้สร้างข้อสอบใหม่หรือเขียนข้อมูลผู้สมัคร

ทดสอบการจัดลำดับด้วยรายการงานจริงและไม่มีผลผู้สมัครจำลอง โดยยังไม่ query ข้อสอบเต็มเพราะ schema เดิมขาด frameworkCode:

| เป้าหมาย | งานตรงเงื่อนไข | ทักษะสำคัญที่คัดได้ (จำนวนงานที่พบ) |
|---|---:|---|
| Full Stack Developer | 44 | React 34, JavaScript 33, Node.js 33, TypeScript 27, SQL 23 |
| Frontend Developer | 38 | React 35, JavaScript 29, TypeScript 25, Git 19, CSS3 18 |
| Backend Developer | 20 | PostgreSQL 15, JavaScript 13, Node.js 12, TypeScript 10, Docker 9 |
| DevOps Engineer | 6 | AWS 4, Kubernetes 4, CI/CD 3, Node.js 3, PostgreSQL 3 |

ตัวเลขนี้เป็น snapshot ของข้อมูลวันที่ตรวจ ไม่ใช่สถิติตลาดแรงงานทั้งหมด การคัดเลือกใช้ requiredJobCount ก่อนจำนวนงานรวม จึงไม่จำเป็นต้องเรียงตามตัวเลขในวงเล็บ ระบบเลือกใหม่จากข้อมูลเมื่อเรียก API ไม่ hardcode รายการนี้

JavaScript จึงเป็นทักษะนำร่องที่มีทั้งความต้องการและข้อสอบเดิมรองรับ การแนะนำแต่ละทักษะยังตรวจความพร้อมทางโครงสร้างของข้อสอบก่อนเสนอ และไม่แปลงข้อสอบ JavaScript ให้รับรอง React/Node.js/TypeScript โดยอัตโนมัติ ทักษะอื่นไม่มีข้อสอบให้แจ้งรอจัดทำ/ทบทวน

ตรวจข้อสอบในฐานข้อมูลจริงและพบ starter code มีเฉลย พร้อมอินพุต palindrome ที่ถูกแยกผิด จึงแก้ชุดเดิมเป็นรุ่น 2 ใน `prisma/assessment-bank/javascript-sandbox.json`: starter เป็นโครงเปล่า, solutionCode แยกฝั่งเซิร์ฟเวอร์, อินพุต JSON argument arrays, rubric และป้าย PENDING_EXPERT_REVIEW_AND_PILOT ใช้สคริปต์ซ่อมเฉพาะชุดเดิมโดยไม่รัน seed ทับข้อมูล ผลทดสอบ Judge0 จริงผ่าน 11/11 กรณี แต่ยังไม่ใช่การยืนยัน content validity/reliability หรือการทดลองกับกลุ่มผู้สมัคร

อ้างอิงขอบเขตเครื่องมือ: [GitHub repository languages](https://docs.github.com/en/rest/repos/repos#list-repository-languages) รายงาน bytes ต่อภาษา ส่วน [Judge0 API](https://ce.judge0.com/) เป็นบริการรันโค้ดใน sandbox และคืนผล execution การใช้บริการดังกล่าวไม่ได้พิสูจน์ความเที่ยงตรงของข้อสอบ

## 5. Migration และการเปิดใช้

การทบทวน AI รอบต่อมาพบข้อจำกัดของ bank v2 และจัดทำ v3 สำหรับ staging เท่านั้น ดู [ข้อค้นพบ](ASSESSMENT_AI_REVIEW_20261027.md) และ [การแก้และทดสอบ v3](ASSESSMENT_V3_STAGING.md) ใช้ rubric แบบ criterion gate และ typed return contract โดยไม่มี schema migration ใหม่ ไม่เปลี่ยนคะแนนเดิม และไม่ถือว่าได้ผ่าน expert validation

ขั้นตอน production ฉบับเต็ม รวมถึง bank patch, migration history และ recovery: [คู่มืออัปเกรดฐานข้อมูล](PRODUCTION_ASSESSMENT_UPGRADE.md) การเริ่ม API/Docker ไม่แก้ schema อัตโนมัติ

SQL ใหม่เปลี่ยนเพียงคอลัมน์คะแนนใบสมัครให้รับ null, เอา default 0 ออก และเพิ่ม JSONB snapshot ไม่มี DELETE, UPDATE คะแนนเดิม หรือการ backfill ผลสอบที่เดาที่มา การเพิ่มคอลัมน์ใช้ IF NOT EXISTS เพื่อรันซ้ำได้

การเตรียมขยาย bank production ในขั้นถัดมาเพิ่ม migration `202610270003_assessment_bank_revisions` สำหรับ archive โจทย์/เกณฑ์เดิมแบบ backend-only โดยไม่ rewrite ผลสอบ รายละเอียด API และการซ้อม 1 → 2 ข้ออยู่ใน [รายงาน staging](ASSESSMENT_EXPANSION_STAGING.md) จึงต้องใช้ลำดับ SQL ปัจจุบันครบก่อนเริ่ม API รุ่นใหม่

อัปเกรดฐานข้อมูล local `smartcareer` จริงแล้วเมื่อ 27 ตุลาคม 2569: เพิ่ม framework fields ที่เคยทำให้เกิด P2022, เปลี่ยนคะแนนใบสมัครเป็น nullable/เพิ่ม snapshot และเพิ่ม enum SALES/COORDINATION/WRITING ที่มีใน schema เดิมแต่ยังขาดในฐานข้อมูล ตรวจ Prisma schema diff แล้วไม่พบความต่าง สำรองและทดลอง restore ก่อนทดสอบจริง รายละเอียดและหลักฐานอยู่ใน [รายงานทดสอบจริง](LIVE_JUDGE0_VERIFICATION.md)

สำหรับฐานข้อมูลเดิมที่เริ่มด้วย db push และยังไม่มี Prisma migration history: สำรองข้อมูล ตรวจสภาพแวดล้อมเป้าหมาย แล้วใช้ SQL แบบไม่ทำลายข้อมูลตามลำดับ:

```powershell
npx prisma db execute --schema prisma/schema.prisma --file scripts/sql/assessment-framework.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/202610270001_assessment_matching/migration.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/202610270002_skill_categories/migration.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/202610270003_assessment_bank_revisions/migration.sql
npm run prisma:generate
npm run build
```

หากใช้ Prisma Migrate อยู่แล้ว ต้องตรวจ baseline/history ให้ตรงก่อน `migrate deploy` ไม่สร้าง initial migration ย้อนหลังหรือ reset ฐานข้อมูลที่มีข้อมูล ไม่ใช้ `db push --accept-data-loss` และไม่รัน seed ทับ production

ทดสอบ migration แบบไม่กระทบตารางจริงด้วย `node scripts/verify-assessment-migration.cjs`: จำกัด search_path เป็น pg_temp, สร้างตารางชั่วคราวพร้อมคะแนนเดิม 85, รัน SQL migration, ยืนยันคะแนนเดิมยังอยู่และแถวใหม่มี null แล้ว rollback ทั้ง transaction

## 6. การตรวจรับและข้อจำกัดการทดสอบ

ชุดทดสอบ `tests/skill-assessment.spec.cjs` ตรวจไม่มีผล/ศูนย์จริง/ผลบางส่วน/ผลครบ, เกณฑ์ไม่ถูกต้อง, กลุ่มว่าง, รอบล่าสุด/รอตรวจ/หมดเวลา/ผลบริษัท/ข้อมูลเก่า, single-batch parity, คอร์สจากช่องว่างจริงเท่านั้น, ไม่ใช้ cache, ใบสมัครเก่า, hash เกณฑ์ และการไม่เปิด hidden cases รวมทั้งเส้นทาง start → ตรวจผ่าน Judge0 adapter จำลอง → matching พร้อม attemptId

แก้ expectation เดิมที่ผูกกับสูตร GitHub ใน `tests/company-development.spec.cjs`, `tests/uat-fixes.spec.cjs` และเพิ่มชุดใหม่ใน `package.json` ไม่ลดการตรวจสิทธิ์หรือการเก็บประวัติ ผลตรวจ: shared build ผ่าน, API build ผ่าน, Next.js production build พร้อม lint/type checking ผ่าน; `npm test` ผ่าน security 19 และ UAT/regression 150 รวม 169 รายการ (รวมชุดนโยบายใหม่ 12 รายการ); migration smoke test บนตารางชั่วคราวผ่านและ rollback; `git diff --check` ไม่พบข้อผิดพลาด whitespace

การทดสอบต่อยอดหลังอัปเกรด: API และหน้าจอส่งคำตอบไป Judge0 จริง ตรวจคะแนน 50 → 100, matching coverage 1/11, คอร์สจาก measured gap และการล้างช่องว่างหลังสอบซ้ำผ่าน ทดสอบบนฐานสำเนาที่กู้จาก backup ของ local จริง ใช้ dev OAuth เฉพาะบัญชี QA จึงไม่อ้างว่าได้ทดสอบ GitHub OAuth จริง ดู [หลักฐานและข้อจำกัด](LIVE_JUDGE0_VERIFICATION.md) ชุด regression เพิ่มเป็น 172 รายการ (security 20 + UAT 152)

## 7. เรื่องที่ต้องให้ผู้เชี่ยวชาญ/เจ้าของระบบตัดสินใจ

1. ตรวจโจทย์เดิม, starter code, test inputs/expected outputs, rubric, ความครอบคลุมทักษะ และทดลองใช้กับกลุ่มเล็กก่อนใช้คัดผู้สมัครจริง
2. สอบเทียบ passingScore/minimumScore ระหว่างข้อสอบกับงาน รวมถึงน้ำหนัก 70:20 และการใช้เกณฑ์สูงสุดจากกลุ่มงาน นโยบายเหล่านี้ยังไม่ผ่านการยืนยันเชิงประจักษ์
3. กำหนดอายุผลประเมิน วิธีเลือกผลล่าสุดข้ามข้อสอบในทักษะเดียวกัน และหลักเกณฑ์นำผลเก่ามาใช้เมื่อมีหลักฐาน skill binding ที่ตรวจสอบได้
4. ตัดสินใจว่าจะอนุญาตใช้ผลบริษัทหรือทฤษฎีในคะแนนส่วนกลางภายใต้สิทธิ์/ความยินยอมและความเทียบเคียงแบบใด ปัจจุบันแยกออกอย่างชัดเจน
5. กำหนด baseline/rollout สำหรับสภาพแวดล้อมอื่นก่อนนำ SQL ไปใช้ การอัปเกรดและทดสอบ local เสร็จแล้ว; ยังไม่ใช่การ deploy ไปบริการ production
