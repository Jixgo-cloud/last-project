# ข้อมูลประสานการเข้าถึงแหล่งงาน SmartCareer

จัดเตรียม 6 ตุลาคม 2026 หลังเจ้าของโครงการแจ้งว่าได้รับอนุมัติให้ใช้ scraping ในโครงการศึกษาแล้ว เอกสารนี้ใช้ขอวิธีเชื่อมต่อที่ต้นทางรองรับจากเซิร์ฟเวอร์จริง ไม่ใช่ข้อตกลงที่ได้ตอบรับหรือข้อความที่ส่งแล้ว

## ข้อมูลทางเทคนิคที่พร้อมส่ง

| รายการ | ข้อมูล |
|---|---|
| โครงการ | SmartCareer — โครงการเพื่อการศึกษา |
| เว็บ | https://smartcareerplatform.vercel.app/ |
| บริการที่อ่านข้อมูล | https://smartcareerapi-production.up.railway.app/ |
| ที่ตั้งบริการตาม Railway | US West |
| หน้า JobsDB ที่อ่าน | https://th.jobsdb.com/jobs?keywords=developer |
| หน้า Blognone Jobs ที่อ่าน | https://jobs.blognone.com/search |
| วิธีที่ทดสอบ | อ่าน HTML และเปิด Chromium แบบไม่มีบัญชีเข้าสู่ระบบ |
| ข้อมูลที่ต้องการ | ชื่องาน บริษัท สถานที่ ประเภทงาน ช่วงเงินเดือนที่ประกาศ และลิงก์กลับต้นทาง |
| รอบอัตโนมัติปัจจุบัน | วันละครั้งเวลา 00:00 น. ประเทศไทย และรอบที่ผู้ดูแลเริ่มเอง |
| จำนวนสูงสุดต่อรอบตามการตั้งค่าปัจจุบัน | JobsDB 30 งาน, Blognone 15 งาน |

ไม่แนบ DATABASE_URL, API keys, cookies, bearer tokens, รหัสผ่าน หรือไฟล์ฐานข้อมูล หากต้นทางต้องการ IP ให้ออกแบบตามรูปแบบที่เขารองรับก่อน ไม่ใช้ชื่อโดเมนหรือ IP ที่เดาว่าเป็น IP ขาออกของ Railway

## ผลปัญหาที่ส่งให้ต้นทางได้

วันที่ 6 ตุลาคม 2026 API ฉบับ `0747a5a` รันบน Railway จริง:

- Blognone: 17:11:17 น. โควตา 5 งาน ตอบ HTTP 403; เพิ่ม 0 งาน
- JobsDB: 17:11:59 น. โควตา 10 งาน ตอบ HTTP 403; เพิ่ม 0 งาน
- เบราว์เซอร์ในเครื่องเปิดหน้าประกาศทั้งสองแหล่งได้ จึงยังระบุไม่ได้ว่า 403 เกิดจากเครือข่าย ระบบป้องกันการเข้าถึงอัตโนมัติ หรือกฎอื่นของต้นทาง

หลักฐานและรายละเอียดฉบับโค้ดอยู่ใน [ผลตรวจจริง](AUTHORIZED_SCRAPING_RETEST_20261006.md)

## ช่องทางและข้อความ JobsDB / SEEK

