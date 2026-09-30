# SmartCareer – Project Structure & 7-Day Development Plan

## 1. Project Overview

**SmartCareer** คือแพลตฟอร์มหางาน รวบรวมตำแหน่งงาน ประเมินทักษะ และช่วยวางแผนพัฒนาตนเองสำหรับสายงานด้าน Software / IT

ระบบเชื่อมโยงข้อมูลจากหลายแหล่ง ได้แก่

- GitHub Repository ของผู้สมัคร
- แบบทดสอบภาคทฤษฎี
- แบบทดสอบภาคปฏิบัติผ่าน Judge0
- ข้อมูลตำแหน่งงานจาก API และ Web Scraping
- ข้อมูลคอร์สเรียนจาก Udemy และ YouTube
- ผลประเมินจากบริษัท

เป้าหมายของ MVP คือให้เกิดวงจรหลักดังนี้

```text
GitHub + Assessment
        ↓
 Candidate Skills
        ↓
   Job Matching
        ↓
 Job Application
        ↓
Company Evaluation
        ↓
    Skill Gap
        ↓
Course Recommendation
        ↓
Skill Improvement
```

แนวทางการพัฒนาจะเน้น **โครงสร้างไม่ซับซ้อน พัฒนาเร็ว แต่ไม่ลดขอบเขตของ Requirement**

---

# 2. User Roles

ระบบมีทั้งหมด 3 Role

```text
CANDIDATE
COMPANY
ADMIN
```

## 2.1 Candidate

ความสามารถหลัก

- สมัครสมาชิก / Login
- สร้างและแก้ไข Profile
- กำหนด Career Goal
- เชื่อมต่อ GitHub
- วิเคราะห์ Repository และ Tech Stack
- แสดง Skill Radar
- ดู Skill Evidence
- ทำแบบทดสอบ Theory
- ทำ Coding Assessment ผ่าน Judge0
- ได้รับ Verified Skill
- ค้นหางาน
- ดู Match Score
- สมัครงาน
- ดูสถานะ Application
- ดู Company Feedback
- วิเคราะห์ Skill Gap
- รับคำแนะนำ Course

---

## 2.2 Company

ความสามารถหลัก

- สมัครบัญชีบริษัท
- สร้าง Company Profile
- ส่งข้อมูลเพื่อ Verification
- สร้าง Job Posting
- แก้ไข / ปิดประกาศงาน
- กำหนด Required Skills
- ดูผู้สมัคร
- ดู Match Score
- ดู Skill Summary
- ดู Assessment Result
- เปลี่ยน Application Status
- เพิ่ม Internal Note
- ประเมิน Candidate
- ส่ง Feedback

Application Pipeline

```text
APPLIED
   ↓
REVIEWING
   ↓
INTERVIEW
   ↓
TECHNICAL_TEST
   ↓
OFFER
   ↓
ACCEPTED

หรือ

REJECTED
```

---

## 2.3 Admin

ความสามารถหลัก

- Dashboard ภาพรวมระบบ
- จัดการ User
- จัดการ Company
- ตรวจสอบ Company Verification
- จัดการ Skill Master
- จัดการ Skill Framework
- จัดการ Question Bank
- จัดการ Assessment
- จัดการ Job
- ตรวจสอบ External Job
- ตรวจสอบ Course
- ตรวจสอบ Scheduler
- ตรวจสอบ Ingestion Log
- ตรวจสอบปัญหา API / Scraper

---

# 3. Recommended Architecture

ใช้รูปแบบ **Modular Monolith**

ไม่ใช้ Microservices ใน MVP เพื่อให้พัฒนาได้เร็วและดูแลระบบง่าย

