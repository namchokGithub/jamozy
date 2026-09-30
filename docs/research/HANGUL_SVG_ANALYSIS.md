# Hangul SVG structural analysis

Status: analysis only, 2026-09-30. This is context for a future Jamo SVG
Tagger/generator; it does **not** introduce production SVG data or change the
existing renderer.

## 1. Goal

Jamozy teaches Korean typing one physical jamo key step at a time. A future
renderer needs to reveal each step as its own SVG path while retaining the
appearance of the composed syllable. The runtime invariant is:

```text
one Hangul syllable → ordered physical typing steps → one combined SVG path per step
```

The challenge is not converting a font outline to SVG. It is assigning every
part of an outline to the physical typing steps, and occasionally splitting a
font contour that contains more than one step.

## 2. Chosen font and extraction basis

- **Authoritative geometry:** local Pretendard SemiBold 600 TTF at
  [`src/assets/fonts/pretendard-latin-600-normal.ttf`](../../src/assets/fonts/pretendard-latin-600-normal.ttf).
- **Extractor:** `opentype.js`, matching the existing development PoC in
  [`src/features/dev-jamo-svg/pretendard-glyphs.ts`](../../src/features/dev-jamo-svg/pretendard-glyphs.ts).
- **Measured font metrics:** 2,048 units/em; ascender 1,950; descender -494;
  PoC SVG baseline 1,752. Every scanned Korean glyph had advance width 1,770.
- **Physical-step rule:** Jamozy’s current typing model in
  [`src/domain/korean/target-sequence.ts`](../../src/domain/korean/target-sequence.ts)
  expands the seven compound medials and eleven compound finals defined in
  [`src/domain/korean/hangul.ts`](../../src/domain/korean/hangul.ts). Tense
  initials remain one shifted-key step. For example, `값` is `ㄱ / ㅏ / ㅂ / ㅅ`.
- **SVG step rule (algorithm v2, 2026-10-01):** the Tagger keeps each compound
  medial as one visual step while compound finals stay expanded; see
  [DEC-036](../DECISIONS.md). The measurements below were taken with v1, which
  also expanded compound medials.

## 3. Target architecture

```text
Pretendard 600 TTF
  → glyph extraction
  → contour/path analysis
  → jamo ownership tagging
  → optional path splitting
  → combine geometry per physical jamo
  → static SVG dataset
  → runtime SVG renderer
```

The analysis does not implement any stage after contour/path analysis.

## 4. Completed development PoC

`/dev/jamo-svg` is a Vite-development-only inspector. It parses only the local
Pretendard 600 TTF and does not import or alter the production Canvas renderer,
guide data, typing engine, Lesson, or Review behavior.

The inspected syllables are `가`, `하`, `녕`, `죄`, `화`, and `값`.

- Direct contour-to-jamo ownership works for the straightforward inspected
  cases.
- One physical jamo can own multiple contours (for example, an exterior and a
  counter), which are combined into its one exported path.
- Source-contour order is not physical typing order; exports use the typing
  sequence explicitly.
- `값` exposes the hard case: one Pretendard contour is a union of final `ㅂ`
  and `ㅅ` geometry. It is not separable by merely assigning whole contours.
- The PoC performs a fixed, auditable split for that source contour. It retains
  the visible Pretendard commands and adds only the shared interior closure
  necessary to produce separate fillable `ㅂ` and `ㅅ` paths.
- The one-color reconstruction and source-outline overlay visually match the
  original Pretendard glyph.

Conclusion: SVG extraction is viable. Tagging and the small minority of true
splits—not SVG conversion—are the scaling problem.

## 5. Full U+AC00–U+D7A3 analysis

### Method and reproducibility

[`scripts/analyze-hangul-svg.ts`](../../scripts/analyze-hangul-svg.ts) iterates
all 11,172 modern precomposed Hangul syllables (`가` through `힣`). For each it
uses the same `glyph.getPath(0, baselineY, unitsPerEm)` convention as the PoC,
splits source contours at `M`/`Z`, derives the current Jamozy physical step
sequence, and records code point, steps, contour count, command topology,
bounds, and advance width. Run:

```bash
pnpm exec tsx scripts/analyze-hangul-svg.ts --compact
```

The following are **measured facts** from that run.

### Coverage and physical typing steps

All 11,172 expected code points were scanned successfully.

| Physical jamo steps | Glyphs | Share |
| ---: | ---: | ---: |
| 2 | 266 | 2.38% |
| 3 | 4,389 | 39.28% |
| 4 | 5,054 | 45.24% |
| 5 | 1,463 | 13.10% |

