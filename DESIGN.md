---
name: 5n7.me
description: Shunta Komatsu's professional profile and published work.
colors:
  background: "#ffffff"
  text: "#24272d"
  body: "#454950"
  muted: "#686d75"
  line: "#e6e8eb"
  link: "#295a9f"
  selection: "#e2ebf8"
  dark-background: "#181a1d"
  dark-text: "#edeef0"
  dark-body: "#c1c5cb"
  dark-muted: "#a0a6af"
  dark-line: "#30343a"
  dark-link: "#9bbdf0"
  dark-selection: "#2c405c"
  print-text: "#000000"
  print-body: "#222222"
  print-muted: "#444444"
  print-line: "#cccccc"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  name: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.035em" }
  name-narrow: { fontSize: "1.375rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.035em" }
  section: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.02em" }
  title: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 }
  employer: { fontSize: "1.0625rem", fontWeight: 600, lineHeight: 1.4 }
  role: { fontSize: "1rem", fontWeight: 500, lineHeight: 1.4 }
  intro: { fontSize: "1.0625rem", fontWeight: 400, lineHeight: 1.85 }
  intro-narrow: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.8 }
  description: { fontSize: "0.9375rem", fontWeight: 400, lineHeight: 1.75 }
  label: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.75 }
  metadata: { fontSize: "0.8125rem", fontWeight: 400 }
  publication: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.7 }
  publication-ja: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.85 }
  footer: { fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.75 }
  print-body: { fontSize: "10pt", fontWeight: 400, lineHeight: 1.75 }
  print-intro: { fontSize: "10pt", fontWeight: 400, lineHeight: 1.6 }
rounded:
  focus: "2px"
  avatar: "50%"
spacing:
  inline: "0.5rem"
  detail: "0.75rem"
  row: "1rem"
  group: "1.5rem"
  section: "2rem"
  employer: "2.5rem"
  section-gap: "3.5rem"
components:
  theme-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.metadata}"
    padding: "0"
  theme-toggle-hover: { textColor: "{colors.text}" }
  theme-toggle-pressed: { textColor: "{colors.text}" }
  navigation-link:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  navigation-link-interactive: { textColor: "{colors.text}" }
  current-work: { typography: "{typography.label}" }
  experience-entry: { textColor: "{colors.body}" }
  publication-link:
    textColor: "{colors.link}"
    typography: "{typography.publication}"
  contact-row: { typography: "{typography.description}" }
---

# Design system: 5n7.me

## Overview

Creative North Star: "Readable professional profile"

The portfolio uses system typography, open lists, and a small corgi illustration.
Headings and spacing distinguish the factual record. Blue identifies links;
muted text identifies dates and supporting details. Reading content stays still.
The corgi avatar makes one full turn on hover.

Key characteristics:

- A shared page background behind the profile and content.
- Plain text entries with visible section rules.
- Native links and document navigation.
- Equivalent content in light, dark, mobile, and print layouts.

This document records `src/styles/portfolio.css` and the rendered patterns in
`src/pages/index.astro` and `src/components/`. The frontmatter owns token values;
the CSS is the source of truth when the two disagree.

## Colors

The light theme uses white, charcoal text, gray metadata, and blue links. The
dark theme maps each role to its `dark-` token. `text` applies to headings and
the introduction, `body` to descriptions, `muted` to supporting text, and `line`
to section dividers. Selection pairs `selection` with `text`.

Links use `link`. Publication and contact underlines use
`color-mix(in srgb, var(--link) 30%, transparent)` and become `currentColor` on
hover. Underlines are 1px thick with a 0.2em offset.

Print uses `background`, `print-text`, `print-body`, `print-muted`, and
`print-line`. Printed links use `print-text` and have no underline.

## Typography

Every role inherits the system font stack in `typography.body`. There are no
downloaded fonts. The name uses `name`, section headings use `section`, and
company headings use `employer`. Experience and award titles use `role`;
education and research headings use `title`. Research paper titles use the
publication size and line height, with regular weight.

The introduction uses `intro` and a 70ch maximum width. Entry descriptions use
`description` and a 72ch maximum width. Profile roles use `label` with a 1.7 line
height. Publication metadata also uses a 1.7 line height; experience periods
and the theme control inherit a 1.75 line height. Dates use tabular numerals.
Current and side-role notes use italics.

Japanese text retains `lang="ja"`, strict line breaking, and wrapping anywhere.
Japanese publication titles use `publication-ja`. At the narrow breakpoint,
the name and introduction use their `-narrow` variants. Personal and contact
rows reduce from `description` to `label`.