```text
                         ┌──────────────────────┐
                         │      Next.js Web    │
                         │ Candidate / Company │
                         │        / Admin       │
                         └──────────┬───────────┘
                                    │
                                    │ REST API
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                       NestJS API                            │
│                                                             │
│ Auth      Candidate      Company       Jobs                 │
│ GitHub    Skills         Assessment    Applications         │
│ Courses   Recommendation Ingestion     Admin                │
│ Scheduler                                                   │
└──────────────┬──────────────┬──────────────┬─────────────────┘
               │              │              │
               ▼              ▼              ▼
          PostgreSQL       GitHub API      External Sources
                                         ├─ JSearch
                                         ├─ Remotive
                                         ├─ Udemy
                                         ├─ YouTube
                                         ├─ Blognone
                                         ├─ JobThai
                                         └─ JobsDB

                              │
                              ▼
                           Judge0
```

---

# 4. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router |
| UI | Tailwind CSS + shadcn/ui |
| Backend | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JWT + OAuth |
| GitHub Integration | GitHub API |
| Chart | Recharts |
| Code Editor | Monaco Editor |
| Code Execution | Judge0 |
| Scraping | Axios + Cheerio |
| Scheduler | NestJS Schedule / Cron |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Database Hosting | Supabase PostgreSQL |

สิ่งที่ไม่จำเป็นใน MVP

```text
Redis
Kafka
RabbitMQ
Elasticsearch
Kubernetes
Microservices
Vector Database
Complex ML Pipeline
```

---

# 5. Main Modules

ระบบแบ่งเป็น Module หลักดังนี้

```text
1. Authentication
2. User
3. Candidate
4. Company
5. GitHub Analysis
6. Skill
7. Assessment
8. Job
9. Application
10. Course
11. Recommendation
12. Data Ingestion
13. Admin
```

---

# 6. Core Feature Structure

## 6.1 Authentication

รองรับระบบยืนยันตัวตนและการเข้าถึงตามบทบาท (Role-Based Authentication & Security Policy):

### นโยบายความปลอดภัยของระบบล็อกอิน (Security & Identity Architecture Policy - v1.0)
* **Candidate (ผู้สมัครงาน)**: **บังคับล็อกอินด้วย GitHub OAuth เท่านั้น** (SmartCareer v1.0 บังคับ Candidate ล็อกอินด้วย GitHub เท่านั้นเพื่อความปลอดภัยของสิทธิ์การเชื่อมต่อโค้ด, การตรวจสอบตัวตนเจ้าของ Repository และการดึง Telemetry/Commit Analysis แบบ End-to-End) *พร้อมรองรับ Local Email/Password สำหรับสภาพแวดล้อมทดสอบ*
* **Company (นายจ้าง/บริษัท)**: รองรับ **Google OAuth** และ **Email / Password** สำหรับนิติบุคคลและทีมงานฝ่ายทรัพยากรบุคคล
* **Admin (ผู้ดูแลระบบ)**: รองรับ **Email / Password** ภายใต้ระบบรักษาความปลอดภัยและการจำกัดสิทธิ์เฉพาะ (RBAC Guard)

```text
CANDIDATE -> GitHub OAuth (Mandatory for Code & Telemetry Security) / Local Dev Auth
COMPANY   -> Google OAuth / Email & Password
ADMIN     -> Dedicated Admin Auth & RBAC
```


---

# 6.2 Candidate Profile

ข้อมูลหลัก

```text
name
email
bio
education
experience
targetCareer
githubUsername
```

Candidate Profile แสดง

```text
Personal Information
Career Goal
GitHub
Skill Radar
Verified Skills
Assessment Result
Recommended Courses
Company Feedback
```

---

# 6.3 Company Profile

ข้อมูลหลัก

```text
companyName
description
website
address
contact
logo
verificationStatus
```

Verification Status

```text
PENDING
VERIFIED
REJECTED
```

Flow

```text
Company Register
       ↓
Create Company Profile
       ↓
Submit Verification
       ↓
Admin Review
       ↓
VERIFIED
       ↓
Create Job
```

---

# 6.4 GitHub Skill Analysis

ระบบวิเคราะห์ GitHub โดยใช้ Evidence-Based Scoring

ข้อมูลที่วิเคราะห์

```text
Repository
Language
Framework
Dependency
Commit
Topic
```

ตัวอย่าง Mapping

```text
react       → React
next        → Next.js
express     → Node.js
nestjs      → NestJS
prisma      → Prisma
postgresql  → PostgreSQL
docker      → Docker
```

