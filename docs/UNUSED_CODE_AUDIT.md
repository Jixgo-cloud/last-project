# ผลตรวจส่วนที่ไม่ได้ใช้งานในโปรเจกต์ SmartCareer

## ผลการจัดการรายการที่ผู้ใช้อนุมัติ

ปรับปรุงต่อจากการเก็บกวาดแล้ว: ค่าตั้งระบบและการสร้างระบบที่ทำซ้ำ ดู [ผลตรวจและรายละเอียดล่าสุด](RUNTIME_SETUP_REPORT.md) ส่วนหลักฐานการตรวจเดิมด้านล่างเก็บไว้ตามสภาพก่อนแก้

ดำเนินการวันที่ 4 ตุลาคม 2026: จัดการรายการที่ไม่ได้ใช้ครบ 79 จุดใน source 25 ไฟล์ ถอด clsx และ tailwind-merge จาก dependencies ของเว็บพร้อมปรับ lockfile และลบเอกสารสำเนาที่ root 3 ไฟล์ โดยเก็บฉบับหลักไว้ใน docs/uat พร้อมปรับ generator ให้สร้างเฉพาะที่ตำแหน่งนี้

คงคำสั่งบันทึกฐานข้อมูลและการเรียก useAuth ไว้เพื่อรักษาการทำงานเดิม ส่วน parameter ตัวแรกของ callback ที่ต้องรักษาลำดับข้อมูลเปลี่ยนเป็นชื่อที่แสดงว่าไม่ใช้ค่า แทนการถอดแล้วทำให้ parameter ถัดไปรับข้อมูลผิดตำแหน่ง

ตรวจแล้วผ่าน: TypeScript ของ web, api และ shared โดยเปิดการตรวจรายการที่ไม่ได้ใช้ ผลคือ 0 จุด; production build ของเว็บ; NestJS build ของ API; syntax ของ generator; การจำลอง generator เพื่อยืนยันว่าไม่สร้างสำเนาที่ root; และการเทียบไฟล์ฉบับหลักทั้ง 3 กับ Git ซึ่งยังเหมือนเดิมทุก byte

ส่วนที่เหลือในรายงานด้านล่างเป็นหลักฐานจากการตรวจก่อน cleanup รวมถึงรายชื่อและตำแหน่งเดิม ยังไม่ได้จัดการ shared declarations, CSS/theme, API endpoints, environment setting หรือ artifacts เพิ่มเติม รายงานรอบนี้ไม่ได้ทดสอบการใช้งานระบบสดกับฐานข้อมูล

## หลักฐานจากการตรวจก่อน cleanup

ตรวจวันที่ 4 ตุลาคม 2026 ตามเวลา Asia/Bangkok จาก working tree ใน D:/Workshop/last-project

พบ import ตัวแปร และ parameter ที่ TypeScript ยืนยันว่าไม่ได้ใช้งาน 79 จุด แบ่งเป็นเว็บ 68 จุดและ API 11 จุด พบ dependencies เว็บที่ไม่มีการอ้างอิง 2 ตัว และ shared declarations ที่ไม่มีผู้ใช้งาน 6 รายการ ขณะเดียวกันยังไม่พบไฟล์ source หลักที่ไม่มีเส้นทางการเรียกใช้จาก entry point ของแอป ผลตรวจนี้เป็นการวิเคราะห์และจัดทำรายงาน ยังไม่ได้ลบไฟล์ เปลี่ยน dependencies หรือแก้โค้ดระบบ

## ขอบเขตและวิธีตรวจ

- ตรวจ inventory ของไฟล์ใน Git 234 ไฟล์ และวิเคราะห์ AST ของ TypeScript กับ JavaScript 135 ไฟล์ รวมแอป shared package seeds และสคริปต์
- ไล่ import และ re-export รวม dynamic import และ require ที่ระบุชื่อโมดูลตรง ๆ โดยแก้ paths alias ตาม tsconfig ของแต่ละ workspace
- ใช้ entry points 28 จุด ได้แก่ Next.js pages/layout และ NestJS main.ts พบไฟล์ที่เข้าถึงได้ 97 ไฟล์ และไม่มี source file หลักที่หลุดจากกราฟนี้
- ตรวจ API routes 94 รายการจาก controller decorators และเทียบกับ frontend calls พร้อมตรวจซ้ำจุดที่ใช้ตัวแปร URL, redirect และ HTTP method
- ตรวจ Prisma models 26 รายการ รวมการอ่านและเขียนผ่าน relations เพื่อเลี่ยงการสรุปผิดจากการไม่พบ delegate โดยตรง
- ตรวจ dependency manifests, npm scripts, Dockerfiles, Compose, CSS, config, เอกสารซ้ำ และ build artifacts โดยไม่อ่านค่าความลับใน .env
- ผล TypeScript จาก config ปัจจุบันพบเฉพาะ diagnostics ของรายการที่ไม่ได้ใช้ ไม่มี type error อื่นใน web, api และ shared ผลนี้ไม่ได้แทนการ build Next.js ทั้งชุดหรือทดสอบระบบสด
- ไม่ได้รัน server, UAT ที่เขียนข้อมูล, seed, ingestion หรือ query ฐานข้อมูล จึงไม่อ้างว่าทราบจำนวนผู้ใช้ API จริงหรือสถานะข้อมูลใน production

