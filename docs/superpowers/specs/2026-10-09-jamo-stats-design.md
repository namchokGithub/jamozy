# Jamo and Lesson Stats (Spec B) — Design

**Date:** 2026-10-09
**Status:** Accepted as [[DEC-050]] (2026-10-09; amends [[DEC-028]] storage)
**Related:** [[DEC-028]] (JamoStat), [[DEC-030]] (Guest migration merge), [[DEC-049]] (Player Stats, Spec A), `docs/LEVELING.md` → Learning / Item Stats

## Problem

`docs/LEVELING.md` ต้องการ Learning / Item Stats: Most Practiced / Most Mistyped /
Strongest / Weakest Jamo, Most Practiced / Most Mistyped Word, Best Accuracy Lesson,
Most Replayed Lesson ตอนนี้ไม่มีการเก็บสถิติราย jamo เลย แม้ [[DEC-028]] จะออกแบบ
`JamoStat` ไว้แล้ว ข้อมูลระดับ keystroke มีอยู่ใน client (`ExpectedKey.jamo`,
`MistakeEvent.expectedJamo`) แต่ไม่ถูกส่งออกจาก session

## Scope

ชุด Player Stats มี 3 spec: Spec A (เสร็จ, DEC-049) → **Spec B (นี้)** → Spec B3
(Personalized Review, spec สุดท้าย ใช้ JamoStat จาก spec นี้)

- ใน spec นี้:
  - เก็บ JamoStat ใน submit transaction (Firebase + IndexedDB)
  - pure functions จัดอันดับ jamo และ lesson (derived ตอนอ่าน)
- นอก scope:
  - UI
  - Personalized Review (Spec B3)
  - Word stats: รอ `VocabularyEntry`
  - ย้าย jamo stats ของ Guest ไปบัญชีตอน login (ตั้งใจไม่ทำ)
  - Backfill: ไม่ทำ เริ่มนับ 0 ตั้งแต่ deploy
  - jamo ระดับประกอบแล้ว (เช่น `ㅘ` เป็นตัวเดียว)

## Decisions

| หัวข้อ           | การตัดสินใจ                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ระดับ jamo       | นับตามปุ่มที่กด (`ExpectedKey.jamo`): `ㅘ` = `ㅗ` + `ㅏ`, `ㄳ` = `ㄱ` + `ㅅ`, `ㄲ` = 1 ปุ่ม (Shift)                                                                                                |
| ที่เก็บ          | doc เดียวแบบ map: `users/{id}/learnerStats/jamo` (amend DEC-028 ที่เป็น doc ต่อ jamo)                                                                                                              |
| อัปเดตเมื่อไร    | ใน transaction เดียวกับ submit session (dedupe ด้วย receipt `sessionOutcomes`)                                                                                                                     |
| ส่งข้อมูลอย่างไร | `SessionSubmissionEffects.jamoCounts` ไม่เก็บใน `LearningSession` history                                                                                                                          |
| Guest → account  | ไม่ย้าย jamo stats; บัญชีเริ่มนับ jamo ใหม่ตั้งแต่ login (ข้อยกเว้นของ DEC-030)                                                                                                                    |
| Rejected         | นับให้ jamo ที่ควรกด ไม่ใช่ jamo ที่กดผิด (ตาม DEC-028)                                                                                                                                            |
| Rankings         | Most Practiced = `accepted + rejected` สูงสุด; Most Mistyped = `rejected` สูงสุด; Weakest / Strongest = mistake rate สูงสุด / ต่ำสุด เฉพาะ jamo ที่ฝึก ≥ 20 ครั้ง, rate เท่ากันตัวที่ฝึกมากกว่าชนะ |
| Lesson stats     | derive จาก `lessonProgress` เดิม ไม่เก็บเพิ่ม                                                                                                                                                      |

## Data model

### `domain/models/jamo-stat.ts` (ใหม่)

