# SmartCareer — Oracle Cloud Infrastructure (OCI) Deployment Guide 🚀
**เป้าหมาย**: คู่มือการ Deploy ระบบ SmartCareer ขึ้นบน Oracle Cloud Compute Instance ด้วย Docker & Docker Compose (พร้อม Caddy Auto-HTTPS)

---

## 📋 1. การเลือกสเปกบน Oracle Cloud (OCI Compute Instance)

ขณะนี้คุณอยู่ที่หน้าสร้าง Compute Instance (`https://cloud.oracle.com/compute/instances/create`) แนะนำให้เลือกค่าดังนี้:

### 1.1 Image and Shape (แนะนำตาม Always Free)
- **Image**: **Canonical Ubuntu 22.04** หรือ **Ubuntu 24.04 Minimal/Standard** (ง่ายต่อการติดตั้ง Docker ที่สุด)
- **Shape**:
  - **ตัวเลือกแนะนำสูงสุด (Always Free)**: **Ampere ARM (`VM.Standard.A1.Flex`)**
    - OCPU: `2 - 4 OCPUs`
    - Memory: `12 - 24 GB RAM`
    - *ข้อดี*: ฟรี แรงมาก และ Docker Multi-stage build รองรับ ARM64 โดยตรง ไม่ติดปัญหาหน่วยความจำไม่พอ (OOM)
  - **ตัวเลือกสำรอง (AMD `VM.Standard.E2.1.Micro`)**:
    - 1 OCPU, 1 GB RAM (หากเลือกตัวนี้ **จำเป็นต้องสร้าง Swap File 4GB** ทันทีหลังสร้าง VM ไม่เช่นนั้นคำสั่ง `next build` จะ Crash ด้วย JavaScript Heap Out of Memory)

### 1.2 Networking & SSH Keys
- **Virtual Cloud Network (VCN)**: ใช้ VCN เริ่มต้น (Default) และติ๊ก **Assign a public IPv4 address**
- **Add SSH keys**: 
  - เลือก **Generate a key pair for me** แล้วดาวน์โหลดไฟล์ Private Key (`.key`) เก็บไว้ในเครื่องคอมพิวเตอร์ หรือวาง Public Key ที่มีอยู่

---

## 🛡️ 2. การเปิด Firewall บน Oracle Cloud (จุดสำคัญที่ห้ามลืม!)

Oracle Cloud มี Firewall สองชั้น ต้องเปิดให้ครบทั้ง 2 ชั้น:

### ชั้นที่ 1: OCI VCN Ingress Rules (ใน Cloud Console)
1. ไปที่เมนู **Networking** -> **Virtual Cloud Networks** -> เลือก VCN ของคุณ
2. คลิก **Security Lists** -> เลือก **Default Security List**
3. คลิก **Add Ingress Rules** และเพิ่ม 2 Rules ดังนี้:
   - **Rule 1 (HTTP)**:
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port Range: `80`
   - **Rule 2 (HTTPS)**:
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port Range: `443`

### ชั้นที่ 2: OS-Level Firewall (ภายใน Ubuntu VM)
เมื่อ SSH เข้าไปใน VM แล้ว ให้รันคำสั่งเปิดพอร์ต 80 และ 443 ใน `iptables`:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

---

## ⚙️ 3. การเตรียม Environment บน VM

### 3.1 อัปเดตแพ็กเกจและติดตั้ง Docker & Docker Compose
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker, Git, Curl
sudo apt install -y docker.io docker-compose-v2 git

# Allow current user to run docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

*(กรณีเลือกเครื่อง AMD 1GB RAM ให้รันคำสั่งเพิ่ม Swap 4GB ดังนี้)*:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 🚀 4. การนำโค้ดขึ้น Server และตั้งค่า Config

### 4.1 ดึงโค้ดโปรเจกต์
```bash
# นำโปรเจกต์ขึ้น server (ผ่าน Git หรือ scp / rsync)
git clone <URL_REPOSITORY> smartcareer
cd smartcareer
```