## รายการที่ยืนยันได้จากโค้ด

### Dependencies เว็บที่ไม่มีผู้ใช้

| รายการ | หลักฐาน | แนวทาง |
| --- | --- | --- |
| clsx | ปรากฏใน apps/web/package.json เท่านั้น ไม่พบ import require หรือการใช้ผ่าน config | ถอดจาก manifest แล้วปรับ lockfile และตรวจ build |
| tailwind-merge | ปรากฏใน apps/web/package.json เท่านั้น ไม่พบ import require หรือการใช้ผ่าน config | ถอดจาก manifest แล้วปรับ lockfile และตรวจ build |

การถอด declarations เหล่านี้ไม่ได้รับประกันว่าแพ็กเกจจะหายจาก node_modules เพราะ dependency อื่นอาจยังต้องใช้ทางอ้อม

### Shared declarations ที่ไม่มีผู้ใช้

| ชื่อ | ตำแหน่ง | ข้อสังเกต |
| --- | --- | --- |
| AuthProvider | [index.ts:8](D:/Workshop/last-project/packages/shared/src/index.ts:8) | enum นี้ไม่มี import จาก shared; AuthProvider ใน auth-context.tsx เป็น React provider คนละ declaration |
| OverrideScoreDTO | [index.ts:96](D:/Workshop/last-project/packages/shared/src/index.ts:96) | controller ใช้รูปแบบ payload ภายในแทน shared interface |
| SkillScoreSummary | [index.ts:196](D:/Workshop/last-project/packages/shared/src/index.ts:196) | ไม่พบผู้ใช้นอก declaration |
| CompanyEvaluationDTO | [index.ts:254](D:/Workshop/last-project/packages/shared/src/index.ts:254) | service ใช้ inline type; interface นี้มี comment และ skillsAssessed ซึ่งต่างจาก payload ปัจจุบัน |
| IngestionLogSummary | [index.ts:263](D:/Workshop/last-project/packages/shared/src/index.ts:263) | ไม่พบผู้ใช้นอก declaration |
| NotificationItem | [index.ts:289](D:/Workshop/last-project/packages/shared/src/index.ts:289) | NotificationBell.tsx ประกาศ interface ชื่อเดียวกันในไฟล์เอง จึงไม่ได้ใช้ shared interface |

ความมั่นใจสูงภายใน repository นี้ เพราะ shared package เป็น workspace ภายใน แต่ควรตรวจผู้ใช้ภายนอกก่อนเปลี่ยน public API ของแพ็กเกจ หากมีการนำไปใช้ภายนอกจริง สำหรับ NotificationItem ควรเลือกใช้ shared interface แล้วลบ type ซ้ำ หรือถอด shared interface ตามรูปแบบที่ต้องการ

AiEvaluationRubricBreakdown ไม่มี import โดยตรงแต่ถูกใช้ภายใน AiEvaluationResult ซึ่ง AI evaluator ใช้อยู่ จึงต้องเก็บไว้ Types ภายในไฟล์อื่น เช่น EvaluatorPayload, EvaluationOutcome และ Judge0ExecutionReport ก็ยังมีผู้ใช้ภายในไฟล์ แม้ไม่ถูก import จากภายนอก

### CSS และ theme ที่ไม่มีผู้ใช้ในแอปปัจจุบัน

- [globals.css:60](D:/Workshop/last-project/apps/web/app/globals.css:60): ไม่พบการใช้ class glass-panel
- [globals.css:66](D:/Workshop/last-project/apps/web/app/globals.css:66): ไม่พบการใช้ class glass-card จึงรวมถึง rule glass-card:hover
- [globals.css:5](D:/Workshop/last-project/apps/web/app/globals.css:5): CSS variables ใน :root และ .dark ไม่มี var(--...) ที่อ้างถึงใน source และไม่ได้ผูกสีเหล่านี้เข้ากับ Tailwind theme ปัจจุบัน
- [tailwind.config.ts:9](D:/Workshop/last-project/apps/web/tailwind.config.ts:9): darkMode ใช้ class แต่ไม่พบ dark: utilities หรือโค้ดสลับ dark class
- [tailwind.config.ts:13](D:/Workshop/last-project/apps/web/tailwind.config.ts:13): brand color palette ไม่มี class brand-* ใน source ปัจจุบัน

ความมั่นใจสูงสำหรับหน้าแอปใน repository นี้ แต่ควรตรวจหน้าตาจริงหลัง cleanup CSS เพราะรายงานนี้ไม่ได้เปิด browser ตรวจทุกหน้าจอ ส่วน hero-orbit, hero-dashboard และ hero-spinner ใช้ใน HomePageClient.tsx ต้องเก็บไว้