```ts
export interface JamoStat {
  acceptedKeystrokes: number
  rejectedKeystrokes: number // ผิดตอนที่ jamo นี้คือปุ่มที่ควรกด
  firstPracticedAt: Date
  lastPracticedAt: Date
}
export type JamoStats = Record<string, JamoStat> // key = jamo ระดับปุ่ม
export type JamoCounts = Record<string, { accepted: number; rejected: number }>
export const MIN_RANKED_JAMO_ATTEMPTS = 20
```

### Storage

| Adapter           | ที่เก็บ                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Firestore         | `users/{userId}/learnerStats/jamo` → `{ jamo: JamoStats }` (timestamps เป็น `Timestamp`) |
| IndexedDB (Guest) | store `learnerStats`, key `${userId}:jamo`, DB version 8                                 |

ขนาด doc: ≈ 33 jamo × 4 fields ≈ 3–5 KB (limit 1 MB)

### `SessionSubmissionEffects`

เพิ่ม `jamoCounts?: JamoCounts` ไม่มีหรือว่าง = ไม่อ่าน/ไม่เขียน `learnerStats`
receipt (`outcome.effects`) เก็บไว้ด้วยเพื่อคืนผลเดิมตอน retry

### `LessonResult` / `HomePartialResult` / `HomeSessionTotals`

เพิ่ม `jamoCounts?: JamoCounts` (optional; ของเก่าหรือ job ที่ค้างอยู่ไม่มี = ไม่นับ)

## Pure functions

- `jamoCountsFrom(results: ExerciseResult[]): JamoCounts`
  - accepted: ทุก `ExpectedKey.jamo` ของ target ที่พิมพ์จบ (`buildExpectedKeys(targetText)`),
    ปุ่มละ 1 ครั้ง
  - rejected: ทุก `MistakeEvent.expectedJamo`
  - ข้าม key ที่ไม่ใช่ jamo: `slot: 'literal'` (ช่องว่าง, เครื่องหมาย) และ jamo ที่ไม่อยู่ใน
    `JAMO_TO_KEY`
- `mergeJamoCounts(a, b): JamoCounts` สำหรับ Home สะสมข้าม exercise
- `applyJamoCounts(current: JamoStats, counts: JamoCounts, now: Date): JamoStats`
  - บวก counter; `firstPracticedAt` ตั้งเฉพาะ jamo ใหม่; `lastPracticedAt = now`
  - jamo ที่ count รวมเป็น 0 ไม่ถูกเพิ่ม
- `jamoRankings(stats): { mostPracticed, mostMistyped, weakest, strongest }` — แต่ละตัวเป็น
  `{ jamo, attempts, rejected, mistakeRate } | null`
- `lessonRankings(progress: Progress[]): { bestAccuracy, mostReplayed }`
  - Best Accuracy Lesson: `bestAccuracy` สูงสุด เฉพาะ `status: 'completed'`
  - Most Replayed: `attempts - 1` สูงสุด (> 0) เฉพาะ `status: 'completed'`

## Data flow

1. **Learning Path / one-page** — `getLessonResult` คำนวณ `jamoCounts` จาก
   `completedResults`; one-page สะสมใน `OnePagePartialLessonResult`;
   `LessonTypingSession` ส่งใน payload; `complete-lesson-session` ส่งต่อใน `effects`
2. **Review** — `ReviewTypingSession` ส่ง `jamoCounts`; `submit-review-session` ส่งต่อ
3. **Home** — `recordHomeExercise` สะสม `jamoCountsFrom([result])` ใน
   `HomePartialResult.jamoCounts`; replay ใช้ `homeReplayTotals`; `submitHomeSession` ส่งต่อ
4. **Submit (Firestore)** — อ่าน `learnerStats/jamo` ก่อน write ตัวแรก
   (ต่อจาก `readSessionStatsWrites`) แล้ว `set` doc ทั้งก้อนใน transaction เดิม
5. **Submit (IndexedDB)** — อ่าน/เขียน store `learnerStats` ใน `putSessionOnce` เดิม
   (callback ชั้นในสุด เหมือน Spec A)