ตัวอย่าง Practical Skill Score

```text
Repository Usage     35%
Dependencies         25%
Commit Contribution  25%
Project Diversity    15%
```

แนวคิดหลัก

```text
Practical Skill → GitHub Evidence
Knowledge Skill → Assessment
```

---

# 6.5 Skill Score

ตัวอย่างการรวมคะแนน

```text
GitHub Practical Score   50%
Theory Assessment        20%
Coding Assessment        30%
```

ผลลัพธ์

```text
Frontend    82
Backend     74
Database    65
DevOps      48
Testing     58
```

นำไปแสดงผ่าน Radar Chart

---

# 6.6 Skill Framework

รองรับ Skill Framework ตามมาตรฐาน เช่น

```text
Microsoft
AWS
Google Cloud
CompTIA
Internal Skill Standard
```

โครงสร้าง

```text
SkillFramework
      │
      └── SkillFrameworkItem
                │
                └── Skill
```

ตัวอย่าง

```text
Microsoft Azure Developer
├── Azure Functions
├── Azure Storage
├── Azure Security
└── Monitoring
```

---

# 6.7 Job Marketplace

Job มี 2 ประเภท

```text
Internal Job
External Job
```

### Internal Job

สร้างโดย Company

```text
Company
   ↓
Create Job
```

### External Job

มาจาก

```text
JSearch
Remotive
Blognone
JobThai
JobsDB
```

ทุก Source จะถูก Normalize เข้า Job Schema เดียวกัน

```text
Job

id
title
company
description
location
employmentType
salary
skills
source
sourceUrl
externalId
publishedAt
expiresAt
```

---

# 6.8 Match Score

คำนวณจาก Candidate Skill เทียบกับ Job Requirement

ตัวอย่างสูตร

```text
Required Skill Coverage     70%
Preferred Skill Coverage    20%
Career Alignment            10%
```

ตัวอย่างผลลัพธ์

```text
Match Score = 78%

Matched Skills
✓ React
✓ TypeScript
✓ Next.js

Skill Gaps
△ Docker
△ AWS
```

ระบบควรแสดงเหตุผลประกอบ ไม่แสดงเพียงตัวเลข Match Score

---

# 6.9 Job Application

โครงสร้าง

```text
Candidate
   ↓
Job
   ↓
JobApplication
```

Pipeline

```text
APPLIED
REVIEWING
INTERVIEW
TECHNICAL_TEST
OFFER
ACCEPTED
REJECTED
```

Company สามารถ

```text
View Candidate
View Skills
View Match Score
View Assessment
Update Application Status
Add Internal Note
Evaluate Candidate
```

Candidate สามารถ

```text
Apply Job
View Application
View Application Status
View Feedback
```

---

# 6.10 Assessment System

แบ่งเป็น

```text
Theory Assessment
Practical Coding Assessment
```

## Theory

รองรับ

```text
Multiple Choice
Single Answer
```

ข้อมูล

```text
Question
Choice
CorrectAnswer
Difficulty
Skill
```

---

## Coding Assessment

ใช้

```text
Monaco Editor
+
Judge0
```

Flow

```text
Candidate writes code
        ↓
Backend API
        ↓
Judge0
        ↓
Test Cases
        ↓
Score
```

---

# 6.11 Verified Skills

เมื่อ Candidate ผ่าน Assessment

```text
Assessment
     ↓
Score
     ↓
Verified Skill
```

ตัวอย่าง

```text
JavaScript

GitHub     78
Theory     80
Coding     75

Verified Score = 77
```

---

# 6.12 Course Recommendation

Course Source

```text
Udemy
YouTube
```

Unified Course Schema

```text
Course

title
provider
description
skills
level
url
thumbnail
source
```

Recommendation ใช้ Skill Gap

ตัวอย่าง

```text
Target Career
Backend Developer

Required
Node.js     80
Database    70
Docker      60

Candidate
Node.js     75
Database    45
Docker      20

Gap
Docker      40
Database    25
Node.js      5
```

Recommendation

```text
1. Docker Course
2. Database Course
3. Node.js Course
```

