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

## 🔑 บัญชีทดสอบระบบ (Demo Credentials)

| บทบาท (Role) | อีเมล (Email) | รหัสผ่าน (Password) | หน้าหลัก (Landing Route) |
|---|---|---|---|
| **Candidate** | `candidate@smartcareer.dev` | `password123` | `/skills` / `/jobs` |
| **Company (Employer)** | `hr@techcorp.co.th` | `password123` | `/company/dashboard` |
| **Admin** | `admin@smartcareer.dev` | `admin123` | `/admin/dashboard` |

> *หมายเหตุ: บนหน้าเว็บแรก (Home) และหน้า Sign In มีปุ่ม **⚡ Quick 1-Click Interactive Demo Login** ให้เข้าใช้งานได้ทันทีโดยไม่ต้องพิมพ์*

---

## 🚀 วิธีการรันโปรเจค (Running Locally)

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

### 3. รัน Database Seeder หรือ Prisma Studio
```bash
# รัน Seed ข้อมูลจำลองครบชุด
npm run prisma:seed

# เปิดดูฐานข้อมูลผ่าน Prisma Studio GUI
npm run prisma:studio
```
