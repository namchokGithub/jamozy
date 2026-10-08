# Leveling, Rank, Perk, Achievement ↓→

---

New Lesson
↓
ตาม Difficulty level: Easy 15 EXP, Medium 25 EXP, Hard 30 EXP
↓
Review / Practice
↓
ตาม Difficulty level: Easy 3 EXP, Medium 5 EXP, Hard 10 EXP
↓
Daily Quest
↓
ตาม Difficulty level: Easy 5 EXP, Medium 10 EXP, Hard 15 EXP
↓
Bonus EXP
↓
Perfect LessonExercise 100%: +5 EXP
↓
Level Up
↓
Profile / Badge / Rank

---

## Meaning

| ระบบ        | Design                                   |
| ----------- | ---------------------------------------- |
| **Level**   | Lv.1 → 100+                              |
| **Rank**    | เปลี่ยนตาม Level และ reset เมื่อ Rebirth |
| **Rebirth** | ทำได้ตั้งแต่ Lv.100                      |
| **Perk**    | ได้จาก Rebirth และติดถาวร                |

---

## EXP Calculation

Final EXP is calculated in this order:

1. Base EXP
2. Add Flat Bonuses
3. Apply Percentage Bonuses
4. Round final EXP

Formula:

```
Final EXP = round((Base EXP + Flat Bonus) × (1 + Total EXP Bonus))
```

ตัวอย่างแต่ละประเภท:

```
Perfect Bonus   +2 EXP / level
Practice Pays   +1 EXP / level
Focused Review  +3 EXP / level
Explorer        +3 EXP / level
Precision       +2 EXP
```

ส่วน `EXP Bonus` คือโบนัสแบบ `%`:

```
EXP Boost       +2% / level
Review Bonus    +5% / level
Daily Boost     +5% / level
Quick Learner   +5% / level
Comeback        +10%
```

ตัวอย่าง New Lesson Hard:

```
Base EXP        30
Explorer III    +9
Perfect Bonus II +4

Subtotal        43

EXP Boost V     +10%
Quick Learner II +10%

Total Bonus     +20%

Final EXP
= round(43 × 1.20)
= 52 EXP
```

ตัวอย่าง Review:

```
Review Hard       10
Focused Review II +6

Subtotal          16

EXP Boost V       +10%
Review Bonus III  +15%

Total Bonus       +25%

Final EXP
= round(16 × 1.25)
= 20 EXP
```

---

## Structure

```
Player
├── Progression
│   ├── Level / EXP
│   ├── Rank
│   ├── Rebirth
│   └── Perks
│
├── Lifetime Stats
│   ├── Learning
│   ├── Typing
│   ├── Performance
│   ├── Time
│   ├── Activity
│   └── Records
│
├── Daily Stats
│   └── Day → Week → Month → Year
│
└── Learning Stats
    ├── Jamo
    ├── Words
    └── Lessons
```

---

## Jamozy Player Stats

### Lifetime Stats

| Category        | Stats                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Progression** | Current Level, Current EXP, Total EXP Earned, Highest Level, Highest Rank, Rebirth Count, Perk Points Earned       |
| **Learning**    | Lessons Completed, Unique Lessons Completed, Lessons Replayed, Reviews Completed, Perfect Lessons                  |
| **Typing**      | Total Keystrokes, Correct Keystrokes, Incorrect Keystrokes, Characters Typed, Words Practiced, Sentences Practiced |
| **Performance** | Average Accuracy, Best Accuracy, Average WPM, Best WPM, Longest Perfect Streak                                     |
| **Time**        | Total Typing Time, Total Learning Time, Longest Session                                                            |
| **Activity**    | Active Days, Current Streak, Longest Streak                                                                        |
| **Records**     | Most EXP / Day, Most EXP / Month, Most Lessons / Day                                                               |

ตัวอย่าง Profile:

```
Genesis · Lv.104
Rebirth III

Total EXP        100,021
Lessons          328
Accuracy         95.7%
Best WPM         67
Typing Time      42h 18m
Active Days      124

Highest Level    104
Highest Rank     Genesis
Longest Streak   37 days
```

