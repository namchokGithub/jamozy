# Weak Jamo Practice (Spec B3) — Design

**Date:** 2026-10-09
**Status:** Accepted as [[DEC-051]] (2026-10-09)
**Related:** [[DEC-043]] (Home static export), [[DEC-045]] (practice EXP, ยังไม่ใช้), [[DEC-049]] (Player Stats), [[DEC-050]] (jamo stats), `docs/LEVELING.md` → Personalized Review, `docs/LEARNING-MODES.md` (Weak Jamo เป็นโหมดในอนาคต)

## Problem

`docs/LEVELING.md` ต้องการ Personalized Review: ดูว่า jamo ไหนผิดบ่อย (เช่น ㅓ 18%,
ㅗ 12%, ㄹ 9%) แล้วสร้างชุดฝึกที่เน้น jamo เหล่านั้น ตอนนี้มี `learnerStats/jamo`
(DEC-050) แล้ว แต่ยังไม่มีโหมดที่นำไปใช้ ส่วน `/review` เดิมเล่นได้แค่ `ReviewItem`
ที่ถึงกำหนดตามระบบ Leitner

## Scope

ชุด Player Stats: Spec A (DEC-049) → Spec B (DEC-050) → **Spec B3 (นี้, spec สุดท้าย)**

- ใน spec นี้:
  - โหมด `weak-jamo` เข้าจากหน้า `/review` และเล่นที่ `/review/weak-jamo`
  - เลือก exercise จาก Home static export
  - บันทึก session พร้อม Player Stats และ jamo stats
  - counter ใหม่ `practicesCompleted`
- นอก scope:
  - EXP ของ practice mode (DEC-045): ทำพร้อม Review ทีหลัง
  - แตะ `ReviewItem` หรือคิว Leitner
  - ให้ผู้เรียนเลือก jamo เอง
  - drill พยางค์สังเคราะห์
  - content จาก Learning Path หรือ static export ของ content ทั้งหมด
  - Word stats

## Decisions

| หัวข้อ          | การตัดสินใจ                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| แหล่ง content   | exercise จาก `public/content/home.json` (DEC-043) ผ่าน `HomeContentRepository` เดิม อ่าน Firestore 0 ครั้ง                                                     |
| ทางเข้า         | ปุ่มบน `/review` ไปที่ route ใหม่ `/review/weak-jamo`                                                                                                          |
| Session context | `{ mode: 'weak-jamo' }` (ใหม่)                                                                                                                                 |
| ReviewItem      | ไม่อ่าน ไม่สร้าง ไม่อัปเดต                                                                                                                                     |
| EXP             | `expGained: 0` (เหมือน Review ตอนนี้)                                                                                                                          |
| Player Stats    | นับ `practicesCompleted` (ใหม่) ไม่นับเป็น lesson หรือ perfect lesson; keystrokes, characters, words/sentences, typing/learning time และ active day นับตามปกติ |
| Jamo stats      | ส่ง `effects.jamoCounts` ตามปกติ (DEC-050)                                                                                                                     |
| jamo เป้าหมาย   | ไม่เกิน 3 ตัว: ฝึก ≥ 20 ครั้ง (`MIN_RANKED_JAMO_ATTEMPTS`), mistake rate > 0, rate สูงสุดก่อน (เท่ากันให้ตัวที่ฝึกมากกว่า)                                     |
| การเลือก        | คะแนน = Σ (จำนวนปุ่ม jamo เป้าหมายใน target × rate ของ jamo นั้น); ข้ามคะแนน 0; สุ่ม 10 ตัวไม่ซ้ำจาก 30 อันดับแรก                                              |
| content ไม่พอ   | น้อยกว่า 10 เล่นเท่าที่มี; 0 ตัวไม่แสดงปุ่ม                                                                                                                    |

ตัวเลข 3 / 10 / 30 เป็น policy ในโค้ด ไม่อยู่ใน schema

## Data model

### `LearningSessionContext`

เพิ่ม `{ mode: 'weak-jamo' }`

### `PeriodStats` และ `SessionAggregate`

เพิ่ม `practicesCompleted` (optional ในข้อมูลเก่า อ่านเป็น 0)

`periodStatsFrom` เปลี่ยนเป็น:

