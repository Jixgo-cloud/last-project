# ขยายหัวข้อ 3: โมดูลส่งข้อมูลอะไรกันบ้าง

เอกสารนี้ขยายหัวข้อ “ส่วนต่าง ๆ ของระบบเชื่อมกันอย่างไร” จาก [คู่มือระบบ](MODULE_INTERACTIONS.md) โดยระบุให้เห็นว่าแต่ละส่วนส่งข้อมูลอะไรให้กัน และข้อมูลส่วนใดถูกฝากไว้ในฐานข้อมูลกลางเพื่อให้โมดูลอื่นอ่านต่อ

## อ่านแผนผังอย่างไร

เส้นลูกศรมีสองแบบ:

- **เรียกกันโดยตรง** — โมดูลหนึ่งส่งค่าหรือคำขอให้อีกโมดูลทำงาน แล้วรับผลกลับ เช่น ขอคะแนนจับคู่งาน
- **ส่งผ่านฐานข้อมูลกลาง** — โมดูลหนึ่งบันทึกข้อมูลลงฐานข้อมูล อีกโมดูลมาอ่านภายหลัง จึงไม่จำเป็นต้องเรียกกันโดยตรง

ใน SmartCareer วิธีที่สองเป็นวิธีหลัก: หลายโมดูลใช้ระเบียนชุดเดียวกันในฐานข้อมูลเพื่อเชื่อมกระบวนการ

## 1. โมดูลเรียกใช้กันโดยตรง

~~~mermaid
flowchart LR
  Jobs["JobsModule<br/>ค้นและแสดงงาน"] -->|"candidateId + รายการงานและ JobSkill"| Matching["MatchingModule<br/>คิดคะแนนจับคู่"]
  Matching -->|"คะแนนรวม, coverage, ทักษะตรง/ขาด"| Jobs

  Applications["ApplicationsModule<br/>สร้างใบสมัคร"] -->|"candidateId + jobId"| Matching
  Matching -->|"MatchScoreResult"| Applications

  Company["CompanyModule<br/>หน้าและขั้นตอนบริษัท"] -->|"userId ของผู้สมัคร"| Candidate["CandidateModule<br/>คำนวณ radar"]
  Candidate -->|"คะแนนตามหมวดทักษะ"| Company

  Company -->|"userId ผู้รับ + ประเภท/หัวข้อ/ข้อความ/ลิงก์"| Notifications["NotificationsModule"]
  Notifications -->|"รายการแจ้งเตือนที่สร้าง"| Company

  Scheduler["SchedulerModule<br/>งานตามเวลา"] -->|"แหล่งงานหรือ provider ของคอร์ส"| Ingestion["IngestionModule<br/>ดึงข้อมูลงานและคอร์ส"]
  Ingestion -->|"IngestionLog: สถานะและจำนวนรายการ"| Scheduler

  Scheduler -->|"เงื่อนไขตรวจงานปิด"| JobScreening["ตรวจงานปิดแล้ว"]
  Scheduler -->|"เงื่อนไขตรวจคอร์สปิด"| CourseScreening["ตรวจคอร์สปิดแล้ว"]
~~~

### รายละเอียดข้อมูลที่ส่งในแต่ละเส้น