### Daily Stats

เก็บเป็นรายวัน แล้วนำไปคำนวณ Today / Week / Month / Year

```
user_daily_stats/{date}

expEarned
lessonsCompleted
lessonsReplayed
reviewsCompleted
perfectLessons

correctKeystrokes
incorrectKeystrokes
charactersTyped
wordsPracticed
sentencesPracticed

typingSeconds
learningSeconds

isActiveDay
```

`Current Streak / Longest Streak` ให้ระบบ progression คำนวณหรือเก็บ lifetime state

ตัวอย่าง Profile:

```
Today       320 EXP
This Week   1,840 EXP
This Month  7,420 EXP

Lessons     28
Accuracy    96.2%
Typing      3h 42m
```

### Learning / Item Stats

เก็บเพื่อวิเคราะห์จุดแข็ง-จุดอ่อนของผู้เรียน

```
Most Practiced Jamo
Most Mistyped Jamo
Strongest Jamo
Weakest Jamo

Most Practiced Word
Most Mistyped Word

Best Accuracy Lesson
Most Replayed Lesson
```

#### Personalized Review

```
ㅓ → mistake rate 18%
ㅗ → mistake rate 12%
ㄹ → mistake rate 9%

↓
Generate Review
↓
เน้น ㅓ / ㅗ / ㄹ
```

---

## Level Curve

Lv.1–99

```JavaScript
baseExp := 50 * math.Pow(level, 1.20)

rebirthMultiplier := 1.0 + (0.15 * float64(rebirthCount))

expToNext := math.Round(
    baseExp * rebirthMultiplier,
)
```

Lv.100+ = Soft Cap, Lv.100+ ใช้ multiplier แบบขั้นบันไดทุก 10 Level

```JavaScript
baseExp := 50 * math.Pow(level, 1.20)

rebirthMultiplier := 1.0 + (0.15 * float64(rebirthCount))

softCapMultiplier := 1.0

if level >= 100 {
    tier := math.Floor((level-100)/10) + 1
    softCapMultiplier = math.Pow(3, tier)
}

expToNext := math.Round(
    baseExp *
    rebirthMultiplier *
    softCapMultiplier,
)
```

---

## Rebirth

### Requirement

- Rebirth is available at Lv.100+
- Rebirth is optional.
- Player can continue leveling beyond Lv.100.

### On Rebirth

Reset:

- Level → 1
- Current EXP → 0
- Rank → Normal

Keep:

- Rebirth Count
- Perks / Perk Levels
- Lifetime Stats
- Daily Stats
- Learning Stats
- Lesson / Course Progress
- Achievements

Reward:

- Rebirth Count +1
- Perk Point +1

---

## Badge / Range

- (รอทำ SVG เบื้องต้นใส่แค่ Text ไปก่อน)
- Badge คือ ตัว Slime
- สีจะเป็น Gradient / Pastel
- Effect: ✦ = Glow, ✦✦ = Glow+, ✦✦✦ = Sparkle, ✦✦✦ = Twinkle
- ✦ แทนมงกุฎด้วย
- Rank จะ Reset เมื่อ Rebirth และจะนำ Rebirth มาต่อหลังเช่น **Normal R3, Epic R8,** ขยันสุดๆ **Genesis R14**

| Rank | Name          | สี Slime               | ความรู้สึก                   |
| ---: | ------------- | ---------------------- | ---------------------------- |
|    1 | **Normal**    | Warm Cream / Stone     | ทั่วไป, Beginner             |
|    2 | **Uncommon**  | Spring Mint            | เริ่มพิเศษ, Learner          |
|    3 | **Rare**      | Soft Sky               | หายาก, Skilled               |
|    4 | **Epic**      | Lavender               | ระดับสูง, Advanced           |
|    5 | **Unique**    | Cherry Blossom         | หนึ่งเดียว, Expert           |
|    6 | **Legendary** | Warm Gold + ✦          | ตำนาน, Master                |
|    7 | **Mythic**    | Coral Crimson + ✦✦     | เหนือตำนาน, Elite            |
|    8 | **Divine**    | Ivory Gold + ✦✦✦       | ระดับเทพ, SuperElite         |
|    9 | **Genesis**   | Prismatic Pastel + ✦✦✦ | จุดกำเนิด / สูงสุด, Beyonder |

