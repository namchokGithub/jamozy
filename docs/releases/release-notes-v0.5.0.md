# Jamozy v0.5.0

## Highlights

- Introduced Rebirth progression, letting learners begin a new progression cycle while keeping their Rebirth history and rank journey intact.
- Profile now includes rank-based progression, animated rank mascots, clearer EXP formatting, and recovery options when a Rebirth update needs to be retried.
- Added difficulty-based EXP rewards across lessons, Home exercises, review, and practice, with progression tracking correctly scoped to the current Rebirth cycle.
- Typing practice now supports question marks and additional punctuation, restores an in-progress lesson for up to five minutes after a refresh, and presents an animated Combo badge.
- Lessons provide exercise hints beside the finger guide, improved typing-stat layouts, and more reliable WPM when older sessions contain zero legacy values.
- Jamo SVG rendering now supports standalone compatibility Jamo and avoids blank previews when candidates are unavailable.
- Settings can follow the device’s system theme, while saved guest settings now carry timestamps to support future migration.
- Admin lesson management now offers create/edit exercise forms, Jamo previews, and easier navigation through filtered exercises. Publishing lessons no longer incorrectly reports unsaved changes.
- Added a quick settings modal on Home and restored the blue finger-guide hand through theme tokens.

## Remaining work

- Validate Rebirth, lesson-resume, and progression behaviour on real devices before a production release.
- Continue planned post-MVP work, including the target guest IndexedDB and authenticated Firebase persistence model.
