# SmartCareer — โครงสร้างระบบ ฟีเจอร์ และความสัมพันธ์ของข้อมูล

เอกสารนี้สรุปโครงสร้างและพฤติกรรมที่พบในโค้ดของ SmartCareer เพื่อใช้ทำความเข้าใจว่าแต่ละส่วนทำหน้าที่อะไร และข้อมูลจากส่วนหนึ่งไหลไปเชื่อมกับอีกส่วนอย่างไร อ้างอิงจาก source code และ Prisma schema ใน repository นี้

## ภาพรวมสถาปัตยกรรม

โปรเจกต์เป็น monorepo ใช้ npm workspaces แยกเว็บ แอป API และชนิดข้อมูลที่ใช้ร่วมกัน เว็บเรียก API ผ่าน HTTP/JSON โดย API ใช้ Prisma อ่านและเขียน PostgreSQL

~~~mermaid
flowchart LR
  Browser["Browser"] --> Web["apps/web<br/>Next.js App Router"]
  Web -->|"HTTP JSON + Bearer JWT"| API["apps/api<br/>NestJS /api"]
  API --> Prisma["Prisma Client"]
  Prisma --> DB[("PostgreSQL")]
  API --> Ext["GitHub, OAuth, Judge0, Gemini,<br/>job และ course providers"]
  Scheduler["NestJS Scheduler"] --> API
  Shared["packages/shared<br/>types และ contracts"] -.-> Web
  Shared -.-> API
~~~

## โครงสร้างไดเรกทอรี

| ตำแหน่ง | หน้าที่ |
|---|---|
| apps/web/app | หน้าเว็บและ route ของ Next.js สำหรับผู้สมัคร บริษัท และผู้ดูแลระบบ |
| apps/web/components | ส่วน UI ที่ใช้ซ้ำ เช่น Navbar, Footer, NotificationBell และหน้าแรก |
| apps/web/lib | API client และ Auth Context; token ถูกเก็บใน localStorage ภายใต้ชื่อ smartcareer_token |
| apps/api/src | NestJS API แบ่งตาม feature/module เช่น auth, jobs, assessments, ingestion และ notifications |
| apps/api/config | ค่า quota สำหรับการดึงข้อมูลภายนอก |
| packages/shared/src | enum, interface และ data contracts ที่แชร์ระหว่างเว็บกับ API |
| prisma/schema.prisma | ตาราง ความสัมพันธ์ enum และข้อกำหนด unique/index ของฐานข้อมูล |
| prisma/seed.ts, seed-production.ts | ข้อมูล seed สำหรับสภาพแวดล้อมทั่วไปและ production |
| scripts | สคริปต์ seed, audit และตรวจสอบระบบ; เอกสาร UAT อยู่ใน docs/uat |
| docs | คู่มือ deployment, UAT และเอกสารภาพรวมฉบับนี้ |

คำสั่งหลักจาก package.json ที่ root: npm run dev:web, npm run dev:api, npm run build, npm run prisma:seed และ npm run prisma:studio เว็บใช้ Next.js 14, API ใช้ NestJS 10 และ Prisma 5 ตาม package manifests

## ฟีเจอร์ตามบทบาทและหน้าเว็บ

| บทบาท/พื้นที่ | หน้าเว็บหลัก | ความสามารถ |
|---|---|---|
| สาธารณะ | /, /jobs, /jobs/[id], /courses, /login, /register | ดูงานและคอร์ส ค้นหางาน ดูรายละเอียด ทดลองวิเคราะห์ GitHub สาธารณะจากหน้าแรก และเข้าใช้งาน/สมัครสมาชิก |
| ผู้สมัคร | /profile, /assessments, /assessments/[id], /applications | จัดการโปรไฟล์และ career target เชื่อม GitHub ดูทักษะ/หลักฐาน ทำแบบประเมิน สมัครงาน ติดตามสถานะ และอ่านการแจ้งเตือน |
| บริษัท | /company/dashboard, /company/profile, /company/jobs, /company/jobs/new, /company/applications, /company/assessments | ตั้งค่าและส่งข้อมูลยืนยันบริษัท ประกาศงาน ดูผู้สมัคร เปลี่ยนสถานะ มอบหมาย assessment และบันทึกผลประเมิน |
| ผู้ดูแลระบบ | /admin/dashboard, /admin/users, /admin/skills, /admin/assessments, /admin/verifications, /admin/ingestion | ดูภาพรวม จัดการผู้ใช้และ master skills ตรวจบริษัท จัดการ assessment และควบคุมการนำเข้าข้อมูล |