The 1,463 five-step glyphs are the intersection of a compound medial and a
compound final. There are 4,389 glyphs with one of the eleven compound finals
(11 finals × 19 initials × 21 medials); all are relevant candidates for
physical-final ownership review, even when their contours look convenient.

### Source contour distribution

| Source contours | Glyphs |
| ---: | ---: |
| 1 | 61 |
| 2 | 588 |
| 3 | 2,422 |
| 4 | 3,150 |
| 5 | 2,444 |
| 6 | 1,490 |
| 7 | 695 |
| 8 | 239 |
| 9 | 66 |
| 10 | 15 |
| 11 | 2 |

### Relationship to physical-step count

| Count relationship | Glyphs | Interpretation |
| --- | ---: | --- |
| contours = steps | 3,312 | **Provisional count-aligned** candidates. Still requires ownership verification; `값` is in this group and is known mixed. |
| contours < steps | 1,715 | **Contour-deficit candidates.** At least one contour must cover multiple physical steps, but this does not prove that a geometric split is necessary. |
| contours > steps | 6,145 | **Contour-surplus candidates.** Multiple source contours may need to combine into one jamo; counters are a common reason. |

This is not a partition of “easy / hard” glyphs. It is a count-only triage
signal. In particular, `값` has four steps and four contours but still contains
a mixed final contour.

Deficit severity: 1,401 glyphs are short by one contour, 286 by two, and 28 by
three. There are 47 especially compact cases with one contour and at least
three physical steps.

By physical step count, the aligned / deficit / surplus split is:

| Steps | Aligned | Deficit | Surplus |
| ---: | ---: | ---: | ---: |
| 2 | 123 | 14 | 129 |
| 3 | 1,422 | 319 | 2,648 |
| 4 | 1,397 | 1,001 | 2,656 |
| 5 | 370 | 381 | 712 |

### Representative cases

- **Simple / count-aligned:** `가` is `ㄱ / ㅏ`, with 2 contours and 2 steps.
  This was directly assigned in the PoC.
- **Verified intermediate / multi-contour ownership:** `하` is `ㅎ / ㅏ`, with
  4 contours and 2 steps. Manual inspection verified Contour 1 → `ㅏ` and
  Contours 2–4 → `ㅎ`; the latter includes the counter/hole geometry. The
  exporter combines those three source contours into `ㅎ`'s one path while
  preserving the transparent counter under `evenodd` fill. `녕`
  (`ㄴ / ㅕ / ㅇ`) has 4 contours and 3 steps, including multiple `ㅇ`
  contours.
- **Difficult / compact:** `굵` (`ㄱ / ㅜ / ㄹ / ㄱ`) has 1 contour for 4
  physical steps; `귌` (`ㄱ / ㅜ / ㅣ / ㄹ / ㅅ`) has 2 contours for 5 steps.
  They are strong review candidates, not proven split cases.
- **Known union case:** `값` (`ㄱ / ㅏ / ㅂ / ㅅ`) has 4 contours for 4 steps,
  54 source commands, and a known final `ㅂ + ㅅ` unioned contour. It proves
  count alignment is insufficient.
- **Highest observed command complexity:** `휋` (`ㅎ / ㅜ / ㅔ / ㄹ / ㅎ`) has
  10 contours and 123 commands. Other high-complexity examples include `쒫`,
  `쬟`, `쮏`, and `홿` (116–119 commands).

### Compound-final review signal

Each compound final has 399 syllables. Their count-level outcomes vary, which
is further evidence that counts cannot decide ownership or splitting:

| Compound final | Aligned | Deficit | Surplus |
| --- | ---: | ---: | ---: |
| ㄳ | 119 | 231 | 49 |
| ㄵ | 109 | 242 | 48 |
| ㄶ | 4 | 0 | 395 |
| ㄺ | 163 | 87 | 149 |
| ㄻ | 60 | 27 | 312 |
| ㄼ | 60 | 27 | 312 |
| ㄽ | 108 | 242 | 49 |
| ㄾ | 163 | 87 | 149 |
| ㄿ | 60 | 27 | 312 |
| ㅀ | 17 | 3 | 379 |
| ㅄ | 178 | 61 | 160 |

`ㅄ` is the `값` final family. Its 399 syllables are all candidates for final
`ㅂ / ㅅ` ownership review. Only 61 have a contour deficit; the remaining 338,
including count-aligned cases like `값`, demonstrate why the tagger must not
use that signal as a split verdict.

