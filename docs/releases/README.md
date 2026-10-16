# Release workflow

คู่มือนี้กำหนดรูปแบบการจัดทำ release notes และ handoff สำหรับ Git tag
กับ GitHub pre-release ของ Jamozy

## Release notes

- สร้างไฟล์ที่ `docs/releases/release-notes-vX.Y.Z.md`
- ใช้ภาษาอังกฤษตามรูปแบบของ release ก่อนหน้า
- สรุปผลกระทบต่อผู้ใช้เป็นหลัก ไม่ลอก commit messages หรือรายละเอียด implementation ที่ไม่จำเป็น
- ระบุเฉพาะขั้นตอน deploy, การตั้งค่า environment, หรือข้อจำกัดที่มีหลักฐานว่าจำเป็นสำหรับ release นั้น
- เจ้าของจะแนบ Message สำหรับ Change มาให้ วิเคราะห์จากตัวนั้น

## Handoff สำหรับ tag และ GitHub Release

AI ต้องไม่สร้าง commit, tag, push หรือ GitHub Release เอง เว้นแต่ผู้ใช้จะสั่งอย่างชัดเจน
เมื่อ release notes พร้อมแล้ว ให้ส่ง handoff commands สำหรับผู้ใช้ โดยใช้ version, title
และไฟล์ notes ของ release นั้น ตัวอย่างสำหรับ v0.1.0:

```bash
git tag -a v0.5.0 -m "v0.5.0 — MVP core"
git push origin v0.5.0
gh release create v0.5.0 --prerelease --title "v0.5.0 — MVP core" --notes-file docs/releases/release-notes-v0.5.0.md
```

ก่อนส่ง handoff ให้ยืนยันว่า release notes อยู่ใน commit ที่ผู้ใช้จะ push และแทนค่า
version, title และ path ให้ตรงกับ release เป้าหมาย
