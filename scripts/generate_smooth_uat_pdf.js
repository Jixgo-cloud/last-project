const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function generateSmoothUatDocument() {
  const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>คู่มือและแบบบันทึกผลการทดสอบระบบ UAT (User Acceptance Testing) - SmartCareer Platform</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
      @bottom-right {
        content: counter(page);
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Sarabun', 'Prompt', sans-serif;
      font-size: 8.5pt;
      line-height: 1.45;
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
      height: 268mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16mm 14mm;
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
      line-height: 1.2;
      color: #0f172a;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .cover-subtitle {
      font-size: 13.5pt;
      color: #475569;
      font-weight: 500;
      margin-bottom: 16px;
    }

    .cover-desc {
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.6;
      max-width: 96%;
      margin-bottom: 16px;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: #ffffff;
      padding: 14px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-top: 14px;
    }

    .meta-item {
      font-size: 8.5pt;
    }

    .meta-label {
      color: #64748b;
      font-size: 7.5pt;
      font-family: 'Prompt', sans-serif;
      font-weight: 600;
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
      margin: 14px 0;
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
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 2px;
    }

    /* Section Styling */
    .section-header {
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 5px;
      margin-top: 10px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .section-title {
      font-size: 11pt;
      color: #0f172a;
      margin: 0;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-tag {
      font-size: 7.5pt;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 2.5px 8px;
      border-radius: 4px;
      font-family: 'Prompt', sans-serif;
      font-weight: 600;
      border: 1px solid #dbeafe;
    }

    .section-desc {
      font-size: 8.5pt;
      color: #475569;
      margin-bottom: 10px;
      line-height: 1.5;
      background: #f8fafc;
      padding: 6px 10px;
      border-left: 3px solid #64748b;
      border-radius: 2px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 8pt;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-family: 'Prompt', sans-serif;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      font-size: 7.8pt;
    }

    td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
      line-height: 1.4;
    }

    tr:nth-child(even) {
      background-color: #f8fafc;
    }

    /* Test Steps & Data Box */
    .test-steps {
      margin-bottom: 5px;
      line-height: 1.45;
    }

    .test-data-box {
      background: #eff6ff;
      border-left: 3px solid #2563eb;
      border-radius: 3px;
      padding: 5px 7px;
      margin-top: 5px;
      font-size: 7.6pt;
      line-height: 1.4;
      color: #1e3a8a;
    }

    .data-tag {
      color: #1d4ed8;
      font-weight: 700;
      font-family: 'Prompt', sans-serif;
      font-size: 7.6pt;
      display: block;
      margin-bottom: 2px;
    }

    /* Badges */
    .badge-priority {
      display: inline-block;
      font-weight: 600;
      font-size: 6.8pt;
      padding: 1.5px 5px;
      border-radius: 3px;
      font-family: 'Prompt', sans-serif;
      margin-top: 3px;
    }

    .badge-critical {
      background-color: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }

    .badge-high {
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
    }

    .badge-medium {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    /* Result Checkboxes for Tester */
    .result-check {
      margin-top: 6px;
      padding-top: 5px;
      border-top: 1px dashed #cbd5e1;
      font-size: 7.2pt;
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .check-box-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: #475569;
    }

    .square {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 1.2px solid #64748b;
      border-radius: 2px;
      background: #ffffff;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 18px;
    }

    .signature-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
      background: #ffffff;
    }

    .signature-line {
      border-bottom: 1px dashed #94a3b8;
      height: 38px;
      margin: 12px 14px 6px 14px;
    }

    .footer-note {
      text-align: center;
      font-size: 7.2pt;
      color: #94a3b8;
      margin-top: 12px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }

    .page-footer {
      display: flex;
      justify-content: space-between;
      font-size: 7.2pt;
      color: #94a3b8;
      margin-top: 8px;
      padding-top: 4px;
      border-top: 0.5px solid #e2e8f0;
    }

    .callout-info {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
      font-size: 8.2pt;
      line-height: 1.5;
    }
  </style>
</head>
<body>

  <!-- ==================== หน้า 1: หน้าปกเอกสาร (COVER PAGE) ==================== -->
  <div class="cover-container">
    <div>
      <div class="cover-badge">OFFICIAL USER ACCEPTANCE TESTING MANUAL (SMOOTH JOURNEY EDITION)</div>
      <h1 class="cover-title">คู่มือและแบบบันทึกผลการทดสอบระบบ UAT</h1>
      <div class="cover-subtitle">SmartCareer Platform · ระบบวิเคราะห์ทักษะและจับคู่งานอัจฉริยะด้วย AI</div>
      
      <p class="cover-desc">
        เอกสารทดสอบการยอมรับระบบของผู้ใช้งาน (User Acceptance Testing: UAT) ฉบับสมบูรณ์ จัดเรียงขั้นตอนการทดสอบตาม <strong>เส้นทางการใช้งานจริงอย่างราบรื่น (Smooth End-to-End Test Journey)</strong> รวม 7 ระยะ 30 กรณีทดสอบ พร้อมระบุ <strong>ข้อมูลตัวอย่างประกอบการทดสอบ (Sample Test Data)</strong> อย่างละเอียดครบถ้วนทุกช่องกรอก และใช้ภาษาสำหรับผู้ใช้งานทั่วไปที่สุภาพ ชัดเจน ปราศจากศัพท์เชิงเทคนิคโปรแกรมเมอร์ เพื่อรองรับการตรวจรับระบบโดยคณะกรรมการและผู้มีส่วนได้ส่วนเสียทุกฝ่าย
      </p>

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-number success">7 Phases</div>
          <div class="kpi-label">ระยะการทดสอบต่อเนื่อง</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-number">30 Cases</div>
          <div class="kpi-label">กรณีทดสอบครอบคลุมทุกฟีเจอร์</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-number">100% Data</div>
          <div class="kpi-label">ข้อมูลตัวอย่างครบทุกช่องกรอก</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-number success">Ready</div>
          <div class="kpi-label">พร้อมตรวจรับและลงนาม</div>
        </div>
      </div>

      <div class="cover-meta-grid">
        <div class="meta-item">
          <div class="meta-label">ระบบที่ทดสอบ (System Web Address)</div>
          <div class="meta-value">https://smartcareerplatform.vercel.app</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">รหัสเอกสารตรวจรับ (Document Reference)</div>
          <div class="meta-value">DOC-UAT-SC2026-JOURNEY-V2.0</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">เวอร์ชันระบบ (System Release)</div>
          <div class="meta-value">SmartCareer Platform Version 2.0.0 (Production Live)</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">วันที่จัดทำเอกสาร (Document Date)</div>
          <div class="meta-value">2 ตุลาคม 2026</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">โครงสร้างการทดสอบ (Testing Paradigm)</div>
          <div class="meta-value">Smooth End-to-End Simulation (Company ➔ Candidate ➔ Assessment ➔ Admin)</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">กลุ่มเป้าหมายผู้ตรวจรับ (Target Stakeholders)</div>
          <div class="meta-value">คณะกรรมการตรวจรับงาน, ผู้จัดการโครงการ, ฝ่ายบริหารทรัพยากรบุคคล (HR)</div>
        </div>
      </div>
    </div>

    <div>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-top: 10px;">
        <div style="font-weight: 700; color: #166534; font-family: 'Prompt'; font-size: 9.5pt;">
          ✔ คำรับรองความพร้อมของระบบ (System Readiness Statement)
        </div>
        <div style="font-size: 8pt; color: #15803d; margin-top: 3px; line-height: 1.45;">
          ระบบ SmartCareer Platform ได้รับการติดตั้ง ทดสอบ และเชื่อมโยงทุกฟังก์ชันบนสภาพแวดล้อมจริงสมบูรณ์แล้ว ผู้ทดสอบสามารถดำเนินการทดสอบตามลำดับขั้นตอนในคู่มือฉบับนี้ได้อย่างต่อเนื่อง ราบรื่น โดยใช้ข้อมูลตัวอย่างที่เตรียมไว้ได้ทันที
        </div>
      </div>
      <div class="footer-note">
        SmartCareer Platform © 2026. Confidential — เอกสารลับเพื่อใช้ในการตรวจรับงานของผู้มีส่วนได้ส่วนเสียเท่านั้น
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== หน้า 2: คำชี้แจงและบัญชีผู้ใช้ทดสอบ ==================== -->
  <div class="section-header">
    <div class="section-title">
      <span>คำชี้แจงการทดสอบและบัญชีผู้ใช้งานตัวอย่าง (Testing Instructions & Credentials)</span>
    </div>
    <div class="section-tag">GUIDELINES & ACCOUNTS</div>
  </div>

  <div class="callout-info">
    <strong style="color: #166534; font-family: 'Prompt'; font-size: 9pt;">💡 แนวทางการทดสอบแบบจำลองสถานการณ์จริง (Smooth Journey Testing Flow):</strong><br>
    เอกสารฉบับนี้เรียงลำดับกรณีทดสอบตาม <strong>วงจรการทำงานจริง (Lifecycle Journey)</strong> เพื่อให้การทดสอบไม่ติดขัด แนะนำให้ทดสอบเรียงตามลำดับข้อ 1 ถึง 30 ดังนี้:
    <ol style="margin: 4px 0 0 18px; padding: 0;">
      <li><strong>ระยะที่ 1:</strong> ฝั่งองค์กรนายจ้างลงทะเบียน ยื่นเอกสาร ได้รับการอนุมัติ สร้างแบบทดสอบ และประกาศงาน</li>
      <li><strong>ระยะที่ 2:</strong> ฝั่งผู้สมัครงานสร้างประวัติ วิเคราะห์ทักษะ สำรวจงาน และส่งใบสมัคร</li>
      <li><strong>ระยะที่ 3:</strong> ผู้สมัครทำแบบทดสอบวัดทักษะ และรับคะแนนพร้อมเหรียญรางวัลรับรอง</li>
      <li><strong>ระยะที่ 4:</strong> ฝั่งองค์กรคัดกรองผู้สมัคร ตรวจแฟ้มประวัติ บันทึกคะแนนสัมภาษณ์ และนัดหมายวันเวลา</li>
      <li><strong>ระยะที่ 5:</strong> ผู้สมัครรับการแจ้งเตือน ติดตามสถานะ และองค์กรยื่นข้อเสนอรับเข้าทำงาน พร้อมส่งออกรายงาน</li>
      <li><strong>ระยะที่ 6:</strong> ผู้ดูแลระบบตรวจดูแดชบอร์ด จัดการผู้ใช้ คลังทักษะ และระบบดึงงานภายนอก</li>
      <li><strong>ระยะที่ 7:</strong> ตรวจสอบความปลอดภัย การจำกัดสิทธิ์ การออกจากระบบ และหน้าหลักสำหรับบุคคลทั่วไป</li>
    </ol>
  </div>

  <h3 style="font-size: 10pt; color: #1e293b; margin-top: 14px; margin-bottom: 6px;">ตารางบัญชีผู้ใช้งานสำหรับทดสอบระบบ (Pre-configured Test Accounts)</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">บทบาท (Role)</th>
        <th style="width: 32%;">ชื่อบัญชี / อีเมลเข้าสู่ระบบ</th>
        <th style="width: 20%;">รหัสผ่าน (Password)</th>
        <th style="width: 28%;">วัตถุประสงค์ในการทดสอบ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>ผู้ดูแลระบบ<br>(Administrator)</strong></td>
        <td><code>admin@smartcareer.io</code></td>
        <td><code>AdminPass#2026!</code></td>
        <td>ใช้ตรวจสอบแดชบอร์ด อนุมัติการรับรององค์กร จัดการผู้ใช้ และคลังทักษะกลาง</td>
      </tr>
      <tr>
        <td><strong>องค์กร / นายจ้าง<br>(Company Recruiter)</strong></td>
        <td><code>hr@thaismarttech.co.th</code><br><span style="font-size: 7.2pt; color: #64748b;">(หรือสร้างใหม่ตาม TC-01)</span></td>
        <td><code>CompanyPass#2026</code></td>
        <td>ใช้สร้างประกาศงาน สร้างแบบทดสอบ คัดกรองผู้สมัคร ประเมินผล และนัดสัมภาษณ์</td>
      </tr>
      <tr>
        <td><strong>ผู้สมัครงาน<br>(Job Candidate)</strong></td>
        <td><code>candidate.somchai@smartcareer.io</code><br><span style="font-size: 7.2pt; color: #64748b;">(หรือสร้างใหม่ตาม TC-06)</span></td>
        <td><code>SomchaiPass#2026</code></td>
        <td>ใช้สร้างเรซูเม่ วิเคราะห์ช่องว่างทักษะ ค้นหางาน ทำแบบทดสอบ และติดตามผล</td>
      </tr>
    </tbody>
  </table>

  <h3 style="font-size: 10pt; color: #1e293b; margin-top: 14px; margin-bottom: 6px;">สัญลักษณ์และเกณฑ์การให้คะแนนผลการทดสอบ</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 22%;">ผลการทดสอบ</th>
        <th style="width: 48%;">ความหมายและเกณฑ์การตัดสิน</th>
        <th style="width: 30%;">แนวทางการดำเนินการ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong style="color: #16a34a;">✔ ผ่าน (Pass)</strong></td>
        <td>ระบบทำงานถูกต้องตรงตามขั้นตอนและผลลัพธ์ที่คาดหวัง ข้อมูลตัวอย่างแสดงผลครบถ้วน</td>
        <td>ยอมรับฟังก์ชัน สามารถเปิดใช้งานจริงได้ทันที</td>
      </tr>
      <tr>
        <td><strong style="color: #d97706;">▲ มีข้อคิดเห็น (Comments)</strong></td>
        <td>ระบบทำงานได้หลักๆ แต่อาจมีข้อแนะนำด้านความสวยงาม ข้อความ หรือความสะดวกเพิ่มเติม</td>
        <td>บันทึกลงในช่องข้อเสนอแนะ เพื่อปรับปรุงในรอบถัดไป</td>
      </tr>
      <tr>
        <td><strong style="color: #dc2626;">✖ ไม่ผ่าน (Fail)</strong></td>
        <td>ฟังก์ชันไม่ทำงานตามที่ระบุ ข้อมูลผิดพลาด หรือพบข้อบกพร่องที่ทำให้ทดสอบต่อไม่ได้</td>
        <td>บันทึกรายละเอียดข้อบกพร่องเพื่อให้ทีมงานแก้ไขโดยด่วน</td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>คู่มือการทดสอบระบบ UAT ฉบับสมบูรณ์ · SmartCareer Platform</span>
    <span>หน้า 2</span>
  </div>

  <div class="page-break"></div>

  <!-- ==================== หน้า 3: ระยะที่ 1: การเปิดใช้งานองค์กรและจัดเตรียมงาน (TC-01 ถึง TC-05) ==================== -->
  <div class="section-header">
    <div class="section-title">
      <span>ระยะที่ 1: การเปิดใช้งานองค์กรและจัดเตรียมงาน (Company & Job Setup)</span>
    </div>
    <div class="section-tag">PHASE 1 · TC-01 ถึง TC-05</div>
  </div>

  <div class="section-desc">
    <strong>เป้าหมายระยะที่ 1:</strong> สร้างและเปิดใช้งานองค์กรธุรกิจในระบบ ยื่นเอกสารนิติบุคคล ได้รับการอนุมัติจากผู้ดูแลระบบ สร้างชุดแบบทดสอบวัดทักษะ และลงประกาศรับสมัครงานพร้อมผูกแบบทดสอบ
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">รหัส</th>
        <th style="width: 20%;">ชื่อการทดสอบ & ความสำคัญ</th>
        <th style="width: 42%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่างที่ใช้กรอก</th>
        <th style="width: 28%;">ผลลัพธ์ที่คาดหวัง & การบันทึกผล</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TC-01</strong></td>
        <td>
          <strong>การลงทะเบียนบัญชีนายจ้างใหม่</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Company Registration)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าหน้าเว็บไซต์ เลือกเมนู <strong>"สมัครสมาชิก"</strong> (<code>/register</code>)<br>
            2. คลิกเลือกประเภทบัญชี: <strong>"องค์กร / นายจ้าง (Company)"</strong><br>
            3. กรอกข้อมูลการลงทะเบียนตามข้อมูลตัวอย่าง<br>
            4. กดปุ่ม <strong>"สร้างบัญชีองค์กร"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>ชื่อผู้ติดต่อ:</strong> คุณวิภาดา สถิตวัฒนากุล<br>
            • <strong>อีเมล:</strong> <code>hr@thaismarttech.co.th</code><br>
            • <strong>รหัสผ่าน:</strong> <code>CompanyPass#2026</code><br>
            • <strong>ชื่อบริษัท:</strong> บริษัท ไทยสมาร์ทเทค จำกัด
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบสร้างบัญชีนายจ้างสำเร็จ และนำเข้าสู่หน้าจอจัดการองค์กรโดยอัตโนมัติ พร้อมแสดงชื่อผู้ติดต่อและชื่อบริษัทถูกต้อง
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-02</strong></td>
        <td>
          <strong>บันทึกโปรไฟล์ & แนบเอกสารนิติบุคคล</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Profile & Verification)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู <strong>"โปรไฟล์องค์กร"</strong> (<code>/company/profile</code>)<br>
            2. กรอกข้อมูลนิติบุคคลตามตัวอย่างให้ครบถ้วน<br>
            3. ในส่วนการรับรององค์กร กรอกเลขทะเบียนนิติบุคคลและอัปโหลดเอกสารรับรองบริษัท (PDF หรือ PNG)<br>
            4. กดปุ่ม <strong>"บันทึกข้อมูลและส่งตรวจสอบ"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>ชื่อบริษัท:</strong> บริษัท ไทยสมาร์ทเทค จำกัด<br>
            • <strong>เว็บไซต์:</strong> <code>https://thaismarttech.co.th</code><br>
            • <strong>อีเมลส่วนกลาง:</strong> <code>contact@thaismarttech.co.th</code><br>
            • <strong>เบอร์โทรศัพท์:</strong> <code>02-123-4567</code><br>
            • <strong>ที่อยู่:</strong> 123 อาคารสาทรซิตี้ทาวเวอร์ ชั้น 18 ถ.สาทรใต้ แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ 10120<br>
            • <strong>คำอธิบาย:</strong> ผู้นำด้านโซลูชันคลาวด์และนวัตกรรมปัญญาประดิษฐ์เพื่อธุรกิจ<br>
            • <strong>เลขทะเบียนนิติบุคคล:</strong> <code>0105567890123</code>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          บันทึกข้อมูลสำเร็จ หน้าจอแสดงป้ายสถานะ <strong>"รอการตรวจสอบ (Pending Review)"</strong> และแสดงรายการเอกสารแนบถูกต้อง
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-03</strong></td>
        <td>
          <strong>แอดมินตรวจสอบ & อนุมัติรับรององค์กร</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Admin Verification)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าสู่ระบบด้วยบัญชีแอดมิน (<code>admin@smartcareer.io</code>)<br>
            2. ไปที่เมนู <strong>"การรับรององค์กร"</strong> (<code>/admin/verifications</code>)<br>
            3. ค้นหารายชื่อ "บริษัท ไทยสมาร์ทเทค จำกัด"<br>
            4. ตรวจสอบเลขทะเบียนนิติบุคคล <code>0105567890123</code> และไฟล์แนบ<br>
            5. กดปุ่ม <strong>"อนุมัติการรับรอง (Approve)"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างตรวจสอบ:</span>
            • องค์กรที่อนุมัติ: บริษัท ไทยสมาร์ทเทค จำกัด<br>
            • การกระทำ: กดปุ่มอนุมัติสีเขียว (Approve)
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          สถานะเปลี่ยนเป็น <strong>"ได้รับการรับรองแล้ว (Verified)"</strong> พร้อมแสดงเครื่องหมายถูกสีเขียว องค์กรได้รับสิทธิ์เต็มในการประกาศงาน
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-04</strong></td>
        <td>
          <strong>การสร้างชุดแบบทดสอบวัดทักษะ</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Assessment Builder)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. กลับมาที่บัญชีบริษัท ไปที่เมนู <strong>"คลังแบบทดสอบ"</strong> (<code>/company/assessments</code>)<br>
            2. กดปุ่ม <strong>"+ สร้างแบบทดสอบใหม่"</strong><br>
            3. ป้อนชื่อ คำอธิบาย ทักษะ เวลาทำ และเกณฑ์คะแนนผ่าน<br>
            4. เพิ่มคำถามปรนัยและคำถามข้อเขียน พร้อมระบุคำตอบที่ถูกต้อง<br>
            5. กดปุ่ม <strong>"บันทึกชุดแบบทดสอบ"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>ชื่อชุดทดสอบ:</strong> แบบประเมินทักษะ Full Stack Web Architecture 2026<br>
            • <strong>คำอธิบาย:</strong> ทดสอบความรู้เชิงลึกด้าน React, Next.js, REST API และการจัดการสถานะ<br>
            • <strong>เวลาทำข้อสอบ:</strong> <code>45</code> นาที · <strong>เกณฑ์คะแนนผ่าน:</strong> <code>70%</code><br>
            • <strong>การแสดงเฉลย:</strong> แสดงคะแนนสรุปทันทีหลังส่ง<br>
            • <strong>คำถามที่ 1:</strong> ข้อใดอธิบายการทำงานของ React Server Components ได้ถูกต้อง?
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ชุดแบบทดสอบถูกบันทึก แสดงในรายการแบบทดสอบของบริษัทด้วยสถานะ <strong>"เปิดใช้งาน (Active)"</strong> พร้อมนำไปผูกกับงาน
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-05</strong></td>
        <td>
          <strong>การสร้างประกาศงาน & ผูกแบบทดสอบ</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Job Posting & Link Assessment)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. ไปที่เมนู <strong>"ประกาศรับสมัครงาน"</strong> -> <strong>"+ ลงประกาศงานใหม่"</strong> (<code>/company/jobs/new</code>)<br>
            2. กรอกข้อมูลตำแหน่งงาน เงินเดือน สถานที่ทำงาน สวัสดิการ<br>
            3. กำหนดทักษะที่ต้องการ: React (ขั้นต่ำ 75%), Node.js (ขั้นต่ำ 70%)<br>
            4. เลือกผูกกับแบบทดสอบ: <strong>"แบบประเมินทักษะ Full Stack Web Architecture 2026"</strong><br>
            5. กดปุ่ม <strong>"เผยแพร่ประกาศงาน"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>ชื่อตำแหน่งงาน:</strong> Senior Full Stack Engineer (React & Node.js)<br>
            • <strong>สถานที่:</strong> กรุงเทพมหานคร (ไฮบริด - สาทร) · <strong>ประเภท:</strong> เต็มเวลา (Full-time)<br>
            • <strong>ช่วงเงินเดือน:</strong> <code>75,000 - 120,000</code> บาท/เดือน · <strong>จำนวนที่รับ:</strong> <code>2</code> อัตรา<br>
            • <strong>หน้าที่รับผิดชอบ:</strong> ออกแบบและพัฒนาเว็บแอปพลิเคชัน ดูแลฐานข้อมูล และนำทีมวิศวกรซอฟต์แวร์<br>
            • <strong>สวัสดิการ:</strong> ประกันสุขภาพกลุ่ม, กองทุนสำรองเลี้ยงชีพ, โบนัสประจำปี, งบพัฒนาตนเอง 30,000 บาท/ปี
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ประกาศงานถูกเผยแพร่สำเร็จ แสดงในแดชบอร์ดงานของบริษัท และขึ้นแสดงบนกระดานค้นหางานสาธารณะทันที
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>คู่มือการทดสอบระบบ UAT ฉบับสมบูรณ์ · SmartCareer Platform</span>
    <span>หน้า 3</span>
  </div>

  <div class="page-break"></div>

  <!-- ==================== หน้า 4: ระยะที่ 2: การสมัครงานและประเมินทักษะของผู้สมัคร (TC-06 ถึง TC-11) ==================== -->
  <div class="section-header">
    <div class="section-title">
      <span>ระยะที่ 2: การสมัครงานและประเมินทักษะของผู้สมัคร (Candidate Journey)</span>
    </div>
    <div class="section-tag">PHASE 2 · TC-06 ถึง TC-11</div>
  </div>

  <div class="section-desc">
    <strong>เป้าหมายระยะที่ 2:</strong> ผู้สมัครลงทะเบียน สร้างประวัติสายอาชีพ วิเคราะห์ช่องว่างทักษะด้วย AI เรดาร์ สำรวจคอร์สเรียน ค้นหาตำแหน่งงาน และยื่นใบสมัครงาน
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">รหัส</th>
        <th style="width: 20%;">ชื่อการทดสอบ & ความสำคัญ</th>
        <th style="width: 42%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่างที่ใช้กรอก</th>
        <th style="width: 28%;">ผลลัพธ์ที่คาดหวัง & การบันทึกผล</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TC-06</strong></td>
        <td>
          <strong>การสมัครสมาชิกผู้สมัครงาน</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Candidate Registration)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ออกจากระบบ แล้วเข้าสู่หน้าลงทะเบียน (<code>/register</code>)<br>
            2. คลิกเลือกประเภทบัญชี: <strong>"ผู้สมัครงาน (Candidate)"</strong><br>
            3. กรอกข้อมูลส่วนตัว อีเมล และรหัสผ่านตามตัวอย่าง<br>
            4. กดปุ่ม <strong>"สร้างบัญชีผู้สมัครงาน"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>ชื่อ-นามสกุล:</strong> นายสมชาย มุ่งมั่นพัฒนา (Somchai Dev)<br>
            • <strong>อีเมล:</strong> <code>candidate.somchai@smartcareer.io</code><br>
            • <strong>รหัสผ่าน:</strong> <code>SomchaiPass#2026</code>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ลงทะเบียนสำเร็จ ระบบนำเข้าสู่หน้าจอจัดทำประวัติและเป้าหมายสายอาชีพ (Profile Setup) โดยอัตโนมัติ
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-07</strong></td>
        <td>
          <strong>การบันทึกประวัติ & เป้าหมายอาชีพ</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Profile & Career Target)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า <strong>"ประวัติของฉัน"</strong> -> แท็บแก้ไขข้อมูล (<code>/profile?tab=edit</code>)<br>
            2. กรอกสโลแกน ประวัติโดยย่อ และสายอาชีพเป้าหมาย<br>
            3. กรอกชื่อบัญชี GitHub เพื่อเตรียมเชื่อมโยงข้อมูลทักษะ<br>
            4. กดปุ่ม <strong>"บันทึกข้อมูลประวัติ"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>สโลแกน / หัวข้อ:</strong> Full Stack Developer ผู้เชี่ยวชาญด้าน Modern Web & Cloud<br>
            • <strong>ประวัติโดยย่อ:</strong> ประสบการณ์ 3 ปีในการพัฒนา Web Application ด้วย React และ Node.js สนใจด้าน Scalable Architecture<br>
            • <strong>สายอาชีพเป้าหมาย:</strong> Full Stack Developer<br>
            • <strong>บัญชี GitHub:</strong> <code>somchai-dev-demo</code>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบบันทึกข้อมูลเรียบร้อย ข้อมูลเป้าหมายสายอาชีพถูกบันทึกเพื่อใช้เป็นฐานในการคำนวณทักษะเปรียบเทียบ
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-08</strong></td>
        <td>
          <strong>วิเคราะห์ช่องว่างทักษะ & กราฟเรดาร์</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Skill Gap Analysis)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. ไปที่แท็บ <strong>"ทักษะและความสามารถ"</strong> ในหน้าโปรไฟล์ (<code>/profile?tab=skills</code>)<br>
            2. สังเกตกราฟเรดาร์ (Radar Chart) เปรียบเทียบระหว่างทักษะของตนเองและเกณฑ์ตลาดงาน<br>
            3. ตรวจสอบการจำแนกทักษะที่มีอยู่และทักษะที่ควรพัฒนาเพิ่ม
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างที่ระบบวิเคราะห์:</span>
            • <strong>เกณฑ์ตลาด (Benchmark):</strong> React (80%), Node.js (75%), TypeScript (70%), Docker (60%)<br>
            • <strong>ระดับของผู้สมัคร:</strong> React (75%), Node.js (65%), TypeScript (40%), Docker (20%)<br>
            • <strong>ช่องว่างที่พบ:</strong> ทักษะ Docker และ TypeScript ยังต่ำกว่าเกณฑ์ตลาด
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          กราฟเรดาร์แสดงผลคมชัด แยกเส้นสีเปรียบเทียบชัดเจน พร้อมแสดงรายการทักษะที่ต้องเร่งพัฒนาเพื่อปิดช่องว่าง
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-09</strong></td>
        <td>
          <strong>สำรวจคอร์สเรียนแนะนำเพื่อปิดช่องว่าง</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Recommended Courses)</span><br>
          <span class="badge-priority badge-medium">ปานกลาง</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าเมนู <strong>"คอร์สเรียนพัฒนาทักษะ"</strong> (<code>/courses</code>)<br>
            2. ตรวจสอบรายการคอร์สเรียนที่ระบบคัดสรรมาให้ตรงกับช่องว่างทักษะ (เช่น TypeScript, Next.js, Docker)<br>
            3. คลิกดูรายละเอียดและทดลองคลิกลิงก์ออกไปยังบทเรียน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างคอร์สที่แสดง:</span>
            • คอร์สที่ 1: "Mastering TypeScript & Clean Architecture" (ผู้ให้บริการ: Udemy/YouTube)<br>
            • คอร์สที่ 2: "Docker & Container Basics for Web Developers"<br>
            • การคัดกรอง: แสดงระยะเวลา ระดับความยาก และป้ายกำกับทักษะ
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          แสดงรายการคอร์สเรียนที่ตรงกับทักษะที่ขาด สามารถคลิกเปิดลิงก์ไปยังแหล่งเรียนรู้ภายนอกได้อย่างถูกต้อง
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-10</strong></td>
        <td>
          <strong>ค้นหางาน & ดูคะแนนความเหมาะสม</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Job Search & Match Score)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าหน้า <strong>"ค้นหางาน"</strong> (<code>/jobs</code>)<br>
            2. พิมพ์คำค้นหา: <code>Full Stack</code> หรือกรองสถานที่: <code>กรุงเทพมหานคร</code><br>
            3. คลิกเลือกงานของ <strong>"บริษัท ไทยสมาร์ทเทค จำกัด"</strong> (<code>/jobs/[id]</code>)<br>
            4. สังเกตกล่องแสดง <strong>"คะแนนความเหมาะสม (Match Score)"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างที่ระบบประมวลผล:</span>
            • <strong>คะแนนความเหมาะสม:</strong> คำนวณอัตโนมัติ (เช่น 80% - 85% Match)<br>
            • <strong>ทักษะที่ตรงกัน:</strong> React, Node.js (แสดงแท็กสีเขียว)<br>
            • <strong>ทักษะที่ควรเสริม:</strong> Docker (แสดงแท็กสีส้มแจ้งเตือน)
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          แสดงคะแนนความเหมาะสมแบบเรียลไทม์ พร้อมจำแนกทักษะที่ตรงและทักษะที่ควรมีอย่างชัดเจน ช่วยให้ตัดสินใจก่อนสมัคร
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-11</strong></td>
        <td>
          <strong>การยื่นใบสมัครงานพร้อมบันทึกแนะนำตัว</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Job Application Submission)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. ในหน้ารายละเอียดงาน คลิกปุ่ม <strong>"ยื่นใบสมัครผ่าน SmartCareer"</strong><br>
            2. ในหน้าต่างยืนยันการสมัคร กรอกข้อความแนะนำตัว (Cover Letter)<br>
            3. ตรวจสอบข้อมูลประวัติที่ระบบจะแนบไปโดยอัตโนมัติ<br>
            4. กดปุ่ม <strong>"ยืนยันการสมัคร"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>ข้อความแนะนำตัว (Cover Letter):</strong><br>
            <em>"มีความสนใจในตำแหน่ง Senior Full Stack Engineer ของไทยสมาร์ทเทคเป็นอย่างยิ่ง มีประสบการณ์ตรงในการสร้าง Web App ด้วย React และ Node.js พร้อมนำทักษะและผลงานมาช่วยขับเคลื่อนโครงการของบริษัทครับ"</em>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบแจ้งเตือน <strong>"ยื่นใบสมัครสำเร็จ"</strong> ปุ่มเปลี่ยนเป็น <strong>"คุณได้ยื่นใบสมัครตำแหน่งนี้แล้ว"</strong> พร้อมลิงก์ไปหน้าติดตามสถานะ
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>คู่มือการทดสอบระบบ UAT ฉบับสมบูรณ์ · SmartCareer Platform</span>
    <span>หน้า 4</span>
  </div>

  <div class="page-break"></div>

  <!-- ==================== หน้า 5: ระยะที่ 3 & 4: การทำแบบทดสอบ & การคัดกรองผู้สมัคร ==================== -->
  <div class="section-header">
    <div class="section-title">
      <span>ระยะที่ 3: การทำแบบทดสอบวัดทักษะความสามารถ (Online Skill Assessment)</span>
    </div>
    <div class="section-tag">PHASE 3 · TC-12 ถึง TC-14</div>
  </div>

  <div class="section-desc">
    <strong>เป้าหมายระยะที่ 3:</strong> ผู้สมัครเข้าทำแบบทดสอบออนไลน์ประจำตำแหน่งงาน ส่งคำตอบ รับผลคะแนนทันที และได้รับเหรียญตราทักษะรับรอง
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">รหัส</th>
        <th style="width: 20%;">ชื่อการทดสอบ & ความสำคัญ</th>
        <th style="width: 42%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่างที่ใช้กรอก</th>
        <th style="width: 28%;">ผลลัพธ์ที่คาดหวัง & การบันทึกผล</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TC-12</strong></td>
        <td>
          <strong>การเข้าทำแบบทดสอบประจำตำแหน่ง</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Taking Online Assessment)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. ไปที่เมนู <strong>"แบบทดสอบ"</strong> (<code>/assessments</code>) หรือคลิกลิงก์ทำข้อสอบจากใบสมัคร<br>
            2. เลือกแบบทดสอบ: <strong>"แบบประเมินทักษะ Full Stack Web Architecture 2026"</strong><br>
            3. อ่านคำชี้แจง แล้วกดปุ่ม <strong>"เริ่มทำแบบทดสอบ"</strong><br>
            4. สังเกตตัวนับเวลาถอยหลัง 45 นาที และรายการข้อสอบ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างหน้าจอทำข้อสอบ:</span>
            • เวลาสอบ: นับถอยหลังจาก 45:00 นาที<br>
            • สลับข้อสอบได้อย่างอิสระ มีปุ่มเลือกตอบตัวเลือกและกล่องพิมพ์ตอบข้อเขียน
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          หน้าจอทำข้อสอบเปิดขึ้นอย่างราบรื่น ตัวจับเวลาทำงานต่อเนื่อง สามารถเลือกตอบคำถามได้อย่างถูกต้อง
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-13</strong></td>
        <td>
          <strong>ส่งคำตอบ & รับผลคะแนนอัตโนมัติ</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Submission & Scoring)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ตอบคำถามให้ครบทุกข้อตามความรู้<br>
            2. ตรวจทานคำตอบ แล้วกดปุ่ม <strong>"ส่งคำตอบทั้งหมด"</strong><br>
            3. กดยืนยันการส่งข้อสอบในหน้าต่างแจ้งเตือน<br>
            4. สังเกตผลคะแนนสรุปที่ระบบแสดงทันทีหลังส่ง
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างผลการสอบ:</span>
            • <strong>คะแนนที่ทำได้:</strong> <code>85 / 100</code> คะแนน (เกณฑ์ผ่าน 70%)<br>
            • <strong>ผลการประเมิน:</strong> ผ่านเกณฑ์ (Passed)<br>
            • <strong>สรุป:</strong> ตอบถูกต้องในหมวด React Architecture และ REST Design
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบประมวลผลคำตอบอัตโนมัติ แสดงผลคะแนนทันที ระบุสถานะ <strong>"ผ่านเกณฑ์การประเมิน (Passed)"</strong>
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-14</strong></td>
        <td>
          <strong>ตรวจดูเหรียญตราทักษะที่ได้รับรอง</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Verified Badges Hub)</span><br>
          <span class="badge-priority badge-medium">ปานกลาง</span>
        </td>
        <td>
          <div class="test-steps">
            1. กลับไปที่หน้าโปรไฟล์ของผู้สมัคร (<code>/profile</code>)<br>
            2. ดูส่วน <strong>"เหรียญรางวัลรับรองทักษะ (Verified Badges)"</strong><br>
            3. ตรวจสอบเหรียญตราใหม่ที่ได้รับจากการสอบผ่าน
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลเหรียญตราที่แสดง:</span>
            • <strong>ชื่อเหรียญ:</strong> Full Stack Architecture Specialist Badge<br>
            • <strong>คะแนนที่บันทึก:</strong> 85% · <strong>วันที่สอบผ่าน:</strong> วันที่ปัจจุบัน
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          เหรียญตราทักษะแสดงขึ้นอย่างสวยงาม และตราสัญลักษณ์นี้จะติดไปกับใบสมัครงานเพื่อยืนยันความสามารถต่อนายจ้าง
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- ระยะที่ 4 -->
  <div class="section-header" style="margin-top: 16px;">
    <div class="section-title">
      <span>ระยะที่ 4: การคัดกรองและการบริหารผู้สมัคร (Recruitment Pipeline)</span>
    </div>
    <div class="section-tag">PHASE 4 · TC-15 ถึง TC-19</div>
  </div>

  <div class="section-desc">
    <strong>เป้าหมายระยะที่ 4:</strong> องค์กรคัดกรองใบสมัคร ตรวจแฟ้มประวัติฉบับเต็ม เปลี่ยนสถานะเป็นคัดกรอง ประเมินคะแนนสัมภาษณ์ และนัดหมายวันเวลา
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">รหัส</th>
        <th style="width: 20%;">ชื่อการทดสอบ & ความสำคัญ</th>
        <th style="width: 42%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่างที่ใช้กรอก</th>
        <th style="width: 28%;">ผลลัพธ์ที่คาดหวัง & การบันทึกผล</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TC-15</strong></td>
        <td>
          <strong>การตรวจรายชื่อผู้สมัคร & คะแนน</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Application Screening)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. สลับมาที่บัญชีบริษัท (<code>hr@thaismarttech.co.th</code>)<br>
            2. เข้าเมนู <strong>"ผู้สมัครงาน"</strong> (<code>/company/applications</code>)<br>
            3. ค้นหารายชื่อ <strong>"นายสมชาย มุ่งมั่นพัฒนา"</strong><br>
            4. สังเกตคะแนนความเหมาะสม ตราเหรียญรางวัล และสถานะเริ่มต้น <strong>"สมัครเข้ามาใหม่ (Applied)"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลที่ปรากฏในรายการ:</span>
            • ผู้สมัคร: นายสมชาย มุ่งมั่นพัฒนา · ตำแหน่ง: Senior Full Stack Engineer<br>
            • คะแนน Match Score: 85% · ตราสัญลักษณ์: Verified Badge
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบแสดงรายชื่อผู้สมัครอย่างถูกต้อง พร้อมแสดงคะแนนความเหมาะสมและสถานะแรกเข้าอย่างชัดเจน
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-16</strong></td>
        <td>
          <strong>เปิดดูแฟ้มประวัติฉบับเต็ม (Dossier)</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Candidate Dossier)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. คลิกที่ชื่อผู้สมัครหรือปุ่ม <strong>"ดูโปรไฟล์ฉบับเต็ม"</strong><br>
            2. ตรวจสอบแท็บข้อมูลต่างๆ ในหน้าต่างประวัติ:<br>
            • แท็บประวัติทั่วไปและข้อความแนะนำตัว<br>
            • แท็บคะแนนทักษะเทียบกับตำแหน่งงาน<br>
            • แท็บผลการทดสอบ (ตรวจดูคะแนนสอบ 85%)
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลในแฟ้มประวัติที่ตรวจสอบ:</span>
            • ข้อความแนะนำตัว: ความสนใจและประสบการณ์ของผู้สมัคร<br>
            • ผลคะแนนสอบทักษะ: 85 คะแนน (ผ่านเกณฑ์)<br>
            • ลิงก์และข้อมูล GitHub: somchai-dev-demo
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          แสดงหน้าต่างแฟ้มประวัติฉบับเต็มอย่างสวยงาม กรรมการสามารถตรวจสอบข้อมูลเชิงลึกของผู้สมัครได้ครบทุกด้าน
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-17</strong></td>
        <td>
          <strong>การปรับเปลี่ยนสถานะการพิจารณา</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Status Progression)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ในแถบรายการของผู้สมัคร คลิกที่เมนูเลือกสถานะ<br>
            2. ปรับสถานะจาก "สมัครเข้ามาใหม่" เป็น <strong>"กำลังคัดกรอง (Reviewing)"</strong><br>
            3. เมื่อตรวจสอบแล้ว ปรับสถานะเป็น <strong>"นัดสัมภาษณ์ (Interview)"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ลำดับสถานะที่ทดสอบเปลี่ยน:</span>
            • <code>Applied</code> ➔ <code>Reviewing</code> ➔ <code>Interview</code>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบอัปเดตสถานะทันที ป้ายสถานะเปลี่ยนเป็นสีม่วง (นัดสัมภาษณ์) และระบบเปิดฟังก์ชันการนัดหมายสัมภาษณ์งาน
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-18</strong></td>
        <td>
          <strong>บันทึกคะแนนประเมินสัมภาษณ์</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Candidate Evaluation)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ในหน้าต่างประวัติผู้สมัคร เปิดส่วน <strong>"แบบฟอร์มประเมินผลผู้สมัคร"</strong><br>
            2. ให้คะแนนประเมินตามเกณฑ์ 4 ด้าน (1 - 5 ดาว)<br>
            3. บันทึกข้อคิดเห็นภาพรวมของผู้สัมภาษณ์<br>
            4. กดปุ่ม <strong>"บันทึกผลการประเมิน"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>ทักษะทางเทคนิค:</strong> 5 ดาว · <strong>การแก้ปัญหา:</strong> 4 ดาว<br>
            • <strong>การสื่อสาร:</strong> 5 ดาว · <strong>การทำงานเป็นทีม:</strong> 5 ดาว<br>
            • <strong>ข้อคิดเห็นภาพรวม:</strong><br>
            <em>"ผู้สมัครมีทักษะสถาปัตยกรรมระบบที่ยอดเยี่ยม ตอบคำถามเชิงลึกได้ดี ทัศนคติดี เหมาะสมกับทีมงานของบริษัท"</em>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบบันทึกผลการประเมิน คำนวณคะแนนเฉลี่ยให้อัตโนมัติ (4.75 ดาว) และแสดงในประวัติการประเมินของผู้สมัคร
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-19</strong></td>
        <td>
          <strong>การนัดหมายวันเวลาสัมภาษณ์งาน</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Interview Scheduling)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. คลิกปุ่ม <strong>"นัดหมายสัมภาษณ์งาน"</strong><br>
            2. กรอกวัน เวลา รูปแบบ และลิงก์ห้องประชุมออนไลน์<br>
            3. พิมพ์ข้อความคำแนะนำถึงผู้สมัคร<br>
            4. กดปุ่ม <strong>"ส่งการนัดหมายสัมภาษณ์"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • <strong>วันนัดหมาย:</strong> <code>15 ตุลาคม 2026</code> · <strong>เวลา:</strong> <code>10:30 - 11:30 น.</code><br>
            • <strong>รูปแบบ:</strong> ออนไลน์ผ่าน Google Meet<br>
            • <strong>ลิงก์ห้องประชุม:</strong> <code>https://meet.google.com/abc-defg-hij</code><br>
            • <strong>ข้อความถึงผู้สมัคร:</strong><br>
            <em>"เรียนคุณสมชาย ทางทีมงานขอเรียนเชิญเข้าร่วมสัมภาษณ์รอบ Technical Interview ผ่าน Google Meet ขอให้เตรียมตัวนำเสนอผลงาน 15 นาทีครับ"</em>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบบันทึกการนัดหมายสำเร็จ และส่งสัญญาณแจ้งเตือนไปยังหน้าจอของผู้สมัครงานทันที
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>คู่มือการทดสอบระบบ UAT ฉบับสมบูรณ์ · SmartCareer Platform</span>
    <span>หน้า 5</span>
  </div>

  <div class="page-break"></div>

  <!-- ==================== หน้า 6: ระยะที่ 5 & 6: การแจ้งเตือน & การดูแลระบบส่วนกลาง ==================== -->
  <div class="section-header">
    <div class="section-title">
      <span>ระยะที่ 5: การแจ้งเตือนและการตอบรับการจ้างงาน (Notification & Final Offer)</span>
    </div>
    <div class="section-tag">PHASE 5 · TC-20 ถึง TC-23</div>
  </div>

  <div class="section-desc">
    <strong>เป้าหมายระยะที่ 5:</strong> ผู้สมัครรับการแจ้งเตือนนัดสัมภาษณ์ ติดตามสถานะงาน องค์กรยื่นข้อเสนอรับเข้าทำงาน และส่งออกรายงานสรุปข้อมูล
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">รหัส</th>
        <th style="width: 20%;">ชื่อการทดสอบ & ความสำคัญ</th>
        <th style="width: 42%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่างที่ใช้กรอก</th>
        <th style="width: 28%;">ผลลัพธ์ที่คาดหวัง & การบันทึกผล</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TC-20</strong></td>
        <td>
          <strong>ผู้สมัครรับการแจ้งเตือนนัดสัมภาษณ์</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Candidate Notification)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. สลับมาที่บัญชีผู้สมัคร (<code>candidate.somchai@smartcareer.io</code>)<br>
            2. ตรวจสอบกระดิ่งแจ้งเตือน หรือเปิดหน้า <strong>"การสมัครงานของฉัน"</strong> (<code>/applications</code>)<br>
            3. สังเกตข้อความแจ้งเตือนนัดสัมภาษณ์จากบริษัท ไทยสมาร์ทเทค จำกัด<br>
            4. คลิกเปิดดูรายละเอียดวัน เวลา และลิงก์ห้องประชุม
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลที่ปรากฏแจ้งเตือน:</span>
            • ข้อความ: "บริษัท ไทยสมาร์ทเทค จำกัด ได้ส่งนัดหมายสัมภาษณ์งานถึงคุณ"<br>
            • รายละเอียด: วันที่ 15 ต.ค. 2026 เวลา 10:30 น. ลิงก์ Google Meet
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          การแจ้งเตือนแสดงผลชัดเจน ผู้สมัครสามารถกดดูรายละเอียด วันเวลา ลิงก์ประชุม และข้อความแนะนำจากบริษัทได้อย่างครบถ้วน
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-21</strong></td>
        <td>
          <strong>การติดตามสถานะใบสมัครงาน</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Application Tracking Hub)</span><br>
          <span class="badge-priority badge-medium">ปานกลาง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ในหน้า <strong>"การสมัครงานของฉัน"</strong> (<code>/applications</code>)<br>
            2. ตรวจสอบแถบความคืบหน้า (Progress Stepper) ของใบสมัครงาน<br>
            3. ตรวจสอบป้ายสถานะปัจจุบัน: <strong>"นัดสัมภาษณ์ (Interview)"</strong>
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 เส้นทางความคืบหน้าที่แสดง:</span>
            • <code>ยื่นใบสมัคร</code> ➔ <code>กำลังคัดกรอง</code> ➔ <code>สอบวัดทักษะ</code> ➔ <code>นัดสัมภาษณ์</code>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          แสดงแถบขั้นตอนความคืบหน้าอย่างชัดเจน มีป้ายสถานะสีม่วงสดใสระบุว่าอยู่ระหว่างรอบสัมภาษณ์
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-22</strong></td>
        <td>
          <strong>การสรุปผลการคัดเลือก & ยื่นข้อเสนองาน</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Job Offer / Acceptance)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. สลับกลับมาที่บัญชีบริษัท (<code>hr@thaismarttech.co.th</code>)<br>
            2. ในหน้ารายการผู้สมัคร ปรับสถานะใบสมัครของนายสมชาย เป็น <strong>"ยื่นข้อเสนองาน (Offer)"</strong> หรือ <strong>"รับเข้าทำงานแล้ว (Accepted)"</strong><br>
            3. บันทึกรายละเอียดข้อเสนอ (เงินเดือน 100,000 บาท วันเริ่มงาน 1 พ.ย. 2026)
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างสำหรับกรอก (Sample Data):</span>
            • สถานะใหม่: <strong>ยื่นข้อเสนองาน (Offer)</strong><br>
            • บันทึกข้อเสนอ: อัตราเงินเดือน 100,000 บาท/เดือน วันเริ่มงาน 1 พฤศจิกายน 2026
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          สถานะเปลี่ยนเป็นแถบสีเขียวเข้ม (Offer / Accepted) ผู้สมัครสามารถตรวจสอบผลการตอบรับการจ้างงานได้ทันที
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-23</strong></td>
        <td>
          <strong>การส่งออกรายงานสรุปผู้สมัครงาน (CSV)</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Export Applications)</span><br>
          <span class="badge-priority badge-medium">ปานกลาง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ในหน้าผู้สมัครงานของบริษัท (<code>/company/applications</code>)<br>
            2. กดปุ่ม <strong>"ส่งออกรายงาน (Export CSV)"</strong> ที่มุมขวาบน<br>
            3. ตรวจสอบไฟล์ <code>.csv</code> ที่ถูกดาวน์โหลดลงในเครื่องคอมพิวเตอร์
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลที่ต้องปรากฏในไฟล์ CSV:</span>
            • รายชื่อผู้สมัคร, ตำแหน่งงาน, คะแนน Match Score, ผลการประเมิน, สถานะใบสมัคร
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ไฟล์ CSV ถูกดาวน์โหลดสำเร็จ ข้อมูลถูกต้องครบถ้วน รองรับภาษาไทย สามารถเปิดดูใน Microsoft Excel ได้เรียบร้อย
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- ระยะที่ 6 -->
  <div class="section-header" style="margin-top: 16px;">
    <div class="section-title">
      <span>ระยะที่ 6: การบริหารจัดการและกำกับดูแลระบบส่วนกลาง (Platform Administration)</span>
    </div>
    <div class="section-tag">PHASE 6 · TC-24 ถึง TC-27</div>
  </div>

  <div class="section-desc">
    <strong>เป้าหมายระยะที่ 6:</strong> ผู้ดูแลระบบตรวจสอบแดชบอร์ดสถิติรวม บริหารจัดการผู้ใช้งาน คลังทักษะ และตรวจสอบระบบรวบรวมตำแหน่งงานภายนอก
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">รหัส</th>
        <th style="width: 20%;">ชื่อการทดสอบ & ความสำคัญ</th>
        <th style="width: 42%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่างที่ใช้กรอก</th>
        <th style="width: 28%;">ผลลัพธ์ที่คาดหวัง & การบันทึกผล</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TC-24</strong></td>
        <td>
          <strong>ตรวจดูแดชบอร์ดสถิติภาพรวมแพลตฟอร์ม</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Admin Dashboard KPIs)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าสู่ระบบด้วยบัญชีแอดมิน (<code>admin@smartcareer.io</code>)<br>
            2. ไปที่หน้าแดชบอร์ดหลัก (<code>/admin/dashboard</code>)<br>
            3. ตรวจสอบการ์ดแสดงตัวเลขสถิติภาพรวมของระบบ (จำนวนผู้ใช้, องค์กร, ตำแหน่งงาน, แบบทดสอบ)
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 สถิติที่ต้องแสดงสอดคล้องกัน:</span>
            • จำนวนผู้สมัครงานและองค์กรที่เพิ่มขึ้นตามการทดสอบจริง<br>
            • สถิติตำแหน่งงานและกิจกรรมการทำแบบทดสอบ
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          แดชบอร์ดแสดงข้อมูลตัวเลขและกราฟิกอย่างถูกต้อง สวยงาม ตัวเลขสอดคล้องกับกิจกรรมจริงที่เกิดขึ้นในระบบ
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-25</strong></td>
        <td>
          <strong>ค้นหา & จัดการบัญชีผู้ใช้งานระบบ</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(User Management)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ไปที่เมนู <strong>"ผู้ใช้งาน"</strong> (<code>/admin/users</code>)<br>
            2. พิมพ์ค้นหาในช่องค้นหา: <code>สมชาย</code> หรือ <code>ไทยสมาร์ทเทค</code><br>
            3. ทดลองกรองตามสิทธิ์ (Role Filter): ผู้สมัคร (Candidate) / นายจ้าง (Company)
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างที่ค้นหา:</span>
            • คำค้น: <code>candidate.somchai@smartcareer.io</code><br>
            • สิทธิ์ที่ตรวจสอบ: CANDIDATE / COMPANY / ADMIN
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบค้นหาและกรองรายชื่อผู้ใช้งานได้อย่างรวดเร็ว ถูกต้อง แสดงบทบาท วันที่ลงทะเบียน และสถานะบัญชีครบถ้วน
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-26</strong></td>
        <td>
          <strong>การจัดการคลังทักษะมาตรฐาน</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Skills Taxonomy)</span><br>
          <span class="badge-priority badge-medium">ปานกลาง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ไปที่เมนู <strong>"คลังทักษะ"</strong> (<code>/admin/skills</code>)<br>
            2. ตรวจสอบรายการทักษะมาตรฐานในระบบ (เช่น React, Node.js, Python, Docker)<br>
            3. ทดลองเพิ่มทักษะใหม่ หรือแก้ไขคำอธิบายทักษะ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลตัวอย่างทักษะ:</span>
            • <strong>ชื่อทักษะ:</strong> Cloud Native Architecture<br>
            • <strong>หมวดหมู่:</strong> DevOps & Cloud Engineering
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          บันทึกทักษะลงในระบบกลางสำเร็จ และทักษะนี้จะถูกนำไปใช้อ้างอิงในระบบค้นหางานและเรดาร์ทักษะโดยอัตโนมัติ
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-27</strong></td>
        <td>
          <strong>ตรวจสอบระบบรวบรวมตำแหน่งงานภายนอก</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Job Ingestion Monitoring)</span><br>
          <span class="badge-priority badge-medium">ปานกลาง</span>
        </td>
        <td>
          <div class="test-steps">
            1. ไปที่เมนู <strong>"ระบบรวบรวมงานตลาด"</strong> (<code>/admin/ingestion</code>)<br>
            2. ตรวจสอบประวัติการเชื่อมต่อดึงข้อมูลตำแหน่งงานจากแหล่งภายนอก (JobsDB, Google Jobs, Blognone)<br>
            3. ตรวจสอบสถานะการทำงานและจำนวนงานที่นำเข้าสำเร็จ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 ข้อมูลสถานะที่ตรวจสอบ:</span>
            • สถานะบริการ: Active / Operational<br>
            • แหล่งงานที่รองรับ: JobsDB, Google Jobs, Blognone
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบแสดงรายงานการดึงข้อมูลตำแหน่งงานอย่างโปร่งใส มีสถิติจำนวนงานที่นำเข้าสำเร็จและไม่มีข้อผิดพลาดค้างในระบบ
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="page-footer">
    <span>คู่มือการทดสอบระบบ UAT ฉบับสมบูรณ์ · SmartCareer Platform</span>
    <span>หน้า 6</span>
  </div>

  <div class="page-break"></div>

  <!-- ==================== หน้า 7: ระยะที่ 7: ความปลอดภัย & หน้าแรกบุคคลทั่วไป ==================== -->
  <div class="section-header">
    <div class="section-title">
      <span>ระยะที่ 7: ความปลอดภัยและประสบการณ์การใช้งานทั่วไป (Security & Public Experience)</span>
    </div>
    <div class="section-tag">PHASE 7 · TC-28 ถึง TC-30</div>
  </div>

  <div class="section-desc">
    <strong>เป้าหมายระยะที่ 7:</strong> ทดสอบการจำกัดสิทธิ์ตามบทบาท ป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต การออกจากระบบอย่างปลอดภัย และการแสดงผลหน้าแรกสำหรับบุคคลทั่วไป
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">รหัส</th>
        <th style="width: 20%;">ชื่อการทดสอบ & ความสำคัญ</th>
        <th style="width: 42%;">ขั้นตอนการทดสอบ & ข้อมูลตัวอย่างที่ใช้กรอก</th>
        <th style="width: 28%;">ผลลัพธ์ที่คาดหวัง & การบันทึกผล</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TC-28</strong></td>
        <td>
          <strong>การจำกัดสิทธิ์การเข้าถึงหน้าจอตามบทบาท</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Role-based Access Control)</span><br>
          <span class="badge-priority badge-critical">สำคัญยิ่งยวด</span>
        </td>
        <td>
          <div class="test-steps">
            1. ล็อกอินด้วยบัญชีผู้สมัครงาน (<code>candidate.somchai@smartcareer.io</code>)<br>
            2. พิมพ์ URL เข้าหน้าหลังบ้านของผู้ดูแลระบบโดยตรง: <code>/admin/dashboard</code><br>
            3. พิมพ์ URL เข้าหน้าจัดการของบริษัทโดยตรง: <code>/company/dashboard</code><br>
            4. สังเกตการตอบสนองด้านความปลอดภัยของระบบ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 URL ที่ทดสอบการบุกรุกข้ามสิทธิ์:</span>
            • <code>/admin/dashboard</code> · <code>/admin/users</code><br>
            • <code>/company/jobs/new</code> · <code>/company/applications</code>
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบปฏิเสธการเข้าถึงอย่างปลอดภัย ไม่อนุญาตให้เปิดหน้าจอข้ามสิทธิ์ และนำทางผู้ใช้กลับสู่หน้าหลักที่ถูกต้อง
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-29</strong></td>
        <td>
          <strong>การออกจากระบบ & การล้างสิทธิ์คงค้าง</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Logout & Session Safety)</span><br>
          <span class="badge-priority badge-high">ความสำคัญสูง</span>
        </td>
        <td>
          <div class="test-steps">
            1. คลิกที่เมนูโปรไฟล์มุมขวาบน แล้วกดปุ่ม <strong>"ออกจากระบบ (Sign Out)"</strong><br>
            2. สังเกตการนำทางกลับสู่หน้าหลักในสถานะผู้ใช้ทั่วไป<br>
            3. ทดลองกดปุ่ม ย้อนกลับ (Back) บนเบราว์เซอร์ เพื่อตรวจสอบว่าย้อนกลับไปดูข้อมูลส่วนบุคคลได้หรือไม่
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 จุดตรวจสอบความปลอดภัย:</span>
            • สถานะบนเมนูนำทาง: เปลี่ยนกลับเป็นปุ่ม "เข้าสู่ระบบ" และ "สมัครสมาชิก"<br>
            • การกดย้อนกลับ (Browser Back): ไม่สามารถเปิดดูหน้าข้อมูลส่วนตัวได้
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          ระบบออกจากระบบอย่างสมบูรณ์ ล้างข้อมูลการเข้าใช้งาน และไม่สามารถกดย้อนกลับเพื่อเข้าถึงข้อมูลเดิมได้
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>

      <tr>
        <td><strong>TC-30</strong></td>
        <td>
          <strong>หน้าหลักบุคคลทั่วไป & การแสดงผลบนมือถือ</strong><br>
          <span style="font-size: 7.2pt; color: #64748b;">(Public Landing & Responsive)</span><br>
          <span class="badge-priority badge-medium">ปานกลาง</span>
        </td>
        <td>
          <div class="test-steps">
            1. เข้าหน้าแรกของเว็บไซต์ (<code>/</code>) ในสถานะยังไม่เข้าสู่ระบบ<br>
            2. ตรวจสอบการแสดงผลแบนเนอร์หลัก, จุดเด่นของระบบ, กระดานงานแนะนำ, และเมนูนำทาง<br>
            3. ทดลองปรับย่อขนาดหน้าต่างเบราว์เซอร์ เพื่อจำลองการแสดงผลบนแท็บเล็ตและโทรศัพท์มือถือ
          </div>
          <div class="test-data-box">
            <span class="data-tag">📌 องค์ประกอบที่ตรวจสอบ:</span>
            • หน้าแรก (Landing Page): ตัวหนังสือคมชัด กราฟิกสมบูรณ์ ปราศจากข้อความแตกหัก<br>
            • การแสดงผลบนมือถือ: เมนูพับเก็บเป็นแถบ Hamburger สวยงาม ใช้งานสะดวก
          </div>
        </td>
        <td>
          <strong>ผลลัพธ์ที่คาดหวัง:</strong><br>
          หน้าเว็บแสดงผลอย่างสวยงาม เป็นมืออาชีพ ปรับขนาดตามหน้าจอได้อย่างสมบูรณ์แบบบนทุกอุปกรณ์
          <div class="result-check">
            <span class="check-box-item"><span class="square"></span> ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ไม่ผ่าน</span>
            <span class="check-box-item"><span class="square"></span> ข้อเสนอแนะ</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- ==================== ส่วนสรุปผลและลงนาม ==================== -->
  <div class="no-break" style="margin-top: 18px;">
    <div class="section-header">
      <div class="section-title">
        <span>แบบฟอร์มสรุปผลการตรวจรับและการลงนาม (Verification Sign-Off Sheet)</span>
      </div>
      <div class="section-tag">ACCEPTANCE SIGN-OFF</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 25%;">รายการสรุป</th>
          <th style="width: 25%;">จำนวนกรณีทดสอบ</th>
          <th style="width: 25%;">ผลการตรวจรับจริง</th>
          <th style="width: 25%;">ร้อยละความสำเร็จ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>กรณีทดสอบทั้งหมด (Total Cases)</strong></td>
          <td>30 กรณีทดสอบ</td>
          <td>........... กรณีทดสอบ</td>
          <td>........... %</td>
        </tr>
        <tr>
          <td><strong style="color: #16a34a;">กรณีที่ผ่านการทดสอบ (Passed)</strong></td>
          <td>เป้าหมาย 100%</td>
          <td>........... ผ่าน</td>
          <td>........... %</td>
        </tr>
        <tr>
          <td><strong style="color: #dc2626;">กรณีที่ไม่ผ่านการทดสอบ (Failed)</strong></td>
          <td>เป้าหมาย 0 เคส</td>
          <td>........... ไม่ผ่าน</td>
          <td>........... %</td>
        </tr>
      </tbody>
    </table>

    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #ffffff; margin-top: 8px;">
      <strong style="font-family: 'Prompt'; font-size: 8.5pt; color: #0f172a;">ข้อคิดเห็นและข้อเสนอแนะเพิ่มเติมของคณะกรรมการตรวจรับระบบ:</strong>
      <div style="border-bottom: 1px dashed #cbd5e1; height: 18px; margin-top: 4px;"></div>
      <div style="border-bottom: 1px dashed #cbd5e1; height: 18px;"></div>
    </div>

    <div class="signature-grid">
      <div class="signature-box">
        <div style="font-weight: 600; font-size: 8pt; color: #0f172a;">ผู้แทนผู้ทดสอบระบบ (Tester)</div>
        <div class="signature-line"></div>
        <div style="font-size: 7.5pt; color: #475569;">(.........................................................)</div>
        <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">วันที่: ...... / ...... / 2026</div>
      </div>
      <div class="signature-box">
        <div style="font-weight: 600; font-size: 8pt; color: #0f172a;">ผู้จัดการโครงการ (Project Manager)</div>
        <div class="signature-line"></div>
        <div style="font-size: 7.5pt; color: #475569;">(.........................................................)</div>
        <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">วันที่: ...... / ...... / 2026</div>
      </div>
      <div class="signature-box">
        <div style="font-weight: 600; font-size: 8pt; color: #0f172a;">ผู้แทนผู้ว่าจ้าง / ประธานตรวจรับ</div>
        <div class="signature-line"></div>
        <div style="font-size: 7.5pt; color: #475569;">(.........................................................)</div>
        <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">วันที่: ...... / ...... / 2026</div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>คู่มือการทดสอบระบบ UAT ฉบับสมบูรณ์ · SmartCareer Platform</span>
    <span>หน้า 7</span>
  </div>

