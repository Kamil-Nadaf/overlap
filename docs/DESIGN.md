# Design direction

**Feel (updated):** storybook illustration. Parchment cards over a full-bleed painted scene, serif display type, one teal-blue accent. Not a clone of when2meet's 2005 look. The visual source of truth is the Overlap UI Theme design canvas (Home, Create, Event created, Availability grid). Match it.

**Logo/mark:** two overlapping circles (like an eclipse/Venn); the lens-shaped intersection is filled with the accent color. Wordmark "Overlap" in a geometric sans.

## Tokens (define on `:root`, override for dark; Tailwind maps to these)
| Token | Dark | Light |
|---|---|---|
| `--bg` | #0b1020 | #f7f8fc |
| `--surface` | #131a2e | #ffffff |
| `--border` | #26304d | #dfe3ee |
| `--text` | #e8ecf8 | #151a2c |
| `--muted` | #8f9bbd | #5b6684 |
| `--accent` | #7c9cff | #3b5bdb |
| `--yes` (available) | #3ddc97 | #12a76b |
| `--maybe` (if need be) | #f2c14e | #c98a00 |

Heatmap ramp: single hue (accent), 5 steps by `yes / total`; "if need be" shown as a diagonal-stripe overlay so meaning does not rely on color alone. Every heatmap cell also prints its count when zoom allows; best cell gets an outline.

## Typography
System UI stack or one webfont (e.g. Inter). Tabular numerals for times. Time labels 12px min.

## Layout
- Home: tagline, "Create event" CTA, recent events from localStorage.
- Create: single column form, live preview of the grid size.
- Event page: header (title, organizer, meeting link, zone selector) / finalized banner if set / two panes on desktop (left: **Your availability** grid, right: **Group** heatmap + best times + people list); on mobile, tabs "You" and "Group".
- Grid cells min 28px height, 44px touch target on mobile via row scaling; sticky day headers and time gutter.

## Interaction rules
- Drag paints with the active brush (Available / If need be / Erase); first cell touched decides paint vs erase for the stroke.
- Touch: long-press or brush mode toggle to avoid scroll conflict; use `touch-action: none` only on the grid while painting.
- Keyboard: arrow keys move, space toggles, shift+arrow extends.
- Unsaved-changes indicator and a clear "Save" button; autosave is off in v1 to avoid accidental overwrites.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## Accessibility
- Cells are buttons with `aria-label` like "Tue 3 Nov 14:00, 4 of 6 available".
- Color contrast AA; non-color cues (stripes, counts).
- Focus rings visible; dialogs trap focus.

## Storybook theme and swappable scenes (v2, overrides the token table above where they differ)
- Fonts: Cormorant Garamond (display, 500/700/italic) and Alegreya Sans (UI, 400/500/700).
- Parchment `#f6ead0` (cards at 93% opacity), field `#fbf3df`, border `#c9b48a`, ink `#2b2118`, muted ink `#6b5a44`, accent teal-blue `#35617a` (pressed edge `#24485c`).
- Availability: available `#8fb35e` with a check mark; if-need-be amber diagonal stripes with a question mark. Heat ramp `#fbf3df #e3ecc2 #c3d98f #9bbd62 #6f9b3f #4a7a2a`, counts printed in each cell.
- Every screen = scene image (`object-fit: cover`) + optional night overlay `rgba(10,18,40,.5)` + parchment cards. Cards must stay readable on any scene.
- **Scene system**: `src/themes/scenes.ts` lists `{id, name, src, position}`. Active scene id and night flag live in `localStorage` (try/catch). A round-thumbnail "Scene" dock sits at the bottom of every screen. "+ Your image" lets a user pick a local image (stored as object URL / data URL in IndexedDB) or paste an image URL. Default scenes ship in `public/scenes/`. Swapping the background must never require code changes.
- Image rights: the six starter scenes in the design canvas are reference art. Before the site goes public, replace them with images you own or that are licensed for reuse.