| ผู้ส่ง → ผู้รับ | สิ่งที่ส่ง | สิ่งที่ได้รับกลับ | ใช้ทำอะไร |
|---|---|---|---|
| JobsModule → MatchingModule | รหัสผู้สมัคร และงานที่มีรายการทักษะของงาน | คะแนนของแต่ละงานจากการคำนวณแบบกลุ่ม หรือคะแนนและรายละเอียดเมื่อขอทีละงาน | เรียงงานตามความเหมาะสมและแสดง matched/missing skills |
| ApplicationsModule → MatchingModule | รหัส CandidateProfile และรหัส Job | ผล MatchScoreResult ของงานนั้น | เก็บคะแนนไว้ใน JobApplication.matchScoreAtApplication เพื่อเป็นภาพ ณ เวลาที่สมัคร |
| CompanyModule → CandidateModule | userId ของผู้สมัครที่บริษัทกำลังเปิดดู | radar points แยกตามหมวดทักษะ | แสดงสรุปทักษะประกอบหน้าโปรไฟล์ผู้สมัคร |
| CompanyModule → NotificationsModule | userId ผู้สมัคร, ประเภทการแจ้งเตือน, หัวข้อ, ข้อความ และอาจมีลิงก์/ข้อมูลประกอบ | ระเบียน Notification ที่บันทึกแล้ว | แจ้งผู้สมัครเมื่อบริษัทเปลี่ยนสถานะใบสมัคร |
| SchedulerModule → IngestionModule | แหล่งงานหรือ provider ของคอร์ส; รอบ cron ใช้ quota ที่ IngestionConfigService ตั้งไว้ | IngestionLog ที่สรุปสำเร็จ/บางส่วน/ล้มเหลว จำนวนเพิ่ม/ซ้ำ/ผิดพลาด | ทำงานนำเข้าประจำวันและตรวจย้อนหลังได้ |
| SchedulerModule → JobScreeningService / CourseScreeningService | ขอบเขตข้อมูลที่จะตรวจ จำนวนรายการ และโหมดจัดการรายการที่ปิดแล้ว | จำนวนที่ตรวจพบและลบ/ปิดใช้งาน | ทำความสะอาดประกาศงานหรือคอร์สที่ไม่เปิดใช้งานแล้ว |

ผู้ดูแลเรียกงานนำเข้าผ่าน **IngestionController** ซึ่งอยู่ใน IngestionModule เช่น ส่ง source/provider, limit, skillId หรือ keyword; ไม่ได้เป็นการเรียก IngestionModule จาก AdminService โดยตรง

การให้คะแนนผู้สมัครจากหน้า company ก็เป็นคำขอแยก: หน้าเว็บส่งข้อมูลไปที่ /evaluations เพื่อให้ EvaluationsModule บันทึก CompanyEvaluation โดยตรง ไม่ใช่ CompanyModule เรียก EvaluationsModule

| ผู้ส่ง → ผู้รับ | สิ่งที่ส่ง | สิ่งที่ได้รับ/บันทึก |
|---|---|---|
| หน้าเว็บบริษัท → EvaluationsModule | applicationId, คะแนน 4 ด้าน, feedback, strengths และ areasForImprovement | CompanyEvaluation ที่ผูกกับใบสมัครนั้น |

## 2. ข้อมูลที่โมดูลส่งต่อผ่านฐานข้อมูล

เส้นทางด้านล่างเกิดจากโมดูลหนึ่งบันทึกข้อมูลไว้ แล้วอีกโมดูลอ่านข้อมูลแถวเดียวกันหรือข้อมูลที่เชื่อมกันด้วยรหัส