### Structural reuse

The analysis recorded 10,236 distinct ordered command-type signatures across
11,172 glyphs. The largest exact signature group contains only 9 glyphs. Raw
outline-command signatures therefore offer little global reuse: glyph-specific
layout, contour ordering, and curve/line choices vary substantially.

There are still useful **inferred** reusable families at a higher semantic
level: choseong / medial layout class / jongseong, compound-medial status,
compound-final identity, contour count, and relative contour geometry. A
future tagger should cluster using those features and reuse reviewed ownership
templates where the geometry is demonstrably compatible—not assume that an
identical jamo sequence has an identical contour partition.

## 6. What geometry can and cannot tell us

### Reliable automated facts

- The code point, modern Hangul decomposition, and Jamozy physical typing
  sequence.
- Font metrics, advance width, glyph bounds, source command stream, contour
  count, per-contour command count, and source-outline SVG path.
- Count deficit/surplus, compound-medial/final status, and exact structural
  signatures as **review priorities**.

### Heuristics and inferred candidates

- A contour deficit is a strong indication that at least one source contour
  represents multiple physical steps.
- Contour surplus suggests multiple contours may be combined under one jamo.
- Compound finals—especially `ㅄ`, the known `값` family—deserve focused
  inspection because one composed final maps to two physical typing steps.
- One-contour, 3+-step glyphs and the 1,463 compound-medial + compound-final
  glyphs should receive higher review priority.

### Not recoverable from count/topology alone

- Which jamo owns a contour.
- Whether overlapping or neighbouring geometry is a true union that needs a
  split, versus a contour that can be assigned intact.
- Where an absent internal seam should be placed without preserving the source
  outline exactly.
- Whether a contour surplus is a counter/hole, a disconnected stroke, or
  multiple jamo without examining geometry.

## 7. Scaling risks

- Manual ownership tags will be needed for ambiguous families.
- Many glyphs require multiple source contours combined into a single jamo.
- A small but material unknown subset of the 4,389 compound-final glyphs may
  need `값`-style union-contour splitting.
- Count-aligned glyphs cannot be automatically marked safe; `값` is the
  counterexample.
- Human visual verification remains necessary for any automatic split and for
  templates propagated to a new structural family.

## 8. Recommended next architecture (not implemented)

Build a development-only Jamo SVG Tagger with these layers:

1. **Extraction cache:** generate source outline, contour metadata, bounds,
   physical steps, and structural signals from the local Pretendard 600 TTF.
2. **Family queue:** prioritize compound finals, contour deficits, one-contour
   multi-step glyphs, and high-complexity outlines. Group by semantic layout
   and geometry features rather than raw command signature alone.
3. **Ownership editor:** assign one or more whole contours to each ordered
   physical step; show source, per-piece, colored, and monochrome
   reconstruction views.
4. **Explicit split editor:** create audited source-vertex/curve-preserving
   split recipes only where whole-contour ownership is impossible. Never use
   visual approximation as a fallback.
5. **Validation/export:** render all output paths in one color against the
   source glyph; export exactly one combined `d` per physical step, with review
   state and extraction fingerprint retained outside the runtime dataset.

This should use automation to propose and propagate tags, with human review of
ambiguous families. It should not attempt all-Hangul automatic path splitting
as its first implementation.

## 9. Decisions and constraints

- Do not copy third-party SVG datasets or paths.
- Generate Jamozy SVG geometry solely from the bundled Pretendard 600 font.
- Final runtime data contains one combined SVG path per ordered physical-jamo
  typing step.
- Preserve Pretendard source geometry; any split must preserve the visible
  outline exactly and be auditable.
- Prefer automation plus human review over manually authoring every syllable.
- The existing Canvas renderer remains untouched until an SVG approach is
  production-ready.

## 10. Next session checklist

- [ ] Decide the family-key and review-state schema for a dev-only tagger.
- [ ] Decide whether to cache raw extraction metadata as a generated dev
      artifact, separate from runtime SVG data.
- [ ] Prototype the ownership editor on a bounded representative queue:
      `ㅄ` finals, one-contour multi-step glyphs, and a contour-surplus family.
- [ ] Define a reconstruction comparison and review-approval workflow.
- [ ] Measure family-template reuse only after reviewed ownership data exists.
- [ ] Design, review, and implement the tagger before generating a production
      SVG dataset.
