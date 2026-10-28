# Accessibility

Expenser is built to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) at **level AAA** wherever a web application can. This page says what that means in practice, which success criteria are met, which are only partly met, and what has and has not been tested.

> **A note on "AAA".** The W3C itself says that level AAA cannot be met for every kind of content, and does not recommend it as a blanket requirement. So this page does not claim "AAA conformant". It lists each AAA criterion and its status, so you can see exactly where the app stands.

## What was tested

| How                                  | What it covers                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run a11y` (automated, in Chrome) | [axe-core](https://github.com/dequelabs/axe-core) with the WCAG 2.0, 2.1 and 2.2 rules at A, AA and AAA, on every page, in light and dark, at desktop and phone width; plus 44 px targets, 14 px text, line spacing, line length and reflow. |
| Keyboard, in the same run            | Skip link, focus after navigation, the Back button, a visible and unobscured focus ring on every stop, the confirm dialog (focus trap, Escape, focus return), announcements, the mobile menu. |
| Reflow, in the same run              | 320 px wide, 200 % text size, and the WCAG 1.4.12 text-spacing override: no horizontal scrolling on any page.                         |
| Windows high contrast, reduced motion | Emulated in the same run.                                                                                                            |
| `node scripts/a11y/contrast.mjs`      | Every colour token against every background it is used on, in both themes.                                                           |

**Not tested:** real screen readers (NVDA, JAWS, VoiceOver, TalkBack), speech control, switch devices or magnification software. Automated checks and keyboard tests find a lot, but not everything: please test with the assistive technology you use and [report what you find](#known-gaps).

## Level AAA criteria

| Criterion | Status | How |
| --------- | ------ | --- |
| **1.4.6** Contrast (Enhanced) | Met | Text is at least **7:1** against every background in both themes; checked by `contrast.mjs` and by axe on the rendered pages. |
| **1.4.8** Visual Presentation | Mostly met | Line spacing is 1.5 or more, paragraphs are at most 80 characters wide (40 for Japanese and Chinese), no text is justified, and text reflows at 200 %. Foreground and background colours can only be chosen as light, dark or the system theme, not freely. |
| **1.4.9** Images of Text (No Exception) | Met | There are no images of text; icons are SVG and carry no text. |
| **1.3.6** Identify Purpose | Met | Regions are real landmarks (banner, navigation, main) and controls have names. |
| **2.1.3** Keyboard (No Exception) | Met | Everything works with the keyboard. |
| **2.2.3** No Timing, **2.2.4** Interruptions, **2.2.6** Timeouts | Met | There are no time limits or interruptions. Demo data is deleted after a week of inactivity, and Settings says so. |
| **2.3.2** Three Flashes, **2.3.3** Animation from Interactions | Met | Nothing flashes. Motion is switched off when the system asks for reduced motion. |
| **2.4.8** Location | Met | The page is in the URL (`#/expenses`), in the tab title, and marked in the menu with a bar, bold text and `aria-current`. The Back button works. |
| **2.4.9** Link Purpose (Link Only) | Met | Link text says where it goes. |
| **2.4.10** Section Headings | Met | Every page has one `h1`, and each section has an `h2` (some are visually hidden). |
| **2.4.12** Focus Not Obscured (Enhanced) | Met | The sticky header never covers a focused control, and the confirm dialog is modal so nothing behind it can take focus. |
| **2.4.13** Focus Appearance | Met | A 3 px outline, offset 2 px, at least 3:1 against the page, cards and hover colours. |
| **2.5.5** Target Size (Enhanced) | Met | Every button, link, field and summary is at least 44 × 44 px (verified on every page). |
| **2.5.6** Concurrent Input Mechanisms | Met | Mouse, touch and keyboard all work at once. |
| **3.1.3** Unusual Words | Met | A Help and glossary page explains the financial terms, and pages that use them link to it. |
| **3.1.4** Abbreviations | Partly met | The glossary spells out APR, CSV and JSON. Currency codes (USD, SEK…) in drop-downs are not individually expanded; Settings shows the full names next to them. |
| **3.1.5** Reading Level | Partly met | The glossary and help text are written in plain language, but the reading level is not measured, and the translations have not been reviewed by native speakers. |
| **3.2.5** Change on Request | Partly met | Nothing opens or moves on its own. Language, theme and currency in Settings change the page as soon as you pick them (Settings says so); the category drop-downs save immediately. |
| **3.3.5** Help | Mostly met | The form fields have short help text read out with the field. The quick "deposit" and "record payment" forms on goals and debts do not. |
| **3.3.6** Error Prevention (All) | Met | Deleting anything, restoring a backup and deleting all data ask first, in a dialog; adding or changing data can be undone by editing or deleting it. |
| **3.3.9** Accessible Authentication (Enhanced), **2.2.5** Re-authenticating | Not applicable | There is no sign-in. |
| **1.2.6 – 1.2.9**, **1.4.7**, **3.1.6** | Not applicable | There is no audio or video, and no ambiguous pronunciation. |

Levels A and AA: the same checks find no failures, including for 1.4.1 (colour is never the only cue: the chosen option has a border and bold text, the current page has a bar), 1.4.10 reflow, 1.4.12 text spacing, 2.4.1 (skip link), 2.4.2 (page titles), 2.4.3 (focus moves to the page after you navigate), 2.5.8 (target size) and 4.1.3 (a live region announces "Saved." and "Deleted."). That is a result of automated and keyboard testing, not a formal audit.

## How it is built

- **Colour.** Tokens in `src/index.css`, defined once with `light-dark()`. The comment there lists the pairs that must stay at 7:1; `scripts/a11y/contrast.mjs` enforces it.
- **Shared components.** `Button`, `SecondaryButton`, `DangerButton`, `IconButton`, `LinkButton` and `ChipButton` are all 44 px minimum. `Field` and `AmountField` tie each label and hint to its input. `ConfirmToast` is a modal `<dialog>`.
- **Navigation.** `src/lib/route.ts` keeps the page in the URL hash. `AppLayout` sets the title, moves focus to the page after you navigate, and owns the live region that announces saves (the API helper fires an event after each change).
- **Not clipped.** Long titles wrap instead of being cut off with an ellipsis.

When you add something, keep to the same pieces: use the shared buttons and fields, add a hint to new form fields, give a new progress bar a name, add new words to the glossary, and run `npm run a11y`.

## Known gaps

- The header has an "Account" button that does nothing yet (a placeholder for future accounts). It has a name and a 44 px target but no action.
- Drop-downs, date pickers and file pickers are the browser's own controls, so how well they work depends on the browser and assistive technology.
- Category names you type are shown as typed and are not marked with their own language (3.1.2).
- Japanese, Chinese and Swedish text was not written or reviewed by native speakers.

## Reporting a problem

Open an issue on the project's repository and say which page, what you were trying to do, and which browser and assistive technology you use.