- `isLesson` = `mode === 'learning-path' || mode === 'home'`
- `reviewsCompleted` = `mode === 'review'`
- `practicesCompleted` = `mode === 'weak-jamo'`
- `lessonsCompleted`, `lessonsReplayed`, `perfectLessons` นับเฉพาะ `isLesson`

เดิมทุกโหมดที่ไม่ใช่ `review` นับเป็น lesson ไม่ต้อง migrate เพราะยังไม่มีโหมดอื่นถูกบันทึก

### `JamoStatsRepository` (ใหม่)

```ts
interface JamoStatsRepository {
  getJamoStats(userId: string): Promise<JamoStats> // ไม่มี doc → {}
}
```

| Adapter   | อ่านจาก                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Firestore | `users/{userId}/learnerStats/jamo` → แปลง Timestamp เป็น `Date` (ใช้ตัวแปลงเดียวกับ `firestore-jamo-stats.ts`) |
| IndexedDB | store `learnerStats` key `${userId}:jamo`                                                                      |

## Pure functions — `domain/practice/weak-jamo.ts`

```ts
export const WEAK_JAMO_TARGETS = 3
export const WEAK_JAMO_SESSION_SIZE = 10
export const WEAK_JAMO_POOL_SIZE = 30

export interface WeakJamoTarget {
  jamo: string
  mistakeRate: number
  attempts: number
}
export interface PracticeExercise {
  id: string
  targetText: string
  lessonType: LessonType
}

export function weakJamoTargets(stats: JamoStats): WeakJamoTarget[]
export function weakJamoScore(
  targetText: string,
  targets: WeakJamoTarget[],
): number
export function selectWeakJamoExercises(
  targets: WeakJamoTarget[],
  exercises: PracticeExercise[],
  random?: () => number,
): PracticeExercise[]
export function homePracticeExercises(content: HomeContent): PracticeExercise[]
```

- `weakJamoScore` นับปุ่มด้วย `buildExpectedKeys` (ข้าม `literal` และ target ที่พิมพ์ไม่ได้
  ใช้กฎเดียวกับ `jamoCountsFrom`)
- `selectWeakJamoExercises` ไม่ซ้ำตาม `id`, เรียงตามคะแนน, ตัดเหลือ 30, สุ่มเลือก 10
  (Fisher-Yates ด้วย `random`)
- `homePracticeExercises` แตก unit → lesson → exercise แล้วติด `lessonType` ของ lesson

## Data flow

1. **`/review` loader (เดิม)**
   - อ่าน `getJamoStats` กับ `getHomeContent` ขนานกับข้อมูลเดิม
   - คืนค่า `weakJamo: { targets, available } | null`
   - ส่วนนี้ล้มเหลวให้คืน `null` โดย review เดิมยังทำงาน
2. **`/review/weak-jamo` loader**
   - อ่าน stats กับ home content แล้วคำนวณ targets → `selectWeakJamoExercises`
   - คืน `{ targets, exercises, settings }`
   - ไม่มี target หรือ exercise ให้ `redirect('/review')`
3. **`/review/weak-jamo` action** → `submitWeakJamoSession(deps, userId, input, now)`
   - input: `submissionId`, `startedAtMs`, `durationSeconds`, `exercisesAttempted`, keystrokes,
     `results: [{ exerciseId, targetText, lessonType, mistakeCount, typingSeconds, elapsedSeconds }]`,
     `jamoCounts?`
   - session: `{ mode: 'weak-jamo' }`, `expGained: 0`, `...sessionStatsFrom(results, undefined, timezone, now)`
     (`lessonType` ต่อ exercise)
   - effects: `{ progress: [], reviewItems: [], ...(jamoCounts ? { jamoCounts } : {}) }`
   - validation: zod; `jamoCounts` ใช้ `jamoCountsSchema.optional().catch(undefined)` แล้วตัด key
4. **Guest migration** — session `weak-jamo` ย้ายด้วยทางเดิม; jamo stats ไม่ย้าย (DEC-050)

## UI

- **`/review`:** การ์ด/ปุ่ม "ฝึก jamo ที่อ่อน"
  - แสดง jamo เป้าหมายกับ mistake rate (`ㅓ 18% · ㅗ 12% · ㄹ 9%`)
  - แสดงแม้ไม่มี review item ถึงกำหนด
  - ซ่อนเมื่อ `weakJamo` เป็น `null` หรือ `available === 0`