---

# 6.13 Company Evaluation

ตัวอย่างข้อมูล

```text
technicalScore
problemSolvingScore
communicationScore
teamworkScore
comment
skills
```

ตัวอย่าง

```text
Technical       4/5
Problem Solving 3/5
Communication   4/5
Teamwork        4/5
```

Feedback ใช้เป็นข้อมูลสำหรับ Career Development

```text
Company Feedback
      ↓
Skill Gap
      ↓
Course Recommendation
```

ไม่ควรใช้ Company Feedback เปลี่ยน Skill Score โดยตรง

---

# 6.14 Data Ingestion

Job Sources

```text
JSearch
Remotive
Blognone
JobThai
JobsDB
```

Course Sources

```text
Udemy
YouTube
```

Pipeline

```text
Fetch
 ↓
Normalize
 ↓
Deduplicate
 ↓
Upsert
 ↓
Log
```

---

# 6.15 Scheduler

ตัวอย่าง Schedule

```text
Job Sync
ทุก 6 ชั่วโมง

Course Sync
ทุก 24 ชั่วโมง
```

ทุก Cycle บันทึกลง

```text
IngestionLog

source
status
startedAt
finishedAt
created
updated
duplicates
errors
errorMessage
```

---

# 6.16 Admin

Admin Pages

```text
/admin/dashboard
/admin/users
/admin/companies
/admin/skills
/admin/frameworks
/admin/assessments
/admin/questions
/admin/jobs
/admin/courses
/admin/ingestion
```

Dashboard แสดง

```text
Users
Companies
Jobs
Courses
Assessments
Applications
Scheduler Status
Ingestion Errors
```

---

# 7. Database Structure

Entity หลักประมาณ 20–22 Tables

```text
User

CandidateProfile

Company
CompanyMember
CompanyVerification

Skill
CandidateSkill

GitHubRepository
GitHubEvidence

Job
JobSkill
JobApplication
ApplicationStatusHistory

Assessment
Question
Choice
AssessmentAttempt
AssessmentAnswer

Course
CourseSkill

SkillFramework
SkillFrameworkItem

CompanyEvaluation

IngestionLog
```

Relationship หลัก

```text
User
├── CandidateProfile
└── CompanyMember
       │
       └── Company

Candidate
├── CandidateSkill
├── GitHubRepository
├── AssessmentAttempt
├── JobApplication
└── CompanyEvaluation

Company
└── Job
     ├── JobSkill
     └── JobApplication

Course
└── CourseSkill

SkillFramework
└── SkillFrameworkItem
```

---

# 8. Frontend Pages

## Candidate

```text
/candidate/dashboard
/profile
/profile/github
/skills
/jobs
/jobs/[id]
/applications
/assessments
/assessments/[id]
/courses
/feedback
```

---

## Company

```text
/company/dashboard
/company/profile
/company/jobs
/company/jobs/new
/company/jobs/[id]
/company/jobs/[id]/edit
/company/jobs/[id]/applications
/company/applications/[id]
/company/evaluations
```

---

## Admin

```text
/admin/dashboard
/admin/users
/admin/companies
/admin/skills
/admin/frameworks
/admin/assessments
/admin/questions
/admin/jobs
/admin/courses
/admin/ingestion
```

---

# 9. Recommended Folder Structure

```text
smartcareer/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   └── lib/
│   │
│   └── api/
│       └── src/
│           ├── auth/
│           ├── users/
│           ├── candidates/
│           ├── companies/
│           ├── github/
│           ├── skills/
│           ├── jobs/
│           ├── applications/
│           ├── courses/
│           ├── assessments/
│           ├── matching/
│           ├── recommendations/
│           ├── ingestion/
│           └── admin/
│
├── packages/
│   └── shared/
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── docs/
│
├── .env.example
├── package.json
└── README.md
```

---

# 10. Development Phases

โปรเจคแบ่งเป็นทั้งหมด 9 Phase

