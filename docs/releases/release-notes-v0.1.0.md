# Jamozy v0.1.0

> Pre-release — ยังไม่พร้อมสำหรับ production

## ไฮไลต์

- Learning Path, Lesson, Review, EXP/Level และโปรไฟล์ผู้เรียนครบเส้นทางหลัก
- รองรับ Guest แบบ IndexedDB และบัญชี Firebase (Email/Password, Google Sign-In) พร้อมย้ายข้อมูล Guest เข้าบัญชี
- มี Settings และ Admin Back Office สำหรับจัดการ Course, Unit และ Lesson
- เพิ่มการพิมพ์ผ่าน virtual keyboard และป้องกันปุ่มที่ไม่ใช่ jamo ไม่ให้กระทบ accuracy
- มี Jamo SVG renderer แบบทดลอง เปิดใช้ด้วย `VITE_JAMO_SVG_RENDERER=1`

## สิ่งที่ยังเหลือ

- ตรวจรับ Home one-page player และ SVG renderer บน Preview/mobile
- ตั้งค่า Cloudflare Pages deployment pipeline
- ฟีเจอร์หลัง MVP เช่น Practice, Daily Quest, History และ dark mode
