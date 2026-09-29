# Light Theme UI Consistency Design

**Date:** 2026-09-29  
**Status:** Pending user review before implementation

## Goal

Bring every existing non-Home interface into the warm, calm, pastel visual
language established by the Home page. The resulting app should feel like one
cohesive Jamozy experience without changing learning behaviour, routes,
loaders, actions, domain models, repository selection, or Firebase access.

## Scope

The implementation covers these existing UI surfaces:

- Course map
- Lesson preview, active typing session, and lesson completion result
- Review preview, active typing session, and review completion result
- Profile
- Settings
- Authentication modal
- Virtual Korean keyboard
- Route-error and not-found pages

It also adds reusable UI-only primitives for modal, dropdown, snackbar, and
the repeated visual surface treatments.

## Explicit exclusions

- Dark-theme implementation or changes to the persisted `theme` setting
- Animation or motion additions
- Changes to typing, learning, review, authentication, session, or loader
  logic
- Firebase, repositories, data models, schemas, and application use cases
- New assets or dependencies

## Visual system

The light theme is the Home page's current visual contract:

- Warm cream page background with restrained blush and sage ambient shapes.
- Ink-navy primary text, muted blue-grey supporting text, and terracotta
  accent text/actions.
- White/ivory cards with warm borders, soft low-contrast shadows, and generous
  rounded corners.
- Pastel lilac, peach, sage, and butter-yellow accents used to distinguish
  information without signalling competition or urgency.
- Clear keyboard focus states using the existing terracotta focus colour.

`public/templates` contains logo and icon variants only, not scenery art. The
implementation will use the appropriate Jamozy logo variant in branded empty
and error states; the existing mascot image remains an occasional welcoming or
success accent, never a required content-bearing image.

## UI component boundaries

New components will live in `src/components/ui/` and remain presentation-only.

| Component | Responsibility | Does not own |
| --- | --- | --- |
| `PageSurface` | Common cream page canvas, ambient decoration, constrained content width, and optional back navigation slot | Route data, user/session data, or navigation decisions |
| `Card` / `Button` | Consistent rounded surfaces and action variants | Fetching, submission, or disabled-state policy |
| `Modal` | Accessible backdrop, labelled dialog container, close affordance, and composed dialog content | Authentication state or form submission |
| `Dropdown` | Accessible, styled select control with label/error support | Settings values or persistence |
| `SnackbarProvider` + `useSnackbar` | One rendered notification region and imperative presentation API | Fetcher state and business outcome decisions |

The provider wraps the router in `main.tsx`, so every route and the auth modal
can publish an ephemeral notification without passing callback props through
the routing tree. It will expose success and error variants; no notification
history is persisted.

## Page adaptation

- **Course map:** course heading becomes a calm hero/header card. Units become
  expandable rounded cards; lesson status is presented with pastel state pills
  and locked/unlocked/completed icons while preserving its current link and
  disclosure behaviour.
- **Lesson and review:** previews use calm cards, clear numbered/progress
  indicators, and a primary terracotta action. Active typing uses a focused
  ivory practice panel; correct/current/pending characters use the pastel
  success/accent/neutral palette. Completion presents results as friendly
  metric cards with the existing navigation actions unchanged.
- **Virtual keyboard:** keys, shift indicator, and highlighted next key use
  the shared card/border palette while retaining the exact keyboard settings
  and key-mapping behaviour.
- **Profile:** level/progress becomes a gentle progress card; learner metrics
  become responsive pastel statistic cards.
- **Settings:** settings are grouped into labelled cards; select elements use
  the shared dropdown. The existing native checkbox/range semantics and all
  setting fields remain unchanged.
- **Auth modal:** the existing auth form is rendered inside the shared modal
  and uses shared inputs/buttons. Its intent switching and submits remain
  unchanged.
- **Error and not-found:** compact branded recovery cards use a public Jamozy
  logo asset and retain their existing text semantics.

## Snackbar behaviour

Only these current UI outcomes publish notifications:

| Surface | Success | Failure |
| --- | --- | --- |
| Settings | `Settings saved` after the existing fetcher completes successfully | `Could not save settings` from a structured UI error result |
| Auth modal | A concise sign-in/account-created success message before the modal closes | The existing auth failure message in an error snackbar, while retaining visible form feedback |
| Home sign out | `Signed out successfully` after the current action completes | A concise error message if the current action reports failure |

Lesson/review completions intentionally do not use snackbars: their dedicated
completion pages already convey the outcome. The snackbar is visually
non-blocking, has a `role=status` or `role=alert` appropriate to its variant,
and is dismissible. It does not rely on animation.

## Data flow and safety

Page components continue to own their existing `useLoaderData`, `useFetcher`,
and local visual state. They translate already-observed fetcher outcomes into
calls to the snackbar hook only. UI primitives receive props and callbacks;
they make no calls to Firebase, repositories, use cases, or browser storage.
The Settings action is the sole outcome-shape exception: it will catch its
existing persistence error and return a structured UI error result so the page
can show the requested snackbar. Its validation, repository call, and write
semantics are unchanged.

This keeps the established dependency direction intact:

```text
Route page / auth modal -> shared presentation component or snackbar hook
Route page / auth modal -> existing loader/action/fetcher path
```

## Testing

- Preserve the existing page and action/loader test suites.
- Add focused component tests for modal accessibility, dropdown selection, and
  snackbar announcements/dismissal.
- Extend settings and authentication/Home action-facing UI tests to verify the
  notification shown for their existing successful and failed outcomes.
- Run `pnpm test`, `pnpm lint`, and `pnpm build` after implementation.

## Acceptance criteria

1. All listed surfaces use the Home page's light visual language at desktop
   and mobile sizes.
2. Shared modal, dropdown, and snackbar components are used instead of
   reimplementing those patterns in individual pages.
3. Snackbars appear only for Settings and authentication/sign-out outcomes.
4. Existing learning, review, auth, persistence, and routing behaviour is
   unchanged.
5. No animation, dependency, or dark-theme work is introduced.