```text
Phase 0 – Foundation
Phase 1 – Candidate & Company Profile
Phase 2 – GitHub Skill Intelligence
Phase 3 – Assessment & Verified Skills
Phase 4 – Job Marketplace & Match Score
Phase 5 – Recruitment Workflow
Phase 6 – Learning & Career Development
Phase 7 – Data Ingestion & Scheduler
Phase 8 – Admin, QA & Deployment
```

---

# Phase 0 – Foundation

เป้าหมาย

สร้างฐานของระบบทั้งหมด

งาน

```text
Monorepo Setup
Next.js
NestJS
PostgreSQL
Prisma

Authentication
Authorization
RBAC

Candidate Role
Company Role
Admin Role

Base Layout
Environment Configuration
```

Acceptance Gate

```text
Candidate Login → Candidate Dashboard

Company Login → Company Dashboard

Admin Login → Admin Dashboard

Candidate → /admin = Forbidden
Company → /admin = Forbidden
```

---

# Phase 1 – Candidate & Company Profile

Candidate

```text
Candidate Profile
Education
Experience
Career Goal
GitHub Account
```

Company

```text
Company Registration
Company Profile
Company Verification
```

Acceptance Gate

```text
Candidate สามารถสร้าง Profile ได้

Company สามารถสมัครและส่ง Verification ได้

Admin สามารถ Approve / Reject Company ได้
```

---

# Phase 2 – GitHub Skill Intelligence

งาน

```text
GitHub OAuth
Repository Sync
Language Detection
Dependency Detection
Tech Stack Detection
Skill Mapping
Skill Scoring
Radar Chart
Skill Evidence
```

Acceptance Gate

```text
GitHub
  ↓
Repositories
  ↓
Tech Stack
  ↓
Skill
  ↓
Radar Chart
```

ต้องทำงานครบด้วย GitHub จริง

---

# Phase 3 – Assessment & Verified Skills

งาน

```text
Theory Assessment
Question Bank
Assessment Attempt
Scoring

Monaco Editor
Judge0
Coding Problems
Test Cases
Coding Score

Verified Skill
```

Acceptance Gate

```text
Start Assessment
      ↓
Theory
      ↓
Coding
      ↓
Submit
      ↓
Judge0
      ↓
Score
      ↓
Verified Skill
```

---

# Phase 4 – Job Marketplace & Match Score

งาน

Internal Job

```text
Company Create Job
Edit Job
Close Job
Required Skills
```

External Job

```text
JSearch
Remotive
Blognone
JobThai
JobsDB
```

Candidate

```text
Search
Filter
Job Detail
Match Score
```

Acceptance Gate

```text
Company Creates Job
        ↓
Candidate Finds Job
        ↓
Candidate Opens Job
        ↓
Match Score Generated
```

---

# Phase 5 – Recruitment Workflow

งาน

```text
Apply Job
JobApplication
Application Pipeline
Status History
Candidate View
Company Candidate Review
Internal Notes
Company Evaluation
```

Acceptance Gate

```text
Candidate Apply
      ↓
Company Review
      ↓
Interview
      ↓
Technical Test
      ↓
Offer
      ↓
Accepted / Rejected
```

---

# Phase 6 – Learning & Career Development

งาน

```text
Career Goal
Skill Gap Analysis
Course Aggregation
Course Recommendation
Company Feedback
Learning Recommendation
```

Course Source

```text
Udemy
YouTube
```

Acceptance Gate

```text
Candidate Skill
      +
Career Target
      +
Company Feedback
      ↓
Skill Gap
      ↓
Recommended Courses
```

---

# Phase 7 – Data Ingestion & Scheduler

งาน

```text
JSearch Connector
Remotive Connector
Blognone Scraper
JobThai Scraper
JobsDB Scraper

YouTube Connector
Udemy Connector

Normalize
Deduplicate
Upsert

Scheduler
Ingestion Log
```

Acceptance Gate

Admin ต้องสามารถเห็น

```text
Source
Last Run
Status
Created
Updated
Duplicate
Errors
```

---

# Phase 8 – Admin, QA & Deployment

Admin

```text
User Management
Company Verification
Skill Management
Skill Framework
Question Bank
Assessment Management
Job Management
Course Management
Scheduler Monitoring
```