### Environment setting ที่ไม่ถูกอ่าน

JWT_EXPIRES_IN อยู่ใน .env.example, .env.production.example และ [docker-compose.prod.yml:36](D:/Workshop/last-project/docker-compose.prod.yml:36) แต่ [auth.module.ts:15](D:/Workshop/last-project/apps/api/src/auth/auth.module.ts:15) ใช้ expiresIn: '7d' ตายตัว ค่านี้จึงไม่มีผลต่ออายุ token ปัจจุบัน ควรให้โค้ดอ่านค่าหรือลบ setting ที่ไม่ทำงาน ไม่ควรลบ JWT_SECRET ซึ่งถูกใช้อยู่

## API ที่ไม่พบผู้เรียกจาก frontend และสคริปต์ใน repository

รายการต่อไปนี้ยังเป็น endpoint ที่ถูก register จึงจัดเป็นผู้สมัครสำหรับทบทวน ไม่ใช่ API ที่ยืนยันว่าลบได้ จำเป็นต้องดู access logs หรือยืนยันผู้ใช้ภายนอกก่อนถอด

| HTTP method | Endpoint หลัง /api | ตำแหน่ง | ข้อสังเกต |
| --- | --- | --- | --- |
| GET | /applications/:id | [applications.controller.ts:29](D:/Workshop/last-project/apps/api/src/applications/applications.controller.ts:29) | frontend ใช้ DELETE /applications/:id เพื่อยกเลิก แต่ไม่พบ GET สำหรับอ่านรายละเอียด |
| PUT | /company/jobs/:id | [company.controller.ts:55](D:/Workshop/last-project/apps/api/src/company/company.controller.ts:55) | มี UI สร้างงาน สลับสถานะ และลบงาน แต่ไม่พบ UI หรือสคริปต์ที่เรียก PUT เพื่อแก้รายละเอียดงาน |
| GET | /evaluations/my-feedback | [evaluations.controller.ts:23](D:/Workshop/last-project/apps/api/src/evaluations/evaluations.controller.ts:23) | ข้อมูลประเมินมีการอ่านผ่าน application/recommendations อีกทาง แต่ไม่พบผู้ใช้ endpoint นี้ |
| GET | /jobs/:id/match | [jobs.controller.ts:76](D:/Workshop/last-project/apps/api/src/jobs/jobs.controller.ts:76) | หน้ารายละเอียดใช้ /jobs/:id/detail ซึ่งคืน matchScore อยู่แล้ว |
| GET | /notifications/unread-count | [notifications.controller.ts:27](D:/Workshop/last-project/apps/api/src/notifications/notifications.controller.ts:27) | NotificationBell นับ unread จากรายการ /notifications?limit=25 เอง |
| GET | /skills/frameworks | [skills.controller.ts:19](D:/Workshop/last-project/apps/api/src/skills/skills.controller.ts:19) | หน้า admin ใช้ /admin/frameworks; ไม่พบผู้ใช้เส้นทาง public นี้ |
| POST | /ingestion/backfill-skills | [ingestion.controller.ts:68](D:/Workshop/last-project/apps/api/src/ingestion/ingestion.controller.ts:68) | เครื่องมือดูแลข้อมูล ไม่มีปุ่มหรือสคริปต์ที่เรียกเส้นทางนี้ |
| POST | /ingestion/enrich-jobs-ai | [ingestion.controller.ts:73](D:/Workshop/last-project/apps/api/src/ingestion/ingestion.controller.ts:73) | เครื่องมือดูแลข้อมูล ไม่มีปุ่มหรือสคริปต์ที่เรียกเส้นทางนี้ |

อย่าถอด service ทั้งก้อนจากรายการนี้ MatchingService ยังถูกเรียกจาก JobsService และ ApplicationsService ส่วน IngestionService ยังถูกเรียกจาก scheduler และ admin endpoints อื่น

## สคริปต์ เอกสาร และไฟล์ที่สร้างขึ้น

### สคริปต์ที่รันแยก

ไม่พบการเรียกจาก npm scripts, แอป หรือเอกสารของชื่อ batch-enrich-all-jobs.js, test-cleaners.js, test-jobsdb-detail.js และ apps/api/seed-courses.js สคริปต์เหล่านี้มี entry point ที่รันได้ด้วย node โดยตรง จึงไม่มีหลักฐานพอจะสรุปว่าเลิกใช้แล้ว

