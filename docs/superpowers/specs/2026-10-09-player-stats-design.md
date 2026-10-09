# Player Stats (Spec A) — Design

**Date:** 2026-10-09
**Status:** Proposed (จะบันทึกเป็น DEC-049 เมื่อ implement)
**Related:** [[DEC-029]] (session history แยกจาก aggregate), [[DEC-030]] (Guest migration merge), [[DEC-043]] (Home), [[DEC-048]] (Level derived), `docs/LEVELING.md` → Jamozy Player Stats

## Problem

`docs/LEVELING.md` กำหนด Player Stats (Lifetime, Daily, Records) แต่ระบบตอนนี้เก็บแค่
`sessionAggregate` (EXP, keystrokes, duration, best accuracy), `lessonProgress` และ
`learningSessions` แบบไม่มีรายละเอียดราย exercise จึงขาด: characters/words/sentences,
perfect lesson/streak, typing time จริง, active days, streak, records และยอดรายวัน/เดือน
ข้อมูลเหล่านี้คำนวณย้อนหลังไม่ได้ ต้องเริ่มเก็บตั้งแต่ตอนนี้

## Scope

- ใน spec นี้: เก็บข้อมูลอย่างเดียว (domain, application, adapter Firebase + IndexedDB, Rules)
- นอก scope:
  - UI หน้า Profile (งานแยกภายหลัง)
  - Item stats ราย jamo/word และ Personalized Review (Spec B)
  - Rebirth, Rank, Perk, Highest Level/Rank ที่รองรับ Rebirth, Streak Guard
  - Backfill ข้อมูลเก่า: ไม่ทำ ทุกค่าใหม่เริ่มนับ 0 ตั้งแต่วัน deploy (ยังไม่มีผู้เล่นจริง)
    `learningSessions` ยังอยู่ จึง backfill ภายหลังได้ถ้าต้องการ

## Decisions

| หัวข้อ                         | การตัดสินใจ                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Words / Sentences / Characters | นับตาม`Lesson.type`: `word` → words, `phrase`/`sentence` → sentences; characters = พยางค์ฮันกึลที่พิมพ์จบ ไม่นับช่องว่าง               |
| Perfect Lesson                 | session โหมด`learning-path` หรือ `home` ที่ `rejectedKeystrokes === 0` นับรวม replay; review ไม่นับ                                    |
| Perfect Streak                 | จำนวน exercise ที่ไม่ผิดติดกัน ต่อข้าม session, reset เมื่อ exercise ใดผิด                                                             |
| Typing vs Learning Time        | Learning = ระยะเวลา session; Typing = keystroke แรกถึงสุดท้ายต่อ exercise ตัดช่วงห่าง > 10 วินาที                                      |
| Active Day / Streak            | วัน`localDate` ที่มี session ส่งสำเร็จ ≥ 1 (ทุกโหมด); session ย้อนวันบวก daily แต่ไม่แก้ streak                                        |
| ยอดรายช่วง                     | `dailyStats/{YYYY-MM-DD}` + `monthlyStats/{YYYY-MM}`; records เก็บใน profile                                                           |
| Timezone                       | `profile.timezone` (IANA) ใน profile ของแต่ละ adapter (Guest: IndexedDB, Account: Firestore); `session.localDate` ถูกตรึงตอนจบ session |
| อัปเดตเมื่อไร                  | ใน transaction เดียวกับ submit session (dedupe ด้วย receipt`sessionOutcomes` เดิม)                                                     |
| ตำแหน่ง logic                  | pure domain function ตัวเดียว ทั้งสอง adapter เรียกใช้                                                                                 |

## Data model

### `LearningSession` (field ใหม่ทั้งหมดเป็น optional; session เก่าไม่มี)

| Field                | ความหมาย                                                      |
| -------------------- | ------------------------------------------------------------- |
| `localDate`          | `'YYYY-MM-DD'` ตาม timezone ตอนจบ session                     |
| `typingSeconds`      | ผลรวม typing time ราย exercise                                |
| `charactersTyped`    | พยางค์ฮันกึลของ`targetText` ที่พิมพ์จบ (ไม่นับช่องว่าง)       |
| `wordsPracticed`     | จำนวน exercise ที่จบ ใน lesson ชนิด`word`                     |
| `sentencesPracticed` | จำนวน exercise ที่จบ ใน lesson ชนิด`phrase`/`sentence`        |
| `exerciseMistakes`   | `number[]` จำนวนผิดต่อ exercise ตามลำดับที่เล่น (≤ 30)        |
| `isReplay`           | lesson เคย`completed` ก่อน session นี้ (โหมด lesson เท่านั้น) |