เริ่มจากผู้ติดต่อเดิมที่อนุมัติโครงการ หากไม่มี ใช้ [ช่องทางขอเชื่อมต่อที่ SEEK ระบุ](https://developer.seek.com/introduction) ซึ่งนำไปยัง [แบบฟอร์ม Integration Request](https://au.employer.seek.com/partners/integration-request/) แบบฟอร์มนี้เป็นการขอเชื่อมต่อผลิตภัณฑ์ SEEK และมีข้อยอมรับ Terms of Use; ยังไม่ยืนยันว่ารองรับการอ่านประกาศสาธารณะสำหรับโครงการนี้ ต้องสอบถามขอบเขตก่อนเลือกบริการ

**Subject:** SmartCareer educational project — JobsDB Thailand server access / approved job feed

> Hello JobsDB / SEEK team,
>
> We are developing SmartCareer, an educational project at [institution/course]. Our public website is https://smartcareerplatform.vercel.app/.
>
> We would like to display public technology job listings with source attribution and a link back to JobsDB for applications. Access to the developer search page works in our local browser, but the same ordinary browser request from our Railway API service in US West receives HTTP 403. The latest test was on 6 October 2026 at 17:11 ICT.
>
> Could you confirm the supported access method for this educational use: an approved job feed, a read API, or permitted access from our server? Our current cap is 30 listings per run, with one scheduled run daily plus administrator-initiated tests. Please advise the permitted request rate, required attribution, handling of closed listings, and any access setup or cost. We are seeking read access, not job posting or application export.
>
> Contact: [name], [institution/course], [email].

หากใช้แบบฟอร์ม ต้องกรอกข้อมูลชื่อ นามสกุล ตำแหน่ง โทรศัพท์ อีเมล สถาบัน/องค์กร และรายละเอียดที่ถามตามจริง ไม่สมมติจำนวนลูกค้า SEEK หรือจำนวนประกาศต่อปี ไม่เลือกผลิตภัณฑ์ลงประกาศเพียงเพื่อส่งฟอร์มให้ครบ

## ช่องทางและข้อความ Blognone

[หน้าติดต่อทางการ](https://www.blognone.com/contact) ระบุอีเมลทีมงาน `admin@blognone.com` หากมีผู้ติดต่อเดิมของ Blognone Jobs ให้ใช้คนนั้นก่อน

**หัวข้อ:** SmartCareer โครงการศึกษา — ขอช่องทางอ่านประกาศ Blognone Jobs จาก Railway

> เรียนทีม Blognone
>
> ผม/ดิฉัน [ชื่อ] จาก [สถาบัน/รายวิชา] กำลังพัฒนา SmartCareer เป็นโครงการเพื่อการศึกษา เว็บไซต์ https://smartcareerplatform.vercel.app/
>
> โครงการต้องการแสดงประกาศงานด้านเทคโนโลยี พร้อมระบุแหล่งที่มาและลิงก์กลับไปสมัครที่ Blognone Jobs ปัจจุบันหน้า https://jobs.blognone.com/search เปิดผ่านเบราว์เซอร์ในเครื่องได้ แต่เบราว์เซอร์ของบริการ API บน Railway เขต US West ได้ HTTP 403 เมื่อทดสอบวันที่ 6 ตุลาคม 2026 เวลา 17:11 น.
>
> ขอสอบถามวิธีเปิดการเข้าถึงจากเซิร์ฟเวอร์ หรือ API/feed ที่ทีมงานรองรับสำหรับโครงการศึกษา ขณะนี้ตั้งขอบเขตสูงสุด 15 ประกาศต่อรอบ มีรอบอัตโนมัติวันละครั้งและรอบที่ผู้ดูแลเริ่มทดสอบ ขอคำแนะนำเรื่องอัตราเรียก การแสดงเครดิต การติดตามประกาศปิดรับ และค่าใช้จ่ายหากมีด้วยครับ/ค่ะ
>
> ผู้ติดต่อ [ชื่อ] — [อีเมล]

## สิ่งที่รอจากเจ้าของโครงการ

ชื่อผู้ติดต่อ สถาบัน/รายวิชา อีเมลที่จะใช้ และช่องทางผู้อนุมัติเดิมถ้ามี ไม่มีการส่งข้อความหรือยอมรับข้อตกลงในรอบเตรียมเอกสารนี้

## สิ่งที่ทำได้ระหว่างรอ

ตรวจรายการสาธารณะผ่าน API ฉบับ `0747a5a` วันที่ 6 ตุลาคม 2026 เวลา 17:18 น. ได้ HTTP 200 ทั้งสามแหล่ง:

| แหล่ง | งานเปิดรับที่แสดง | ชื่อ บริษัท และลิงก์ครบ | รหัสและลิงก์ไม่ซ้ำภายในแหล่ง |
|---|---:|---:|---:|
| JSearch | 24 | 24 | 24 |
| JobThai | 25 | 25 | 25 |
| Remotive | 17 | 17 | 17 |

รวม 66 งาน ใช้ทดลองค้นหา กรองแหล่ง อ่านรายละเอียดและเปิดต้นทางได้ การตรวจนี้เป็นการอ่านข้อมูลที่บริการแสดงอยู่ ไม่ใช่การนำเข้าใหม่หรือการรับรองว่าทุกประกาศที่ต้นทางยังเปิดรับ และไม่ได้ตรวจรายการซ้ำข้ามแหล่ง

ทดลองการสมัคร สอบ และคัดเลือกภายใน SmartCareer ด้วยงาน QA ของบริษัทในระบบตาม [ใบงานผู้ทดลอง](PILOT_PARTICIPANT_GUIDE.md) งานจากภายนอกพาไปสมัครที่ต้นทาง จึงไม่ใช้แทนรอบ QA ภายใน