QA

```text
Unit Test
Integration Test
E2E
Security Test
Responsive Test
Production Build
```

Deployment

```text
Frontend → Vercel
Backend  → Render
Database → Supabase PostgreSQL
Judge    → Judge0
```

---

# 11. Seven-Day Development Plan

## Day 1 – Foundation + User Roles

ทำ

```text
Project Setup
Database
Authentication
RBAC

Candidate
Company
Admin

Candidate Profile
Company Profile
Company Verification

Candidate Dashboard
Company Dashboard
Admin Dashboard
```

Acceptance Gate

```text
Candidate Login = PASS
Company Login = PASS
Admin Login = PASS

RBAC = PASS
Profile CRUD = PASS
Company Verification = PASS
```

---

# Day 2 – GitHub Skill Analysis

ทำ

```text
GitHub OAuth
Repository Fetch
Language Analysis
Dependency Analysis
Tech Mapping
Skill Scoring
Skill Evidence
Radar Chart
```

Acceptance Gate

```text
Real GitHub Account
      ↓
Repository
      ↓
Tech Stack
      ↓
Skill Score
      ↓
Radar Chart
```

---

# Day 3 – Job Marketplace

ทำ

```text
Company Job CRUD

JSearch
Remotive
Blognone
JobThai
JobsDB

Normalize Job
Deduplicate Job

Job Search
Job Filter
Job Detail
Match Score
```

Acceptance Gate

```text
Company Create Job = PASS

External Job Import = PASS

Candidate Search = PASS

Match Score = PASS
```

---

# Day 4 – Assessment & Judge0

ทำ

```text
Assessment CRUD
Question Bank
Theory Assessment

Monaco Editor
Judge0
Coding Problems
Test Cases
Scoring

Verified Skill
```

Acceptance Gate

```text
Theory Submission = PASS

Coding Submission = PASS

Judge0 Execution = PASS

Verified Skill = PASS
```

---

# Day 5 – Recruitment + Learning

ทำ

```text
Job Application
Application Status
Company Candidate Review
Internal Note
Company Evaluation

Skill Gap
YouTube Course
Udemy Course
Course Recommendation
```

Acceptance Gate

```text
Candidate Apply
      ↓
Company Review
      ↓
Company Evaluation
      ↓
Candidate Feedback
      ↓
Skill Gap
      ↓
Course Recommendation
```

---

# Day 6 – Scheduler + Admin

ทำ

```text
Job Scheduler
Course Scheduler

Ingestion Logs
Error Logs
Manual Sync

Admin Users
Admin Companies
Admin Skills
Admin Frameworks
Admin Questions
Admin Assessments
Admin Jobs
Admin Courses
```

Acceptance Gate

```text
Automatic Sync = PASS

Manual Sync = PASS

Ingestion Log = PASS

Admin CRUD = PASS
```

---

# Day 7 – QA + Deployment

ห้ามเพิ่ม Feature ใหม่ในวันนี้

ทำเฉพาะ

```text
Bug Fix
Integration Testing
E2E Testing
Security
Responsive
Deployment
Seed Demo Data
Documentation
Demo Preparation
```

---

# 12. Final E2E Acceptance

## Candidate Journey

```text
Register
  ↓
Create Profile
  ↓
Connect GitHub
  ↓
Analyze Skills
  ↓
Skill Radar
  ↓
Take Assessment
  ↓
Verified Skill
  ↓
Search Job
  ↓
View Match Score
  ↓
Apply Job
  ↓
View Application Status
  ↓
Receive Feedback
  ↓
Skill Gap
  ↓
Course Recommendation
```

---

## Company Journey

```text
Register Company
      ↓
Create Profile
      ↓
Submit Verification
      ↓
Admin Approve
      ↓
Create Job
      ↓
View Applicants
      ↓
Review Candidate
      ↓
Update Pipeline
      ↓
Evaluate Candidate
```

---

## Admin Journey

```text
Admin Login
     ↓
Verify Company
     ↓
Manage Skills
     ↓
Manage Skill Framework
     ↓
Manage Assessment
     ↓
Manage Jobs
     ↓
Monitor Scheduler
     ↓
Inspect Ingestion Errors
```