API เปิดใช้งานใต้ prefix /api แต่ละ feature มี NestJS module/controller/service ของตัวเอง กลุ่ม endpoint หลักคือ /auth, /candidate, /company, /admin, /jobs, /applications, /assessments, /skills, /github, /evaluations, /recommendations, /ingestion, /notifications และ /health Auth ใช้ JWT และ RolesGuard จำกัดเส้นทางที่ต้องเป็น CANDIDATE, COMPANY หรือ ADMIN; บางเส้นทาง เช่น ค้นงานและรายการ assessment เปิดให้เรียกแบบ public

## ข้อมูลไหลเชื่อมกันอย่างไร

~~~mermaid
flowchart TD
  Profile["CandidateProfile<br/>เป้าหมายอาชีพ"] --> Github["GitHub sync"]
  Github --> Repos["GitHubRepository + GitHubEvidence"]
  Repos --> CandidateSkill["CandidateSkill<br/>คะแนนและสถานะยืนยัน"]
  PlatformAssessment["Platform Assessment"] --> Attempt["AssessmentAttempt + Answer"]
  Attempt --> CandidateSkill
  CandidateSkill --> Matching["Job matching"]
  JobSkills["Job + JobSkill"] --> Matching
  Profile --> Gaps["Skill gap ตาม career benchmark"]
  CandidateSkill --> Gaps
  Gaps --> Course["Course + CourseSkill"]
  Matching --> Application["JobApplication"]
  Application --> History["ApplicationStatusHistory"]
  Application --> AssignedTest["Assessment ที่มอบหมาย"]
  AssignedTest --> Attempt
  Application --> Evaluation["CompanyEvaluation"]
  Application --> Notice["Notification"]
  JobSources["แหล่งงานภายนอก/บริษัท"] --> Ingestion["Ingestion"]
  CourseSources["YouTube / Udemy"] --> Ingestion
  Ingestion --> JobSkills
  Ingestion --> Course
~~~

### เส้นทางหลักของข้อมูล

1. **โปรไฟล์และทักษะ:** CandidateProfile เก็บข้อมูลผู้สมัคร เป้าหมายอาชีพ การศึกษา และประสบการณ์ GitHub sync บันทึก repository และหลักฐาน แล้วสร้างหรือปรับ CandidateSkill ตาม skill ที่ตรวจพบ
2. **การยืนยันคะแนน:** แบบประเมินของแพลตฟอร์มที่ผูกกับ Skill บันทึก Attempt/Answer และนำผลทฤษฎีหรือโค้ดกลับไปปรับ CandidateSkill ส่วน assessment ของบริษัทใช้กับการคัดเลือกและการ review
3. **ค้นหาและจับคู่งาน:** Job มี JobSkill เป็นทักษะที่ต้องการ ระบบเทียบกับ CandidateSkill และ targetCareer แล้วส่งคะแนน รายการทักษะที่ตรง และช่องว่างกลับหน้าแสดงงาน เมื่อสมัครจะสร้าง JobApplication พร้อม matchScoreAtApplication
4. **การคัดเลือก:** บริษัทเปลี่ยนสถานะใบสมัครได้ตั้งแต่ APPLIED, REVIEWING, INTERVIEW, TECHNICAL_TEST, OFFER จนถึง ACCEPTED/REJECTED; ผู้สมัครยกเลิกได้ สถานะใหม่ถูกเก็บใน ApplicationStatusHistory และการเปลี่ยนสถานะของบริษัทสร้าง Notification ให้ผู้สมัคร
5. **แบบทดสอบรับสมัคร:** บริษัทเลือก assessment ที่ตนสร้างหรือ assessment ของแพลตฟอร์มเพื่อมอบหมายให้ application; ความพยายามทำข้อสอบอยู่ใน AssessmentAttempt และคำตอบอยู่ใน AssessmentAnswer ผล open-ended สามารถรอ AI หรือ human review ได้
6. **พัฒนาทักษะ:** ระบบเปรียบเทียบคะแนนผู้สมัครกับ benchmark ของ targetCareer เพื่อหา skill gap แล้วค้น Course ด้วยชื่อ/คำอธิบายหรือความสัมพันธ์ CourseSkill
7. **ข้อมูลภายนอก:** ingestion ดึงงานและคอร์ส จัดเป็น Job/Course และเชื่อมทักษะด้วย JobSkill/CourseSkill; แต่ละรอบสร้าง IngestionLog สำหรับสรุปจำนวนข้อมูลและข้อผิดพลาด

## แบบจำลองข้อมูล