- batch-enrich-all-jobs.js เป็นงาน enrichment แบบรันครั้งเดียว ซึ่งเขียน job และ skills ในฐานข้อมูล และมีความสามารถทับซ้อนกับ ingestion service เหมาะแก่การย้ายเข้าชุด maintenance หรือ archive หากไม่ใช้งานอีก
- test-cleaners.js และ test-jobsdb-detail.js เป็นเครื่องมือ debug scraper ที่ผูกกับ URL ตัวอย่างและ curl.exe จึงควรพิจารณาเก็บใน scripts/debug ถ้าต้องใช้ต่อ
- apps/api/seed-courses.js เป็น seed เพิ่มคอร์สด้วย Prisma ไม่ใช่ source ที่ API import ตอนเริ่มแอป
- scripts/verify-*, scripts/test-*, scripts/execute-* และสคริปต์ผลิต PDF เป็นเครื่องมือ verification/UAT/documentation การไม่พบ import จากแอปเป็นพฤติกรรมปกติ ไม่ควรลบทิ้งทั้งหมดจากเกณฑ์นี้

### เอกสารซ้ำ

ตรวจ SHA256 แล้วพบสำเนาที่เหมือนกันทุก byte 3 คู่:

| ที่ root | สำเนาใน docs/uat |
| --- | --- |
| UAT_SmartCareer_Smooth_Journey_Manual.md | docs/uat/UAT_SmartCareer_Smooth_Journey_Manual.md |
| UAT_SmartCareer_Smooth_Journey_Manual.html | docs/uat/UAT_SmartCareer_Smooth_Journey_Manual.html |
| UAT_SmartCareer_Smooth_Journey_Manual.pdf | docs/uat/UAT_SmartCareer_Smooth_Journey_Manual.pdf |

scripts/generate_smooth_uat_pdf.js สร้าง HTML และ PDF ทั้งสองตำแหน่งโดยตั้งใจ หากต้องการเก็บเพียงชุดเดียวควรปรับ generator และ links พร้อมกัน มิฉะนั้นสำเนาจะกลับมาเมื่อสร้างเอกสารอีกครั้ง การซ้ำกันไม่ได้หมายความว่าเอกสารทุกชุดไม่มีผู้ใช้

### Cache และ artifacts

| ตำแหน่ง | ขนาดตอนตรวจโดยประมาณ | การตีความ |
| --- | --- | --- |
| tmp/pdfs | 70.92 MiB | รูปและ HTML ชั่วคราว พร้อม browser profiles สำหรับงาน PDF ไม่ใช่ runtime source; ต้องเก็บสิ่งที่ต้องใช้ก่อนล้าง |
| output | 1.09 MiB | มี SmartCareer_System_Overview_TH.pdf เป็นผลลัพธ์ของผู้ใช้ ควรเก็บตามความต้องการ |
| apps/web/.next | 332.03 MiB | build/dev cache สร้างใหม่ได้ แต่ production start ต้องใช้ผล build |
| apps/api/dist | 1.60 MiB | compiled API ต้องใช้ตอน start แบบ production |
| packages/shared/dist | 0.01 MiB | compiled shared package ใช้ใน backend runtime |
| apps/web/tsconfig.tsbuildinfo | เป็นไฟล์ใน Git | incremental cache ควรนำออกจากการ track และเพิ่ม *.tsbuildinfo ใน .gitignore หาก cleanup |

tmp/ และ output/ เป็น untracked อยู่ก่อนเริ่มตรวจและยังไม่อยู่ใน .gitignore ไม่ได้ลบหรือเปลี่ยนไฟล์เดิมภายในสองโฟลเดอร์นี้

## ขั้นตอน build และ declarations ที่ซ้ำ

- คำสั่ง npm run build:web ที่ root เรียก build shared เอง จากนั้น workspace web มี prebuild ที่ build shared และ build ที่ build shared อีกครั้ง ทำให้ shared build 3 ครั้งใน flow นี้
- Dockerfile.web build shared ก่อนแล้วเรียก workspace web build จึงเกิด shared build 3 ครั้งใน flow นี้เช่นกัน
- root build:api และ Dockerfile.api build shared และ generate Prisma ก่อน workspace API ซึ่ง prebuild ทำสองอย่างนี้ซ้ำอีก เหมาะกับการกำหนดจุดเตรียม dependencies ให้ชัดเจน
- root ระบุ prisma และ ts-node ทั้ง dependencies และ devDependencies เป็น declarations ที่ซ้ำ แต่ Dockerfile.api ใช้ prisma ตอน startup และมีเครื่องมือ seed/admin ที่ใช้ ts-node จึงไม่ควรถอดออกจาก production dependencies โดยดูเพียงความซ้ำ
- apps/api devDependencies มี source-map-support และ ts-loader ที่ไม่พบการใช้โดยตรงในแอป/config ปัจจุบัน จัดเป็นรายการทบทวนระดับกลาง; ts-loader เป็นส่วนของ Nest CLI webpack flow จึงต้องพิจารณาความต้องการ build mode ก่อนถอด

## ส่วนที่ตรวจแล้วต้องเก็บไว้

