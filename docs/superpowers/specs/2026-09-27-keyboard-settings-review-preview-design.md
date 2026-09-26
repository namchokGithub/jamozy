# Keyboard Settings and Review Preview Design

## Goal

Make the three keyboard preferences affect both interactive typing flows, and
make the Review preview show the same optional vocabulary context as the Lesson
preview.

## Scope

In scope:

- `showKeyboard`, `showEnglishKeys`, and `keyboardOpacity` in both lesson and
  review typing sessions.
- A `keyboardOpacity` default of `0.7` for newly created user profiles. Saved
  user settings remain unchanged.
- Romanization and selected meaning language in the Review preview list.
- A review-preview application read model that resolves a review item's source
  exercise through repository interfaces.
- Tests and progress documentation for the shipped behavior.

Out of scope:

- Sound behavior and dark mode.
- Showing meaning or romanization while a review session is actively typing.
- Changing persisted `ReviewItem` data or migrating Firestore documents.
- Changing review scheduling, answer submission, or lesson behavior unrelated
  to the keyboard guide.

## Existing Constraints

- React components must not access Firebase directly. Route loaders call
  application functions; application functions use domain repository
  interfaces.
- Persisted data remains in loaders, not Zustand. The existing Zustand store
  remains responsible only for in-progress typing state.
- Keyboard preferences use the existing `UserSettings` fields and take effect
  when a route loader has loaded the settings; a Settings-page save does not
  live-update an already mounted typing session.
- The Korean target text is always shown in a Review preview, even when source
  lesson metadata cannot be resolved.

## Design

### Keyboard guide

`VirtualKeyboard` gains explicit presentation props for English key-label
visibility and opacity. Its callers continue to provide the next key. The
lesson and review typing-session components decide whether to mount the
keyboard at all using `showKeyboard`, then pass through the other two values.

The default keyboard opacity changes from `1` to `0.7`, matching the calm
learning-keyboard direction. It applies only through `defaultUserProfile` for
new profiles; existing persisted settings are not migrated or overwritten.

`LessonDetailPage` already loads settings, so it passes them into its typing
session after the user starts. `ReviewPage.loader` will load settings together
with due review items, and `ReviewPage` passes them to its typing session.
This keeps settings data route-owned and avoids a new client-side global store.

### Review preview read model

Add a focused application function that accepts due `ReviewItem`s and a
`LessonRepository`. It deduplicates `sourceLessonId`s, fetches those lessons in
parallel via `getLessonById`, and matches each item's `sourceExerciseId` to an
exercise. Its output preserves the original review item and supplies optional
exercise metadata.

The function never removes an item because a referenced lesson or exercise is
missing. The UI retains `ReviewItem.targetText` as the canonical fallback and
omits only unavailable romanization/meaning. This supports current data without
requiring a Firestore schema migration and keeps the join out of the UI.

`ReviewPage.loader` first authenticates, then fetches due items and settings in
parallel; it resolves previews only after the due-item result is available. The
page renders optional metadata using the existing meaning formatter and the
same settings semantics as `LessonDetailPage`.

### Error behavior

Failures reading settings, review items, or lessons retain the established
route-error behavior. A successful lesson query that returns `null`, or an
exercise that is absent from an existing lesson, is ordinary incomplete source
data and produces a Korean-only preview rather than an error.

## Testing and Verification

- Test `VirtualKeyboard` with English labels hidden and with a custom opacity.
- Test that a newly created default profile starts with `keyboardOpacity: 0.7`.
- Test both typing-session consumers so `showKeyboard` controls whether the
  keyboard is mounted and the remaining settings reach it.
- Test the new application read model for joined metadata, one fetch per unique
  lesson id, and missing lesson/exercise fallback.
- Test the Review loader returns settings and enriched previews.
- Test Review preview rendering for enabled/disabled romanization and selected
  meaning language, including metadata fallback.
- Run focused tests during TDD, then `pnpm test`, `tsc -b`, and `pnpm lint`.
- Update `docs/PROGRESS.md` and `docs/COMPLETE-LOG.md` with the completed
  settings consumers and Review-preview behavior.