schema มี 25 models แบ่งตามโดเมนดังนี้

| โดเมน | Models | ความหมาย/ความสัมพันธ์สำคัญ |
|---|---|---|
| บัญชีและองค์กร | User, CandidateProfile, Company, CompanyMember, CompanyVerification | User มี CandidateProfile ได้หนึ่งรายการ; สมาชิกบริษัทเชื่อม User กับ Company; CompanyVerification เก็บคำขอและผลตรวจบริษัท |
| ทักษะและหลักฐาน | Skill, CandidateSkill, GitHubRepository, GitHubEvidence, SkillFramework, SkillFrameworkItem | CandidateSkill เชื่อมผู้สมัครกับ Skill พร้อมคะแนน; GitHubEvidence เชื่อม CandidateSkill กับ Repository; SkillFrameworkItem เชื่อม framework กับ Skill |
| ตลาดงาน | Job, JobSkill, JobApplication, JobFavorite, ApplicationStatusHistory | Job เชื่อม Company ได้ (งานภายนอกอาจไม่มี Company); JobSkill เชื่อม Job กับ Skill; JobApplication เชื่อมงานและผู้สมัคร; ประวัติและรายการโปรดแยกเก็บ |
| การประเมิน | Assessment, Question, Choice, AssessmentAttempt, AssessmentAnswer, CompanyEvaluation | Assessment มีคำถามและ attempts; Choice รองรับข้อสอบปรนัย; CompanyEvaluation เก็บ feedback ต่อ application ได้หนึ่งรายการ |
| การเรียนรู้และระบบปฏิบัติการ | Course, CourseSkill, IngestionLog, Notification | Course เชื่อม Skill ผ่าน CourseSkill; IngestionLog เก็บผล sync; Notification เป็นของ User |

ความสัมพันธ์หลักของฐานข้อมูลแสดงแบบย่อ:

