const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const CSS_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');

  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {
      content: counter(page);
    }
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Sarabun', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13.5px;
    line-height: 1.65;
    color: #1e293b;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Inter', 'Sarabun', sans-serif;
    color: #0f172a;
    font-weight: 700;
    margin-top: 1.4em;
    margin-bottom: 0.5em;
    page-break-after: avoid;
    break-after: avoid;
  }

  h1 {
    font-size: 24px;
    font-weight: 800;
    border-bottom: 2.5px solid #4f46e5;
    padding-bottom: 8px;
    margin-top: 0;
    color: #1e1b4b;
  }

  h2 {
    font-size: 18px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 1.8em;
    color: #312e81;
  }

  h3 {
    font-size: 15px;
    margin-top: 1.4em;
    color: #4338ca;
  }

  h4 {
    font-size: 13.5px;
    color: #475569;
  }

  p {
    margin-top: 0;
    margin-bottom: 0.8em;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 11.5px;
    page-break-inside: auto;
    break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  thead {
    display: table-header-group;
  }

  th {
    background-color: #f1f5f9;
    color: #1e293b;
    font-weight: 700;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid #cbd5e1;
  }

  td {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  /* Code & Syntax */
  code {
    font-family: 'Fira Code', Consolas, monospace;
    font-size: 11.5px;
    background-color: #f1f5f9;
    color: #0f172a;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  pre {
    background-color: #0f172a;
    color: #f8fafc;
    padding: 12px 14px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 11px;
    line-height: 1.5;
    page-break-inside: avoid;
    break-inside: avoid;
    margin: 12px 0;
  }

  pre code {
    background-color: transparent;
    color: inherit;
    padding: 0;
    border: none;
    font-size: 11px;
  }

  /* Blockquotes & GitHub-style alerts */
  blockquote {
    margin: 12px 0;
    padding: 10px 14px;
    background-color: #f8fafc;
    border-left: 4px solid #4f46e5;
    border-radius: 0 6px 6px 0;
    color: #334155;
    font-size: 12.5px;
  }

  /* Badges & Checklist */
  ul {
    margin-top: 0;
    margin-bottom: 0.8em;
    padding-left: 22px;
  }

  li {
    margin-bottom: 4px;
  }

  li input[type="checkbox"] {
    margin-right: 6px;
    transform: translateY(1px);
  }

  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }

  a {
    color: #4f46e5;
    text-decoration: none;
  }

  /* Cover Page Styles */
  .cover-page {
    text-align: center;
    padding: 80px 20px;
    page-break-after: always;
    break-after: always;
  }

  .cover-logo {
    display: inline-block;
    width: 60px;
    height: 60px;
    background-color: #e8eaff;
    color: #4f46e5;
    font-weight: 800;
    font-size: 26px;
    line-height: 60px;
    border-radius: 16px;
    margin-bottom: 24px;
  }

  .cover-title {
    font-size: 30px;
    font-weight: 800;
    color: #1e1b4b;
    margin-bottom: 12px;
    border: none;
    padding: 0;
  }

  .cover-subtitle {
    font-size: 16px;
    color: #475569;
    margin-bottom: 40px;
  }

  .cover-meta {
    display: inline-block;
    text-align: left;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px 30px;
    font-size: 13px;
    line-height: 1.8;
  }
`;

function convertMarkdownToHtml(markdownContent, title = 'SmartCareer UAT') {
  const htmlBody = marked.parse(markdownContent);
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    ${CSS_STYLES}
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;
}

function printHtmlToPdf(htmlFilePath, pdfOutputPath) {
  const fileUrl = `file:///${htmlFilePath.replace(/\\/g, '/')}`;
  const cmd = `"${EDGE_PATH}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdfOutputPath}" "${fileUrl}"`;
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  const uatDir = path.resolve(__dirname, '../docs/uat');
  const tempDir = path.resolve(__dirname, '../docs/uat/.tmp_html');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const files = [
    { name: '00_UAT_MASTER_INDEX', file: '00_UAT_MASTER_INDEX.md', title: 'SmartCareer - UAT Master Index' },
    { name: '01_UAT_ROLE_CANDIDATE', file: '01_UAT_ROLE_CANDIDATE.md', title: 'SmartCareer - Candidate UAT Test Scripts' },
    { name: '02_UAT_ROLE_COMPANY', file: '02_UAT_ROLE_COMPANY.md', title: 'SmartCareer - Company UAT Test Scripts' },
    { name: '03_UAT_ROLE_ADMIN', file: '03_UAT_ROLE_ADMIN.md', title: 'SmartCareer - Admin UAT Test Scripts' },
    { name: '04_UAT_SECURITY_AND_EDGES', file: '04_UAT_SECURITY_AND_EDGES.md', title: 'SmartCareer - Security & Concurrency UAT Test Scripts' },
  ];

  console.log('🚀 Converting SmartCareer UAT Markdown files to PDF via Microsoft Edge Headless Engine...\n');

  // 1. Convert each file individually
  for (const item of files) {
    const mdPath = path.join(uatDir, item.file);
    if (!fs.existsSync(mdPath)) {
      console.warn(`⚠️ Warning: ${mdPath} does not exist, skipping.`);
      continue;
    }

    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const htmlContent = convertMarkdownToHtml(mdContent, item.title);

    const tempHtmlPath = path.join(tempDir, `${item.name}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

    const pdfPath = path.join(uatDir, `${item.name}.pdf`);
    console.log(`📄 Generating: ${item.name}.pdf...`);
    printHtmlToPdf(tempHtmlPath, pdfPath);
    console.log(`✅ Created: ${pdfPath}`);
  }

  // 2. Generate Combined Unified Complete Manual PDF
  console.log('\n📚 Generating Complete Unified UAT Manual (All Roles in One PDF)...');
  const combinedTitle = 'SmartCareer — Complete UAT Acceptance Manual & Test Scripts';

  const coverHtml = `
    <div class="cover-page">
      <div class="cover-logo">SC</div>
      <h1 class="cover-title">SmartCareer Acceptance Testing Manual</h1>
      <div class="cover-subtitle">ชุดเอกสารการทดสอบการยอมรับของผู้ใช้และระเบียบการตรวจรับระบบฉบับสมบูรณ์ (UAT)</div>
      
      <div class="cover-meta">
        <div><strong>ระบบเป้าหมาย:</strong> SmartCareer Career Intelligence Platform</div>
        <div><strong>สถาปัตยกรรม:</strong> Next.js 14 App Router / NestJS 10 / PostgreSQL 18 / Prisma 5.22</div>
        <div><strong>เวอร์ชันเอกสาร:</strong> Revision 2.0 (Official Execution Edition)</div>
        <div><strong>สถานะ:</strong> APPROVED / READY FOR UAT EXECUTION</div>
        <div><strong>จำนวนกรณีทดสอบ:</strong> 58 Test Scenarios (Candidate 20, Company 14, Admin 10, Security 14)</div>
        <div><strong>วันที่สร้างเอกสาร:</strong> 30 กันยายน 2026</div>
      </div>
    </div>
  `;

  let combinedMd = '';
  for (const item of files) {
    const mdPath = path.join(uatDir, item.file);
    if (fs.existsSync(mdPath)) {
      combinedMd += `\n\n<div style="page-break-before: always; break-before: always;"></div>\n\n` + fs.readFileSync(mdPath, 'utf-8');
    }
  }

  const combinedParsedHtml = marked.parse(combinedMd);
  const fullCombinedHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${combinedTitle}</title>
  <style>
    ${CSS_STYLES}
  </style>
</head>
<body>
  ${coverHtml}
  ${combinedParsedHtml}
</body>
</html>`;

  const combinedHtmlPath = path.join(tempDir, 'SMARTCAREER_COMPLETE_UAT_MANUAL.html');
  fs.writeFileSync(combinedHtmlPath, fullCombinedHtml, 'utf-8');

  const combinedPdfPath = path.join(uatDir, 'SMARTCAREER_COMPLETE_UAT_MANUAL.pdf');
  printHtmlToPdf(combinedHtmlPath, combinedPdfPath);
  console.log(`🎉 Successfully created Unified Manual: ${combinedPdfPath}\n`);

  // Cleanup temporary HTML files
  try {
    const tempFiles = fs.readdirSync(tempDir);
    for (const tf of tempFiles) {
      fs.unlinkSync(path.join(tempDir, tf));
    }
    fs.rmdirSync(tempDir);
  } catch (e) {
    // ignore
  }

  console.log('✨ All UAT PDF conversions completed successfully!');
}

main().catch(err => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