Derived (ไม่เก็บ): perfect lesson = โหมด lesson และ `rejectedKeystrokes === 0`;
review = `context.mode === 'review'`

### `ExerciseResult` (domain `lesson-session`)

เพิ่ม `typingSeconds?: number` (optional ใน zod schema เพราะ `homeSyncJobs` ที่ค้างอยู่ไม่มี)
จำนวนผิดใช้ `mistakes.length` ที่มีอยู่

### `ReviewItem`

เพิ่ม `sourceLessonType?: LessonType` ตั้งตอนสร้าง item ใหม่ item เก่าที่ไม่มี field นับแค่ characters

### `HomeSessionTotals` / `HomePartialResult`

เพิ่มยอดสะสม `typingSeconds`, `learningSeconds`, `charactersTyped`, `wordsPracticed`,
`sentencesPracticed`, `exerciseMistakes` (optional; ค่าที่ไม่มีถือเป็น 0 / `[]`)
Learning Time ของ Home = `learningSeconds` (ผลรวมเวลาราย exercise) แทน `durationSeconds`
ที่อาจยาวข้ามวัน

### `profile.sessionAggregate` (บวกสะสมด้วย `addSessionAggregate`)

เพิ่ม (optional ใน doc เก่า อ่านเป็น 0):

- sum: `lessonsCompleted`, `lessonsReplayed`, `reviewsCompleted`, `perfectLessons`,
  `charactersTyped`, `wordsPracticed`, `sentencesPracticed`, `typingSeconds`
  (`lessonsCompleted` = ทุก session โหมด lesson รวม replay; `lessonsReplayed` = ส่วนที่
  `isReplay`; `reviewsCompleted` = session โหมด review; daily/monthly ใช้นิยามเดียวกัน)
- max: `longestSessionSeconds`, `bestWpm` (WPM = accepted ÷ 5 ÷ (`typingSeconds` / 60))

`totalTypingTimeSeconds` เดิมคงชื่อและความหมายเดิม (ระยะเวลา session) = **Learning Time**
ไม่ rename เพื่อไม่ต้อง migrate; อธิบายใน `DOMAIN-MODEL.md`

### Profile (state ที่ไม่ใช่ผลบวก)

```ts
timezone?: string                 // IANA เช่น 'Asia/Bangkok'
activeDays?: number
streak?: { current: number; longest: number; lastActiveDate: string }
perfectStreak?: { current: number; longest: number }
records?: {
  mostExpDay?: { value: number; date: string }
  mostExpMonth?: { value: number; month: string }
  mostLessonsDay?: { value: number; date: string }
}
```

### `users/{id}/dailyStats/{YYYY-MM-DD}` และ `users/{id}/monthlyStats/{YYYY-MM}`

field เดียวกัน (`PeriodStats`): `expEarned`, `lessonsCompleted`, `lessonsReplayed`,
`reviewsCompleted`, `perfectLessons`, `correctKeystrokes`, `incorrectKeystrokes`,
`charactersTyped`, `wordsPracticed`, `sentencesPracticed`, `typingSeconds`, `learningSeconds`

doc มีอยู่ = วัน active (ไม่มี `isActiveDay`) Guest: object store `dailyStats`,
`monthlyStats` ใน IndexedDB (bump DB version) key `${userId}:${date}`

### Derived ตอนอ่าน (ไม่เก็บ)

Level/EXP (DEC-048), Highest Level/Rank (= ปัจจุบัน จนกว่ามี Rebirth), Unique Lessons
Completed (นับ `lessonProgress` ที่ `completed`), Average Accuracy, Average WPM
(keystrokes ก่อน deploy ไม่มี `typingSeconds` ค่าจึงเพี้ยนเล็กน้อย ยอมรับได้),
Current Streak แสดง 0 เมื่อ `lastActiveDate` เก่ากว่าเมื่อวาน

## Data flow

1. **ระหว่างเล่น** — `lesson-session.pressKey` รับ `nowMs` (optional) และเก็บเวลาต่อ
   exercise: บวกช่วงห่างระหว่าง keystroke ที่ ≤ 10 วินาที ผลลง `ExerciseResult.typingSeconds`
   Home บวกค่าราย exercise ลง `HomePartialResult` / `HomeSessionTotals`