</body>
</html>`;

  return htmlContent;
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const docsUatDir = path.join(rootDir, 'docs', 'uat');
  
  if (!fs.existsSync(docsUatDir)) {
    fs.mkdirSync(docsUatDir, { recursive: true });
  }

  const htmlPath = path.join(docsUatDir, 'UAT_SmartCareer_Smooth_Journey_Manual.html');
  const rootHtmlPath = path.join(rootDir, 'UAT_SmartCareer_Smooth_Journey_Manual.html');
  const pdfPath = path.join(docsUatDir, 'UAT_SmartCareer_Smooth_Journey_Manual.pdf');
  const rootPdfPath = path.join(rootDir, 'UAT_SmartCareer_Smooth_Journey_Manual.pdf');

  console.log('Generating Smooth UAT Document HTML...');
  const htmlContent = generateSmoothUatDocument();
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  fs.writeFileSync(rootHtmlPath, htmlContent, 'utf8');
  console.log('Saved HTML to:', htmlPath);

  // Convert to PDF using headless Edge
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    console.error('Microsoft Edge not found at:', edgePath);
    process.exit(1);
  }

  console.log('Generating PDF via headless Microsoft Edge...');
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    htmlPath
  ];

  try {
    execFileSync(edgePath, args, { stdio: 'inherit' });
    console.log('Successfully generated PDF at:', pdfPath);
    
    // Copy to root as well
    fs.copyFileSync(pdfPath, rootPdfPath);
    console.log('Copied PDF to root:', rootPdfPath);

    const stats = fs.statSync(pdfPath);
    console.log(`PDF File Size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    process.exit(1);
  }
}

main();