---

# 13. Definition of Done

| Requirement | Required |
|---|---|
| Candidate Profile | ✅ |
| Company Profile | ✅ |
| Company Verification | ✅ |
| GitHub Connection | ✅ |
| GitHub Skill Analysis | ✅ |
| Skill Radar | ✅ |
| Skill Evidence | ✅ |
| Job Search | ✅ |
| Company Job Posting | ✅ |
| JSearch | ✅ |
| Remotive | ✅ |
| Blognone Scraping | ✅ |
| JobThai Scraping | ✅ |
| JobsDB Scraping | ✅ |
| Match Score | ✅ |
| Job Application | ✅ |
| Company Recruitment Pipeline | ✅ |
| Theory Assessment | ✅ |
| Coding Assessment | ✅ |
| Judge0 | ✅ |
| Verified Skill | ✅ |
| Skill Framework | ✅ |
| YouTube Course | ✅ |
| Udemy Course | ✅ |
| Skill Gap | ✅ |
| Course Recommendation | ✅ |
| Company Feedback | ✅ |
| Scheduler | ✅ |
| Ingestion Logs | ✅ |
| Admin User Management | ✅ |
| Admin Company Management | ✅ |
| Admin Skill Management | ✅ |
| Admin Assessment Management | ✅ |
| Admin Dashboard | ✅ |
| E2E Testing | ✅ |
| Production Deployment | ✅ |

---

# 14. Complexity Reduction Strategy

ลดความซับซ้อนของ Implementation โดยไม่ลด Requirement

| Requirement | Avoid | MVP Approach |
|---|---|---|
| GitHub Analysis | LLM อ่าน source code ทั้งหมด | Dependency + Language + Commit Evidence |
| Match Score | Machine Learning | Weighted Matching |
| Course Recommendation | AI Recommender | Skill Gap |
| Skill Standard | Certification Engine | Framework Mapping |
| Coding Sandbox | Build Container System | Judge0 |
| Scraping | Distributed Crawler | Axios + Cheerio |
| Scheduler | Queue Cluster | Cron |
| Search | Elasticsearch | PostgreSQL |
| Admin | Full CMS | CRUD |
| Infrastructure | Microservices | Modular Monolith |
| Company Feedback | Complex AI scoring | Recommendation Signal |

---

# 15. Development Priority

ใช้ Priority ดังนี้

```text
P0 = Feature ต้องทำงานจริง
P1 = UX/UI และความสมบูรณ์
P2 = Optimization
```

ภายใน 7 วัน

```text
P0 → ต้องครบ 100%

P1 → ทำตามเวลาที่เหลือ

P2 → ทำหลัง MVP
```

P2 ตัวอย่าง

```text
AI Semantic Job Matching
LLM Repository Analysis
Vector Database
Machine Learning Recommender
Distributed Scraping
Advanced Analytics
Redis Caching
Event-Driven Architecture
Microservices
```

---

# 16. Final Project Structure

ภาพรวมระบบ

```text
                         GitHub
                            │
                            ▼
                    Skill Intelligence
                            │
                  ┌─────────┴─────────┐
                  │                   │
                  ▼                   ▼
             Assessment             Jobs
                  │                   │
                  ▼                   ▼
           Verified Skills       Match Score
                  │                   │
                  └─────────┬─────────┘
                            ▼
                        Candidate
                            │
                            ▼
                     Job Application
                            │
                            ▼
                         Company
                            │
                            ▼
                    Company Feedback
                            │
                            ▼
                        Skill Gap
                            │
                            ▼
                  Course Recommendation
```

แกนสำคัญของ SmartCareer คือ

> **Candidate Skill → Job Matching → Recruitment → Feedback → Skill Development**

หาก Full Flow นี้ทำงานได้ครบ ระบบจะเป็น MVP ที่มีความเชื่อมโยงของ Feature อย่างชัดเจน และพร้อมสำหรับใช้ Demo หรือพัฒนาต่อใน Production Phase