2. **สร้าง session** — pure `sessionStatsFrom({ results, lessonType | perItemLessonType, timezone, now })` คืน `localDate`, `typingSeconds`, `charactersTyped`, `wordsPracticed`,
   `sentencesPracticed`, `exerciseMistakes` ใช้ใน `complete-lesson-session`,
   `submit-review-session`, `home-session-submission`, `submit-home-replay`
   `isReplay` มาจาก `Progress` เดิมที่ use case อ่านอยู่แล้ว
   timezone: `profile.timezone` ถ้าไม่มีใช้ timezone ของ browser แล้วเขียนกลับ profile
3. **Submit (Firebase transaction / IndexedDB `putSessionOnce`)**

   ```
   read receipt → มีแล้ว: คืนผลเดิม
   read profile; read dailyStats/{localDate}; read monthlyStats/{YYYY-MM}
   next = applySessionStats({ profile, daily, monthly }, session)
   write session, receipt, progress, reviewItems (เดิม)
   write profile (sessionAggregate + timezone/activeDays/streak/perfectStreak/records)
   write daily, monthly
   ```

4. **`applySessionStats`** (pure domain)

   - daily/monthly: บวกทุก field
   - `activeDays` +1 เมื่อ daily ยังไม่มี
   - streak: เท่ากับ `lastActiveDate` → คงเดิม; วันถัดไป → +1; ห่าง > 1 วัน → 1;
     เก่ากว่า → ไม่แก้; `longest = max`
   - perfectStreak: ไล่ `exerciseMistakes` (0 → +1, > 0 → 0); `longest = max`
   - records: เทียบยอด daily/monthly ใหม่กับ record เดิม
   - session ไม่มี field ใหม่: ค่าใหม่เป็น 0, `localDate` คำนวณจาก `completedAt` ด้วย
     `profile.timezone` หรือ `Asia/Bangkok`

5. **Guest migration** — `migrateSessionOutcome` อ่าน daily/monthly เพิ่มและเรียก
   `applySessionStats` ใน transaction เดิม เรียง outcome ตาม `completedAt` ก่อนนำเข้า
   `mergeProfile`: ใช้ `timezone` ของ cloud ถ้าไม่มีใช้ของ Guest
6. **Error handling** — ทุกการเขียนอยู่ใน transaction เดียว ล้มทั้งชุด retry ปลอดภัยด้วย receipt
7. **Rules** — `dailyStats/{date}` และ `monthlyStats/{month}` อ่าน/เขียนได้เฉพาะเจ้าของ
   (เหมือน `learningSessions`) ต้องยืนยันกับเจ้าของ repo ก่อนแก้ ไม่ต้องเพิ่ม index
8. **อ่าน (ไว้ใช้กับ UI ภายหลัง)** — Today/Month: get 1 doc; Week: get 7 docs;
   Year: query `monthlyStats` ช่วง ID `YYYY-01`..`YYYY-12`

## Testing

รันเฉพาะ test ที่เพิ่มหรือแก้ ไม่รัน `pnpm test` ทั้งชุดและไม่ build (เจ้าของ repo ทำต่อเอง)

- **Domain:** `sessionStatsFrom` (นับพยางค์ไม่นับช่องว่าง, lesson type, `localDate` ข้ามเที่ยงคืนตาม
  timezone, review item ไม่มี type); typing time (ตัดช่วง > 10 วินาที, keystroke เดียว = 0);
  `applySessionStats` (streak ทุกกรณีรวมย้อนวัน, perfect streak ข้าม session, records,
  `activeDays`, session เก่า); `addSessionAggregate` (sum/max); `mergeProfile` timezone
- **Application:** 4 use case กับ fake repo — field ใหม่ครบ, `isReplay`, Home สะสมข้าม exercise
- **Adapter:** Firestore Emulator ไฟล์ใหม่ project ID แยก (submit, submit ซ้ำ,
  `migrateSessionOutcome`); rules test เจ้าของ/ไม่ใช่เจ้าของ; `local-session-submission-repository`
  test สำหรับ IndexedDB

## Docs

`DOMAIN-MODEL.md` (field ใหม่, ความหมาย `totalTypingTimeSeconds`), `SESSION-AND-HISTORY.md`
(session stats, daily/monthly), `AUTH-AND-PERSISTENCE.md` (timezone, migration stats),
`DECISIONS.md` DEC-049, log `docs/log/2026-10.md`

## Handoff (เจ้าของ repo)

- รัน `pnpm test` ทั้งชุด และ `pnpm build`
- deploy Firestore Rules (`dailyStats`, `monthlyStats`) ก่อน deploy code
- ตรวจด้วยมือ: เล่น lesson, review, Home แล้วดู `users/{id}/dailyStats` / `monthlyStats` / profile