### 4.2 ตั้งค่า Environment Variables (`.env`)
คัดลอกไฟล์ต้นแบบ:
```bash
cp .env.production.example .env
```
เปิดแก้ไขไฟล์ `.env`:
```bash
nano .env
```
ปรับแต่งค่าที่สำคัญดังนี้:
1. `POSTGRES_PASSWORD`: กำหนดรหัสผ่านฐานข้อมูลที่แข็งแรง (เช่น `openssl rand -hex 16`)
2. `JWT_SECRET`: สุ่มคีย์ 64 ตัวอักษร (รันคำสั่ง `openssl rand -base64 32`)
3. `FRONTEND_URL` และ `NEXT_PUBLIC_API_URL`:
   - หากมี Domain: 
     - `FRONTEND_URL="https://smartcareer.yourdomain.com"`
     - `NEXT_PUBLIC_API_URL="https://api.smartcareer.yourdomain.com/api"`
     - `ALLOWED_ORIGINS="https://smartcareer.yourdomain.com"`
   - หากยังไม่มี Domain (ใช้ Public IP ในช่วงทดสอบ):
     - `FRONTEND_URL="http://<YOUR_VM_PUBLIC_IP>"`
     - `NEXT_PUBLIC_API_URL="http://<YOUR_VM_PUBLIC_IP>:4000/api"` หรือ `/api`
4. `GEMINI_API_KEY`: ใส่ API Key ของ Google Gemini
5. `JUDGE0_API_KEY` / `RAPIDAPI_KEY`: ใส่ Key สำหรับ Coding Sandbox (ถ้ามี)

### 4.3 ปรับแต่ง `Caddyfile`
- **กรณีมี Domain Name** (Caddy จะออก SSL Let's Encrypt อัตโนมัติ):
  ```caddy
  smartcareer.yourdomain.com {
      reverse_proxy web:3000
      encode zstd gzip
  }

  api.smartcareer.yourdomain.com {
      reverse_proxy api:4000
      encode zstd gzip
  }
  ```
- **กรณีไม่มี Domain (ใช้ Public IP ช่วงทดสอบ)**:
  ```caddy
  :80 {
      handle /api/* {
          reverse_proxy api:4000
      }
      handle {
          reverse_proxy web:3000
      }
      encode zstd gzip
  }
  ```

---

## 🚢 5. สั่ง Build และ Start Container

รันคำสั่ง Docker Compose เพื่อ Build อิมเมจและรัน Service ทั้ง 4 ตัว:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

ตรวจสอบสถานะของ Container ทั้งหมด:
```bash
docker compose -f docker-compose.prod.yml ps
```
*(ควรแสดงสถานะ `Up (healthy)` สำหรับ postgres และ api, และ `Up` สำหรับ web และ caddy)*

---

## 🗄️ 6. การสร้าง Table ฐานข้อมูล และ Superadmin ครั้งแรก

เนื่องจาก PostgreSQL Container เพิ่งถูกสร้างขึ้นมาใหม่ ต้องรันคำสั่ง Setup Database ดังนี้:

### 6.1 Push โครงสร้างตาราง (Prisma DB Push)
```bash
docker compose -f docker-compose.prod.yml exec api npm run prisma:push
```

### 6.2 Seed ข้อมูลหลัก (Master Skills, Frameworks, Assessments, Courses)
```bash
docker compose -f docker-compose.prod.yml exec -e ALLOW_PRODUCTION_SEED=true api npm run prisma:seed:prod
```

### 6.3 สร้าง Superadmin Account บัญชีแรกของระบบ
รันคำสั่งสร้าง Superadmin (กำหนดอีเมลและรหัสผ่านที่มีตัวพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ ความยาว 12+ ตัวอักษร):
```bash
docker compose -f docker-compose.prod.yml exec -e ADMIN_EMAIL="admin@yourdomain.com" -e ADMIN_PASSWORD="SmartCareer2026!Admin" api npm run admin:create
```

---

## ✅ 7. ตรวจสอบความสมบูรณ์หลัง Deploy (Smoke Test)

1. **เช็ก Health Check API**:
   ```bash
   curl http://localhost:4000/api/health
   # ผลลัพธ์ต้องได้: {"status":"ok","database":"connected",...}
   ```

2. **เปิดเบราว์เซอร์เข้าใช้งาน**:
   - เข้า URL ของ Frontend หรือ Public IP
   - ทดสอบ Login ด้วยบัญชี Superadmin ที่สร้างไว้
   - ตรวจสอบหน้า `/admin/dashboard`, `/jobs`, `/courses`, `/assessments`