~~~mermaid
flowchart TD
  Auth["AuthModule"] -->|"User, CandidateProfile หรือ Company/CompanyMember"| DB[("ฐานข้อมูลกลาง")]
  Candidate["CandidateModule"] -->|"โปรไฟล์และ career target"| DB
  Github["GithubModule"] -->|"Repository, Evidence, Skill, CandidateSkill"| DB
  Assessments["AssessmentsModule"] -->|"Attempt, Answer และคะแนนสอบ"| DB
  Company["CompanyModule"] -->|"Company, Verification, Job/JobSkill, pipeline และ Assessment"| DB
  Applications["ApplicationsModule"] -->|"JobApplication, match snapshot, status history"| DB
  Evaluations["EvaluationsModule"] -->|"CompanyEvaluation"| DB
  Ingestion["IngestionModule"] -->|"Job/JobSkill, Course/CourseSkill, Skill, IngestionLog"| DB
  Admin["AdminModule"] -->|"อ่าน/ดูแลข้อมูลหลายโดเมน"| DB

  DB -->|"User และโปรไฟล์/องค์กรเดิม"| Auth["AuthModule"]
  DB -->|"โปรไฟล์ ทักษะ และหลักฐานเดิม"| Candidate["CandidateModule"]
  DB -->|"CandidateProfile และ repository เดิม"| Github["GithubModule"]
  DB -->|"งาน/คอร์สเดิมและ master Skill"| Ingestion
  DB -->|"Skill และ SkillFramework"| Skills["SkillsModule"]
  DB -->|"โจทย์, คำตอบ, attempts และคะแนน"| Assessments["AssessmentsModule"]
  DB -->|"ข้อมูลบริษัท ผู้สมัคร ใบสมัคร และผลสอบ"| Company
  DB -->|"CandidateProfile, Job และใบสมัครล่าสุด"| Applications
  DB -->|"สมาชิกบริษัทและใบสมัครที่มีสิทธิ์ประเมิน"| Evaluations["EvaluationsModule"]
  DB -->|"โปรไฟล์และ CandidateSkill"| Matching["MatchingModule"]
  DB -->|"Job และ JobSkill"| Matching
  DB -->|"Job, JobSkill, รายการโปรด และคอร์ส"| Jobs["JobsModule"]
  DB -->|"ประวัติผู้สมัครและสถานะ"| CandidateView["หน้า Candidate / Company"]
  DB -->|"Career target + CandidateSkill + Course"| Recs["RecommendationsModule"]
  DB -->|"Course และ CourseSkill"| Jobs
  DB -->|"Notification ของผู้ใช้"| Notifications["NotificationsModule"]
  DB -->|"ตัวชี้วัดและประวัติการนำเข้า"| Admin
~~~

ฐานข้อมูลเป็นจุดร่วมของข้อมูล ไม่ใช่ตัวคำนวณ ตัวอย่างเช่น GithubModule บันทึกทักษะไว้ก่อน แล้ว MatchingModule จึงอ่านทักษะนั้นในเวลาค้นงาน

### เส้นทางข้อมูลสำคัญทีละชุด

| ข้อมูลเริ่มจาก | บันทึกเป็น | โมดูลที่นำไปใช้ต่อ | ความสัมพันธ์ |
|---|---|---|---|
| สมัครบัญชี/เข้าสู่ระบบ | User และ CandidateProfile หรือ Company กับ CompanyMember | Candidate, Company, Admin และระบบตรวจสิทธิ์ | บัญชีหนึ่งมีบทบาทกำหนดว่าผู้ใช้ทำงานส่วนใดได้ |
| โปรไฟล์ GitHub | GitHubRepository และ GitHubEvidence | Candidate, Company, Matching | Evidence บอกว่าพบ skill ใดใน repository ใด แล้วเชื่อมกับ CandidateSkill |
| ผลจาก GitHub/ข้อสอบ | CandidateSkill | Matching, Recommendations, Candidate, Company | หนึ่งแถวคือคะแนนของผู้สมัครหนึ่งคนต่อหนึ่ง Skill |
| ประกาศงานจากบริษัทหรือแหล่งงาน | Job และ JobSkill | Jobs, Matching, Applications | JobSkill แยกว่าทักษะใดจำเป็นหรือเป็นทักษะเสริม |
| คำขอสมัคร | JobApplication และ ApplicationStatusHistory | Company, Candidate, Evaluations, Notifications | ใบสมัครชี้ไปที่ผู้สมัครและงาน; ประวัติสถานะแยกเก็บทุกการเปลี่ยน |
| การมอบหมาย/ทำข้อสอบ | Assessment, AssessmentAttempt, AssessmentAnswer | Company, Candidate, Assessments และ Admin | Attempt ผูกผู้สอบกับข้อสอบ และ Answer เก็บคำตอบของแต่ละข้อ |
| การประเมินโดยบริษัท | CompanyEvaluation | Candidate และ Company | ประเมินหนึ่งรายการต่อใบสมัคร พร้อมคะแนนและข้อความ feedback |
| การนำเข้าคอร์ส | Course และ CourseSkill | Recommendations และ Jobs | CourseSkill ระบุว่าคอร์สช่วยฝึก Skill ใด |
| การเปลี่ยนสถานะโดยบริษัท | ApplicationStatusHistory และ Notification | Candidate และ Notifications | เก็บทั้งประวัติการเปลี่ยนและข้อความแจ้งผู้สมัคร |