~~~mermaid
erDiagram
  USER ||--o| CANDIDATE_PROFILE : owns
  USER ||--o{ COMPANY_MEMBER : member
  COMPANY ||--o{ COMPANY_MEMBER : has
  COMPANY ||--o{ COMPANY_VERIFICATION : verifies
  CANDIDATE_PROFILE ||--o{ CANDIDATE_SKILL : has
  SKILL ||--o{ CANDIDATE_SKILL : measures
  CANDIDATE_PROFILE ||--o{ GITHUB_REPOSITORY : owns
  CANDIDATE_SKILL ||--o{ GITHUB_EVIDENCE : supported_by
  GITHUB_REPOSITORY ||--o{ GITHUB_EVIDENCE : contains
  JOB ||--o{ JOB_SKILL : requires
  SKILL ||--o{ JOB_SKILL : requested
  COMPANY ||--o{ JOB : publishes
  CANDIDATE_PROFILE ||--o{ JOB_APPLICATION : submits
  JOB ||--o{ JOB_APPLICATION : receives
  CANDIDATE_PROFILE ||--o{ JOB_FAVORITE : saves
  JOB ||--o{ JOB_FAVORITE : favorited
  JOB_APPLICATION ||--o{ APPLICATION_STATUS_HISTORY : records
  JOB_APPLICATION ||--o| COMPANY_EVALUATION : evaluated
  CANDIDATE_PROFILE ||--o{ COMPANY_EVALUATION : receives
  COMPANY ||--o{ COMPANY_EVALUATION : writes
  ASSESSMENT o|--o{ JOB : custom_test
  ASSESSMENT o|--o{ JOB_APPLICATION : assigned_test
  ASSESSMENT ||--o{ QUESTION : contains
  QUESTION ||--o{ CHOICE : offers
  CANDIDATE_PROFILE ||--o{ ASSESSMENT_ATTEMPT : takes
  ASSESSMENT ||--o{ ASSESSMENT_ATTEMPT : assigned
  ASSESSMENT_ATTEMPT ||--o{ ASSESSMENT_ANSWER : records
  COURSE ||--o{ COURSE_SKILL : teaches
  SKILL ||--o{ COURSE_SKILL : covered
  USER ||--o{ NOTIFICATION : receives
~~~

ฟิลด์ Json ใช้กับข้อมูลที่มีโครงสร้างยืดหยุ่น เช่น education/experience ของโปรไฟล์, topics และ languagesBreakdown ของ repository, testCases/rubric ของคำถาม, snapshot/draftCode/integrityEvents ของ attempt และ documents/metadata บางรายการ ส่วนความสัมพันธ์ระหว่างตารางหลักใช้ foreign key และมี unique constraints เช่น email, GitHub username, candidate-skill, job-skill, course-skill และ job/candidate/roundNumber

## กติกาคำนวณที่เชื่อมฟีเจอร์

- **คะแนนทักษะ:** CandidateSkill แยก practicalScore, theoryScore, codingScore และ verifiedScore; สูตรรวมที่ใช้ใน GitHub sync/assessment คือ practical 50% + theory 20% + coding 30% และมี isVerified/verifiedAt กำกับ
- **Job match:** 70% required skill coverage + 20% preferred skill coverage + 10% career alignment; ทักษะ required นับคะแนนตามระดับขั้นต่ำ ส่วน preferred ใช้เกณฑ์พบ/ไม่พบ และ career alignment เช็กคำร่วมระหว่าง targetCareer กับชื่อตำแหน่ง
- **Skill gap:** ใช้ benchmark ที่กำหนดไว้ใน RecommendationsService สำหรับ Full Stack, Frontend, Backend และ DevOps; ถ้า targetCareer ไม่ตรงกับรายการจะใช้ Full Stack Developer เป็นค่าเริ่มต้น แล้วเลือก gap ที่มากกว่า 5 คะแนน
- **Course recommendation:** ใช้ CourseSkill หรือค้นจากชื่อ/คำอธิบายคอร์สที่ตรงกับทักษะที่ขาด
- **ความคงทนของข้อสอบ:** Attempt เก็บ assessmentVersion และ snapshot ของเกณฑ์/คำถามที่ใช้เริ่มทำ เพื่อแยกผลของการสอบครั้งนั้นออกจากการแก้ assessment ภายหลัง

## งานเบื้องหลังและบริการภายนอก

- งานดึงข้อมูลตั้งเวลา 00:00 น. ตาม Asia/Bangkok จาก JSearch, JobsDB, JobThai, Blognone และ Remotive; คอร์สจาก YouTube และ Udemy
- ทำความสะอาดงานปิดแล้วทุกวัน 00:30 น. และคอร์สที่ปิด/ถูกลบทุกวัน 00:35 น. ตาม Asia/Bangkok
- การดึงงานสร้าง Job และติดแท็ก JobSkill; การดึงคอร์สสร้าง Course และเชื่อม CourseSkill; deduplication ใช้ source/externalId และ/หรือชื่อกับบริษัทสำหรับงาน และ provider/externalId สำหรับคอร์ส
- Integration ที่พบในโค้ด: GitHub API สำหรับ OAuth/ข้อมูล repository, Google OAuth, Judge0 สำหรับรันโค้ด, Gemini/Google GenAI สำหรับประเมินคำตอบแบบ open-ended, JSearch API, Remotive, Blognone, JobsDB, JobThai, YouTube และ Udemy
- API มี readiness endpoint ที่ตรวจการเชื่อมต่อฐานข้อมูล: /api/health และ /api/health/ready

## หมายเหตุจากการเทียบเอกสารกับโค้ด

- README ระบุว่าคะแนน GitHub ประกอบจาก usage/dependencies/commits/diversity แต่ GitHubService ปัจจุบันคำนวณ practicalScore จากจำนวนดาว repository และ scoreWeight ของ skill ที่ตรวจพบ โดยจำกัดคะแนนไว้ระหว่าง 50–95; ค่า commitCount และ linesOfCode ที่บันทึกใน GitHubEvidence ถูกสร้างด้วยค่ากึ่งสุ่มใน sync ปัจจุบัน
- README ระบุว่า feedback บริษัทเชื่อมเข้า skill gap แต่ EvaluationsService บันทึก CompanyEvaluation แยกกับใบสมัคร ขณะที่ RecommendationsService คำนวณ gap จาก career benchmark และ CandidateSkill โดยยังไม่อ่านคะแนน/feedback บริษัท
- README ระบุ 24 Prisma models; schema ปัจจุบันมี 25 models รวม Notification
- source งานที่ตั้งเวลาใน Scheduler รวม JSearch, JobsDB และ JobThai เพิ่มจาก Remotive/Blognone ที่กล่าวใน README
- README อ้างถึงหน้า /skills แต่ใน apps/web/app ไม่มี route นี้; คะแนนและข้อมูลทักษะของผู้สมัครอยู่ในหน้า /profile

สำหรับรายละเอียดตามการใช้งานจริง โปรดดู [คู่มือ UAT](uat/00_UAT_MASTER_INDEX.md), [README หลัก](../README.md), [Prisma schema](../prisma/schema.prisma), [API modules](../apps/api/src/app.module.ts) และหน้าเว็บใต้ apps/web/app