## Layout

| Viewport      | Page layout                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Above 960px   | Centered 68rem maximum width, a 13rem profile column, a flexible content column, and a 5rem column gap. Padding is 4.5rem 2.5rem 2rem.       |
| At most 960px | One column, 46rem maximum width, and a 2rem gap. Top padding becomes 2.5rem. The avatar sits beside the name; navigation wraps horizontally. |
| At most 480px | Page padding is 1.5rem 1.25rem. Entry headings stack, and current-work details sit below their roles.                                        |

The profile sticks 3rem from the top only when the viewport is at least 961px
wide and 760px tall; it then spans the footer row so it stays pinned to the page
bottom. Otherwise it stays in document flow.

Sections have a 1px top rule, `section-gap` top margin, and `section` top
padding. Narrow screens use 2.75rem margin and 1.75rem padding. Entries have a
`group` gap; company groups have an `employer` gap. The footer sits outside
`main` under the content column, with a 4rem top margin (2rem plus the row gap
in one column) and `group` top padding. Anchor destinations have 2rem scroll
clearance.

Print uses a full-width block layout without page padding or a sticky profile.
The avatar, navigation, theme control, skip link, and footer are hidden. Body
and introduction text use the print typography tokens. Sections use 1.5rem top
margin and 1rem top padding. Headings avoid a following page break; experience,
education, publication, and award entries avoid internal page breaks.

## Elevation & Depth

The page has no shadows, gradients, or elevated containers. Spacing and section
rules separate groups. The keyboard skip link uses `z-index: 10` so it remains
visible when focused.

## Shapes

The corgi avatar is circular and measures 4.5rem square, or 3.5rem square at the
single-column breakpoint. The illustration is the existing `/profile.webp`.
The focus outline has the `focus` radius. Content entries have no enclosing
border or panel background.

## Components

- The avatar keeps its original size and spacing. On devices that support
  hover, it rotates 360 degrees once over 800ms. Moving the pointer away stops
  the animation and restores the resting position. The wrapper stays still,
  so the hover area does not move. Reduced motion disables the effect. The
  interaction uses CSS, with no button or script.
- Navigation uses native section anchors with muted text. Hover and keyboard
  focus apply the heading color and an underline. Link height is at least
  2.25rem on desktop and 2.75rem in the wrapping layout. Mobile navigation has
  top and bottom rules, 0.5rem vertical padding, and a 1.25rem column gap.
- The theme toggle has a 16px moon icon, a 0.5rem gap, and a 2.75rem minimum
  height. It has no border or background. Hover and the pressed state use the
  heading color. `aria-pressed` identifies dark mode; the control stays hidden
  until its script initializes. It precedes the navigation in source order so
  focus order matches its single-column position beside the location.
- Current work is a definition list with a 3rem label column and 0.75rem column
  gaps. Rows have a 0.375rem gap, increasing to 0.75rem on narrow screens.
- Experience entries place the role and date on one baseline when space
  permits. Dates wrap, descriptions follow after 0.5rem, and roles group under
  their company heading. Writing and talks use linked titles above wrapping
  venue, date, and optional supporting text.
- The Experience heading includes a small "Full work history on LinkedIn"
  link using the existing profile URL. The heading and link wrap when needed.
- Personal and contact rows use a 6.5rem label column and a 1rem gap. Narrow
  screens use a 5.5rem label column and a 0.75rem gap. Contact links have 0.5rem
  vertical padding and can wrap anywhere.

Theme selection uses `data-theme` and persists under the `theme` storage key.
A stored choice applies before the first paint. Without a choice, the page
follows the system theme, including changes while open. Storage events sync
other tabs. Selection still works when storage is unavailable; CSS supplies
the system theme when JavaScript is unavailable. Print always uses light colors.

Keyboard focus uses a 2px solid link-colored outline with a 5px offset. The skip
link appears on focus and targets the focusable main region. Keep the contents
navigation label, section headings, descriptive image alternative, and native
button semantics. HTTP contact and publication links open in a new tab with
`rel="noopener"`.

## Do's and Don'ts

- Do use the existing color roles in both screen themes.
- Do preserve complete titles and descriptions when text wraps.
- Do retain native anchors, visible keyboard focus, and the print layout.
- Don't replace the system font stack or add decorative type treatments.
- Don't turn the existing text entries into cards or badges.
- Don't animate the reading content or play reactions automatically.
- Don't add floating hearts to the avatar interaction.