6. **Guest migration** — `migrateSessionOutcome` ไม่แตะ `learnerStats`

## Error handling

- **Validation (action)**
  - key ต้องอยู่ใน `Object.keys(JAMO_TO_KEY)` (keymap เดิม)
  - ค่าเป็นจำนวนเต็ม 0..10,000 ต่อ jamo ต่อ session
  - ไม่ผ่าน → ตัด `jamoCounts` ทิ้ง แล้ว submit ส่วนอื่นตามปกติ
- **Firestore**
  - `set` doc ทั้งก้อน: jamo เป็น key ใน map ไม่ใช้ field path
  - ไม่ส่ง `undefined`
- **Atomic** — อยู่ใน transaction เดียวกับ session; retry ปลอดภัยด้วย receipt
- **Trust** — client คำนวณ เหมือน Spec A (สถิติส่วนตัว ไม่ใช่รางวัล)
- **Rules** — `match /learnerStats/{doc}` owner-only; ต้องยืนยันกับเจ้าของ repo ก่อนแก้
  และ deploy ก่อน code

## Impact

- ไม่กระทบการสร้างบทเรียน (Admin ใช้แค่ `domain/korean/hangul`) และ Jamo SVG tagger
  (ใช้แค่ `tools/jamo-svg/compile`)
- งานนี้แค่อ่าน `buildExpectedKeys`, `ExpectedKey`, `MistakeEvent`, `JAMO_TO_KEY` ไม่แก้
- `LearningSession` ไม่เพิ่ม field: บรรทัด "no per-jamo maps are persisted" ใน history
  ยังเป็นจริง

## Testing

รันเฉพาะ test ที่เพิ่มหรือแก้ ไม่รัน `pnpm test` ทั้งชุดและไม่ build (เจ้าของ repo ทำต่อเอง)

- **Domain**
  - `jamoCountsFrom`: `ㅘ` แยกนับ `ㅗ`/`ㅏ`, `ㄲ` นับ 1, พิมพ์ผิดนับให้ jamo ที่ควรกด,
    ช่องว่างไม่นับ
  - `applyJamoCounts`: ไม่ทับ `firstPracticedAt`, jamo ใหม่, count 0 ไม่เพิ่ม key
  - `jamoRankings`: ขั้นต่ำ 20, rate เท่ากัน, ไม่มีข้อมูล → `null`
  - `lessonRankings`: ข้าม lesson ที่ยังไม่ completed, ไม่มี replay → `null`
- **Application**
  - 4 use case ส่ง `jamoCounts` ใน `effects`
  - Home สะสมข้าม exercise และ job เก่าไม่มี `jamoCounts`
  - payload ไม่ผ่าน validation ยัง submit ได้ แต่ไม่มี `jamoCounts`
- **Adapter**
  - Emulator: submit → doc ถูก, submit ซ้ำไม่นับซ้ำ, ผู้ใช้อื่นอ่านไม่ได้
  - Guest: pure helper (แบบ `guestStatsWrites`)
  - Migration: `migrateSessionOutcome` ไม่เขียน `learnerStats`

## Docs

- `DECISIONS.md`: DEC-050 + amend DEC-028 (path เป็น doc เดียวแบบ map, ข้อยกเว้น migration)
- `DOMAIN-MODEL.md`: ส่วน JamoStat (path/shape), `SessionSubmissionEffects.jamoCounts`
- `AUTH-AND-PERSISTENCE.md`: store `learnerStats` (v8), กฎ merge: jamo stats ไม่ย้าย
- `PROGRESS.md`: JamoStats domain/repository support
- log `docs/log/2026-10.md`

## Handoff (เจ้าของ repo)

- deploy Firestore Rules (`learnerStats`) ก่อน deploy code
- รัน `pnpm test` ทั้งชุด และ `pnpm build`
- ตรวจด้วยมือ: เล่น lesson, review, Home แล้วดู `users/{id}/learnerStats/jamo`