- ไม่พบ source file หลักที่เข้าถึงไม่ได้ และไม่พบ method ของ service ที่ไม่มีผู้เรียก หลังแยก framework hooks ออก
- PrismaService.onModuleInit/onModuleDestroy, Guards.canActivate และ JwtStrategy.validate ถูก framework เรียกอัตโนมัติ แม้ไม่มีผู้เรียกโดยตรงในโค้ดแอป
- scheduler ทั้ง 4 งานมี Cron decorators และถูก register ผ่าน SchedulerModule
- /auth/callback และ /auth/mock-oauth เป็น route aliases ที่ re-export หน้า /callback และ /mock-oauth ส่วน mock OAuth มีไว้ทดสอบ development และถูกปิดใน production จึงไม่ใช่ dead code แบบไม่มีการใช้งาน
- OAuth endpoints ถูกใช้งานผ่าน window.location.href และ callback ของผู้ให้บริการ; health endpoints มีไว้สำหรับ probes และเอกสาร deploy
- ไม่พบ Prisma model ที่ไม่มีการอ้างอิงเลย SkillFrameworkItem ถูกอ่านผ่าน framework.items ส่วน ApplicationStatusHistory ถูกอ่านและเขียนผ่าน statusHistory relations จึงต้องเก็บทั้งสองตาราง
- react-dom ใช้ผ่าน Next.js, @nestjs/platform-express โหลดโดย NestFactory, passport ใช้ผ่าน @nestjs/passport, rxjs/reflect-metadata เป็น peer/runtime dependencies ของ Nest และ class-transformer ใช้โดย global ValidationPipe จึงไม่ควรถอดเพียงเพราะไม่มี import ใน source
- puppeteer-core ใช้ในสคริปต์ UAT และตรวจ UI ไม่ใช่ dependency ที่ไร้ผู้ใช้
- apps/api/config/ingestion-quotas.json เป็นข้อมูล configuration ที่อ่านผ่าน fs จึงต้องเก็บ แม้ไม่ปรากฏเป็น import

## ข้อผิดพลาดข้างเคียงที่พบ

ประเด็นเหล่านี้ไม่ใช่ dead code แต่มีผลต่อการตรวจหรือ deploy และควรแก้แยกจาก cleanup

- IngestionConfigService ใช้ process.cwd()/config/ingestion-quotas.json เมื่อรัน workspace API ค่า cwd เป็น apps/api จึงอ่านไฟล์เดิมได้ แต่ Dockerfile.api เริ่มจาก /app และไม่ copy apps/api/config ไป runner ทำให้ production ใช้ค่า default หรือไฟล์คนละตำแหน่ง
- Dockerfile.web สั่ง COPY /app/apps/web/public แต่ checkout นี้ไม่มี apps/web/public จึงมีความเสี่ยงที่ build Docker จะหยุดที่ขั้นตอน COPY ต้องตรวจด้วย Docker build จริง
- main.ts import dotenv และ express โดย apps/api/package.json ไม่ declare โดยตรง ปัจจุบันพึ่ง dependency ทางอ้อม
- scripts/convert-md-to-pdf.js require marked แต่ root ไม่ declare marked และ npm run format ของ API เรียก prettier ทั้งที่ manifest ไม่ declare และการติดตั้งปัจจุบันไม่มี prettier
- root dev ใช้ npm run dev --workspaces แต่ shared workspace ไม่มี script dev ควรตรวจพฤติกรรมคำสั่งหรือแยกการ start watch ของ shared ให้ชัดเจน

## ลำดับ cleanup ที่แนะนำ

1. ลบ unused imports และ pure local calculations; สำหรับ updatedAttempt ที่ไม่มีผู้ใช้ ให้ถอดเฉพาะการเก็บตัวแปร แต่คง await tx.assessmentAttempt.update(...) เพราะมีผลเขียนฐานข้อมูล
2. ถอด clsx และ tailwind-merge แล้วตรวจ lockfile, TypeScript และ Next.js build
3. ทบทวน shared declarations 6 รายการและใช้ type กลางแทนการประกาศซ้ำเมื่อเหมาะสม
4. ลบ CSS/theme ที่ไม่ได้ใช้หลังตรวจหน้าตาเว็บ และลด build shared/Prisma ที่ซ้ำ
5. กำหนดที่เก็บเอกสาร UAT หลัก, ปรับ generator, นำ tsbuildinfo ออกจาก Git และจัดการ artifacts ตามอายุการใช้งาน
6. ตรวจ access logs และยืนยันผู้ใช้ภายนอกก่อนถอด API routes; ทบทวน one-off/debug scripts แยกจาก runtime source

## รายการ TypeScript ที่ยืนยันว่าไม่ได้ใช้

ตัวเลข 79 คือจำนวน diagnostics โดยแต่ละจุดอาจเป็น import binding, local variable หรือ parameter ไม่ได้หมายถึง 79 ฟังก์ชันหรือไฟล์ รายการทั้งหมดอยู่ด้านล่าง

### apps web