- **`/review/weak-jamo`:** หัวข้อ "ฝึก ㅓ ㅗ ㄹ" + ตัวเล่นเดียวกับ Review
  - `ReviewTypingSession` เปลี่ยน prop เป็น `exercises: {id, targetText}[]` และรับ payload
    builder / submit target
  - `/review` เดิม map `ReviewItem` เข้ามา
- **หน้าจบ:** สรุปแบบ Review (ถูก / ต้องฝึกเพิ่ม) + accuracy ของ jamo เป้าหมายในรอบนี้
  (จาก `jamoCounts` ของ session)
  - ปุ่ม "ฝึกอีกรอบ" (reload loader → สุ่มชุดใหม่) และ "กลับ Review"
- ใช้ style ของหน้า Review เดิม

## Error handling

- **โหลด `home.json` หรือ jamo stats ล้มเหลว** — `/review` ทำงานปกติ ไม่มีปุ่ม;
  `/review/weak-jamo` redirect กลับ `/review`
- **Submit**
  - dedupe ด้วย receipt
  - submit ล้ม: แสดง error และให้ retry ด้วย `submissionId` เดิม (pattern เดียวกับ Lesson)
- **Validation** — payload ผิด → throw (แบบ Review); `jamoCounts` ผิด → ตัดทิ้ง ส่วนอื่น submit ปกติ
- **Firestore** — ไม่ส่ง `undefined` ทุกจุด

## Testing

รันเฉพาะ test ที่เพิ่มหรือแก้ ไม่รัน `pnpm test` ทั้งชุดและไม่ build (เจ้าของ repo ทำต่อเอง)
UI ล้วนไม่เขียน automated test (กฎ repo) แต่ test เดิมของ `ReviewTypingSession` / `ReviewPage`
ต้องผ่านหลังปรับ props

- **Domain**
  - `weakJamoTargets`: ≥ 20 ครั้ง, rate 0 ไม่นับ, ≤ 3 ตัว, เรียงถูก
  - `weakJamoScore` / `selectWeakJamoExercises`: ถ่วงน้ำหนัก, ไม่ซ้ำ, ≤ 10, สุ่มเฉพาะใน 30
    อันดับแรก (random กำหนดได้), คะแนน 0 ถูกข้าม, ช่องว่างไม่นับ
  - `homePracticeExercises`: ติด `lessonType`
  - `periodStatsFrom`: `weak-jamo` → `practicesCompleted` เท่านั้น; `addSessionAggregate` บวก
    `practicesCompleted`
- **Application**
  - `submitWeakJamoSession`: context, `expGained: 0`, stats, effects ไม่มี `reviewItems`/`progress`,
    `jamoCounts` เฉพาะเมื่อมี
- **Adapter**
  - Firestore `getJamoStats` (emulator: Timestamp → Date, ไม่มี doc → `{}`)
  - IndexedDB helper
- **Loader / action**
  - `/review` loader เมื่อ home content ล้ม → `weakJamo: null`
  - `/review/weak-jamo` loader redirect
  - action ตัด `jamoCounts` ผิด

## Docs

- `DECISIONS.md`: DEC-051
- `LEARNING-MODES.md`: Weak Jamo ไม่ใช่ "future" แล้ว; อธิบายโหมด
- `DOMAIN-MODEL.md`: `LearningSessionContext` `weak-jamo`, `practicesCompleted`
- `SESSION-AND-HISTORY.md`: practice session
- `PROGRESS.md`, log `docs/log/2026-10.md`

## Handoff (เจ้าของ repo)

- ไม่ต้องแก้ Firestore Rules (`learnerStats` มีแล้ว)
- รัน `pnpm test` ทั้งชุด และ `pnpm build`
- ตรวจด้วยมือ:
  - เปิด `/review` เห็นปุ่มเมื่อมี jamo ผ่านเกณฑ์
  - เล่น `/review/weak-jamo` จนจบ แล้วดู `learningSessions` (`mode: 'weak-jamo'`),
    `dailyStats.practicesCompleted` และ `learnerStats/jamo`