### Rank and Leveling

```
Lv.1–9      Normal
Lv.10–19    Uncommon
Lv.20–34    Rare
Lv.35–49    Epic
Lv.50–64    Unique
Lv.65–79    Legendary ✦
Lv.80–89    Mythic ✦✦
Lv.90–99    Divine ✦✦✦
Lv.100+     Genesis ✦✦✦
```

### Color Information

#### Prismatic Pastel

#F6C8DF → #DDD0F5 → #C5E5F7 → #C8EBCF → #FFE7A8

```SCSS
linear-gradient(
  145deg,
  var(--rank-light) 0%,
  var(--rank-base) 100%
)
```

#### Naming

Spring Mint → Korean garden
Soft Sky → peaceful scenery
Lavender → dreamy
Cherry Blossom → spring
Warm Gold → sunlight
Coral → sunset
Ivory Gold → divine/light

#### Effects

|        Rank | Effect         | ลักษณะ                                |
| ----------: | -------------- | ------------------------------------- |
|         1–5 | **None**       | สี Gradient/Pastel อย่างเดียว         |
| 6 Legendary | ✦**Glow**      | เรืองแสงนุ่ม ๆ รอบ Slime              |
|    7 Mythic | ✦✦**Glow+**    | Glow ชัดขึ้น + aura บาง ๆ             |
|    8 Divine | **✦✦✦Sparkle** | Glow + ดาวประกายรอบตัว                |
|   9 Genesis | ✦✦✦**Twinkle** | Prismatic glow + ดาวกระพริบ/ขยับเบา ๆ |

---

## Perk

|   # | Perk               | Effect                                                                   | Max Lv. |
| --: | ------------------ | ------------------------------------------------------------------------ | ------: |
|   1 | **Second Chance**  | การพิมพ์ผิดครั้งแรกไม่นับเป็น Mistake ต่อ Exercise                       |   **5** |
|   2 | **EXP Boost**      | EXP ที่ได้รับ`+2%` ต่อระดับ                                              |   **5** |
|   3 | **Review Bonus**   | EXP จาก Review`+5%` ต่อระดับ                                             |   **3** |
|   4 | **Perfect Bonus**  | Perfect Lesson ได้ Bonus EXP เพิ่ม`+2 EXP` ต่อระดับ                      |   **5** |
|   5 | **Daily Boost**    | Daily Quest EXP`+5%` ต่อระดับ                                            |   **3** |
|   6 | **Combo Keeper**   | พิมพ์ผิด 1 ครั้งไม่ทำลาย Perfect/Typing Combo                            |   **3** |
|   7 | **Warm Up**        | Exercise แรกของ Lesson ได้ Mistake Protection +1                         |       1 |
|   8 | **Quick Learner**  | Lesson ครั้งแรกได้ EXP เพิ่ม`+5%` ต่อระดับ                               |   **3** |
|   9 | **Practice Pays**  | Replay EXP`+1` ต่อระดับ                                                  |   **3** |
|  10 | **Focused Review** | Review ที่ตอบถูกแบบ Perfect ได้`+3 EXP` ต่อระดับ                         |   **3** |
|  11 | **Streak Guard**   | พลาด Daily Streak ได้ 1 วันโดยไม่ Reset                                  |   **1** |
|  12 | **Comeback**       | กลับมาเรียนหลังหาย ≥3 วัน ได้ EXP`+10%` สำหรับ Lesson แรก                |       1 |
|  13 | **Precision**      | Perfect Exercise ติดต่อกัน 5 ครั้ง →`+2 EXP`                             |   **3** |
|  14 | **Steady Hand**    | ลดจำนวน mistake ที่ใช้ในการคำนวณ Accuracy ตอนจบ Lesson`Ignore 1 mistake` |   **3** |
|  15 | **Explorer**       | เรียน Lesson ใหม่ครั้งแรก`+3 EXP` ต่อระดับ                               |   **3** |

---

## Feature Future

- Achievement
