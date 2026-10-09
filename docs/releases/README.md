# Release workflow

คู่มือนี้กำหนดรูปแบบการจัดทำ release notes และ handoff สำหรับ Git tag
กับ GitHub pre-release ของ Jamozy

## Release notes

- สร้างไฟล์ที่ `docs/releases/release-notes-vX.Y.Z.md`
- ใช้ภาษาไทยตามรูปแบบของ release ก่อนหน้า และระบุ `Pre-release` เมื่อยังไม่พร้อมสำหรับ production
- สรุปผลกระทบต่อผู้ใช้เป็นหลัก ไม่ลอก commit messages หรือรายละเอียด implementation ที่ไม่จำเป็น
- ระบุเฉพาะขั้นตอน deploy, การตั้งค่า environment, หรือข้อจำกัดที่มีหลักฐานว่าจำเป็นสำหรับ release นั้น
- อย่าอ้างว่า test, build หรือ deploy สำเร็จ หากยังไม่มีผลตรวจสอบในรอบงานปัจจุบัน

## Handoff สำหรับ tag และ GitHub Release

AI ต้องไม่สร้าง commit, tag, push หรือ GitHub Release เอง เว้นแต่ผู้ใช้จะสั่งอย่างชัดเจน
เมื่อ release notes พร้อมแล้ว ให้ส่ง handoff commands สำหรับผู้ใช้ โดยใช้ version, title
และไฟล์ notes ของ release นั้น ตัวอย่างสำหรับ v0.1.0:

```bash
git tag -a v0.1.0 -m "v0.1.0 — MVP core (pre-release)"
git push origin v0.1.0
gh release create v0.1.0 --prerelease --title "v0.1.0 — MVP core (pre-release)" --notes-file docs/releases/release-notes-v0.1.0.md
```

ก่อนส่ง handoff ให้ยืนยันว่า release notes อยู่ใน commit ที่ผู้ใช้จะ push และแทนค่า
version, title และ path ให้ตรงกับ release เป้าหมาย
