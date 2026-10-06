# Jamozy v0.2.0

> Pre-release — ยังไม่พร้อมสำหรับ production

## ไฮไลต์

- หน้า Home ใหม่: เล่นคอร์ส Home เพียงคอร์สเดียวที่จัดการผ่าน Admin BO และ export เป็น static JSON ตอน build ทำให้เปิด Home แล้วเริ่มพิมพ์ได้ทันทีโดยไม่ต้องรอ Firestore (DEC-043)
- เล่นต่อเนื่องไม่สะดุด: แต่ละ Lesson สุ่มลำดับใหม่ทุก session ไปบทถัดไปอัตโนมัติ และวนกลับบทแรกเมื่อจบคอร์ส
- Progress ระดับ exercise (เช่น `3/5`) sync ข้ามอุปกรณ์ จบ Lesson ครั้งแรกได้ EXP ตาม accuracy ส่วนการเล่นซ้ำครบชุดได้ 15 EXP
- การบันทึกทั้งหมดทำงานเบื้องหลังผ่าน outbox ใน IndexedDB และลองใหม่อัตโนมัติเมื่อออฟไลน์หรือบันทึกไม่สำเร็จ
- หน้าแรกโหลดเร็วขึ้น: ข้อมูลจาก Firestore ทยอยแสดงทีหลัง ไม่มีจอขาวตอน refresh และ query เนื้อหาพร้อมกัน
- Admin BO: เพิ่ม Course type (`learning` / `home`), ตรวจและแปลงตัวอักษรที่แป้นพิมพ์ไม่ได้ (เช่น ᄀ → ㄱ), ตัดช่องว่างหน้าหลังข้อความ และลากเรียงลำดับเนื้อหาได้ทุกระดับ
- Virtual keyboard แสดงจุดนำนิ้วที่ปุ่ม F และ J
- ถ้ายังไม่มีคอร์ส Home ที่เผยแพร่ หน้า Home จะใช้ player แบบเดิม (DEC-042)

## หมายเหตุสำหรับการ deploy

- `pnpm build` จะรัน `pnpm content:export-home` ก่อนทุกครั้ง จึงต้องมี `VITE_FIREBASE_*` ในสภาพแวดล้อมที่ build
- `public/content/home.json` เป็นไฟล์ที่ generate และไม่ถูก commit
- ฐานข้อมูล IndexedDB ในเครื่องผู้ใช้จะอัปเกรดเป็น version 6 อัตโนมัติ

## สิ่งที่ยังเหลือ

- ตรวจรับ Home player และ SVG renderer บน Preview/mobile
- ตั้งค่า Cloudflare Pages deployment pipeline
- ฟีเจอร์หลัง MVP เช่น Practice, Daily Quest, History และ dark mode
