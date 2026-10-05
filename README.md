# SmartCareer — Career Intelligence & Job Matching Platform

SmartCareer เป็นแพลตฟอร์มหางาน รวบรวมตำแหน่งงาน ประเมินทักษะด้วยหลักฐานจริง (Evidence-Based Skill Intelligence) และวางแผนพัฒนาตนเองตามเส้นทางอาชีพ พัฒนาขึ้นตามข้อกำหนดใน [`SmartCareer_Project_Structure_7Day_Development_Plan.md`](file:///d:/Workshop/last-project/SmartCareer_Project_Structure_7Day_Development_Plan.md) ครบถ้วน 100%

---

## 🌟 จุดเด่นของระบบ (Core Capabilities)

1. **GitHub Skill Intelligence:**
   - เชื่อมต่อและสแกน Repository, ภาษาที่ใช้ และ Dependencies (เช่น React, Next.js, NestJS, Prisma, PostgreSQL, Docker)
   - คำนวณ Practical Skill Score (Usage 35%, Dependencies 25%, Commits 25%, Diversity 15%)
   - แสดงผล **Interactive Radar Chart (Recharts)** 5 แกนหลัก พร้อม Evidence Drill-down

2. **Assessment & Coding Sandbox (Judge0):**
   - แบบทดสอบภาคทฤษฎี (Theory MCQ) พร้อมการจับเวลาและตรวจข้อสอบทันที
   - แบบทดสอบเขียนโค้ดภาคปฏิบัติด้วย **Monaco Code Editor** เชื่อมต่อ **Judge0 Sandbox API** (พร้อม Built-in Safe Local Evaluator)
   - คำนวณคะแนน **Verified Skill Badge**: $(\text{GitHub} \times 0.5) + (\text{Theory} \times 0.2) + (\text{Coding} \times 0.3)$

3. **70/20/10 Weighted Job Matching Engine:**
   - คำนวณความเข้ากันได้ของตำแหน่งงานแบบ Real-time:
     - **Required Skills Coverage:** 70%
     - **Preferred Skills Coverage:** 20%
     - **Career Goal Alignment:** 10%
   - แสดงรายการทักษะที่ตรง (Matched Skills) และทักษะที่ขาด (Skill Gaps) อย่างโปร่งใส

4. **Recruitment Pipeline & Company Evaluation:**
   - กระบวนการรับสมัครแบบ Kanban: `APPLIED` → `REVIEWING` → `INTERVIEW` → `TECHNICAL_TEST` → `OFFER` → `ACCEPTED` / `REJECTED`
   - บริษัทสามารถประเมินผล Candidate ได้ 4 ด้าน (Technical, Problem Solving, Communication, Teamwork) และเขียน Feedback
   - Feedback เชื่อมโยงเข้าสู่ระบบคำนวณ Skill Gap เพื่อแนะนำคอร์สเรียนต่อ

5. **Skill Gap Analysis & Course Recommendations:**
   - วิเคราะห์จุดอ่อนเปรียบเทียบกับเกณฑ์มาตรฐานของตำแหน่งงานเป้าหมาย (เช่น Full Stack, Backend, DevOps)
   - แนะนำคอร์สเรียนตรงจุดจาก **YouTube Data API** และ **Udemy**

6. **Automated Ingestion Schedulers & Audit Trail:**
   - ดึงตำแหน่งงานอัตโนมัติจาก Remotive API และ Web Scraper (Blognone Jobs)
   - มีระบบ Deduplication ตรวจจับงานซ้ำ
   - จัดเก็บ Audit Logs การทำงาน พร้อมปุ่ม Manual Trigger บน Admin Backoffice

7. **Full Admin Backoffice Suite:**
   - Dashboard แสดงสถิติและสถานะระบบภาพรวม
   - อนุมัติเอกสารและตรวจสอบสถานะบริษัท (Company Verification)
   - จัดการ Master Skills และ Industry Frameworks (Microsoft Azure, AWS)

---

## 🛠️ สถาปัตยกรรมและเทคโนโลยี (Tech Stack)

*   **Monorepo:** npm workspaces (`apps/web`, `apps/api`, `packages/shared`, `prisma`)
*   **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Monaco Editor
*   **Backend:** NestJS 10 (Modular Monolith, Passport JWT, RBAC Guards, Schedule Cron, Axios, Cheerio)
*   **Database:** PostgreSQL 18 + Prisma ORM (24 Models & Enums)

---

## 🔑 ช่องทางสมัครและเข้าสู่ระบบ

| บทบาท | สมัครสมาชิก | เข้าสู่ระบบ | หน้าหลัก |
|---|---|---|---|
| Candidate | GitHub เท่านั้น | GitHub เท่านั้น | `/profile` |
| Company | Google เท่านั้น | Google เท่านั้น | `/company/dashboard` |
| Admin | สร้างโดยผู้ดูแลระบบเท่านั้น | อีเมลและรหัสผ่าน | `/admin/dashboard` |

บัญชีเดิมยังเก็บข้อมูลทั้งหมดไว้ การเชื่อมบัญชีเดิมต้องใช้อีเมลที่ผู้ให้บริการยืนยันตรงกับบัญชีเดิม และชื่อ GitHub ที่ผูกไว้ต้องตรงกัน ไม่รองรับรหัสผ่านของผู้สมัครหรือบริษัทอีกต่อไป

การตรวจอัตโนมัติใช้ตัวจำลองผู้ให้บริการเฉพาะฐานข้อมูลแยกในเครื่อง (`ENABLE_DEV_MOCK_AUTH=true` และ `NODE_ENV=development`) ตัวจำลองปิดใน production เสมอ และไม่ใช้แทนการตรวจ GitHub/Google จริง

ดูขั้นตอนทดสอบนโยบายใหม่ที่ [OAuth-only UAT](docs/uat/AUTH_PROVIDER_POLICY.md)

---

## 🚀 วิธีการรันโปรเจค (Running Locally)

### เตรียมเครื่องครั้งแรก

ใช้ Node.js 22 และ PostgreSQL ที่เปิดใช้งานแล้ว คัดลอก `.env.example` เป็น `.env` ที่โฟลเดอร์หลักหากยังไม่มี แล้วตั้ง `DATABASE_URL` ให้ตรงกับฐานข้อมูลของเครื่อง

```bash
npm ci
# สำหรับฐานข้อมูลใหม่ที่ยังไม่มีตาราง
npm run prisma:push
npm run build
```

คำสั่ง `npm run build` เตรียมส่วนใช้ร่วมกันและตัวเชื่อมฐานข้อมูลครั้งเดียว ก่อนสร้างระบบหลังบ้านและเว็บ หากต้องการสร้างเฉพาะส่วน ใช้ `npm run build:api` หรือ `npm run build:web` ซึ่งเตรียมส่วนที่จำเป็นให้อัตโนมัติ `build:app` เป็นคำสั่งย่อยสำหรับกระบวนการสร้างรวม ไม่ใช่คำสั่งเริ่มเตรียมโปรเจกต์

ระบบหลังบ้านรับค่าจากระบบที่ใช้เปิดโปรแกรมก่อน ตามด้วย `apps/api/.env` และ `.env` ที่โฟลเดอร์หลักตามลำดับ ไฟล์เฉพาะระบบหลังบ้านเดิมยังใช้เป็นค่าทับได้ แต่สำหรับเครื่องใหม่สามารถใส่ค่ารวมใน `.env` ที่โฟลเดอร์หลักได้ เปิดจากโฟลเดอร์หลักหรือ `apps/api` ก็อ่านไฟล์ชุดเดียวกัน

เว็บอ่านไฟล์ตั้งค่าตามมาตรฐาน Next.js ภายใน `apps/web` หากต้องการเปลี่ยนที่อยู่ระบบหลังบ้าน ให้สร้าง `apps/web/.env.local` พร้อมค่า เช่น:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

ค่าที่ขึ้นต้น `NEXT_PUBLIC_` ต้องกำหนดก่อนสร้างเว็บ เมื่อเปลี่ยนต้องสร้างเว็บใหม่ ส่วน Docker รับค่าที่อยู่ระบบหลังบ้านจาก build arguments ใน Compose

### ค่าที่มีผลกับการใช้งาน

- `JWT_EXPIRES_IN`: ระยะเวลาที่เข้าสู่ระบบค้างไว้ เช่น `30m`, `12h` หรือ `7d` หากไม่ได้กำหนดใช้ 7 วัน ค่าที่เปลี่ยนมีผลกับการเข้าสู่ระบบครั้งใหม่หลังเปิดระบบหลังบ้านใหม่
- `INGESTION_CONFIG_DIR`: ตำแหน่งเก็บค่าจำนวนรายการที่จะนำเข้า หากไม่ได้กำหนดใช้ `apps/api/config` โดยไม่ขึ้นกับโฟลเดอร์ที่ใช้เปิดระบบ แนะนำใช้ตำแหน่งเต็มเมื่อกำหนดเอง
- Docker Compose เก็บค่าจำนวนรายการนำเข้าในพื้นที่ถาวรชื่อ `api_config` จึงยังอยู่เมื่อสร้างหรือเปลี่ยนตัวระบบหลังบ้านใหม่ และส่งค่า GitHub กับ Udemy ที่กำหนดไว้ให้ระบบหลังบ้านด้วย

### 1. รัน Backend API (Port 4000)
```bash
npm run dev:api
```
Backend API จะทำงานที่: `http://localhost:4000/api`

### 2. รัน Frontend Web (Port 3000)
```bash
npm run dev:web
```
Frontend Web จะทำงานที่: `http://localhost:3000`

เปิดสองคำสั่งข้างต้นในคนละหน้าต่าง สำหรับเปิดชุดที่สร้างเสร็จแล้ว ใช้ `npm run start --workspace=@smartcareer/api` และ `npm run start --workspace=@smartcareer/web` ในคนละหน้าต่างเช่นกัน

### ตรวจค่าตั้งระบบและไฟล์ติดตั้ง

หลัง `npm run build` สามารถตรวจโดยไม่แก้ข้อมูลจริง:

```bash
node scripts/verify-runtime-config.cjs
npx ts-node scripts/verify-manifests.ts
```

คำสั่งแรกตรวจการอ่านค่าตั้งระบบและการเก็บค่าหลังเปิดใหม่ โดยเขียนเฉพาะไฟล์ชั่วคราว คำสั่งที่สองตรวจไฟล์ติดตั้ง ไม่ได้สร้างหรือเปิด Docker จริง ผลตรวจหลังปรับปรุงอยู่ใน [รายงานค่าตั้งระบบและขั้นตอนเตรียมระบบ](docs/RUNTIME_SETUP_REPORT.md)

### 3. รัน Database Seeder หรือ Prisma Studio
```bash
# รัน Seed ข้อมูลจำลองครบชุด
npm run prisma:seed

# เปิดดูฐานข้อมูลผ่าน Prisma Studio GUI
npm run prisma:studio
```
