# SmartCareer — Quick Deploy Guide (Vercel + Supabase + Railway/Render) ⚡
**เป้าหมาย**: สถาปัตยกรรมคลาวด์ยุคใหม่ (Modern Jamstack + PaaS) ที่สะดวกที่สุด จัดการผ่าน Web UI ทั้งหมด ไม่ต้องแตะคำสั่ง Linux หรือตั้งค่า Firewall เลย

---

## 🏗️ แผนภาพสถาปัตยกรรม (Architecture Overview)

```
[ Client Browser ]
        │
        ├── 1. เข้าเว็บ (Frontend) ────► [ Vercel (Edge CDN) ]
        │                                  (Next.js 14 App Router)
        │
        └── 2. ยิง API (Backend)  ────► [ Railway หรือ Render ]
                                           (NestJS 10 API Container)
                                                    │
                                                    ▼
                                           [ Supabase (PostgreSQL 16) ]
                                           (Managed Database + UI Editor)
```

---

## 🟢 ขั้นตอนที่ 1: เตรียม Database บน Supabase (ใช้เวลา 2 นาที)

1. สมัคร/เข้าสู่ระบบที่ **[supabase.com](https://supabase.com)** (Login ด้วย GitHub ได้เลย)
2. กด **New Project**:
   - **Name**: `smartcareer-db`
   - **Database Password**: ตั้งรหัสผ่านที่แข็งแรง (จดบันทึกไว้)
   - **Region**: เลือก **Singapore (`ap-southeast-1`)** (ใกล้ไทย เร็วที่สุด)
   - กด **Create new project** (รอระบบสร้าง DB ประมาณ 1 นาที)
3. ไปที่เมนู **Project Settings** (รูปเฟืองซ้ายล่าง) -> **Database**:
   - เลื่อนลงมาที่หัวข้อ **Connection string** -> เลือกแท็บ **URI**
   - โหมด: เลือก **Direct** (พอร์ต 5432)
   - คัดลอก Connection String เช่น:
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```
     *(อย่าลืมแทนที่ `[YOUR-PASSWORD]` ด้วยรหัสผ่านจริงที่ตั้งไว้)*

---

## 🚀 ขั้นตอนที่ 2: รัน Migration ตาราง และสร้าง Admin จากเครื่องคุณเข้า Supabase

คุณสามารถรันคำสั่งจาก Terminal บนเครื่องคอมพิวเตอร์ปัจจุบันเพื่อยิงโครงสร้างตารางและข้อมูล Master Data เข้า Supabase ได้ทันที:

```powershell
# บน PowerShell ในโฟลเดอร์ d:\Workshop\last-project

# 1. กำหนดค่า URL ชี้ไปที่ Supabase
$env:DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# 2. Push โครงสร้างตาราง (Prisma DB Push)
npm run prisma:push

# 3. Seed ข้อมูล Master Data (Skills, Frameworks, Assessments, Courses)
$env:ALLOW_PRODUCTION_SEED="true"
npm run prisma:seed:prod

# 4. สร้างบัญชี Superadmin บัญชีแรก
$env:ADMIN_EMAIL="admin@yourdomain.com"
$env:ADMIN_PASSWORD="SmartCareer2026!Admin"
npm run admin:create
```
*(เมื่อรันเสร็จ คุณสามารถเปิดดูตาราง `users`, `jobs`, `skills` ได้ในเมนู **Table Editor** บนหน้าเว็บ Supabase ทันที!)*

---

## 🚂 ขั้นตอนที่ 3: Deploy Backend API บน Railway หรือ Render (ใช้เวลา 3 นาที)

### ตัวเลือกที่ 3.1: ผ่าน Railway.app (แนะนำสูงสุดสำหรับ Docker)
1. ไปที่ **[railway.app](https://railway.app)** -> กด **Login with GitHub**
2. กด **New Project** -> เลือก **Deploy from GitHub repo** -> เลือก Repo ของคุณ
3. คลิกที่ Service ที่สร้างขึ้น -> ไปที่แท็บ **Settings**:
   - **Build**: เลือก Dockerfile
   - **Dockerfile Path**: ใส่ `Dockerfile.api`
4. ไปที่แท็บ **Variables** -> กด **Add Variable** แล้วใส่ค่าดังนี้:
   - `DATABASE_URL`: วาง Connection String ของ Supabase จากขั้นตอนที่ 1
   - `PORT`: `4000`
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: รหัสสุ่ม 32-64 ตัวอักษร (เช่น `openssl rand -base64 32`)
   - `JWT_EXPIRES_IN`: `7d`
   - `FRONTEND_URL`: `https://<ชื่อโปรเจกต์ของคุณ>.vercel.app` (ใส่ URL Vercel จากขั้นตอนที่ 4)
   - `ALLOWED_ORIGINS`: `https://<ชื่อโปรเจกต์ของคุณ>.vercel.app`
   - `GEMINI_API_KEY`: API Key ของ Google Gemini
5. ไปที่แท็บ **Settings** -> เลื่อนไปที่ **Networking** -> กด **Generate Domain**
   - คุณจะได้ URL Backend ทันที เช่น: `https://smartcareer-api-production.up.railway.app`

*(หรือถ้าใช้ Render.com: กด New -> Web Service -> ต่อ GitHub -> Environment เลือก Docker -> Dockerfile Path ใส่ `Dockerfile.api` -> กรอก Environment Variables แบบเดียวกัน)*

---

## ▲ ขั้นตอนที่ 4: Deploy Frontend บน Vercel (ใช้เวลา 2 นาที)

1. ไปที่ **[vercel.com](https://vercel.com)** -> กด **Add New...** -> เลือก **Project**
2. เลือก Import Repository ของโปรเจกต์นี้จาก GitHub
3. ในหน้า **Configure Project**:
   - **Framework Preset**: เลือก **Next.js**
   - **Root Directory**: ปล่อยเป็น `./` (ค่าเริ่มต้น)
   - ขยายหัวข้อ **Build and Output Settings**:
     - **Build Command**: ติ๊ก Override แล้วใส่:
       ```bash
       npm run build:web
       ```
     - **Output Directory**: ติ๊ก Override แล้วใส่:
       ```bash
       apps/web/.next
       ```
   - ขยายหัวข้อ **Environment Variables** แล้วเพิ่ม:
     - `NEXT_PUBLIC_API_URL`: ใส่ URL ของ Backend จากขั้นตอนที่ 3 ตามด้วย `/api` เช่น:
       ```text
       https://smartcareer-api-production.up.railway.app/api
       ```
     - `NEXT_PUBLIC_SHOW_DEMO_LOGIN`: `false`
4. กดปุ่ม **Deploy**!
   - Vercel จะคอมไพล์ Next.js และเปิดให้เข้าใช้งานทันทีภายใน 60 วินาที ผ่านโดเมน เช่น `https://smartcareer-xxx.vercel.app`

---

## 🔗 ขั้นตอนที่ 5: ตรวจสอบ CORS ให้เชื่อมต่อกันสมบูรณ์

1. เมื่อได้ URL โดเมนของ Vercel แล้ว (เช่น `https://smartcareer-demo.vercel.app`)
2. กลับไปที่ **Railway / Render** ของ Backend API ตรวจสอบว่าตัวแปร:
   - `FRONTEND_URL` = `https://smartcareer-demo.vercel.app`
   - `ALLOWED_ORIGINS` = `https://smartcareer-demo.vercel.app`
3. เปิดเบราว์เซอร์เข้าลิงก์ Vercel -> เข้าสู่ระบบด้วยบัญชี Superadmin ที่สร้างไว้ -> ใช้งานได้ทันที 100%! 🎉
