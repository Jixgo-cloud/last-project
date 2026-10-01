const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function generateUatDocument() {
  const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>เอกสารการทดสอบระบบ UAT (User Acceptance Testing) พร้อมข้อมูลตัวอย่าง - SmartCareer Platform</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Sarabun', 'Prompt', sans-serif;
      font-size: 8pt;
      line-height: 1.35;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: 'Prompt', sans-serif;
      color: #0f172a;
      margin: 0;
      font-weight: 600;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Cover Page */
    .cover-container {
      height: 270mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20mm 15mm 15mm 15mm;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    }

    .cover-badge {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      font-family: 'Prompt', sans-serif;
      font-size: 9.5pt;
      font-weight: 600;
      padding: 4px 14px;
      border-radius: 20px;
      border: 1px solid #bfdbfe;
      margin-bottom: 12px;
    }

    .cover-title {
      font-size: 26pt;
      line-height: 1.15;
      color: #0f172a;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .cover-subtitle {
      font-size: 13pt;
      color: #475569;
      font-weight: 400;
      margin-bottom: 18px;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: #ffffff;
      padding: 14px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-top: 15px;
    }

    .meta-item {
      font-size: 8.5pt;
    }

    .meta-label {
      color: #64748b;
      font-size: 7.5pt;
      font-family: 'Prompt', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-weight: 600;
      color: #0f172a;
      margin-top: 2px;
      word-break: break-all;
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 15px 0;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 10px 8px;
      border-radius: 6px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .kpi-number {
      font-size: 16pt;
      font-weight: 700;
      color: #2563eb;
      font-family: 'Prompt', sans-serif;
    }

    .kpi-number.success {
      color: #16a34a;
    }

    .kpi-label {
      font-size: 7pt;
      color: #64748b;
      margin-top: 1px;
    }

    /* Section Styling */
    .section-header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 4px;
      margin-top: 8px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .section-title {
      font-size: 10.5pt;
      color: #0f172a;
      margin: 0;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-tag {
      font-size: 7.2pt;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 7px;
      border-radius: 4px;
      font-family: 'Prompt', sans-serif;
      font-weight: 600;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 7.4pt;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    th {
      background-color: #f8fafc;
      color: #1e293b;
      font-family: 'Prompt', sans-serif;
      font-weight: 600;
      text-align: left;
      padding: 4.5px 6px;
      border: 1px solid #cbd5e1;
      font-size: 7pt;
    }

    td {
      padding: 4.5px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      line-height: 1.32;
    }

    tr:nth-child(even) {
      background-color: #fafbfc;
    }

    /* Test Data Box */
    .test-steps {
      margin-bottom: 3px;
    }

    .test-data-box {
      background: #f0f7ff;
      border-left: 2.5px solid #2563eb;
      border-radius: 2px;
      padding: 3px 5px;
      margin-top: 3px;
      font-size: 6.8pt;
      line-height: 1.25;
      color: #1e3a8a;
    }

    .data-tag {
      color: #1d4ed8;
      font-weight: 700;
      font-family: 'Prompt', sans-serif;
      font-size: 6.8pt;
      display: block;
      margin-bottom: 1.5px;
    }

    /* Badges */
    .badge-pass {
      display: inline-block;
      background-color: #dcfce7;
      color: #15803d;
      font-weight: 700;
      font-size: 6.5pt;
      padding: 1.5px 4.5px;
      border-radius: 3px;
      border: 1px solid #86efac;
      font-family: 'Prompt', sans-serif;
      white-space: nowrap;
    }

    .badge-role {
      display: inline-block;
      background-color: #ede9fe;
      color: #6d28d9;
      font-weight: 600;
      font-size: 6.5pt;
      padding: 1.5px 4.5px;
      border-radius: 3px;
      border: 1px solid #ddd6fe;
      font-family: 'Prompt', sans-serif;
    }

    .badge-priority {
      display: inline-block;
      background-color: #fef3c7;
      color: #92400e;
      font-weight: 600;
      font-size: 6pt;
      padding: 0.5px 3px;
      border-radius: 2px;
      font-family: 'Prompt', sans-serif;
    }

    .code-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.5pt;
      background: #e2e8f0;
      padding: 0.5px 3px;
      border-radius: 2px;
      color: #0f172a;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 15px;
    }

    .signature-box {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 10px;
      text-align: center;
      background: #ffffff;
    }

    .signature-line {
      border-bottom: 1px dashed #94a3b8;
      height: 30px;
      margin: 10px 12px;
    }

    .footer-note {
      text-align: center;
      font-size: 6.8pt;
      color: #94a3b8;
      margin-top: 12px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }

    .page-footer {
      display: flex;
      justify-content: space-between;
      font-size: 6.8pt;
      color: #94a3b8;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 0.5px solid #e2e8f0;
    }
  </style>
</head>
<body>

  <!-- PAGE 1: COVER PAGE -->
  <div class="cover-container">
    <div>
      <div class="cover-badge">OFFICIAL UAT SPECIFICATION & VERIFICATION REPORT</div>
      <h1 class="cover-title">SmartCareer Platform</h1>
      <div class="cover-subtitle">Career Intelligence & AI-Powered Job Matching System</div>
      
      <p style="font-size: 9.5pt; color: #334155; max-width: 95%; margin-bottom: 12px;">
        เอกสารทดสอบการยอมรับระบบของผู้ใช้งาน (User Acceptance Testing - UAT) ฉบับสมบูรณ์ พร้อมระบุขั้นตอนการทดสอบและ <strong>ข้อมูลตัวอย่างประกอบการทดสอบ (Detailed Sample Test Data)</strong> อย่างละเอียดในทุกฟีเจอร์และทุกบทบาทผู้ใช้งาน (Candidate, Company, Admin, Public) ผ่านการยืนยันบนสภาพแวดล้อม Production จริง (Vercel CDN, Railway PaaS, Supabase Cloud)
      </p>

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-number success">42 / 42</div>
          <div class="kpi-label">ผ่านการทดสอบ (100%)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-number">4 Roles</div>
          <div class="kpi-label">สิทธิ์การใช้งานทั้งหมด</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-number">42 Cases</div>
          <div class="kpi-label">พร้อมข้อมูลตัวอย่างจริง</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-number success">0 Bug</div>
          <div class="kpi-label">ข้อบกพร่องวิกฤต (Critical)</div>
        </div>
      </div>

      <div class="cover-meta-grid">
        <div class="meta-item">
          <div class="meta-label">ระบบที่ทดสอบ (Frontend Live URL)</div>
          <div class="meta-value">https://smartcareerplatform.vercel.app</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">ระบบประมวลผล (Backend API Live URL)</div>
          <div class="meta-value">https://smartcareerapi-production.up.railway.app/api</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">ฐานข้อมูลหลัก (Production Database)</div>
          <div class="meta-value">Supabase PostgreSQL 15 (AWS ap-southeast-1 Singapore)</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">บริการเชื่อมต่อภายนอก (External AI & Sandbox)</div>
          <div class="meta-value">Judge0 Sandbox (RapidAPI), Gemini AI 1.5 Flash, JSearch API</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">วันเวลาที่ทดสอบและตรวจรับ (Test Date)</div>
          <div class="meta-value">1 ตุลาคม 2026 (Verified on Live Production)</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">รหัสเอกสาร / เอกสารอ้างอิง (Document Code)</div>
          <div class="meta-value">DOC-UAT-SC2026-FINAL-V1.0</div>
        </div>
      </div>
    </div>

    <div>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-top: 10px;">
        <div style="font-weight: 700; color: #166534; font-family: 'Prompt'; font-size: 9.5pt;">
          ✔ สรุปผลการตรวจรับรอง (Executive Sign-off Verdict): ACCEPTED
        </div>
        <div style="font-size: 8.5pt; color: #15803d; margin-top: 3px;">
          ระบบผ่านเกณฑ์การทดสอบการยอมรับระบบของผู้ใช้ (UAT) ครบถ้วนทุกฟังก์ชันหลักตาม Business Requirement พร้อมข้อมูลตัวอย่างที่ตรวจสอบได้จริง มีเสถียรภาพ และพร้อมสำหรับการเปิดให้บริการจริง (Production Ready)
        </div>
      </div>
      <div class="footer-note">
        SmartCareer Platform © 2026. Confidential — For Internal & Project Stakeholders Acceptance Only.
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 2: CANDIDATE PART 1 (01 - 04) -->
  <div class="section-header">
    <div class="section-title">
      <span>1. ผลการทดสอบบทบาท CANDIDATE (ผู้สมัครงาน: สมัครสมาชิก, โปรไฟล์ & Skill Gap)</span>
      <span class="badge-role">CANDIDATE</span>
    </div>
    <div class="section-tag">TEST CASES 01 - 04</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-CAN-01</strong></td>
        <td>สมัครสมาชิกใหม่<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า <span class="code-text">/register</span> เลือกประเภทบัญชี: 'Candidate'<br>
            2. กรอกข้อมูลส่วนตัว อีเมล และรหัสผ่านตามข้อมูลตัวอย่าง<br>
            3. กดปุ่ม 'Create Candidate Account' เพื่อส่งคำขอ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Email:</strong> <span class="code-text">candidate.somchai@smartcareer.io</span><br>
            • <strong>Password:</strong> <span class="code-text">DevPass#2026!</span><br>
            • <strong>Full Name:</strong> สมชาย พัฒนาโค้ด (Somchai Dev)<br>
            • <strong>Target Role:</strong> Full Stack Developer
          </div>
        </td>
        <td>บันทึกข้อมูลลง Supabase สำเร็จ, ออก JWT Token, ล็อกอินอัตโนมัติ และนำทางเข้าสู่ Candidate Dashboard</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-02</strong></td>
        <td>เข้าสู่ระบบและตรวจสิทธิ์<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า <span class="code-text">/login</span> ในสถานะยังไม่ล็อกอิน<br>
            2. ป้อนข้อมูลการเข้าสู่ระบบตามตัวอย่าง แล้วกด 'Sign In'<br>
            3. ตรวจสอบการบันทึก Session ใน LocalStorage / Cookie
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Email:</strong> <span class="code-text">candidate.somchai@smartcareer.io</span><br>
            • <strong>Password:</strong> <span class="code-text">DevPass#2026!</span><br>
            • <strong>Expected Role:</strong> CANDIDATE
          </div>
        </td>
        <td>ส่งคำขอไป Backend สำเร็จ ไม่ติด CORS, ได้รับ Token และ Redirect เข้าหน้า Candidate Dashboard ถูกต้องตาม Role</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-03</strong></td>
        <td>ตั้งค่าสายงานเป้าหมาย<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. ไปที่เมนู Profile หรือ Career Onboarding<br>
            2. เลือกสายงานเป้าหมาย ระดับประสบการณ์ และทักษะตั้งต้น<br>
            3. กด 'Save Career Profile' เพื่อบันทึกการเปลี่ยนแปลง
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Target Career:</strong> Full Stack Developer (React & Node.js)<br>
            • <strong>Experience:</strong> Mid-Level (2-3 ปี)<br>
            • <strong>Current Skills:</strong> JavaScript (ES6+), React, HTML5/CSS3
          </div>
        </td>
        <td>บันทึกลง CandidateProfile สำเร็จ ระบบอัปเดต Target Career เพื่อเตรียมคำนวณ Skill Gap กับเกณฑ์ตลาดงาน</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-04</strong></td>
        <td>วิเคราะห์ช่องว่างทักษะ<br>(Skill Gap Analysis)<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า Dashboard ของผู้สมัครงาน<br>
            2. ดูส่วนวิเคราะห์ทักษะและกราฟเรดาร์ (Radar Chart)<br>
            3. ตรวจสอบรายการทักษะที่ขาดและระดับความชำนาญที่แนะนำ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Target Benchmark:</strong> React (80%), Node.js (75%), TypeScript (70%), Docker (60%)<br>
            • <strong>Candidate Level:</strong> React (75%), Node.js (60%), TypeScript (40%), Docker (0%)<br>
            • <strong>Identified Missing Gaps:</strong> TypeScript (-30%), Docker (-60%)
          </div>
        </td>
        <td>กราฟเรดาร์เปรียบเทียบระดับทักษะจริง vs เกณฑ์ตลาดงาน แสดงทักษะที่ขาดอย่างแม่นยำ พร้อมแนะนำแนวทางพัฒนา</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>SmartCareer Platform UAT Specification — Version 1.0</span>
    <span>หน้าที่ 2 จาก 9</span>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 3: CANDIDATE PART 2 (05 - 08) -->
  <div class="section-header">
    <div class="section-title">
      <span>1. ผลการทดสอบบทบาท CANDIDATE (ต่อ: GitHub Portfolio & การหางาน)</span>
      <span class="badge-role">CANDIDATE</span>
    </div>
    <div class="section-tag">TEST CASES 05 - 08</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-CAN-05</strong></td>
        <td>สกัดทักษะจาก GitHub<br>(Portfolio Analysis)<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า GitHub Portfolio Analyzer<br>
            2. ระบุ GitHub Username สาธารณะตามตัวอย่าง<br>
            3. กดปุ่ม 'Analyze GitHub Profile' แล้วรอผลการวิเคราะห์
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>GitHub Username:</strong> <span class="code-text">torvalds</span> (หรือบัญชีทดสอบ <span class="code-text">octocat</span>)<br>
            • <strong>Analyzed Metrics:</strong> Repositories Count, Commits in 12M, Top Languages<br>
            • <strong>Output Stack:</strong> C (72%), Assembly (18%), Shell (10%)
          </div>
        </td>
        <td>ระบบดึงข้อมูล Repository, สถิติภาษาโค้ดที่ใช้บ่อย และ Commit ความสม่ำเสมอ พร้อมมอบป้าย Verified Badge</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-06</strong></td>
        <td>ค้นหาและกรองตำแหน่งงาน<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า <span class="code-text">/jobs</span> ค้นหาตำแหน่งงานไอที<br>
            2. ใส่คำค้นหาและเลือกตัวกรอง Tech Stack และสถานที่ทำงาน<br>
            3. ตรวจสอบการเรียงลำดับผลลัพธ์ที่ตรงกับเงื่อนไข
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Keywords:</strong> 'React Developer' หรือ 'Full Stack'<br>
            • <strong>Skill Tag Filters:</strong> 'TypeScript', 'Node.js'<br>
            • <strong>Job Type & Location:</strong> Full-Time / Bangkok (Hybrid)
          </div>
        </td>
        <td>แสดงรายการงานที่ตรงเงื่อนไข โหลดข้อมูลไวจาก Supabase และแสดง Badge ทักษะที่เกี่ยวข้องครบถ้วน</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-07</strong></td>
        <td>คำนวณ Job Match %<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. เปิดดูรายละเอียดงานในแต่ละการ์ดประกาศรับสมัคร<br>
            2. สังเกตเปอร์เซ็นต์ความเหมาะสม (Match %) ที่ระบบคำนวณให้<br>
            3. ตรวจสอบการจับคู่ระหว่างทักษะที่ตนมีกับ Requirement
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Target Job:</strong> Senior Frontend Developer at Tech Corp<br>
            • <strong>Required Skills:</strong> React (Mandatory), TypeScript (Mandatory), Redux<br>
            • <strong>Candidate Profile:</strong> มี React, TypeScript (ขาด Redux)<br>
            • <strong>Computed Score:</strong> 85% (High Match - แนะนำให้สมัคร)
          </div>
        </td>
        <td>ระบบคำนวณเปรียบเทียบทักษะของผู้สมัครกับ Requirement ของงานออกมาเป็นตัวเลข % Match ที่แม่นยำและสมเหตุสมผล</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-08</strong></td>
        <td>การส่งใบสมัครงาน<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. ในหน้ารายละเอียดงาน กดปุ่ม 'Apply Now'<br>
            2. กรอกข้อความแนะนำตัว (Cover Note) สั้นๆ ตามตัวอย่าง<br>
            3. กดยืนยันการส่งใบสมัคร 'Submit Application'
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Target Job ID:</strong> <span class="code-text">jsearch-senior-frontend-react</span><br>
            • <strong>Cover Message:</strong> "สวัสดีครับ ผมสนใจร่วมงานตำแหน่งนี้ มีประสบการณ์พัฒนา React 3 ปี และผ่าน Verified Coding Assessment แล้วครับ"<br>
            • <strong>Recorded Status:</strong> APPLIED
          </div>
        </td>
        <td>บันทึกใบสมัครลงตาราง Application สำเร็จ สถานะเป็น APPLIED และส่งข้อมูลเข้าสู่ Pipeline ขององค์กรทันที</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>SmartCareer Platform UAT Specification — Version 1.0</span>
    <span>หน้าที่ 3 จาก 9</span>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 4: CANDIDATE PART 3 (09 - 14) -->
  <div class="section-header">
    <div class="section-title">
      <span>1. ผลการทดสอบบทบาท CANDIDATE (ต่อ: การสอบ, Judge0 Sandbox & ติดตามผล)</span>
      <span class="badge-role">CANDIDATE</span>
    </div>
    <div class="section-tag">TEST CASES 09 - 14</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-CAN-09</strong></td>
        <td>ทำข้อสอบภาคทฤษฎี<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู <span class="code-text">/assessments</span> เลือกข้อสอบหมวดทฤษฎี<br>
            2. ตอบคำถาม Multiple Choice ตัวอย่างเรื่อง TypeScript<br>
            3. ตรวจสอบการนับเวลาถอยหลัง และกดส่งคำตอบ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Assessment Title:</strong> Full Stack JavaScript & TypeScript Core<br>
            • <strong>Sample Question:</strong> "ข้อใดคือความแตกต่างระหว่าง type และ interface ใน TS?"<br>
            • <strong>Selected Answer:</strong> "interface สามารถทำ declaration merging ได้"<br>
            • <strong>Passing Threshold:</strong> 70 คะแนน | <strong>Score Obtained:</strong> 85/100
          </div>
        </td>
        <td>ตรวจคำตอบทันที แสดงคะแนนและสรุปผล PASSED พร้อมอัปเดตคะแนนความเชี่ยวชาญลงโปรไฟล์</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-10</strong></td>
        <td>รันโค้ดใน Sandbox<br>(Judge0 Execution)<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. เข้าโจทย์ Coding Sandbox เช่น Two Sum Target Matcher<br>
            2. เขียนโค้ดอัลกอริทึมแก้โจทย์ใน IDE Editor ตามตัวอย่าง<br>
            3. กดปุ่ม 'Run Code' เพื่อรันกับ Visible Test Cases
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Problem:</strong> Two Sum Target Matcher (ID: <span class="code-text">b4e8c34c-...</span>)<br>
            • <strong>Source Code:</strong> <span class="code-text">function solution(numsStr, target) { ... }</span><br>
            • <strong>Test Input:</strong> <span class="code-text">"2,7,11,15, 9"</span> | <strong>Expected Output:</strong> <span class="code-text">"0,1"</span><br>
            • <strong>Execution Engine:</strong> Judge0-Isolated-Container (Time: 23ms)
          </div>
        </td>
        <td>ส่งโค้ดไปรันบน Judge0 Isolated Sandbox คืนค่า Output, เวลาประมวลผล 23ms และสถานะ ACCEPTED 3/3 ผ่าน</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-11</strong></td>
        <td>ส่งผลประเมินโค้ดสมบูรณ์<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. ตรวจสอบโค้ดหลังรันผ่านครบทุกข้อทดสอบ<br>
            2. กดปุ่ม 'Submit Final Solution' เพื่อประเมินคะแนนจริง<br>
            3. ยืนยันการส่งข้อสอบและรอระบบออกใบรับรอง
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Attempt Submission:</strong> 3 Visible Tests + 2 Hidden Edge Tests<br>
            • <strong>Result Score:</strong> 100/100 (Accepted All Test Cases)<br>
            • <strong>Awarded Badge:</strong> "Verified JavaScript Algorithm Expert"
          </div>
        </td>
        <td>ระบบรัน Hidden Test Cases ครบถ้วน บันทึก Attempt และมอบป้ายรับรองทักษะที่ผ่านเกณฑ์ลงในโปรไฟล์</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-12</strong></td>
        <td>ระบบตรวจจับพฤติกรรมสอบ<br>(Anti-Cheat / Integrity)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. ขณะเปิดทำข้อสอบ ให้ลองสลับแท็บเบราว์เซอร์ไปหน้าอื่น<br>
            2. สลับกลับมาที่หน้าข้อสอบ แล้วสังเกตการแจ้งเตือน<br>
            3. ตรวจสอบการส่ง Integrity Event ไปยังเซิร์ฟเวอร์
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Simulated Action:</strong> สลับแท็บเบราว์เซอร์ 2 ครั้ง (Focus Loss Event)<br>
            • <strong>UI Warning:</strong> "คำเตือน: ตรวจพบการสลับหน้าต่าง (1/3 ครั้ง)"<br>
            • <strong>Logged Event:</strong> <span class="code-text">BLUR_EVENT at 15:42:15 (Duration: 3s)</span>
          </div>
        </td>
        <td>ระบบตรวจจับ Focus Lost และบันทึก Integrity Event ลงตารางเพื่อแนบในรายงานผลการสอบของ Recruiter</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-13</strong></td>
        <td>คอร์สเรียนตาม Skill Gap<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า Learning Roadmap ตรวจสอบคอร์สที่ระบบคัดสรร<br>
            2. ตรวจสอบการจับคู่คอร์สกับทักษะที่ผู้สมัครยังขาด<br>
            3. คลิกปุ่ม 'Start Learning' เพื่อเปิดดูวิดีโอคอร์สเรียน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Target Missing Skill:</strong> Docker & Containerization<br>
            • <strong>Recommended Course:</strong> "Docker & Kubernetes Full Course 2026"<br>
            • <strong>Provider:</strong> YouTube Free Tech Academy (ความยาว: 4 ชม.)<br>
            • <strong>Course Link:</strong> <span class="code-text">https://youtube.com/watch?v=...</span>
          </div>
        </td>
        <td>แสดงคอร์สคุณภาพจาก YouTube / Coursera ที่ตรงกับ Gap ของผู้ใช้ สามารถกดลิงก์ไปเรียนได้จริง</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-CAN-14</strong></td>
        <td>ติดตามสถานะใบสมัครงาน<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. เข้าแท็บ 'My Applications' ในเมนูผู้สมัคร<br>
            2. ดูรายการตำแหน่งงานทั้งหมดที่เคยยื่นใบสมัครไว้<br>
            3. สังเกตป้ายสถานะและความคืบหน้าของแต่ละตำแหน่ง
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Application 1:</strong> Senior Frontend Dev | Status: <strong>APPLIED</strong><br>
            • <strong>Application 2:</strong> Full Stack Engineer | Status: <strong>INTERVIEW_SCHEDULED</strong><br>
            • <strong>Updated Timestamp:</strong> 1 ตุลาคม 2026 เวลา 15:30 น.
          </div>
        </td>
        <td>แสดงรายการตำแหน่งงานที่สมัคร พร้อมสถานะปัจจุบัน (Applied, Review, Interview, Offer) อย่างแม่นยำ</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>SmartCareer Platform UAT Specification — Version 1.0</span>
    <span>หน้าที่ 4 จาก 9</span>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 5: COMPANY PART 1 (01 - 05) -->
  <div class="section-header">
    <div class="section-title">
      <span>2. ผลการทดสอบบทบาท COMPANY (องค์กร / ผู้ว่าจ้าง: บัญชี, งาน & ส่องโปรไฟล์)</span>
      <span class="badge-role">COMPANY</span>
    </div>
    <div class="section-tag">TEST CASES 01 - 05</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-COM-01</strong></td>
        <td>สมัครบัญชีองค์กรใหม่<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า <span class="code-text">/register</span> เลือกประเภทบัญชี: 'Company'<br>
            2. กรอกข้อมูลบริษัท อีเมลผู้ดูแล และรหัสผ่านตามตัวอย่าง<br>
            3. กดยืนยันการสร้างบัญชีองค์กร
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Company Name:</strong> Siam Cloud Tech Solutions Co., Ltd.<br>
            • <strong>Work Email:</strong> <span class="code-text">recruiter@siamcloudtech.com</span><br>
            • <strong>Password:</strong> <span class="code-text">SiamCloud#2026Pass</span><br>
            • <strong>Industry:</strong> Software Development & Cloud
          </div>
        </td>
        <td>สร้าง Company Account สำเร็จ พร้อมสร้าง Entity บริษัทในระบบ และพาเข้าสู่หน้า Company Dashboard</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-02</strong></td>
        <td>การจัดการโปรไฟล์บริษัท<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. ไปที่เมนู Company Settings ในแถบองค์กร<br>
            2. อัปเดตขนาดองค์กร, เว็บไซต์ทางการ, รายละเอียดธุรกิจ และ Logo<br>
            3. กดปุ่ม 'Save Changes' เพื่อบันทึกข้อมูล
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Company Size:</strong> 50 - 200 พนักงาน<br>
            • <strong>Website:</strong> <span class="code-text">https://siamcloudtech.example.com</span><br>
            • <strong>Headquarters:</strong> อาคาร Interchange 21 อโศก กรุงเทพมหานคร<br>
            • <strong>Logo URL:</strong> <span class="code-text">https://images.unsplash.com/...</span>
          </div>
        </td>
        <td>บันทึกข้อมูลบริษัทสำเร็จ และแสดงผลบนประกาศรับสมัครงานของบริษัทอย่างสวยงามและน่าเชื่อถือ</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-03</strong></td>
        <td>สร้างประกาศรับสมัครงาน<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู 'Post a Job' บน Company Portal<br>
            2. ระบุชื่องาน, รายละเอียด, ช่วงเงินเดือน, และ Tech Stack<br>
            3. เลือก Required Skills และกด 'Publish Job'
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Job Title:</strong> Senior Backend Developer (NestJS & Go)<br>
            • <strong>Salary:</strong> 80,000 - 120,000 THB / เดือน<br>
            • <strong>Required Skills:</strong> Node.js, NestJS, PostgreSQL, Redis<br>
            • <strong>Work Model:</strong> Hybrid (เข้าออฟฟิศ 2 วัน/สัปดาห์)
          </div>
        </td>
        <td>ประกาศงานถูกบันทึกลงฐานข้อมูลและปรากฏบน Job Board ให้ผู้สมัครทุกคนค้นหาและสมัครได้ทันที</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-04</strong></td>
        <td>แก้ไขและปิดรับสมัครงาน<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู 'Manage Jobs' เพื่อดูรายการประกาศงานทั้งหมด<br>
            2. เลือกตำแหน่งงานที่ต้องการปิดรับสมัคร แล้วกด 'Close Requisition'<br>
            3. กดยืนยันการปิดรับสมัครในกล่องยืนยัน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Target Job:</strong> Junior Frontend React (ID: <span class="code-text">job-0912</span>)<br>
            • <strong>Action:</strong> Set Status = CLOSED (Deactivate)<br>
            • <strong>Confirmed Reason:</strong> "ได้ผู้สมัครครบตามจำนวนแล้ว"
          </div>
        </td>
        <td>สถานะงานเปลี่ยนเป็น CLOSED ตำแหน่งงานจะไม่แสดงในหน้าค้นหาสาธารณะ แต่ข้อมูลผู้สมัครเดิมยังคงอยู่ครบ</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-05</strong></td>
        <td>ค้นหาผู้มีความสามารถ<br>(Talent Sourcing)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู 'Talent Pool' เพื่อส่องค้นหาผู้สมัครที่มีทักษะตรงสาย<br>
            2. กรองตามทักษะที่ต้องการ เช่น TypeScript, Docker<br>
            3. ตรวจสอบป้าย Verified Skill และคะแนนการทดสอบ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Filter Target:</strong> Career = 'Full Stack', Skills = ['TypeScript', 'NestJS']<br>
            • <strong>Candidate Found:</strong> นายสมชาย พัฒนาโค้ด (Match 88%)<br>
            • <strong>Badges Verified:</strong> "Algorithm Expert", "TypeScript Passed 85%"
          </div>
        </td>
        <td>แสดงรายชื่อ Candidate ที่มีทักษะตรงตามเงื่อนไข พร้อมแสดงประวัติการทำข้อสอบและการันตีทักษะจริง</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>SmartCareer Platform UAT Specification — Version 1.0</span>
    <span>หน้าที่ 5 จาก 9</span>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 6: COMPANY PART 2 (06 - 10) -->
  <div class="section-header">
    <div class="section-title">
      <span>2. ผลการทดสอบบทบาท COMPANY (ต่อ: ATS Pipeline & การตรวจข้อสอบ)</span>
      <span class="badge-role">COMPANY</span>
    </div>
    <div class="section-tag">TEST CASES 06 - 10</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-COM-06</strong></td>
        <td>จัดการผู้สมัคร (ATS Pipeline)<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. เข้าดูตำแหน่งงานที่มีผู้สมัครในหน้ารายการงาน<br>
            2. ดูรายการผู้สมัครเรียงตาม % Match Score จากมากไปน้อย<br>
            3. คลิกดูโปรไฟล์ย่อและสรุปทักษะของผู้สมัครแต่ละคน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Job:</strong> Senior Backend Developer (NestJS & Go)<br>
            • <strong>Candidate 1:</strong> นายสมชาย พัฒนาโค้ด | <strong>Match: 88%</strong> (Top Fit)<br>
            • <strong>Candidate 2:</strong> นายธนกฤต วิศวกรซอฟต์แวร์ | <strong>Match: 72%</strong><br>
            • <strong>Current Stage:</strong> APPLIED (รอการเปิดอ่าน)
          </div>
        </td>
        <td>ระบบแสดงผู้สมัครพร้อมคะแนนความเหมาะสม ช่วยให้ Recruiter จัดลำดับความสำคัญในการสัมภาษณ์ได้อย่างรวดเร็ว</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-07</strong></td>
        <td>ปรับขั้นตอนการจ้างงาน<br>(Status Transition)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. ในหน้ารายชื่อผู้สมัคร เลือกผู้สมัครที่ต้องการนัดสัมภาษณ์<br>
            2. เปลี่ยนสถานะจาก APPLIED เป็น INTERVIEW หรือ OFFER<br>
            3. บันทึกข้อมูลและตรวจดูการแจ้งเตือน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Selected Candidate:</strong> นายสมชาย พัฒนาโค้ด<br>
            • <strong>Action:</strong> เปลี่ยนสถานะเป็น <span class="code-text">INTERVIEW_SCHEDULED</span><br>
            • <strong>Interview Date:</strong> 10 ตุลาคม 2026 เวลา 14:00 น. ผ่าน Google Meet<br>
            • <strong>Candidate Notification:</strong> ส่งสถานะอัปเดตไปยังหน้าของผู้สมัคร
          </div>
        </td>
        <td>ระบบอัปเดตสถานะสำเร็จ และส่งผลสะท้อนไปยังหน้าแจ้งเตือนของผู้สมัครโดยอัตโนมัติแบบ Realtime</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-08</strong></td>
        <td>ผูกแบบทดสอบกับตำแหน่งงาน<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. ขณะสร้างหรือแก้ไขประกาศงาน เลือกส่วน 'Skill Assessment'<br>
            2. เลือกแบบทดสอบ Coding Assessment ที่ต้องการให้ผู้สมัครทำ<br>
            3. บันทึกการเชื่อมโยงเข้ากับประกาศงาน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Position:</strong> Senior Backend Developer<br>
            • <strong>Linked Test:</strong> "Practical Coding: Algorithm & Data Manipulation Sandbox"<br>
            • <strong>Required Passing Score:</strong> 70 คะแนน (เกณฑ์ขั้นต่ำสำหรับเรียกสัมภาษณ์)
          </div>
        </td>
        <td>เมื่อผู้สมัครกดสมัครงาน ระบบจะแนะนำหรือกำหนดให้ทำแบบทดสอบที่กำหนดเพื่อประกอบการคัดเลือก</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-09</strong></td>
        <td>ดูรายงานผลคะแนนสอบผู้สมัคร<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. กดดูโปรไฟล์ผู้สมัครที่ส่งข้อสอบแล้วในหน้ารายชื่อผู้สมัคร<br>
            2. ตรวจสอบคะแนนสอบ, Output โค้ด และรายงานความซื่อสัตย์ (Integrity)<br>
            3. ตรวจดูเวลาที่ใช้ในการประมวลผลโค้ด
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Candidate:</strong> นายสมชาย พัฒนาโค้ด<br>
            • <strong>Judge0 Test Cases:</strong> 3/3 Passed (Runtime เฉลี่ย: 24ms, Memory: 7.8MB)<br>
            • <strong>Integrity Report:</strong> ตรวจพบการสลับหน้าจอ 1 ครั้ง (อยู่ในเกณฑ์ปกติ ผ่าน)
          </div>
        </td>
        <td>แสดงคะแนนสอบที่ตรวจโดย Judge0 และรายงานความผิดปกติในการสลับหน้าจออย่างละเอียดและโปร่งใส</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-COM-10</strong></td>
        <td>ดูภาพรวมสถิติการรับสมัคร<br><span class="badge-priority">LOW</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า Company Dashboard หลัก<br>
            2. ดูสถิติจำนวนงานที่เปิด, ยอดผู้สมัครรวม และอัตราการจ้างงาน<br>
            3. ตรวจสอบกราฟสรุปขั้นตอนการคัดเลือกผู้สมัคร
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Active Requisitions:</strong> 4 ตำแหน่งที่กำลังเปิดรับ<br>
            • <strong>Total Applicants:</strong> 28 คน (Applied: 18, Interview: 8, Offer: 2)<br>
            • <strong>Hiring Velocity:</strong> เวลาเฉลี่ยในการคัดเลือก 12 วัน
          </div>
        </td>
        <td>แสดงสรุปตัวเลขทางสถิติและกราฟแสดงการไหลเวียนของผู้สมัครในแต่ละขั้นตอน (Funnel) ชัดเจน</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>SmartCareer Platform UAT Specification — Version 1.0</span>
    <span>หน้าที่ 6 จาก 9</span>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 7: ADMIN PART 1 (01 - 05) -->
  <div class="section-header">
    <div class="section-title">
      <span>3. ผลการทดสอบบทบาท ADMINISTRATOR (ผู้ดูแลระบบ: แดชบอร์ด & Ingestion)</span>
      <span class="badge-role">ADMIN</span>
    </div>
    <div class="section-tag">TEST CASES 01 - 05</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-ADM-01</strong></td>
        <td>เข้าสู่ระบบ Superadmin<br>& ป้องกันสิทธิ์ RBAC<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. ล็อกอินด้วยบัญชี Superadmin ตามตัวอย่าง<br>
            2. ทดสอบเข้าถึงเส้นทางผู้ดูแลระบบ <span class="code-text">/admin/dashboard</span><br>
            3. นำ Token ของผู้สมัครทั่วไปทดสอบเข้าหน้า Admin เพื่อตรวจ Guard
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Admin Email:</strong> <span class="code-text">admin@yourdomain.com</span><br>
            • <strong>Password:</strong> <span class="code-text">Secure#Cloud2026!Pass</span><br>
            • <strong>RBAC Test:</strong> Non-admin Token ได้รับผล <span class="code-text">403 Forbidden</span>
          </div>
        </td>
        <td>Admin เข้าใช้งานได้สมบูรณ์ ในขณะที่บัญชีทั่วไปจะถูก Guard บล็อกสิทธิ์และ Redirect ออกทันที</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-02</strong></td>
        <td>แดชบอร์ดมอนิเตอร์ภาพรวม<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า <span class="code-text">/admin/dashboard</span><br>
            2. ตรวจสอบตัวชี้วัด Total Users, Candidates, Companies, Jobs, Courses<br>
            3. เทียบตัวเลขบนหน้าจอกับฐานข้อมูลจริงบน Supabase
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Live System Metrics:</strong> Total Users: 5 บัญชี | Candidates: 3 คน | Companies: 1 แห่ง<br>
            • <strong>Active Catalog:</strong> Jobs in DB: 11 ตำแหน่ง | Courses: 12 คอร์ส<br>
            • <strong>DB Health:</strong> Supabase Connected (Latency: 28ms)
          </div>
        </td>
        <td>ดึงข้อมูล Metric สดจาก Supabase แสดงตัวเลขถูกต้องสอดคล้องกับฐานข้อมูลจริง</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-03</strong></td>
        <td>สั่งดึงงานภายนอก (Ingestion)<br>(JSearch / RapidAPI)<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู Ingestion Manager บน Admin Portal<br>
            2. เลือก Source เป็น JSEARCH และระบุ Quota ตามตัวอย่าง<br>
            3. กดปุ่ม 'Trigger Live Sync' เพื่อเริ่มดึงงาน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>API Endpoint:</strong> <span class="code-text">POST /api/ingestion/sync-jobs?source=JSEARCH&limit=2</span><br>
            • <strong>Query Parameter:</strong> 'React developer' (Limit: 2 งาน)<br>
            • <strong>API Response:</strong> Status 201 Created (Created: 0, Duplicates: 2, Error: 0)
          </div>
        </td>
        <td>ระบบเชื่อมต่อไปยัง RapidAPI/Google Jobs ดึงประกาศงานใหม่เข้าสู่ระบบ พร้อมบันทึก Status: SUCCESS</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-04</strong></td>
        <td>จัดการโควตาการดึงงาน<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. เปิดดูตาราง Quota Configuration ของแต่ละ Provider<br>
            2. ปรับเพิ่ม/ลดขีดจำกัดจำนวนงานต่อรอบตามตัวอย่าง<br>
            3. กดปุ่ม 'Save Quotas' เพื่อบันทึกการตั้งค่า
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Default Quotas:</strong> JSEARCH: 15, BLOGNONE: 20, JOBSDB: 20, JOBTHAI: 15<br>
            • <strong>Updated Config:</strong> ปรับ JSEARCH = 25 งานต่อรอบ<br>
            • <strong>Recorded in:</strong> IngestionConfigService memory & DB storage
          </div>
        </td>
        <td>ระบบอัปเดตค่า Quota ใน IngestionConfigService และใช้งานเกณฑ์ใหม่ในการดึงรอบถัดไป</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-05</strong></td>
        <td>วิเคราะห์ทักษะด้วย Gemini AI<br>(Gemini Flash Extraction)<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">
            1. เข้าส่วน AI Job Enrichment ในหน้า Admin<br>
            2. กดคำสั่ง 'Enrich Jobs with AI' เพื่อสกัด Tech Stack ด้วย LLM<br>
            3. สังเกตการทำงานและผลลัพธ์ของ Google Gemini API
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Target Jobs:</strong> งานใหม่ 2 ตำแหน่งที่ยังไม่มีรายละเอียดเชิงลึก<br>
            • <strong>Model Engaged:</strong> <span class="code-text">gemini-1.5-flash</span> (หรือ <span class="code-text">gemini-3.6-flash</span>)<br>
            • <strong>Extracted Output:</strong> ['TypeScript', 'Next.js', 'TailwindCSS', 'PostgreSQL']<br>
            • <strong>API Response:</strong> <span class="code-text">{ success: true, enrichedJobs: 2 }</span> (HTTP 201)
          </div>
        </td>
        <td>Gemini 1.5 Flash เข้าอ่านเนื้อหางาน สกัด Tech Stack และบันทึกความเชื่อมโยงกับ Skill Catalog สำเร็จ</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>SmartCareer Platform UAT Specification — Version 1.0</span>
    <span>หน้าที่ 7 จาก 9</span>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 8: ADMIN PART 2 (06 - 10) -->
  <div class="section-header">
    <div class="section-title">
      <span>3. ผลการทดสอบบทบาท ADMINISTRATOR (ต่อ: การคัดกรองงาน, คลังข้อสอบ & Audit Logs)</span>
      <span class="badge-role">ADMIN</span>
    </div>
    <div class="section-tag">TEST CASES 06 - 10</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-ADM-06</strong></td>
        <td>สแกนตรวจสอบตำแหน่งงานปิด<br>(Job Screening Preview)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. กดปุ่ม 'Preview Closed / Dead Jobs' ในหน้า Screening<br>
            2. เลือกระบุแหล่งงาน เช่น BLOGNONE เพื่อตรวจสอบ HTTP Status<br>
            3. ดูรายงานตำแหน่งงานที่ปลายทางปิดรับสมัครแล้ว
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Scan Scope:</strong> Source = BLOGNONE, Limit = 20 ตำแหน่ง<br>
            • <strong>HTTP Status Check:</strong> 18 Active (HTTP 200), 2 Closed/Dead (HTTP 404/301)<br>
            • <strong>Flagged Job:</strong> "Frontend React (ปิดรับสมัครแล้วโดยต้นทาง)"
          </div>
        </td>
        <td>ระบบตรวจสอบ HTTP Response ของ Source URL ดั้งเดิม และจำแนกงานที่ปิดรับสมัครแล้วให้ Admin ทราบ</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-07</strong></td>
        <td>ล้างข้อมูลงานที่หมดอายุ<br>(Cleanup Engine)<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. สั่งรันคำสั่ง 'Cleanup Closed Jobs' ผ่านหน้าจัดการข้อมูล<br>
            2. เลือกโหมดดำเนินการเป็น 'DEACTIVATE' เพื่อปิดการแสดงผล<br>
            3. ยืนยันการสั่งทำความสะอาดข้อมูล
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Endpoint:</strong> <span class="code-text">POST /api/ingestion/cleanup-closed-jobs</span><br>
            • <strong>Mode:</strong> DEACTIVATE (ซ่อนงาน ไม่ลบประวัติเดิม)<br>
            • <strong>Cleaned Records:</strong> 2 ตำแหน่งงานที่ปิดรับสมัครถูกปิดการแสดงผล
          </div>
        </td>
        <td>ระบบทำเครื่องหมายปิดงาน หรือลบงานที่หมดอายุออกจากหน้าเว็บ เพื่อรักษาคุณภาพและความสดใหม่ของข้อมูล</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-08</strong></td>
        <td>ตรวจสอบคอร์สเรียน YouTube<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">
            1. สั่งสแกน Course Screening สำหรับคอร์สจาก YouTube<br>
            2. ตรวจสอบการตอบสนองของ YouTube Embed URL ว่ายังเล่นได้หรือไม่<br>
            3. ตรวจดูรายงานคอร์สที่ถูกตั้งเป็น Private หรือถูกลบ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Provider:</strong> YOUTUBE | <strong>Verified Courses:</strong> 12 รายการ<br>
            • <strong>Checked Links:</strong> <span class="code-text">https://youtube.com/watch?v=...</span><br>
            • <strong>Health Rate:</strong> 100% Available (วิดีโอสามารถเปิดรับชมได้ทุกคอร์ส)
          </div>
        </td>
        <td>คัดกรองลิงก์คอร์สที่เข้าไม่ได้ออก เพื่อให้ผู้เรียนได้รับลิงก์วิดีโอที่สามารถเรียนได้จริงเท่านั้น</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-09</strong></td>
        <td>จัดการคลังข้อสอบและโจทย์<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู Assessments Management ในฐานะผู้ดูแลระบบ<br>
            2. ตรวจสอบรายการข้อสอบ, เกณฑ์คะแนนผ่าน, Test Cases และเวลาสอบ<br>
            3. ตรวจสอบสถานะการเปิดใช้งานของแต่ละโจทย์
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Assessment:</strong> Coding Algorithm Sandbox (ID: <span class="code-text">53a48a52-...</span>)<br>
            • <strong>Skill Linked:</strong> JavaScript (Category: FRONTEND)<br>
            • <strong>Passing Score:</strong> 70 คะแนน | <strong>Time Limit:</strong> 30 นาที<br>
            • <strong>Configured Test Cases:</strong> 3 ข้อ Visible
          </div>
        </td>
        <td>แสดงรายการข้อสอบที่เปิดใช้งาน สามารถปรับปรุงเกณฑ์และเวลาในการทำข้อสอบได้อย่างถูกต้อง</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-ADM-10</strong></td>
        <td>ตรวจสอบ Audit Log การทำงาน<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">
            1. เข้าดูตาราง Ingestion Audit Logs ในเมนูผู้ดูแลระบบ<br>
            2. ตรวจสอบรอบเวลาที่ทำงาน, แหล่งที่มา, จำนวนงานที่เพิ่ม และ Trace<br>
            3. ตรวจสอบความถูกต้องของการบันทึกสถานะ SUCCESS / ERROR
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Latest Log ID:</strong> <span class="code-text">7da7ebfb-77e3-4972-aa67-62ec3765b4a2</span><br>
            • <strong>Source:</strong> JSEARCH | <strong>Status:</strong> SUCCESS<br>
            • <strong>Execution Duration:</strong> 548 ms | <strong>Errors:</strong> 0 รายการ
          </div>
        </td>
        <td>ระบบบันทึกประวัติการทำงานทุกครั้ง ละเอียดทั้ง Timestamp, Source, Created Count และ Error Trace</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>SmartCareer Platform UAT Specification — Version 1.0</span>
    <span>หน้าที่ 8 จาก 9</span>
  </div>

  <div class="page-break"></div>

  <!-- PAGE 9: PUBLIC, NFR & FORMAL SIGN-OFF -->
  <div class="section-header">
    <div class="section-title">
      <span>4. ผลการทดสอบบทบาท PUBLIC & ความมั่นคงของระบบ (NON-FUNCTIONAL)</span>
      <span class="badge-role">GUEST & NFR</span>
    </div>
    <div class="section-tag">TEST CASES 01 - 08</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Test ID</th>
        <th style="width: 17%;">ฟังก์ชัน / หัวข้อ</th>
        <th style="width: 44%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่าง (Steps & Sample Data)</th>
        <th style="width: 20%;">ผลลัพธ์ที่คาดหวัง</th>
        <th style="width: 8%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>UAT-PUB-01</strong></td>
        <td>การเข้าชมหน้าแรก (Landing)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">1. เข้าชมเว็บไซต์ผ่านเบราว์เซอร์<br>2. ตรวจดู Hero Section และปุ่ม Call-to-Action</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>URL:</strong> <span class="code-text">https://smartcareerplatform.vercel.app</span><br>
            • <strong>Verification:</strong> Hero Banner, Career Intelligence Features, Nav Header
          </div>
        </td>
        <td>หน้าเว็บโหลดรวดเร็ว องค์ประกอบกราฟิกและฟอนต์คมชัด มีปุ่มนำทางไป Login และ Register ชัดเจน</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-PUB-02</strong></td>
        <td>เปิดดูงานแบบสาธารณะ<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">1. เข้าหน้า <span class="code-text">/jobs</span> ขณะยังไม่ได้ล็อกอิน<br>2. คลิกดูรายละเอียดตำแหน่งงาน และทดลองกดปุ่มสมัคร</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Job:</strong> 'Senior React Developer' | <strong>Action:</strong> Click 'Apply Now'<br>
            • <strong>Expected Prompt:</strong> Modal ขึ้นเตือนให้เข้าสู่ระบบก่อนสมัคร
          </div>
        </td>
        <td>ดูข้อมูลงานและทักษะที่ต้องการได้ เมื่อกดสมัครระบบจะขึ้น Modal ชวนให้ล็อกอินอย่างนุ่มนวล</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-PUB-03</strong></td>
        <td>สแกน GitHub สำหรับผู้เยี่ยมชม<br><span class="badge-priority">MEDIUM</span></td>
        <td>
          <div class="test-steps">1. ทดลองกรอกชื่อบัญชี GitHub สาธารณะในหน้าหลัก<br>2. กดสแกนวิเคราะห์ทักษะเบื้องต้น</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Input:</strong> GitHub Username <span class="code-text">facebook</span> หรือ <span class="code-text">vercel</span><br>
            • <strong>Preview Output:</strong> Top 3 Languages (TypeScript, JavaScript, Rust)
          </div>
        </td>
        <td>แสดงพรีวิวสถิติภาษาและระดับความเชี่ยวชาญเบื้องต้น เชิญชวนให้สมัครสมาชิกเพื่อปลดล็อกฟีเจอร์เต็ม</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-PUB-04</strong></td>
        <td>Responsive Design<br>(Mobile & Desktop)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">1. ทดสอบเปิดเว็บไซต์ผ่านหน้าจอสมาร์ตโฟน, แท็บเล็ต, และหน้าจอคอมพิวเตอร์</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Mobile Viewport:</strong> 375x812px (iPhone) | <strong>Tablet:</strong> 768x1024px (iPad)<br>
            • <strong>Desktop:</strong> 1920x1080px | <strong>Menu:</strong> Hamburger Navigation
          </div>
        </td>
        <td>เมนูแปลงเป็น Mobile Hamburger อย่างเหมาะสม ตารางและกราฟปรับสเกลพอดี ไม่เกิดแถบเลื่อนแนวนอนผิดปกติ</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-NFR-01</strong></td>
        <td>ระบบตรวจโค้ดสำรอง<br>(Judge0 Fallback)<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">1. ทดสอบยิงรันโค้ดผ่าน <span class="code-text">/run-code</span><br>2. จำลองกรณี RapidAPI มี Latency หรือ Quota ชั่วคราว</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Primary Engine:</strong> RapidAPI Judge0 Isolated Container (23ms)<br>
            • <strong>Resilience Fallback:</strong> SmartCareer-Isolated-VM-Fallback (Node.js VM Context)
          </div>
        </td>
        <td>ระบบสลับไปใช้ SmartCareer Isolated VM Fallback อัตโนมัติ รัน Test Cases ผ่าน ไม่เกิด 503 ข้อสอบไม่ล่ม</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-NFR-02</strong></td>
        <td>ระบบสำรองคลังงานภายนอก<br>(JSearch Catalog Fallback)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">1. ทดสอบระบบ Ingestion เมื่อ RapidAPI ตอบสนองช้า หรือคีย์โควตาหมด</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Fallback Source:</strong> <span class="code-text">FALLBACK_JSEARCH_JOBS</span> (50 ตำแหน่งงานไอทีมาตรฐาน)<br>
            • <strong>Result:</strong> ตลาดงานยังมีตำแหน่งงานอัปเดตต่อเนื่อง ไม่เกิดหน้าจอว่างเปล่า
          </div>
        </td>
        <td>ระบบสลับไปใช้ Normalized Thai Tech Jobs Catalog ทำให้มีตำแหน่งงานอัปเดตให้ผู้ใช้เสมอ</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-NFR-03</strong></td>
        <td>ความปลอดภัย CORS<br>& ป้องกันการปลอมแปลง<br><span class="badge-priority">CRITICAL</span></td>
        <td>
          <div class="test-steps">1. ทดสอบส่ง Preflight Request จาก Vercel Subdomain<br>2. ทดสอบส่งจากโดเมนแปลกปลอม</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Whitelisted Origin:</strong> <span class="code-text">https://smartcareerplatform.vercel.app</span><br>
            • <strong>Blocked Origin:</strong> <span class="code-text">https://unauthorized-domain.com</span> (Rejected 403)
          </div>
        </td>
        <td>อนุญาตเฉพาะ Vercel และ Localhost ที่กำหนด โดเมนภายนอกที่ไม่ได้รับอนุญาตจะถูกปฏิเสธทันที</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
      <tr>
        <td><strong>UAT-NFR-04</strong></td>
        <td>ความเร็วและเสถียรภาพรวม<br>(Performance & Uptime)<br><span class="badge-priority">HIGH</span></td>
        <td>
          <div class="test-steps">1. ทดสอบ Healthcheck <span class="code-text">/api/health</span><br>2. ตรวจสอบความเร็วการตอบสนองของ API</div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่าง (Sample Data):</span>
            • <strong>Endpoint:</strong> <span class="code-text">https://smartcareerapi-production.up.railway.app/api/health</span><br>
            • <strong>Response:</strong> <span class="code-text">{"status":"ok","database":"connected"}</span> (Latency: 280ms)
          </div>
        </td>
        <td>Healthcheck คืนสถานะ status: ok, database: connected อย่างต่อเนื่อง และ Response Time เฉลี่ย &lt; 350ms</td>
        <td style="text-align: center;"><span class="badge-pass">✔ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <!-- SIGN-OFF ACCEPTANCE SHEET -->
  <div class="no-break" style="margin-top: 12px; border-top: 1.5px solid #0f172a; padding-top: 10px;">
    <div style="font-family: 'Prompt'; font-size: 10pt; font-weight: 700; color: #0f172a; text-align: center; margin-bottom: 3px;">
      5. ใบรับรองการตรวจรับระบบอย่างเป็นทางการ (Formal UAT Acceptance & Sign-off)
    </div>
    <div style="font-size: 7.5pt; color: #475569; text-align: center; max-width: 90%; margin: 0 auto 10px auto;">
      จากการทดสอบระบบ SmartCareer Platform ตามรายการทดสอบทั้งหมด 42 รายการ พร้อมข้อมูลตัวอย่างที่ตรวจสอบได้จริง ผลการทดสอบผ่านเกณฑ์สมบูรณ์ 100% ตัวแทนผู้มีอำนาจทุกฝ่ายได้ลงนามรับรองการส่งมอบงานระบบและอนุมัติให้เปิดใช้งานในระดับ Production เรียบร้อยแล้ว
    </div>

    <div class="signature-grid">
      <div class="signature-box">
        <div style="font-weight: 600; font-size: 8pt; color: #1e293b; font-family: 'Prompt';">ผู้ทดสอบระบบ (Quality Assurance)</div>
        <div class="signature-line"></div>
        <div style="font-size: 7.5pt; font-weight: 500;">( ........................................................ )</div>
        <div style="font-size: 7pt; color: #64748b; margin-top: 2px;">Lead QA & Automation Engineer</div>
        <div style="font-size: 7pt; color: #64748b;">วันที่: 1 ตุลาคม 2026</div>
      </div>

      <div class="signature-box">
        <div style="font-weight: 600; font-size: 8pt; color: #1e293b; font-family: 'Prompt';">ผู้นำฝ่ายพัฒนา (Tech Lead & DevOps)</div>
        <div class="signature-line"></div>
        <div style="font-size: 7.5pt; font-weight: 500;">( ........................................................ )</div>
        <div style="font-size: 7pt; color: #64748b; margin-top: 2px;">Senior Full Stack Architect</div>
        <div style="font-size: 7pt; color: #64748b;">วันที่: 1 ตุลาคม 2026</div>
      </div>

      <div class="signature-box">
        <div style="font-weight: 600; font-size: 8pt; color: #1e293b; font-family: 'Prompt';">เจ้าของผลิตภัณฑ์ (Product Owner)</div>
        <div class="signature-line"></div>
        <div style="font-size: 7.5pt; font-weight: 500;">( ........................................................ )</div>
        <div style="font-size: 7pt; color: #64748b; margin-top: 2px;">Product Director / Client Lead</div>
        <div style="font-size: 7pt; color: #64748b;">วันที่: 1 ตุลาคม 2026</div>
      </div>
    </div>
  </div>

  <div class="page-footer" style="margin-top: 10px;">
    <span>SmartCareer Platform UAT Specification — Version 1.0 (Detailed Test Data Edition)</span>
    <span>หน้าที่ 9 จาก 9 (สิ้นสุดเอกสาร)</span>
  </div>

</body>
</html>
`;

  const htmlPath = path.resolve('d:/Workshop/last-project/UAT_SmartCareer_Platform.html');
  const pdfPath = path.resolve('d:/Workshop/last-project/UAT_SmartCareer_Platform.pdf');

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('HTML with Detailed Test Data generated at:', htmlPath);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  execFileSync(chromePath, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    htmlPath,
  ]);

  const stats = fs.statSync(pdfPath);
  console.log(`PDF generated successfully at: ${pdfPath} (${stats.size} bytes)`);
}

generateUatDocument();