| ตำแหน่ง | รายการที่ไม่ได้ใช้ |
| --- | --- |
| [apps/web/app/admin/assessments/page.tsx:15](D:/Workshop/last-project/apps/web/app/admin/assessments/page.tsx:15) | 'Clock' is declared but its value is never read. |
| [apps/web/app/admin/assessments/page.tsx:23](D:/Workshop/last-project/apps/web/app/admin/assessments/page.tsx:23) | 'RefreshCw' is declared but its value is never read. |
| [apps/web/app/admin/assessments/page.tsx:43](D:/Workshop/last-project/apps/web/app/admin/assessments/page.tsx:43) | 'user' is declared but its value is never read. |
| [apps/web/app/admin/dashboard/page.tsx:11](D:/Workshop/last-project/apps/web/app/admin/dashboard/page.tsx:11) | 'Building2' is declared but its value is never read. |
| [apps/web/app/admin/dashboard/page.tsx:15](D:/Workshop/last-project/apps/web/app/admin/dashboard/page.tsx:15) | 'CheckCircle2' is declared but its value is never read. |
| [apps/web/app/admin/dashboard/page.tsx:16](D:/Workshop/last-project/apps/web/app/admin/dashboard/page.tsx:16) | 'AlertTriangle' is declared but its value is never read. |
| [apps/web/app/admin/dashboard/page.tsx:18](D:/Workshop/last-project/apps/web/app/admin/dashboard/page.tsx:18) | 'Sparkles' is declared but its value is never read. |
| [apps/web/app/admin/dashboard/page.tsx:22](D:/Workshop/last-project/apps/web/app/admin/dashboard/page.tsx:22) | 'Clock' is declared but its value is never read. |
| [apps/web/app/admin/ingestion/page.tsx:15](D:/Workshop/last-project/apps/web/app/admin/ingestion/page.tsx:15) | 'Building2' is declared but its value is never read. |
| [apps/web/app/admin/ingestion/page.tsx:19](D:/Workshop/last-project/apps/web/app/admin/ingestion/page.tsx:19) | 'AlertCircle' is declared but its value is never read. |
| [apps/web/app/admin/ingestion/page.tsx:20](D:/Workshop/last-project/apps/web/app/admin/ingestion/page.tsx:20) | 'Play' is declared but its value is never read. |
| [apps/web/app/admin/ingestion/page.tsx:25](D:/Workshop/last-project/apps/web/app/admin/ingestion/page.tsx:25) | 'Check' is declared but its value is never read. |
| [apps/web/app/admin/ingestion/page.tsx:33](D:/Workshop/last-project/apps/web/app/admin/ingestion/page.tsx:33) | 'AlertTriangle' is declared but its value is never read. |
| [apps/web/app/admin/ingestion/page.tsx:34](D:/Workshop/last-project/apps/web/app/admin/ingestion/page.tsx:34) | 'Info' is declared but its value is never read. |
| [apps/web/app/admin/skills/page.tsx:13](D:/Workshop/last-project/apps/web/app/admin/skills/page.tsx:13) | 'BookOpen' is declared but its value is never read. |
| [apps/web/app/admin/skills/page.tsx:14](D:/Workshop/last-project/apps/web/app/admin/skills/page.tsx:14) | 'Sparkles' is declared but its value is never read. |
| [apps/web/app/admin/skills/page.tsx:15](D:/Workshop/last-project/apps/web/app/admin/skills/page.tsx:15) | 'Briefcase' is declared but its value is never read. |
| [apps/web/app/admin/skills/page.tsx:16](D:/Workshop/last-project/apps/web/app/admin/skills/page.tsx:16) | 'ChevronRight' is declared but its value is never read. |
| [apps/web/app/admin/skills/page.tsx:17](D:/Workshop/last-project/apps/web/app/admin/skills/page.tsx:17) | 'Shield' is declared but its value is never read. |
| [apps/web/app/admin/skills/page.tsx:18](D:/Workshop/last-project/apps/web/app/admin/skills/page.tsx:18) | 'Tag' is declared but its value is never read. |
| [apps/web/app/admin/users/page.tsx:13](D:/Workshop/last-project/apps/web/app/admin/users/page.tsx:13) | 'CheckCircle2' is declared but its value is never read. |
| [apps/web/app/admin/users/page.tsx:14](D:/Workshop/last-project/apps/web/app/admin/users/page.tsx:14) | 'Mail' is declared but its value is never read. |
| [apps/web/app/admin/users/page.tsx:15](D:/Workshop/last-project/apps/web/app/admin/users/page.tsx:15) | 'Calendar' is declared but its value is never read. |
| [apps/web/app/admin/users/page.tsx:16](D:/Workshop/last-project/apps/web/app/admin/users/page.tsx:16) | 'Sparkles' is declared but its value is never read. |
| [apps/web/app/admin/users/page.tsx:17](D:/Workshop/last-project/apps/web/app/admin/users/page.tsx:17) | 'Filter' is declared but its value is never read. |
| [apps/web/app/admin/verifications/page.tsx:8](D:/Workshop/last-project/apps/web/app/admin/verifications/page.tsx:8) | 'ShieldCheck' is declared but its value is never read. |
| [apps/web/app/admin/verifications/page.tsx:15](D:/Workshop/last-project/apps/web/app/admin/verifications/page.tsx:15) | 'AlertCircle' is declared but its value is never read. |
| [apps/web/app/admin/verifications/page.tsx:17](D:/Workshop/last-project/apps/web/app/admin/verifications/page.tsx:17) | 'Search' is declared but its value is never read. |
| [apps/web/app/applications/page.tsx:16](D:/Workshop/last-project/apps/web/app/applications/page.tsx:16) | 'TrendingUp' is declared but its value is never read. |
| [apps/web/app/applications/page.tsx:23](D:/Workshop/last-project/apps/web/app/applications/page.tsx:23) | 'user' is declared but its value is never read. |
| [apps/web/app/assessments/[id]/page.tsx:20](D:/Workshop/last-project/apps/web/app/assessments/[id]/page.tsx:20) | 'FileQuestion' is declared but its value is never read. |
| [apps/web/app/assessments/[id]/page.tsx:24](D:/Workshop/last-project/apps/web/app/assessments/[id]/page.tsx:24) | 'Eye' is declared but its value is never read. |
| [apps/web/app/assessments/[id]/page.tsx:27](D:/Workshop/last-project/apps/web/app/assessments/[id]/page.tsx:27) | 'Save' is declared but its value is never read. |
| [apps/web/app/assessments/page.tsx:19](D:/Workshop/last-project/apps/web/app/assessments/page.tsx:19) | 'ShieldCheck' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:10](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:10) | 'Building2' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:17](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:17) | 'ArrowRight' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:20](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:20) | 'Filter' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:21](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:21) | 'SlidersHorizontal' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:25](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:25) | 'AlertCircle' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:27](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:27) | 'Layers' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:34](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:34) | 'FileText' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:35](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:35) | 'Activity' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:39](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:39) | 'MapPin' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:41](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:41) | 'Check' is declared but its value is never read. |
| [apps/web/app/company/applications/page.tsx:464](D:/Workshop/last-project/apps/web/app/company/applications/page.tsx:464) | 'currentStatusMeta' is declared but its value is never read. |
| [apps/web/app/company/assessments/page.tsx:15](D:/Workshop/last-project/apps/web/app/company/assessments/page.tsx:15) | 'Clock' is declared but its value is never read. |
| [apps/web/app/company/assessments/page.tsx:17](D:/Workshop/last-project/apps/web/app/company/assessments/page.tsx:17) | 'CheckCircle2' is declared but its value is never read. |
| [apps/web/app/company/assessments/page.tsx:18](D:/Workshop/last-project/apps/web/app/company/assessments/page.tsx:18) | 'XCircle' is declared but its value is never read. |
| [apps/web/app/company/assessments/page.tsx:22](D:/Workshop/last-project/apps/web/app/company/assessments/page.tsx:22) | 'Briefcase' is declared but its value is never read. |
| [apps/web/app/company/assessments/page.tsx:27](D:/Workshop/last-project/apps/web/app/company/assessments/page.tsx:27) | 'Send' is declared but its value is never read. |
| [apps/web/app/company/assessments/page.tsx:41](D:/Workshop/last-project/apps/web/app/company/assessments/page.tsx:41) | 'AssessmentReviewStatus' is declared but its value is never read. |
| [apps/web/app/company/assessments/page.tsx:45](D:/Workshop/last-project/apps/web/app/company/assessments/page.tsx:45) | 'user' is declared but its value is never read. |
| [apps/web/app/company/dashboard/page.tsx:17](D:/Workshop/last-project/apps/web/app/company/dashboard/page.tsx:17) | 'Sparkles' is declared but its value is never read. |
| [apps/web/app/company/dashboard/page.tsx:22](D:/Workshop/last-project/apps/web/app/company/dashboard/page.tsx:22) | 'user' is declared but its value is never read. |
| [apps/web/app/company/jobs/new/page.tsx:8](D:/Workshop/last-project/apps/web/app/company/jobs/new/page.tsx:8) | 'Briefcase' is declared but its value is never read. |
| [apps/web/app/company/jobs/new/page.tsx:8](D:/Workshop/last-project/apps/web/app/company/jobs/new/page.tsx:8) | 'CheckCircle2' is declared but its value is never read. |
| [apps/web/app/company/jobs/page.tsx:11](D:/Workshop/last-project/apps/web/app/company/jobs/page.tsx:11) | 'Users' is declared but its value is never read. |
| [apps/web/app/company/jobs/page.tsx:37](D:/Workshop/last-project/apps/web/app/company/jobs/page.tsx:37) | 'currentActive' is declared but its value is never read. |
| [apps/web/app/company/profile/page.tsx:25](D:/Workshop/last-project/apps/web/app/company/profile/page.tsx:25) | 'ImageIcon' is declared but its value is never read. |
| [apps/web/app/courses/page.tsx:14](D:/Workshop/last-project/apps/web/app/courses/page.tsx:14) | 'PlayCircle' is declared but its value is never read. |
| [apps/web/app/courses/page.tsx:21](D:/Workshop/last-project/apps/web/app/courses/page.tsx:21) | 'ArrowRight' is declared but its value is never read. |
| [apps/web/app/profile/page.tsx:19](D:/Workshop/last-project/apps/web/app/profile/page.tsx:19) | 'User' is declared but its value is never read. |
| [apps/web/app/profile/page.tsx:30](D:/Workshop/last-project/apps/web/app/profile/page.tsx:30) | 'Code2' is declared but its value is never read. |
| [apps/web/app/profile/page.tsx:31](D:/Workshop/last-project/apps/web/app/profile/page.tsx:31) | 'FileCheck2' is declared but its value is never read. |
| [apps/web/app/profile/page.tsx:34](D:/Workshop/last-project/apps/web/app/profile/page.tsx:34) | 'Flame' is declared but its value is never read. |
| [apps/web/components/NotificationBell.tsx:16](D:/Workshop/last-project/apps/web/components/NotificationBell.tsx:16) | 'ExternalLink' is declared but its value is never read. |
| [apps/web/components/NotificationBell.tsx:18](D:/Workshop/last-project/apps/web/components/NotificationBell.tsx:18) | 'Briefcase' is declared but its value is never read. |
| [apps/web/lib/auth-context.tsx:4](D:/Workshop/last-project/apps/web/lib/auth-context.tsx:4) | 'UserRole' is declared but its value is never read. |