## 3. ข้อมูลสำคัญที่อยู่ในผลตอบกลับ

### ผลจับคู่งาน (MatchScoreResult)

MatchingModule รับข้อมูลทักษะผู้สมัครกับทักษะที่งานต้องการ แล้วส่งกลับ:

- **matchScore** — คะแนนรวมความเหมาะสม
- **requiredCoverage / preferredCoverage** — ระดับการครอบคลุมทักษะจำเป็นและทักษะเสริม
- **careerAlignment** — ความใกล้เคียงระหว่างเป้าหมายอาชีพกับชื่อตำแหน่ง
- **matchedSkills** — ทักษะที่ผ่านเกณฑ์ พร้อมคะแนนผู้สมัครและระดับที่งานต้องการ
- **missingSkills** — ทักษะที่ยังไม่ถึงเกณฑ์หรือยังไม่มีข้อมูล

คะแนนรวมใช้สัดส่วน 70% ทักษะจำเป็น, 20% ทักษะเสริม และ 10% ความสอดคล้องกับเป้าหมายอาชีพ ข้อมูลนี้ใช้แสดงงานและบันทึกคะแนน ณ เวลาสมัคร

### ข้อมูลใบสมัครและการแจ้งเตือน

JobApplication เก็บงาน ผู้สมัคร รอบสมัคร จดหมายสมัคร/ลิงก์ resume คะแนนจับคู่ตอนสมัคร และสถานะปัจจุบัน ส่วน ApplicationStatusHistory เก็บสถานะก่อนหน้า สถานะใหม่ ผู้เปลี่ยน หมายเหตุ และเวลา

เมื่อบริษัทเปลี่ยนสถานะ CompanyModule ส่งข้อมูลข้อความให้ NotificationsModule สร้าง Notification ภายใต้ User ของผู้สมัคร โดยหน้าแจ้งเตือนอ่านรายการและปรับสถานะอ่านแล้วผ่าน NotificationsModule

### ข้อมูลการสอบ

Assessment อธิบายชุดข้อสอบ; Question ระบุโจทย์และเกณฑ์ตรวจ; Choice เก็บตัวเลือกของข้อสอบทฤษฎี; AssessmentAttempt แทนการเข้าสอบหนึ่งครั้ง; AssessmentAnswer เก็บคำตอบแต่ละข้อและผลรันโค้ด

การสอบของแพลตฟอร์มที่ผูกกับ Skill สามารถปรับคะแนน CandidateSkill ได้ ส่วนข้อสอบของบริษัทใช้ช่วยคัดเลือกและ review ผล ไม่ได้เพิ่มคะแนนทักษะของแพลตฟอร์มโดยอัตโนมัติ

## 4. หน้าที่ของโมดูลอื่นที่ไม่ได้ส่งข้อมูลให้กันโดยตรง

บางโมดูลเป็นผู้ให้ข้อมูลหรือดูแลระบบมากกว่าจะส่งข้อมูลตรงไปยังอีกโมดูล:

