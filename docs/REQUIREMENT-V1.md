**Korean Typing Learning**

> อัปเดต 2026-09-23: ผ่านการเทียบกับ `docs/DOMAIN-MODEL.md`/`docs/DECISIONS.md` แล้ว จุดที่ปรับตามด้านล่างมีหมายเลข `[[DEC-xxx]]` กำกับ — ดูเหตุผลเต็มที่ `docs/DECISIONS.md`

1. **Learning Flow**

   - เรียนจากง่าย → ยาก
   - แบ่งเป็น `Course → Unit → Lesson`
   - แต่ละ Lesson มีคำศัพท์/วลีประมาณ 10–30 รายการ
   - ตัวอย่าง progression:

     - Unit 1: ตัวอักษรพื้นฐาน
     - Unit 2: พยางค์ง่าย ๆ
     - Unit 3: คำศัพท์สั้น
     - Unit 4: คำศัพท์ทั่วไป
     - Unit 5: วลี
     - Unit 6+: ประโยค

   - ทำ Lesson สำเร็จแล้วปลดล็อกบทถัดไป

2. **Typing Lesson**

   - แสดงคำภาษาเกาหลี เช่น `안녕하세요`
   - ให้ผู้ใช้พิมพ์ตาม
   - Highlight:

     - ตัวที่กำลังพิมพ์
     - ตัวที่ถูก
     - ตัวที่ผิด

   - พิมผิดจะไม่ไปตัวต่อไป
   - แสดง progress เช่น `7 / 20`
   - Keyboard guide ภาษาเกาหลีเปิด/ปิดได้
   - เลือกได้ว่าจะโชว์ English key เช่น `ㅎ → g`

3. **Vocabulary**

   - แต่ละคำเก็บ:

     - Korean
     - Romanization
     - Thai/English meaning
     - Difficulty
     - Lesson

   - เช่น:

     ```text
     안녕
     annyeong
     สวัสดี
     ```

   - MVP อาจแสดงแค่ Korean ตอนฝึก แล้วเฉลยความหมายหลังพิมพ์

4. **Lesson Result**

   - หลังจบบทแสดง:

     - Accuracy
     - Typing speed
     - Mistakes
     - เวลา
     - คำที่ผิดบ่อย

   - ปุ่ม:

     - Next Lesson
     - Retry
     - Review mistakes

5. **Review System**

   - เก็บคำที่:

     - พิมพ์ผิด
     - ใช้เวลานาน
     - accuracy ต่ำ

   - หน้า `Review`
   - สามารถกดฝึกเฉพาะคำเหล่านั้นได้
   - **[[DEC-008]] ทำ Spaced Repetition เต็มรูปแบบตั้งแต่ MVP** — Leitner box (1–5), interval 1/3/7/14/30 วัน ตอบถูกเลื่อน box ขึ้น ตอบผิดรีเซ็ตกลับ box 1

6. **Practice Mode**

   - ฝึกแบบไม่กระทบ progression
   - เลือก:

     - Unit
     - Lesson
     - Difficulty
     - คำที่เคยผิด

   - Random vocabulary ได้

7. **Progression**

   - แต่ละ Lesson มีสถานะ **[[DEC-009]] (3 สถานะ ไม่มี Mastered)**:

     ```text
     locked
     unlocked
     completed
     ```

   - แสดง progress ของแต่ละ Unit
   - เช่น:

     ```text
     Unit 3
     ███████░░░ 7/10 Lessons
     ```

8. **Level System**

   - ทำแบบ plain ตามที่คุณคิดไว้ได้เลย
   - ได้ EXP จากการจบบทเรียน
   - เช่น:

     ```text
     Complete Lesson  +100 EXP
     Accuracy > 90%   +20 EXP
     Perfect Lesson   +50 EXP
     ```

   - Level ไม่ต้องปลด stat หรือ skill
   - ใช้เพื่อแสดง progression เท่านั้น
   - **[[DEC-006]] สูตร: `level = 1 + floor(exp / 100)` (flat 100 EXP ต่อ level, ไม่ใช่ curve เพิ่มขึ้นเรื่อยๆ), `level` ไม่ถูก store เก็บแต่ `exp` แล้ว derive ตอน read**
   - เช่น (exp = 650):

     ```text
     Level 7
     50 / 100 EXP
     ```

9. **Stats**

   - จำนวน Lesson ที่เรียน
   - จำนวนคำที่ฝึก
   - Accuracy เฉลี่ย
   - Best accuracy
   - Typing speed
   - Total typing time
   - Current Level

10. **Keyboard**

    - Korean keyboard visualization
    - Highlight key ที่ต้องกด
    - Highlight Shift เมื่อจำเป็น
    - Settings:

      - Show keyboard
      - Show English keys
      - Keyboard opacity

    - ส่วนนี้น่าจะเป็น feature เด่นของเว็บ

11. **Home / Dashboard**

    - Continue Learning
    - Current Unit
    - Level + EXP
    - วันนี้เรียนไปกี่คำ
    - Recent lessons
    - Review ที่รออยู่
    - เช่น:

      ```text
      Level 4
      ██████░░ 420 / 600 EXP

      Continue
      Unit 3 — Basic Words
      Lesson 4 / 10

      Review
      12 words
      ```

12. **Course Map**

    - หน้าแสดง Unit ทั้งหมด
    - ลักษณะคล้าย Type Hangeul ที่คุณส่งมา
    - เช่น:

      ```text
      Unit 1
      Hangul Basics
      5 Lessons
           ↓
      Unit 2
      Simple Syllables
      8 Lessons
           ↓
      Unit 3
      Basic Words
      10 Lessons
      ```

    - ยังไม่ต้องทำ world map หรือ gamification หนัก ๆ

13. **Settings**

    - Sound On/Off
    - Show Keyboard
    - Show English Key
    - Romanization On/Off
    - Meaning:

      - Thai
      - English
      - Both

    - Reset Progress
    - Theme Light/Dark

14. **Save System**

    - เก็บ:

      - Lesson progress
      - EXP
      - Stats
      - Mistakes
      - Settings

    - **[[DEC-006]] Level ไม่ได้ save แยก** — derive จาก EXP ตอน read เสมอ (กัน level กับ exp ไม่ตรงกัน)

    - ยังไม่จำเป็นต้อง Login, Anonymous Auth

15. **Content Management**

    - ทำให้เพิ่ม Lesson ใหม่โดยไม่แก้ business logic

16. **Sound — Optional สำหรับหลัง MVP**

    - เสียงพิมพ์
    - เสียง correct / wrong
    - pronunciation ของคำเกาหลี
    - หลังจากนั้นค่อยพิจารณา Web Speech / audio file จริง

17. **Achievements — Optional**

    - First Lesson
    - 10 Lessons
    - 100 Words
    - Perfect Lesson
    - Accuracy 95%+
    - 7 Day Streak

18. **Streak — Optional**

    - Daily learning streak
    - แต่ผมจะยังไม่ใส่ตอนแรก เพราะมันเริ่มเพิ่มเรื่อง date/time และ persistence