### apps api

| ตำแหน่ง | รายการที่ไม่ได้ใช้ |
| --- | --- |
| [apps/api/src/admin/admin.service.ts:3](D:/Workshop/last-project/apps/api/src/admin/admin.service.ts:3) | 'UserRole' is declared but its value is never read. |
| [apps/api/src/assessments/assessments.service.ts:9](D:/Workshop/last-project/apps/api/src/assessments/assessments.service.ts:9) | 'ServiceUnavailableException' is declared but its value is never read. |
| [apps/api/src/assessments/assessments.service.ts:531](D:/Workshop/last-project/apps/api/src/assessments/assessments.service.ts:531) | 'finalStatus' is declared but its value is never read. |
| [apps/api/src/assessments/assessments.service.ts:575](D:/Workshop/last-project/apps/api/src/assessments/assessments.service.ts:575) | 'updatedAttempt' is declared but its value is never read. |
| [apps/api/src/assessments/assessments.service.ts:628](D:/Workshop/last-project/apps/api/src/assessments/assessments.service.ts:628) | 'aiPassed' is declared but its value is never read. |
| [apps/api/src/assessments/assessments.service.ts:676](D:/Workshop/last-project/apps/api/src/assessments/assessments.service.ts:676) | 'updatedAttempt' is declared but its value is never read. |
| [apps/api/src/assessments/assessments.service.ts:791](D:/Workshop/last-project/apps/api/src/assessments/assessments.service.ts:791) | 'updatedAttempt' is declared but its value is never read. |
| [apps/api/src/github/github.service.ts:324](D:/Workshop/last-project/apps/api/src/github/github.service.ts:324) | 'bytes' is declared but its value is never read. |
| [apps/api/src/ingestion/course-screening.service.ts:4](D:/Workshop/last-project/apps/api/src/ingestion/course-screening.service.ts:4) | 'execFileSync' is declared but its value is never read. |
| [apps/api/src/ingestion/ingestion.service.ts:438](D:/Workshop/last-project/apps/api/src/ingestion/ingestion.service.ts:438) | 'm' is declared but its value is never read. |
| [apps/api/src/recommendations/recommendations.service.ts:3](D:/Workshop/last-project/apps/api/src/recommendations/recommendations.service.ts:3) | 'CareerTrack' is declared but its value is never read. |

### packages shared

ไม่พบ unused diagnostics

## คำสั่งตรวจซ้ำ

รันจาก root ของ repository โดยไม่แก้ tsconfig:

```powershell
.\node_modules\.bin\tsc.cmd --project apps/web/tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
.\node_modules\.bin\tsc.cmd --project apps/api/tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
.\node_modules\.bin\tsc.cmd --project packages/shared/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
```

web และ API คืน exit code 1 เมื่อเปิด flags เหล่านี้เพราะรายการที่ไม่ได้ใช้ ส่วน shared ไม่แจ้งรายการที่ไม่ได้ใช้ เนื่องจาก TypeScript อนุญาต declarations ที่ export แม้ไม่มี consumer; จึงต้องตรวจ imports แยกดังที่รายงานไว้

ข้อมูลจาก AST และ diagnostics ฉบับเต็มอยู่ใน [unused-code-audit-data.json](D:/Workshop/last-project/docs/unused-code-audit-data.json) รายการ candidate ในข้อมูลดิบต้องอ่านคู่กับข้อยืนยันในรายงาน เช่น framework hooks และ model relations ไม่ใช่รายการสำหรับลบโดยอัตโนมัติ