| โมดูล | หน้าที่ในเส้นทางข้อมูล |
|---|---|
| SkillsModule | อ่านรายการ Skill และกรอบมาตรฐานมาให้หน้าเว็บ; การเพิ่มรายการทำผ่านหลังบ้านหรือการตรวจพบจาก GitHub/ingestion |
| RecommendationsModule | อ่าน CandidateSkill และเป้าหมายอาชีพ แล้วค้น Course/CourseSkill; ในโค้ดมีการโหลด CompanyEvaluation แต่ไม่ได้เอามาคำนวณ gap |
| EvaluationsModule | บันทึกและอ่าน CompanyEvaluation แยกจากคะแนน CandidateSkill; จึงเป็น feedback สำหรับการรับสมัคร ไม่ใช่คะแนนทักษะอัตโนมัติ |
| AdminModule | อ่านหรือแก้ข้อมูลหลายกลุ่มโดยตรง เช่น ผู้ใช้ บริษัท Skill, Assessment, Course และ IngestionLog; ไม่ใช่ตัวกลางที่ทุกโมดูลต้องผ่าน |
| HealthModule | ส่งคำถามสั้น ๆ ไปตรวจฐานข้อมูลว่าตอบสนองอยู่หรือไม่ แล้วส่งสถานะกลับระบบ deployment |
| PrismaModule | รับคำขออ่าน/เขียนจาก service แล้วติดต่อ PostgreSQL ผ่าน PrismaService; เป็นชั้นเชื่อมกับฐานข้อมูลกลาง ไม่ได้เก็บข้อมูลธุรกิจเอง |
| AppModule | เปิดใช้งาน modules; ไม่รับ/ส่งข้อมูลผู้สมัครหรืองานเอง |
| packages/shared | รวมชื่อสถานะและรูปแบบข้อมูลที่เว็บกับ API ใช้ร่วมกัน; เป็นแบบฟอร์มข้อมูล ไม่ใช่ที่เก็บข้อมูลจริง |

## 5. ข้อควรเข้าใจเมื่ออ่านแผนผัง

- เส้นระหว่างโมดูลไม่ได้หมายความว่าโมดูลหนึ่งส่ง “ทุกฟิลด์” ให้อีกโมดูล เส้นและตารางระบุเฉพาะข้อมูลที่ใช้ในงานนั้น
- โมดูลอาจอ่านข้อมูลที่อีกโมดูลสร้างไว้ แม้ไม่มีเส้นเรียกกันตรง ๆ เพราะข้อมูลถูกบันทึกไว้ในฐานข้อมูลกลาง
- CompanyEvaluation ถูกเก็บและแสดงได้ แต่ยังไม่ไหลไปปรับ CandidateSkill หรือผล skill gap
- คะแนนการจับคู่กับ badge ยืนยันทักษะเป็นคนละผลลัพธ์; การจับคู่งานใช้ practicalScore ก่อนเมื่อมีค่า ส่วนคะแนนสอบช่วยยืนยัน badge และใช้ประกอบ skill gap
- ค่า commitCount และ linesOfCode ที่บันทึกกับ GitHubEvidence ใน sync ปัจจุบันเป็นค่ากึ่งสุ่ม ไม่ใช่ค่าที่อ่านจริงจาก GitHub

## 6. ไฟล์โค้ดที่เป็นแหล่งของแต่ละเส้นทาง

- การต่อ modules: [app.module.ts](../apps/api/src/app.module.ts)
- การจับคู่: [jobs.service.ts](../apps/api/src/jobs/jobs.service.ts), [matching.service.ts](../apps/api/src/matching/matching.service.ts), [applications.service.ts](../apps/api/src/applications/applications.service.ts)
- โปรไฟล์และเรดาร์: [candidate.service.ts](../apps/api/src/candidate/candidate.service.ts)
- GitHub และหลักฐาน: [github.service.ts](../apps/api/src/github/github.service.ts)
- pipeline และแจ้งเตือน: [company.service.ts](../apps/api/src/company/company.service.ts), [notifications.service.ts](../apps/api/src/notifications/notifications.service.ts)
- assessments: [assessments.service.ts](../apps/api/src/assessments/assessments.service.ts)
- feedback บริษัท: [evaluations.service.ts](../apps/api/src/evaluations/evaluations.service.ts)
- skill gap/course: [recommendations.service.ts](../apps/api/src/recommendations/recommendations.service.ts)
- นำเข้าข้อมูลและตั้งเวลา: [ingestion.service.ts](../apps/api/src/ingestion/ingestion.service.ts), [scheduler.service.ts](../apps/api/src/scheduler/scheduler.service.ts)
- ความสัมพันธ์ข้อมูลทั้งหมด: [schema.prisma](../prisma/schema.prisma)
