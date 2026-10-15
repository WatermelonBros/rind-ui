# Assistive technology & accessibility testing — research

Status: done · Cross-cutting (read before every component note; see [CLAUDE.md](../../CLAUDE.md))

Two parts. **Part 1** shows how screen readers (SR) and browsers actually behave,
using the bug history of ten headless libraries. **Part 2** covers what each
accessibility testing tool can and cannot prove, and where rind-ui uses each one.
Part 2 ends with the list of generic invariants that `testMachine` checks
automatically.

Method (2026-10-14). `gh search issues` over adobe/react-spectrum, radix-ui/primitives,
chakra-ui/zag, chakra-ui/ark, mui/base-ui, tailwindlabs/headlessui,
ariakit/ariakit, unovue/reka-ui, huntabyte/bits-ui and kobaltedev/kobalte. Terms:
VoiceOver, NVDA, JAWS, TalkBack, "screen reader", iOS, Safari, Firefox,
aria-activedescendant, aria-hidden, "accessible name", announce, "live region",
"high contrast", forced-colors. That gave about 1,100 hits; about 300 were relevant
to accessibility, and about 110 were read in full. I also grepped the local
clones for comments that name an AT or a browser bug: Base UI, Kobalte and
Ariakit document their workarounds in comments. On top of that I read the React
Spectrum [external browser bug tracker](https://github.com/adobe/react-spectrum/wiki/Tracker-for-External-Browser-Bugs,-Library-Bugs,-and-Features), the WebAIM survey and current
tool docs.

Abbreviations: **RA** React Aria/Spectrum · **RX** Radix · **ZG** Zag · **ARK** Ark ·
**BU** Base UI · **HUI** Headless UI · **AK** Ariakit · **RK** Reka · **BITS** Bits UI ·
**KB** Kobalte · **VO** VoiceOver · **SR** screen reader · **AX tree** accessibility tree.

## Summary

1. **Most SR bugs are not ARIA mistakes.** The usual cause is a mismatch between
   what the library assumes an AT does and what it really does. The assumption is
   usually "keys arrive as keydown", "focus means keyboard" or "the AX tree
   updates synchronously". Section 1.2 lists twelve recurring root causes; nearly
   every issue read fits one of them.
2. **Three causes do most of the damage:**
   (a) an SR "press" sends a `click` with `detail: 0` and no pointer or key events
   ([BITS#2185](https://github.com/huntabyte/bits-ui/issues/2185), [RX#2700](https://github.com/radix-ui/primitives/issues/2700), [ZG#1664](https://github.com/chakra-ui/zag/issues/1664));
   (b) VoiceOver does not reliably follow `aria-activedescendant`
   ([ZG#2936](https://github.com/chakra-ui/zag/issues/2936), [RA#10326](https://github.com/adobe/react-spectrum/issues/10326), [BU#5721](https://github.com/mui/base-ui/issues/5721));
   (c) the techniques that hide everything outside a layer (`aria-hidden`, `inert`)
   also hide live regions, labels and portals that should stay exposed
   ([RX#1820](https://github.com/radix-ui/primitives/issues/1820), [RA#9737](https://github.com/adobe/react-spectrum/issues/9737), [RX#4115](https://github.com/radix-ui/primitives/issues/4115), [ARK#3728](https://github.com/chakra-ui/ark/issues/3728)).
3. **Many reports are AT regressions or tester setup**, not library bugs. Examples:
   Safari 26 VO focus ([RA#9814](https://github.com/adobe/react-spectrum/issues/9814), [RA#10641](https://github.com/adobe/react-spectrum/issues/10641)), a 2020 NVDA
   ([RA#10081](https://github.com/adobe/react-spectrum/issues/10081)), VO "Arrow-key Quick Nav" left on ([BU#4954](https://github.com/mui/base-ui/issues/4954)),
   VO settings reset ([RK#2521](https://github.com/unovue/reka-ui/issues/2521)). A manual protocol needs pinned AT
   versions and reset settings, and has to compare against the APG example and
   the native control before blaming our code.
4. **Target matrix**, from WebAIM survey #11 (2026): JAWS + Chrome/Edge,
   NVDA + Chrome/Firefox, VO + Safari (macOS and iOS), TalkBack + Chrome. We state
   it publicly, as RA does. VO + Firefox is out of scope.
5. **Automated tools catch a minority of issues.** axe-core finds 57% of issues by
   volume in Deque's own study, 29% of the barriers in the GOV.UK audit, and about
   23% in Evinced's sample. None of the tools in Part 2 can see the class-2 bugs
   above. rind-ui closes part of that gap with **behavioural invariants run on
   every model-test step** and a **"virtual" input modality** that fires bare
   `click` / `focus()`. Real SR automation (Guidepup) runs nightly; a manual
   matrix gates releases.

---

# Part 1 — Assistive technology & browser quirks

## 1.1 Support matrix

WebAIM Screen Reader User Survey #11 ([results](https://webaim.org/projects/screenreadersurvey11/), survey July–August 2026,
1,780 responses, published 2026-09-29), compared with #10 ([results](https://webaim.org/projects/screenreadersurvey10/),
Dec 2023–Jan 2024, 1,539 responses):

| Primary desktop SR | #11 (2026) | #10 (2024) |
|---|---|---|
| JAWS | 55.0% | 40.5% |
| NVDA | 32.9% | 37.7% |
| VoiceOver (macOS) | 6.5% | 9.7% |
| ZoomText/Fusion | 2.1% | 2.7% |
| Orca | 1.4% | 2.4% |

| SR + browser combination | #11 | #10 |
|---|---|---|
| JAWS + Chrome | 31.2% | 24.7% |
| NVDA + Chrome | 17.3% | 21.3% |
| JAWS + Edge | 17.0% | 11.4% |
| NVDA + Firefox | 9.1% | 10.0% |
| NVDA + Edge | 5.4% | 5.0% |
| JAWS + Firefox | 5.0% | 2.6% |
| VoiceOver + Safari | 4.3% | 7.0% |
| VoiceOver + Chrome | 1.6% | 2.0% |

Mobile SR, commonly used (multi-select): VoiceOver 72.2%, TalkBack 29.5% (#11).
WebAIM warns that the sample is not controlled, so treat the JAWS jump as a
signal, not a fact.

React Aria's published support list ([quality page](https://react-aria.adobe.com/quality)): VO + Safari/Chrome
(macOS), JAWS + Firefox/Chrome, NVDA + Firefox/Chrome, VO iOS, TalkBack + Chrome.
RA has declined VO + Firefox because of "historical compatibility issues"
([RA#10202](https://github.com/adobe/react-spectrum/issues/10202)). AK only answers for "the three major screen readers" and
not for Narrator ([AK#3377](https://github.com/ariakit/ariakit/issues/3377)). Users have asked AK twice to publish which
SR versions it tests ([AK#399](https://github.com/ariakit/ariakit/issues/399), [AK#4027](https://github.com/ariakit/ariakit/issues/4027), citing
[Roselli](https://adrianroselli.com/2022/11/your-accessibility-claims-are-wrong-unless.html)).

**rind-ui target:**

| Tier | Combination | Why | How tested |
|---|---|---|---|
| 1 | JAWS + Chrome, NVDA + Chrome | 48.5% of desktop users | release checklist (manual), Guidepup NVDA nightly |
| 1 | NVDA + Firefox | 9.1%; Firefox has its own AX API mapping, and many click/role quirks show up only here | release checklist |
| 1 | VO + Safari macOS, VO + Safari iOS | VO is most of mobile; WebKit causes the most quirks | release checklist, Guidepup VO nightly |
| 1 | TalkBack + Chrome Android | 29.5% mobile; pointer-event and slider quirks | release checklist (real device) |
| 2 | JAWS/NVDA + Edge, VO + Chrome, JAWS + Firefox, Narrator + Edge | Edge is Chromium, so it is mostly covered by tier 1 | on bug report |
| — | VO + Firefox, Orca | small user base and known AT/browser bugs | issues accepted; no guarantee |

Each component docs page gets a generated **"Tested with"** table: AT version +
browser version + date of the last manual pass, which is what AK#4027 asked for.

## 1.2 Recurring root causes

Every finding below has a symptom, a root cause, a fix that worked, and links.
The per-AT and per-pattern sections (1.3, 1.4) refer back to these by letter.

### A. An SR "press" is a bare `click`

- **Symptom.** A trigger works with Tab + Enter but not with VO+Space, NVDA browse
  mode Enter, or a TalkBack/iOS VO double-tap. Seen in [RX#1963](https://github.com/radix-ui/primitives/issues/1963) (VO+Space
  in Safari/Firefox), [RX#2700](https://github.com/radix-ui/primitives/issues/2700) (NVDA + Firefox browse mode),
  [BITS#1760](https://github.com/huntabyte/bits-ui/issues/1760), [BITS#2185](https://github.com/huntabyte/bits-ui/issues/2185), [ZG#1664](https://github.com/chakra-ui/zag/issues/1664) (combobox
  `onPointerUp`), [HUI#62](https://github.com/tailwindlabs/headlessui/issues/62) (menu items on iOS VO).
- **Root cause.** The AT activates the element through the platform AX API, not
  through the keyboard. WebKit's `AccessibilityObject::press()` dispatches
  `mousedown`/`mouseup`/`click` with `detail: 0` and **no pointer events**
  (BITS#2185 cites the WebKit source). Firefox's AX activation "always appears as
  a click event" (RX#2700). NVDA/JAWS in browse mode also synthesize a click.
  Chrome sends a 1×1, zero-pressure `pointerdown` with `pointerType: "mouse"`
  ([RA#10310](https://github.com/adobe/react-spectrum/issues/10310) (open); BU `floating-ui-react/utils/event.ts`). TalkBack
  sends pointer events but no key events ([RA#2561](https://github.com/adobe/react-spectrum/issues/2561), chromium 1271444 on
  the [RA tracker](https://github.com/adobe/react-spectrum/wiki/Tracker-for-External-Browser-Bugs,-Library-Bugs,-and-Features)).
- **Fix.** Put activation on `click`, never on `pointerdown`/`pointerup` alone.
  If a trigger opens on `pointerdown` for speed, it also needs a `click` handler
  that opens when no pointerdown came first. Detect "virtual" clicks
  (`detail === 0 && !pointerType`, plus the 0×0 / 1×1 / iOS `<1` width pointer
  heuristics in BU `isVirtualPointerEvent` and KB `is-virtual-event.ts`) and treat
  them like keyboard opens (focus the first item, open synchronously; see BU
  `useClick.ts`). Expect the heuristics to be imperfect: RA#10310 shows JAWS/NVDA +
  Chrome clicks that cannot be told apart from a mouse.

### B. VoiceOver ignores `aria-activedescendant` changes

- **Symptom.** In a combobox, arrowing moves the visual highlight but VO says
  nothing, or says it late. [ZG#2936](https://github.com/chakra-ui/zag/issues/2936), [RA#10326](https://github.com/adobe/react-spectrum/issues/10326) (open, Safari
  26.4/26.5), [BU#5721](https://github.com/mui/base-ui/issues/5721) (open), [HUI#3593](https://github.com/tailwindlabs/headlessui/issues/3593), [HUI#2736](https://github.com/tailwindlabs/headlessui/issues/2736),
  [RK#1978](https://github.com/unovue/reka-ui/issues/1978), [AK#1647](https://github.com/ariakit/ariakit/issues/1647).
- **Root cause.** A WebKit/VO limitation. AK puts it plainly: "Safari doesn't
  support aria-activedescendant on combobox elements"
  (`combobox-store.ts`). On touch, moving the VO cursor through options always
  sends focus back to the input.
- **Fix.** (1) Apple platforms: announce the highlighted option through a
  polite live region ("Apple, 1 of 6", plus "selected"). RA `useComboBox` does
  this, and so do KB `combobox-base.tsx` and ZG's fix for #2936. Also announce the
  option count on open and the selection on commit, because VO does not do it on
  its own (KB comments). (2) iOS Safari: AK turns `virtualFocus` off and moves
  real focus. (3) BU sets `aria-selected` on the highlighted `menuitem` only in
  WebKit while the input has focus, because "Safari VoiceOver needs it for
  arrow-key navigation" (`MenuStore.ts`). It is invalid ARIA, scoped as narrowly
  as possible. **This announcer is the most-copied workaround in the ecosystem,
  and any rind-ui pattern that uses `aria-activedescendant` (combobox,
  autocomplete, command, filterable menu) must have it from day one** (RA#10326
  shows what happens when one pattern lacks it).

### C. Focus without a key: the virtual cursor moves DOM focus

- **Symptom.** Tabs get selected just because the VO cursor passes over them, so
  the user can never read the previous panel ([RX#1047](https://github.com/radix-ui/primitives/issues/1047), open since
  2021). A tooltip inside a popover opens by itself ([RX#2248](https://github.com/radix-ui/primitives/issues/2248)).
- **Root cause.** VO (via WebKit's NSAccessibility path) and iOS VO move DOM
  focus as the cursor moves, and they fire `focus` without any keydown. BU
  `FocusGuard.tsx`: "Unlike NVDA and JAWS, VoiceOver's virtual cursor triggers
  `onFocus` as it moves — but only on focusable/role-button elements."
- **Fix.** Never run a state transition on `focus` unless a keyboard event caused
  it. AK's Tab only selects on focus when a key moved focus; its sandbox test
  is "do not select with focus (e.g., screen reader focus)"
  (`app/src/sandbox/tab/test.ts`). For rind-ui this is a machine rule: a
  `FOCUS` event carries its modality, and automatic activation is guarded on
  `modality === "keyboard"`.

### D. Live regions announce nothing the first time

- **Symptom.** The first toast or status message is silent, and later ones work
  ([RA#5191](https://github.com/adobe/react-spectrum/issues/5191) NVDA/JAWS, open; [BU#4181](https://github.com/mui/base-ui/issues/4181); [RX#3634](https://github.com/radix-ui/primitives/issues/3634);
  [RK#2469](https://github.com/unovue/reka-ui/issues/2469) TalkBack; [KB#411](https://github.com/kobaltedev/kobalte/issues/411)). Messages are dropped when another
  keypress follows ([RA#4719](https://github.com/adobe/react-spectrum/issues/4719)).
- **Root cause.** A region only announces *changes* to a region that already
  exists. If the region is mounted together with its text, the text is not a
  change. VO also needs time to start watching a new region (BU
  `useInitialLiveRegionTextMutation.ts`: "Safari VoiceOver needed roughly 200ms").
  NVDA needs the text to arrive in a later frame (RX `toast.tsx` and RK
  `ToastAnnounce.vue`: "render text content in the next frame to ensure toast is
  announced in NVDA"). A new keypress cancels speech that is still queued.
- **Fix.** Mount one persistent, empty region per politeness level at startup
  (an `Announcer` service; rind-ui already injects it). Insert text on the next
  frame; re-announcing the same text needs a mutation (BU appends a word joiner
  `U+2060`). Mute the region while `document.hidden`, so a background tab does
  not speak (RX `announce.tsx`, after [Inclusive Components](https://inclusive-components.design/notifications/#restrictingmessagestocontexts)). Keep
  error announcements to the focused field only (RA#4719 discussion).

### E. Hiding the outside hides the wrong things

- **Symptoms and causes.** Live regions get swallowed: RX ran `hideOthers` over the whole body, so `aria-live`/`role=alert` content in `#root` went quiet while a menu was open ([RX#1820](https://github.com/radix-ui/primitives/issues/1820)). RA's announcer was created lazily inside an already-hidden tree, so month changes were spoken only after close ([RA#3559](https://github.com/adobe/react-spectrum/issues/3559)). Portalled children of a modal get hidden: a Select inside a Dialog ([ARK#3728](https://github.com/chakra-ui/ark/issues/3728)); a nested dialog with an `aria-hidden` ancestor ([ZG#3408](https://github.com/chakra-ui/zag/issues/3408)); a toast viewport inside the dialog's hidden subtree that is still clickable ([RX#4115](https://github.com/radix-ui/primitives/issues/4115), open, a 1.2.15 regression); a tooltip that becomes `inert` inside a Modal, so NVDA/Narrator lose its `aria-describedby` ([RA#8915](https://github.com/adobe/react-spectrum/issues/8915)). Names break across `inert`: Chromium does not resolve `aria-labelledby` into an inert subtree, so a menu labelled by its trigger loses its name ([RA#9737](https://github.com/adobe/react-spectrum/issues/9737), open, [crbug 489792331](https://issues.chromium.org/issues/489792331)). Firefox and Safari are fine. Focus restore fails: `focus()` on a trigger that is still `inert` is a no-op by spec, so if the restore frame runs before the inert cleanup, focus is lost ([RA#10610](https://github.com/adobe/react-spectrum/issues/10610)). `aria-hidden` on `<body>` is blocked by Chrome ([ARK#2715](https://github.com/chakra-ui/ark/issues/2715), [ARK#2844](https://github.com/chakra-ui/ark/issues/2844)). A non-modal combobox hid its siblings ([ARK#3699](https://github.com/chakra-ui/ark/issues/3699), [RK#2240](https://github.com/unovue/reka-ui/issues/2240)). `aria-hidden` without `inert` leaves the content tabbable, which axe reports as `aria-hidden-focus` ([RK#2922](https://github.com/unovue/reka-ui/issues/2922), [BU#4678](https://github.com/mui/base-ui/issues/4678), [BU#5528](https://github.com/mui/base-ui/issues/5528)). iOS VO ignores `aria-hidden` on `role=row` ([webkit 222623](https://bugs.webkit.org/show_bug.cgi?id=222623)); KB and RA hide the cells as well.
- **Fix.** This is covered in [overlay-infrastructure.md](overlay-infrastructure.md) §4:
  `inert` instead of `aria-hidden` alone; the announcer and every descendant
  layer (portal branches, toasts) live outside the inert set; restore focus only
  after the inert attribute is removed; never touch `body`/`html`. New from this
  survey: **label sources must sit outside any inert subtree while a layer is
  open** (for example, the content gets `aria-label` copied from the trigger text
  instead of `aria-labelledby` pointing at it). Otherwise Chromium names the menu
  "▼" (RA#9737).

### F. Focus guards upset both VO and axe

- **Symptom.** BU/RX/RK place `tabindex=0` sentinel spans around a trapped
  popup. axe and Evinced report `aria-hidden-focus` in Chromium
  ([BU#5706](https://github.com/mui/base-ui/issues/5706), [BU#4668](https://github.com/mui/base-ui/issues/4668), [BU#4845](https://github.com/mui/base-ui/issues/4845), [RK#2486](https://github.com/unovue/reka-ui/issues/2486),
  [RK#2776](https://github.com/unovue/reka-ui/issues/2776), [RX#3593](https://github.com/radix-ui/primitives/issues/3593)), or `button-name` in WebKit, where BU
  makes the guards `role=button` on purpose ([BU#5237](https://github.com/mui/base-ui/issues/5237), open).
- **Root cause.** Sentinels catch Tab, but VO only "focuses" a virtual-cursor
  target if it is a button (cause C). So it has to be exposed to VO and hidden
  from everyone else, and no single attribute does both.
- **Fix used by others.** Excluding `[data-*-focus-guard]` in axe (BU's advice).
- **rind-ui.** Use no focus-guard sentinels for modal layers. `inert` on the
  outside already keeps both Tab and the virtual cursor inside. Non-modal
  popovers that need "Tab out returns to the trigger" handle `focusout` on the
  content instead of sentinels. If a sentinel turns out to be unavoidable, it
  becomes a documented quirk entry (see 1.5), not an axe exclusion that
  consumers have to copy.

### G. Value announced one step late (sliders, spin buttons)

- **Symptom.** VO reads the previous value: [RA#5583](https://github.com/adobe/react-spectrum/issues/5583), [RX#2303](https://github.com/radix-ui/primitives/issues/2303),
  [BU#4954](https://github.com/mui/base-ui/issues/4954), [BU#5296](https://github.com/mui/base-ui/issues/5296) (open), [BU#5294](https://github.com/mui/base-ui/issues/5294).
- **Root cause.** Partly VO's own behaviour: the APG example has the same
  problem (RA#5583). Partly self-inflicted: BU blurred and refocused the input to
  force `:focus-visible`, and the blur/focus cycle ran before the value update
  (BU#5296). BU#4954 was the tester's "Arrow-key Quick Nav" setting.
- **Fix.** Never blur/refocus to toggle a focus ring; `data-focus-visible` comes
  from our own modality tracking. Update `aria-valuenow`/`aria-valuetext` in the
  same task as the keydown. Use a native `<input type=range>` under the thumb,
  which also fixes TalkBack (cause J).

### H. Safari reads cached or mangled text

- **Symptom.** Select's value text is read truncated ("Bana", [RX#3671](https://github.com/radix-ui/primitives/issues/3671);
  ", Documentatio", [BU#82](https://github.com/mui/base-ui/issues/82)) or stale after a change ([ZG#3099](https://github.com/chakra-ui/zag/issues/3099)).
  VO macOS reads options that have `aria-labelledby`/`aria-label` as just "text"
  ([webkit 209279](https://bugs.webkit.org/show_bug.cgi?id=209279), noted in KB `listbox-item.tsx`). The tooltip label
  is read twice when the trigger's `aria-label` equals the tooltip text
  ([RX#2988](https://github.com/radix-ui/primitives/issues/2988)).
- **Root cause.** WebKit caches text nodes of non-focusable spans inside a
  focusable control. Name computation for option children is buggy in WebKit.
- **Fix.** Re-key or replace the value-text node when the value changes
  (ZG#3099: `<span key={value}>` fixed it). Let options take their name from
  their content and do not set `aria-labelledby` on options in WebKit (KB
  follows RA here). Do not describe a trigger with text equal to its name.

### I. ARIA features with uneven AT support

| Feature | Reality | Source | rind-ui rule |
|---|---|---|---|
| `aria-errormessage` | missing or partial on VO macOS and TalkBack; NVDA claims support | [RA#7425](https://github.com/adobe/react-spectrum/issues/7425), [ARK#4150](https://github.com/chakra-ui/ark/issues/4150) (ARK switched and users lost errors), [a11ysupport](https://a11ysupport.io/tech/aria/aria-errormessage_attribute), KB `create-form-control.tsx` | use `aria-describedby` for errors, plus `aria-invalid`; `aria-errormessage` only alongside |
| `progressbar`/`meter` name | NVDA ignores `aria-labelledby` (and even `aria-label`); JAWS bug | [BU#4184](https://github.com/mui/base-ui/issues/4184) | BU adds a workaround span (`ProgressRoot.tsx`); copy it and keep it behind a quirk entry |
| `aria-describedby` on dialog | not read by VO when the dialog opens | [RX#2038](https://github.com/radix-ui/primitives/issues/2038) | keep the description short; do not rely on it for essential text |
| `aria-checked` on `option` | VO ignores it; TalkBack calls it "actionable" | AK `menu-nested-search-interactions` comment | multi-select listbox: `aria-selected` + `aria-multiselectable` |
| `aria-selected` absent on unselected options | VO reads every option as "selected"; NVDA reads no state | [HUI#1599](https://github.com/tailwindlabs/headlessui/issues/1599), [BITS#2173](https://github.com/huntabyte/bits-ui/issues/2173), [RX#1907](https://github.com/radix-ui/primitives/issues/1907) | always set explicit `true`/`false` on selectable options |
| `aria-roledescription` + required | iOS VO drops "required" | webkit 221065 ([RA tracker](https://github.com/adobe/react-spectrum/wiki/Tracker-for-External-Browser-Bugs,-Library-Bugs,-and-Features)) | avoid `aria-roledescription` on form controls |
| `role=grid` label inside `main` | not announced by VO | webkit 239920 ([RA tracker](https://github.com/adobe/react-spectrum/wiki/Tracker-for-External-Browser-Bugs,-Library-Bugs,-and-Features)) | — (tracked) |
| checked `menuitemcheckbox` | VO prepends "1" | [RX#889](https://github.com/radix-ui/primitives/issues/889) (also in the APG demo) | wontfix; documented |
| `aria-expanded` on a submenu trigger | VO announces the state change instead of the first item | BU `MenuSubmenuTrigger.tsx` drops it while open on Apple | see invariant exceptions, Part 2 |

### J. Mobile ATs do not send keys

TalkBack does not send arrow keys to a `div[role=slider]`; it changes native range inputs instead ([chromium 40816094](https://issues.chromium.org/issues/40816094), quoted in BU `SliderThumb.test.tsx`; [RA#1400](https://github.com/adobe/react-spectrum/issues/1400), [RX#2850](https://github.com/radix-ui/primitives/issues/2850) open, [BU#2575](https://github.com/mui/base-ui/issues/2575)). Fix: render the thumb as `input[type=range]`. iOS VO cannot focus `role=spinbutton` segments and does not announce groups. KB/RA switch date segments to `role=textbox` on iOS and put the field label into each segment's name (`time-field-segment.tsx`). VO macOS calls segments "stepper", but VO+Up/Down does nothing because `contenteditable` swallows the keys ([RA#8591](https://github.com/adobe/react-spectrum/issues/8591), open). TalkBack does not click visually hidden elements on some devices ([RA#3047](https://github.com/adobe/react-spectrum/issues/3047), [google 229646660](https://issuetracker.google.com/issues/229646660), unfixed). So dismiss buttons that are visually hidden are not reliable on Android. A `div` wrapper inside `role=option` stops TalkBack from swiping onto options ([BU#4435](https://github.com/mui/base-ui/issues/4435)). Use phrasing content (`span`) inside options. A touch SR closes a Select right after it opens ([RX#1343](https://github.com/radix-ui/primitives/issues/1343), open). The "outside pointerdown" logic counts the synthesized tap as outside. TalkBack's cursor is pulled back to the first element in a Modal, because `activeElement` is `body` after a rAF ([RA#7471](https://github.com/adobe/react-spectrum/issues/7471)). Treat "focus on body" as possibly an AT artefact, and re-focus only on a real `focusout` with a null `relatedTarget`. A text-only TabPanel is not read by TalkBack ([RA#6153](https://github.com/adobe/react-spectrum/issues/6153), open). iPhone VO closes the whole menu after the last submenu item ([BU#5794](https://github.com/mui/base-ui/issues/5794), open). Swiping past the end moves focus outside, which counts as "focus outside".

### K. Forced colors (Windows High Contrast)

- **Symptom.** Switches, sliders and radios disappear ([ARK#3421](https://github.com/chakra-ui/ark/issues/3421),
  [ARK#3422](https://github.com/chakra-ui/ark/issues/3422), [RX#2993](https://github.com/radix-ui/primitives/issues/2993)). Selected/hover state is lost because
  it was a background colour only ([AK#558](https://github.com/ariakit/ariakit/issues/558), [RA#2949](https://github.com/adobe/react-spectrum/issues/2949)). Focus
  rings made with `box-shadow` vanish ([RA#5931](https://github.com/adobe/react-spectrum/issues/5931)).
- **Root cause.** Forced colors replace `background-color`, `border-color`,
  `color` and `box-shadow` with system colours. SVG fills that are not
  `currentColor` keep the author colour (AK#7873).
- **Fix.** This belongs to `@rind-ui/theme`. Every state has a non-colour cue
  (border, outline, glyph). Focus is shown with `outline` (a transparent outline
  becomes visible in forced colors). Use `Highlight`/`HighlightText`/`GrayText`
  for selected and disabled. Use `forced-color-adjust: none` only on swatches.
  AK tests each UI sandbox under `(forced-colors: active)` with Playwright
  emulation and visual captures (`test-chrome-firefox.ts`, AK#7476/#7518/#7871).
  We copy that for the theme package.

### L. Regressions in the AT, not in us

Safari 26 broke "VO follows `focus()` on newly added elements". The result was
silent popovers, dialogs and DatePicker calendars ([RA#9814](https://github.com/adobe/react-spectrum/issues/9814),
[RA#9821](https://github.com/adobe/react-spectrum/issues/9821), [RA#10641](https://github.com/adobe/react-spectrum/issues/10641)); it was fixed in Safari 27 /
[webkit 311125](https://bugs.webkit.org/show_bug.cgi?id=311125). VO's virtual-cursor behaviour on virtualized tables
changed ([RA#9550](https://github.com/adobe/react-spectrum/issues/9550)). NVDA 2020.4 misread date segments, and 2025.3 was
fine ([RA#10081](https://github.com/adobe/react-spectrum/issues/10081); NV Access says about 80% of users run a release from
the last ~1.5 years). Lesson: **a bug report without AT + browser + OS versions
is not actionable.** Re-test old "wontfix" quirks every year, and keep an
external-bug tracker, as RA does ([wiki](https://github.com/adobe/react-spectrum/wiki/Tracker-for-External-Browser-Bugs,-Library-Bugs,-and-Features)).

## 1.3 By AT + browser

| Combination | Characteristic failures | Main causes | Issues |
|---|---|---|---|
| **VO + Safari (macOS)** | activedescendant silent; VO+Space does nothing on pointer-only triggers; cached/truncated value text; focus guards need `role=button`; Safari 26 focus regression; VO+Space clicks twice on `button[role=menuitem]` ([webkit 228318](https://bugs.webkit.org/show_bug.cgi?id=228318), AK `menu-button.tsx`) | A B H F L | RA#10326, RA#8998, RA#8077, RX#1963, RX#3671, RX#3699, ZG#3099, BU#5721, BU#5934, HUI#2736, BITS#1760 |
| **VO + Chrome (macOS)** | Select item count wrong or missing ([RX#3962](https://github.com/radix-ui/primitives/issues/3962), [RX#4110](https://github.com/radix-ui/primitives/issues/4110), open); dialog title not announced ([RX#3348](https://github.com/radix-ui/primitives/issues/3348), open); combobox initial announcement truncated ([AK#1648](https://github.com/ariakit/ariakit/issues/1648)); "selected" read on unselected options ([RA#5434](https://github.com/adobe/react-spectrum/issues/5434), later gone); extraneous `blur` with null `relatedTarget` (chromium 1473752) | H, Chrome AX timing | RX#3962, RX#3348, AK#1648 |
| **VO iOS (Safari)** | SR tap closes Select; cursor trapped in combobox after the list hides and reappears ([RA#2108](https://github.com/adobe/react-spectrum/issues/2108)); `aria-hidden` on rows ignored; spinbuttons unfocusable; groups not announced; aria-label of a grid not read (RA `Calendar.tsx` adds a hidden heading + hidden "next" button); double `touchend` (KB `combobox-input.tsx`); whole menu closes past the last submenu item | A E J | RX#1343, RA#2108, BU#5794 |
| **NVDA + Chrome/Edge** | first live announcement lost; leaves focus mode for browse mode on arrows (fix: `role=toolbar` container, BU#3629, `ComboboxChips.tsx`; RA#7300 = [nvaccess/nvda#11413](https://github.com/nvaccess/nvda/issues/11413)); popover "dialog" role not spoken ([RA#9814](https://github.com/adobe/react-spectrum/issues/9814)); progress label ignored; Select with an undefined value: arrows leave the list ([HUI#3560](https://github.com/tailwindlabs/headlessui/issues/3560), open); calendar arrow-down moves through the DOM in browse mode ([RK#2438](https://github.com/unovue/reka-ui/issues/2438)); heading read twice in dialog ([RX#3377](https://github.com/radix-ui/primitives/issues/3377)) | D I + browse/focus mode | RA#5191, BU#4184, BU#3629, HUI#3560 |
| **NVDA + Firefox** | Enter in browse mode sends only `click`, so pointer/keydown-only triggers fail; `role=presentation` + `tabindex=-1` is exposed as a section and breaks the table ([RA#4382](https://github.com/adobe/react-spectrum/issues/4382), [bmo 616594](https://bugzilla.mozilla.org/show_bug.cgi?id=616594)); Firefox makes scroll containers tab stops ([RA#3633](https://github.com/adobe/react-spectrum/issues/3633)) | A, Firefox role mapping | RX#2700, RX#1815, RA#4382 |
| **JAWS + Chrome/Edge** | first announcement lost (RA#5191); virtual cursor leaves a non-modal popover ([HUI#3853](https://github.com/tailwindlabs/headlessui/issues/3853), open; expected: it is non-modal); JAWS-side progressbar bug (BU#4184) | D E | HUI#3853 |
| **TalkBack + Chrome** | no key events (sliders); visually hidden buttons not clickable; `div` inside an option; modal cursor pulled back; toasts silent ([RK#2469](https://github.com/unovue/reka-ui/issues/2469)); text-only tab panel not read | A J D | RA#1400, RA#3047, RA#7471, BU#4435, RA#6153 |
| **Narrator** | tabs not activatable, focus trapped in the tab list ([HUI#3274](https://github.com/tailwindlabs/headlessui/issues/3274), open; RX works) | — | HUI#3274 |
| **Forced colors (Edge/Chrome/Firefox on Windows)** | invisible controls and states | K | ARK#3421, RX#2993, RA#2529 |

## 1.4 By component pattern

**Dialog / alert dialog.** Title not spoken on open in VO + Chrome ([RX#3348](https://github.com/radix-ui/primitives/issues/3348)); VO ignores the description ([RX#2038](https://github.com/radix-ui/primitives/issues/2038)). When `autoFocus` lands on an element after the title, NVDA reads the heading twice ([RX#3377](https://github.com/radix-ui/primitives/issues/3377)). Safari 26 does not follow `focus()` into new content (L). A modal with no visible close button traps SR users. AK renders a hidden dismiss button next to (not inside) the dialog ([AK#7310](https://github.com/ariakit/ariakit/issues/7310), `dialog.tsx`; it must be localizable, [AK#7307](https://github.com/ariakit/ariakit/issues/7307)). RA puts `DismissButton` before and after the content, which VO users find confusing ([RA#8998](https://github.com/adobe/react-spectrum/issues/8998)). A Modal's MutationObserver makes tooltips inert (RA#8915). Pinch-zoom is blocked in iOS dialogs ([RA#1898](https://github.com/adobe/react-spectrum/issues/1898)). *rind-ui:* initial focus on the first tabbable or the title, `aria-labelledby` to the title, a generated test that the name is non-empty, no description-only content, `inert` outside, and a hidden dismiss as a quirk entry for Android/iOS only if testing shows that we need it.

**Menu / menubar.** Pointer-only triggers fail with VO+Space and NVDA/Firefox (A: RX#1963, RX#2700, BITS#1760, HUI#62). Focus does not move to the first item on click/AT open ([RX#1815](https://github.com/radix-ui/primitives/issues/1815), open; "deliberate" for mouse, but an AT click looks like a mouse click). VO focuses the wrong item when a menu opens inside a menubar ([AK#5262](https://github.com/ariakit/ariakit/issues/5262)); VO in Safari menubar ([RX#3699](https://github.com/radix-ui/primitives/issues/3699)). Submenu `aria-expanded` is announced instead of the first item (BU); TalkBack cannot close a submenu unless the trigger toggles (BU `MenuSubmenuTrigger.tsx`). VO+Space on a native button with `role=menuitem` fires twice ([webkit 228318](https://bugs.webkit.org/show_bug.cgi?id=228318)). *rind-ui:* virtual click = keyboard open (focus the first item), toggle submenus on activation.

**Combobox / listbox / autocomplete.** Cause B dominates. Other combobox bugs: [ZG#2947](https://github.com/chakra-ui/zag/issues/2947) (`aria-selected` on the highlighted option instead of the selected one), [RA#4941](https://github.com/adobe/react-spectrum/issues/4941) (the count is announced before the role), [RA#5839](https://github.com/adobe/react-spectrum/issues/5839)/[RA#2578](https://github.com/adobe/react-spectrum/issues/2578) (sections announced wrongly), [RA#10711](https://github.com/adobe/react-spectrum/issues/10711)/[AK#6301](https://github.com/ariakit/ariakit/issues/6301) (`aria-posinset` > `aria-setsize` after filtering), [BU#5569](https://github.com/mui/base-ui/issues/5569) (listbox without a name), [BU#5443](https://github.com/mui/base-ui/issues/5443) (`role=status` as a listbox child breaks `aria-required-children`). [ZG#2936](https://github.com/chakra-ui/zag/issues/2936) is cause B (VoiceOver ignoring `aria-activedescendant` changes), as the maintainer confirmed; the portal was a commenter's guess *(corrected in combobox.md, 2026-10-14)*. Portalled popups can still put the listbox far from the input in touch swipe order (BU#5528), so Combobox renders its popup in place by default. HUI resets the input value on open "to trick VoiceOver" (`combobox.tsx`). With VO in Firefox/Chrome, arrows are eaten ([HUI#3810](https://github.com/tailwindlabs/headlessui/issues/3810), open). *rind-ui:* announcer on Apple platforms, explicit `aria-selected=false`, set metadata computed in the same render, the empty state outside the listbox, a hidden name on the listbox.

**Select.** Value text cached or truncated in Safari (H: RX#3671, BU#82, ZG#3099). Count wrong in VO + Chrome (RX#3962, RX#4110). A touch SR closes it instantly (RX#1343). After VO cursor movement, a plain Arrow Down continues from DOM focus, not from the VO cursor ([BU#5934](https://github.com/mui/base-ui/issues/5934), open). Fix: follow `focus` events into the highlight. Live regions elsewhere on the page are silenced while the Select is open ([RA#7155](https://github.com/adobe/react-spectrum/issues/7155)). `isRequired` is not announced ([RA#8607](https://github.com/adobe/react-spectrum/issues/8607), [ZG#2785](https://github.com/chakra-ui/zag/issues/2785)). RX: `aria-selected = isSelected && isFocused` "fixes stuttering in VoiceOver" (`select.tsx`). It is invalid per the APG and was contested ([RX#1907](https://github.com/radix-ui/primitives/issues/1907)).

**Tabs.** SR focus selects the tab (C: [RX#1047](https://github.com/radix-ui/primitives/issues/1047)). Inactive panels stayed in the AX tree when hidden only visually ([HUI#2688](https://github.com/tailwindlabs/headlessui/issues/2688)). Use `hidden`, not visually-hidden. Narrator (HUI#3274); TalkBack with text-only panels (RA#6153). APG `aria-controls` debate ([RA#8699](https://github.com/adobe/react-spectrum/issues/8699)). Panels are focusable only if they contain no focusable element ([RK#2430](https://github.com/unovue/reka-ui/issues/2430)).

**Tooltip.** RA wants the tooltip kept in the DOM, hidden, so `aria-describedby` resolves in JAWS virtual / NVDA browse mode ([RA#2101](https://github.com/adobe/react-spectrum/issues/2101), open). Tooltip inside a Modal is inert, so it is never spoken in Chromium/Firefox + NVDA (RA#8915). Double reading when the label equals the content (RX#2988). AK and RX settled on: name tooltips use `aria-labelledby`, description tooltips use `aria-describedby` ([AK#2228](https://github.com/ariakit/ariakit/issues/2228), [AK#3242](https://github.com/ariakit/ariakit/issues/3242)). Tooltips are not reachable on touch at all; document that.

**Toast.** First toast silent (D); `aria-live="off"` regression ([RX#3634](https://github.com/radix-ui/primitives/issues/3634)); TalkBack silent ([RK#2469](https://github.com/unovue/reka-ui/issues/2469)); KB never announced ([KB#411](https://github.com/kobaltedev/kobalte/issues/411)). Announcement text rendered as a JSON array in the Vue port ([RK#2611](https://github.com/unovue/reka-ui/issues/2611)). Title read twice when labelledby = describedby ([RA#5329](https://github.com/adobe/react-spectrum/issues/5329)). The Undo action cannot be reached in time ([BU#4253](https://github.com/mui/base-ui/issues/4253), open; WCAG 2.2.1). `aria-hidden` on a focusable high-priority toast ([BU#5659](https://github.com/mui/base-ui/issues/5659)); toast inside a dialog's hidden subtree (RX#4115). *rind-ui:* the Announcer speaks; the visible toast is not a live region; pause the timer on focus and hover; actions need an alternative (hotkey or region landmark).

**Slider.** Cause G (stale value) and cause J (TalkBack): use a native range input, and keep `aria-valuetext` in sync with the visible output ([RA#6402](https://github.com/adobe/react-spectrum/issues/6402)).

**Date fields / calendar.** NVDA reads the whole calendar when it leaves focus mode ([RA#4637](https://github.com/adobe/react-spectrum/issues/4637)). Month changes are not announced when the announcer is hidden (E: [RA#3559](https://github.com/adobe/react-spectrum/issues/3559)). Segments: iOS `textbox` role, label repeated in each segment (J). VO stepper commands are dead ([RA#8591](https://github.com/adobe/react-spectrum/issues/8591)). NVDA + Firefox misread with an old NVDA ([RA#10081](https://github.com/adobe/react-spectrum/issues/10081)). Errors are not discoverable ([RA#3328](https://github.com/adobe/react-spectrum/issues/3328)). RA calendar adds a visually hidden heading for the visible range and a "next" button after the grid for touch SRs (`Calendar.tsx`). `aria-roledescription` and placeholder must be translated ([ZG#3420](https://github.com/chakra-ui/zag/issues/3420)).

**Tree / grid / table.** WebKit has open grid bugs: selected row state not announced (235068), header and index not announced (236790), navigation breaks while a virtualized grid scrolls (236865), `aria-describedby` on headers ignored (228573) — all on the [RA tracker](https://github.com/adobe/react-spectrum/wiki/Tracker-for-External-Browser-Bugs,-Library-Bugs,-and-Features). VO lags behind fast `focus()` in a grid and reads the previous cell ([RA#7734](https://github.com/adobe/react-spectrum/issues/7734), open). Virtualized columns get skipped by the SR ([RA#9550](https://github.com/adobe/react-spectrum/issues/9550)). NVDA leaves focus mode on checkboxes inside cells (RA#7300, nvda#11413). Resizer text ("75 pixels") leaks into cell names ([RA#9160](https://github.com/adobe/react-spectrum/issues/9160), open). Firefox `role=presentation` + `tabindex` breaks the table structure ([RA#4382](https://github.com/adobe/react-spectrum/issues/4382)). iOS `aria-hidden` on rows (E). [ZG#3431](https://github.com/chakra-ui/zag/issues/3431) is a closed feature request for a treegrid (not a shipped component); RA Tree keyboard vs APG ([RA#9918](https://github.com/adobe/react-spectrum/issues/9918)). *rind-ui:* tree and grid are wave 3. Their research notes start from this list, and they must be tested on real VO from the first prototype.

## 1.5 What this means for rind-ui's architecture

1. **Modality is part of every event.** Machine events carry `modality:
   "keyboard" | "pointer" | "touch" | "virtual"` (virtual = AT press/click with
   no pointer or key, or focus with no key). Guards use it: automatic tab
   activation, focus-first-item on open, tooltip-on-focus. The detection
   heuristics (cause A) live once in `core/dom/modality.ts`.
2. **One `Announcer`**, injected (already in CLAUDE.md), that follows the
   cause-D rules and is excluded from every inert/hide-outside operation.
   Patterns using `aria-activedescendant` must declare their announcements
   (`focusAnnouncement`, `countAnnouncement`, `selectionAnnouncement`) in the
   contract, so the drivers can assert them.
3. **A quirks registry, `core/dom/quirks.ts`.** Every UA-gated workaround (BU
   `webkitAriaSelected`, KB iOS `textbox` segments, VO announcer) is an entry
   with: the condition (`platform.webkit && …`), the bug link, the test that
   reproduces it, and the condition for removing it. BU and KB scatter these in
   components; we keep one list, so the yearly re-test (cause L) is a grep and
   the docs can list "known AT quirks" per component.
4. **Prefer native elements where the AT path is better.** Range inputs for
   slider thumbs (TalkBack), native buttons for triggers (activation), `hidden`
   for inactive panels. This is input for `native-platform.md`.

---

# Part 2 — Testing accessibility

## 2.1 axe-core

- **Version** 4.14.0 (npm, 2026-10-12); `@axe-core/playwright` 4.13.0.
- **What it checks.** Static DOM rules on the current state: roles and allowed
  attributes, required parent/children (`aria-required-children`, the rule that
  caught BU#5443), names (`button-name`, `aria-input-field-name`; RX#2127,
  ZG#2781), `aria-hidden-focus` (cause F), valid IDREFs on some attributes,
  contrast (real browser only), duplicate ids, landmarks. It reports
  `incomplete` ("needs review") when unsure; RA#7155 and BU#5237 show results
  that move between violation and needs-review.
- **How much it finds.**

  | Study | Coverage |
  |---|---|
  | Deque, by issue volume over 2,000+ audits ([study](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues)) | 57.38% |
  | GOV.UK audit of tools, 142 barriers ([audit](https://alphagov.github.io/accessibility-tool-audit/), updated 2018) | axe found 29% (30% including "potential"); the best tool found 40% |
  | Evinced's own sample ([blog](https://evinced.com/blog/what-an-automation-company-learned-from-manual-audits)) | about 23% |

  Two of these are vendor numbers. All three agree that most of the issues in
  Part 1 are out of reach: none of causes A–D, G, H, J or L is a static DOM
  property.
- **Limits that matter to us.**
  - One snapshot per run: an open menu is only checked if the test leaves it open.
  - jsdom has no layout, so `color-contrast` and visibility checks are skipped
    or unreliable.
  - It treats the guard-sentinel pattern as a violation, even though ACT
    "passed example 4" allows it (BU#5706). That is one more reason to avoid
    sentinels.
  - It cannot know that `aria-describedby` points into an inert subtree (RA#8915)
    or that `aria-labelledby` crosses one (RA#9737). Chromium's AX tree can
    (2.4).

## 2.2 Storybook a11y addon

`@storybook/addon-a11y` 10.6.2 ([docs](https://storybook.js.org/docs/writing-tests/accessibility-testing)):

- **`parameters.a11y.test`**: `"off"`, `"todo"` (warn in the UI, nothing in CI)
  or `"error"` (fail in the UI and in CI). It can be set per project, per meta or
  per story. **`globals.a11y.manual: true`** disables automatic runs (for
  anti-pattern stories).
- **When it runs**: in the preview's `afterEach` hook (read in
  `dist/_browser-chunks/chunk-*.js`), so it runs **once, after the `play`
  function**, on the final state. Context defaults to `body`, so portals are
  included. The `region` rule is off by default. Rules come from `config`
  (`axe.configure`) and `options.runOnly`.
- **In CI** it runs through the Vitest addon in Playwright's Chromium. The docs
  warn that results vary by browser version, and that Suspense/RSC may not have
  rendered when the check runs.
- **Consequence for rind-ui.** `a11y.test: "error"` on every story (already
  decided) checks only the final state of each story. To cover open, nested and
  error states, either (a) write state stories ("Select / open with a value",
  "Dialog / nested") whose `play` leaves the state in place, or (b) let
  `testMachine` run axe itself on each reached state (2.9). We do both: (a) for
  docs and a quick look, (b) for coverage.

## 2.3 Playwright: role locators, assertions, ARIA snapshots

- **Assertions**: `toHaveAccessibleName`, `toHaveAccessibleDescription`,
  `toHaveRole` (1.44), `toHaveAccessibleErrorMessage` (1.50), and
  `getByRole(…, { description })` (1.60).
- **ARIA snapshots** (`toMatchAriaSnapshot` 1.49; `/children` and `/url` 1.52;
  placeholder 1.56; `page.ariaSnapshot()` with depth/mode 1.59; on Page 1.60;
  `ariaSnapshotJSON` 1.63; `getByRef` 1.64; [docs](https://playwright.dev/docs/aria-snapshots),
  [release notes](https://playwright.dev/docs/release-notes)) store YAML like
  `- combobox "Country" [expanded]`. Each node records role, name, the states
  `checked`/`disabled`/`expanded`/`invalid`/`level`/`pressed`/`selected`, and
  link `/url`. Matching is partial by default: an omitted name or attribute is
  ignored, regex is allowed, and `/children: equal|deep-equal` makes it strict.
  It does not capture `aria-describedby` descriptions; use
  `toHaveAccessibleDescription` for those.
- **`page.accessibility` was removed in 1.57.** The release notes point to axe.
- **Important limitation, from AK's test utils** (`app/src/test-utils/accessibility.ts`):
  "Playwright computes accessible names in the page instead of reading the
  browser tree, so it resolves `aria-labelledby` across the `inert` boundary that
  Chromium rejects, and it reports an `inert` element as visible." ARIA
  snapshots are Playwright's model of the tree, not the tree the SR receives.
- **Use in rind-ui.** Partial ARIA snapshots per state story, to catch
  structural regressions (role, name, `expanded`, `selected`) in all three
  engines. The same YAML goes into the generated docs as **"what assistive
  technology sees"** for each state. That is a compact, exact fact sheet for
  LLMs ([0005](../decisions/0005-llm-knowledge.md)).

## 2.4 Chromium's AX tree via CDP

`context.newCDPSession(page)` → `Accessibility.enable` →
`Accessibility.getFullAXTree` (or `queryAXTree`/`getPartialAXTree`) returns
Blink's computed tree: `role`, `name` with its sources, `ignored` and
`ignoredReasons`, and child ids. This is the closest automated view of what
NVDA/JAWS + Chrome receive (48.5% of desktop users). AK uses it to assert that a
menu's name and owned roles are right, and that a fallback dismiss button is
exposed outside the inert set. It does this exactly where Playwright's in-page
model gives the wrong answer.

- Chromium only. Firefox and WebKit have no equivalent protocol in Playwright.
  Firefox exposes its tree only via devtools; WebKit's WebInspector protocol is
  not reachable from Playwright.
- The tree is async-ish and the result needs polling: AK returns `null` so that
  `expect.poll` retries.
- **Use in rind-ui.** A `chromiumTree(page)` helper in
  `@rind-ui/testing/playwright`, used by the invariants that only the browser
  tree can answer: name through inert (RA#9737), description target not ignored
  (RA#8915), focused node not ignored, popup exposed (RX#4115).

## 2.5 Testing Library role queries & `dom-accessibility-api`

`@testing-library/dom` 10.4.2 uses `dom-accessibility-api` 0.7.1 for names and
roles and `aria-query` for implicit roles. Limits, checked in the shipped
source:

- **Hidden detection is partial.** `isSubtreeInaccessible` checks only
  `hidden`, `aria-hidden="true"` and `display: none`
  (`dist/role-helpers.js`; it also checks `visibility` per element). It does
  **not** check `inert`, the inertness that `showModal()` gives the outside of a
  dialog, or `content-visibility`. `dom-accessibility-api` has no `inert`
  handling. So in jsdom, `getByRole` finds elements an SR cannot reach, and our
  "outside is inert" invariant has to inspect `inert` ancestry itself.
- **No CSS-generated content.** jsdom has no `::before`/`::after` content, so
  icon-font names differ from the browser's.
- **No `aria-owns` reparenting** in queries, and no layout: `visibility` via
  stylesheets is approximate, and nothing knows if an element is off-screen or
  0×0 (HUI#2688's "1x0" panels pass).
- **Speed.** `*ByRole` walks and computes styles across the whole tree. It is
  slow on big DOMs; scope the queries to the part.
- It computes names from the spec, not from any engine. It will not reproduce
  Chromium's inert behaviour or WebKit's option-name bug (H).
- **Use in rind-ui.** The default DOM adapter, as already decided in
  [testing.md](testing.md). The adapter adds an `inert` check to "hidden", and
  that check must be identical in both adapters.

## 2.6 Virtual screen reader (`@guidepup/virtual-screen-reader`)

0.33.0 (2026-09). It simulates a "spec-ideal" SR over the DOM, built on
`@testing-library/dom`, `dom-accessibility-api` and `html-aria`, and is tested
against WPT (396 suites passing, 81 failing, 338 skipped, per its README). API:
`virtual.start({ container })`, `next()`/`previous()`, `act()`, `press()`,
`type()`, `lastSpokenPhrase()`, `spokenPhraseLog()`, `itemTextLog()`. The build
handles `aria-live`, `aria-busy`, `aria-owns`, `aria-activedescendant`, `inert`
and `aria-modal` (read in `lib/esm`). It runs in jsdom, happy-dom, the browser
and Storybook.

- **Good for**: deterministic assertions on *what would be spoken*, especially
  **announcement sequences**. "Exactly one announcement per streamed message"
  (0003) and "the toast is announced once" are easy to state as
  `spokenPhraseLog()` equality. It also proves the reading order of a composed
  widget.
- **Not good for**: any real AT quirk. It is the ideal SR, so causes A–L all
  pass. It cannot replace 2.7 or 2.8. Its names come from the same
  `dom-accessibility-api`, so it shares 2.5's blind spots apart from `inert`.
- **Use in rind-ui.** The `Announcer` contract tests and AI-UI streaming
  primitives assert the spoken log (jsdom + browser). Each wave-1 pattern gets
  one golden "reading order" test.

## 2.7 Real screen reader automation (`@guidepup/guidepup`)

0.36.0 (2026-10-13); `@guidepup/playwright` 0.19.1; `@guidepup/setup` 0.29.2
([repo](https://github.com/guidepup/guidepup)). It drives **VoiceOver on macOS** (Sonoma through Golden Gate),
**NVDA on Windows** (Server 2022/2025) and, in preview, **Orca on Linux**. It
can send SR commands (`voiceOver.next()`, `perform(voiceOver.keyboardCommands.…)`)
and read the spoken phrase log. In CI, `guidepup/setup-action` configures
GitHub-hosted macOS and Windows runners (`--ci`; `--record` saves a screen
recording when setup fails).

- **Pros**: the real AT and the real browser, so it reproduces causes A, B, D, H
  and L.
- **Cons**: slow (one SR instance per machine, so it runs serially); timing
  flakiness from speech; macOS TCC permissions; no JAWS, no iOS, no TalkBack. It
  also needs exact phrase expectations, which change with AT versions.
- **Use in rind-ui.** A **nightly, non-blocking** workflow: VO + Safari on
  `macos-latest` and NVDA + Chrome on `windows-latest`. About 3–5 golden flows
  per wave-1 component (open, navigate, select, close; announcements). Assertions
  use *contains* on key phrases ("Apple", "1 of 6", "selected"), not full
  equality. A failure opens an issue with the phrase diff and versions. It
  reports trends; it does not gate PRs. W3C's ARIA-AT project automates NVDA/VO
  for APG patterns through AT Driver, and its results are a reference for "is
  this our bug or the AT's".

## 2.8 Manual testing protocol

Required for each component **before `done`**, and for each changed component
**at release**:

1. **Environment.** Record the OS, browser and AT versions, and use only AT
   releases from the last ~18 months. Reset AT settings to their defaults before
   the session (VO Utility → Reset, which turns off Arrow-key Quick Nav; NVDA
   defaults; JAWS default verbosity). BU#4954 and RK#2521 were setup errors.
2. **Matrix.** The tier-1 rows in 1.1. JAWS on a licensed machine or a 40-minute
   demo session, or a hosted service (RA uses AssistivLabs, RA#5191; BrowserStack,
   BU#5721). iOS and Android on real devices; simulators do not run VO/TalkBack
   as users do.
3. **Script per pattern.** It is generated from the contract: each state × each
   action, done with (a) the keyboard alone, (b) the SR's own commands (VO+arrows,
   VO+Space; NVDA browse mode + Enter; JAWS virtual cursor; swipe/double-tap),
   (c) a mouse with the SR running. Listen for: name, role, state, value,
   position ("2 of 5"), announcements, and where focus lands after
   close/select/escape.
4. **Before filing an AT bug**, run the same steps on the APG example and on the
   native control (RA#5583, RA#8591, RX#889). If they fail the same way, record
   a quirk entry with the external bug link.
5. **Record.** A video with speech output for every failure, then update the
   docs page's generated "Tested with" table (1.1).
6. **Forced colors and zoom.** Windows High Contrast (Edge + Firefox), 400%
   zoom / reflow, `prefers-reduced-motion`. These are visual checks on the theme
   package.
7. **iOS scroll lock.** On a real iPhone and iPad with Safari (simulators and
   desktop emulation do not reproduce `overflow: hidden` being ignored), open a
   modal dialog and check: the page behind does not scroll when swiping on the
   backdrop or past the end of the dialog's content; pinch zoom works; the
   text-selection handles of an input inside the dialog can be dragged; a range
   input inside the dialog can be dragged; after closing, the page has not
   jumped (RX#3078, HUI#3890, RX#3331).

## 2.9 What rind-ui adopts, and where

| Layer | Tool | What it proves | Blocking? |
|---|---|---|---|
| jsdom (Vitest) | driver + TL role queries; generic invariants (2.10) that don't need layout; virtual SR for announcer and streaming logs | contracts hold in consumers' environment; announcement counts | yes |
| Vitest browser mode (Chromium, Firefox, WebKit via Playwright) | `testMachine` paths × modalities **including `virtual`**; all generic invariants; **axe per unique reached state** (deduplicated by state + props hash, so it does not run per step: this answers [testing.md](testing.md) open question 7); CDP tree invariants in Chromium | behaviour + static ARIA in real engines; activation with bare clicks; names across inert | yes |
| Storybook (Vitest addon) | `a11y.test: "error"` on every story; state stories for open/nested/invalid | final state of every story is axe-clean in Chromium | yes |
| Playwright e2e | partial `toMatchAriaSnapshot` per state story, in 3 engines; `emulateMedia({ forcedColors: "active" })` visual captures for `@rind-ui/theme` (AK's approach) | AX shape regressions; forced-colors visibility | yes |
| Nightly CI | Guidepup VO + Safari (macOS), NVDA + Chrome (Windows) golden flows | real AT output trends | no (opens issues) |
| Release checklist | manual protocol 2.8, tier-1 matrix, per changed component; quirks registry re-test once a year | what no tool can see | yes, for `done` and releases |

**Consumers** get the same tools: `testMachine` (with the `virtual` modality and
all invariants), `chromiumTree`, and an `axe` hook. A consumer's restyled
wrapper is then checked against the same accessibility behaviour, not just the
same DOM.

## 2.10 Generic invariants for model-based tests

These run after every step of every `testMachine` path, in both adapters unless
marked. They extend the table in [testing.md](testing.md#e-model-based-runner--testmachine).
Its existing rows (IDREFs resolve, single anchor match, aria-expanded mirrors
state, focus not on body while a layer is open, focus restore, Escape closes the
topmost layer, closed content hidden) stay, and are not repeated here. Each row
cites the bugs it would have caught.

| # | Invariant | Check | Env | Would have caught |
|---|---|---|---|---|
| 1 | Every **focusable or interactive part** (role in widget roles, or `tabindex ≥ 0`) has a non-empty accessible name | `computeAccessibleName` in DOM; `toHaveAccessibleName(/.+/)`; Chromium: CDP `name` | all; CDP for inert cases | RX#2127, ZG#2781, BU#5569, AK#6330, RA#9737 |
| 2 | **Name sources are reachable**: every `aria-labelledby`/`aria-describedby` target of an exposed element is not inside an `inert` subtree while a layer is open | walk target ancestors for `inert`; CDP `ignored` | all + Chromium | RA#9737, RA#8915 |
| 3 | **Focused element is exposed**: `document.activeElement` (deep, through shadow roots) has no `aria-hidden="true"` or `inert` ancestor, and is not `display:none`/`hidden` | ancestor walk; CDP `ignored === false` | all | RX#3701, BU#5183, ZG#3408 |
| 4 | **No focusable element inside an `aria-hidden` subtree** (axe `aria-hidden-focus` equivalent, run per step, cheaper than axe) | query `[aria-hidden=true] :is(tabbable)` | all | RK#2922, BU#4678, BU#5528, RK#2776 |
| 5 | **Exposed ⇔ interactive**: any element with `pointer-events` not `none` inside an open layer, or any open layer, is not in an `aria-hidden`/`inert` subtree | computed style + ancestor walk | browser | RX#4115, ARK#3728 |
| 6 | **Live regions stay live**: every `[aria-live]`/`role=status|alert|log` region (including the Announcer) exists before its first message, and is never inside an `aria-hidden`/`inert` subtree | track region mount time vs first text mutation (MutationObserver) | all | RX#1820, RA#3559, BU#4181, RA#5191 |
| 7 | **`aria-activedescendant`** points to an element that exists, is rendered, has an allowed role (`option`, `menuitem*`, `gridcell`, `row`, `treeitem`, `tab`), is inside the element named by `aria-controls`, and equals the part with `data-highlighted` | id lookup + role + containment | all | RX#4085, ZG#2947, AK#6682 |
| 8 | **Announcement parity**: on Apple-platform emulation, each highlight change emits exactly one Announcer message equal to the contract's `focusAnnouncement`; nothing elsewhere | Announcer spy | all (platform injected) | RA#10326, ZG#2936 |
| 9 | **Explicit selection state**: in a listbox/grid/tree with selection, every selectable item has `aria-selected` (or `aria-checked`) set to `"true"` or `"false"`, never absent; single mode has ≤ 1 true; true ⇔ the machine's selected set (not the highlight) | attribute scan vs oracle context | all | HUI#1599, BITS#2173, ZG#2947, RX#1907, BU#2366 |
| 10 | **Set metadata is consistent**: `aria-posinset` ∈ [1, `aria-setsize`], unique within a set, and equals the visible order after filtering | scan | all | RA#10711, AK#6301, RA#9556 |
| 11 | **Hidden-but-mounted parts are hidden for AT too**: when the oracle says a part is closed/inactive (kept mounted), it has `hidden`, `inert`, or `display:none`, not only visual hiding | attribute/style check | all | HUI#2688, RX#3085 |
| 12 | **Virtual activation parity**: for each transition whose contract action is `press`, replaying it as a bare `click` (`detail: 0`, no pointer/key events), as WebKit's AX press does, reaches the same oracle state | `virtual` modality in the driver | all | BITS#2185, RX#1963, RX#2700, ZG#1664, BITS#1760 |
| 13 | **Focus alone does not commit**: a programmatic `focus()` with no preceding key event changes no state except focus/highlight context (tabs do not select, menus do not open) unless the contract whitelists it (tooltip open on focus) | `virtual` focus step; oracle diff | all | RX#1047, RX#2248 |
| 14 | **No `aria-hidden`/`inert` on `<html>`/`<body>`**, and every attribute the library added is removed after close (snapshot diff; already in overlay notes) | attribute diff | all | ARK#2844, ARK#2715, ARK#3699, RK#2240 |
| 15 | **Name ≠ description** for the same element (no double reading) | compute both | all | RX#2988, RA#5329 |
| 16 | **Value attributes track the machine in the same step**: `aria-valuenow`/`aria-valuetext` (and value text nodes) equal the oracle value after each step, with no intermediate blur/focus of the control | attribute check + focus-event spy | all | BU#5296, RA#6402, ZG#3099 |
| 17 | **axe clean** on each unique reached state (dedup) | `@axe-core/playwright`, or `axe.run` in browser mode | browser | the static class |

**Exceptions** are declared in the contract, never silently skipped. Example:
if we follow BU and drop `aria-expanded` on submenu triggers while open on Apple
platforms, invariant "aria-expanded mirrors state" gets a contract-level
`quirk("vo-submenu-expanded")` reference. That reference links to the quirks
registry entry and its removal condition. Consumers see the same list.

**Not automatable** (manual protocol only): whether speech is *good* (verbosity,
order, double reading in a specific SR), VO's activedescendant behaviour itself,
NVDA browse/focus mode switching, mobile gestures, forced-colors legibility,
timing that users can manage (WCAG 2.2.1, BU#4253).

## Decisions

- **Support matrix**: the tiers in 1.1, published on the docs site with a
  generated per-component "Tested with" table.
- **Event modality** (`keyboard | pointer | touch | virtual`) on every machine
  event. Detection is in `core/dom/modality.ts`. Activation is bound to `click`.
- **Announcer** follows rule D: persistent regions, next-frame insert, mutation
  marker, muted in hidden tabs, never hidden. Patterns that use
  `aria-activedescendant` declare announcements in their contracts.
- **Quirks registry** `core/dom/quirks.ts`: every UA-gated workaround is an
  entry with a bug link, a repro test and a removal condition. The registry is
  re-tested once a year.
- **No focus-guard sentinels for modal layers**; `inert` instead.
- **Errors via `aria-describedby`** (+ `aria-invalid`); `aria-errormessage`
  only as an addition.
- **Testing stack**: TL + `dom-accessibility-api` (jsdom), Vitest browser in 3
  engines with `testMachine` + invariants 1–17 + deduplicated axe, CDP tree
  helper (Chromium), virtual SR for announcement logs, partial ARIA snapshots per
  state story (also emitted into docs), Storybook `a11y.test: "error"`, nightly
  Guidepup VO/NVDA, manual tier-1 protocol at `done` and release.
- The `virtual` modality and invariants 12–13 are what we add over every other
  library; none of their test suites drive AT-style activation.

## Open questions

1. **Apple detection for the announcer.** Gate on `platform.apple` (BU, RA, KB),
   or announce on all platforms and accept double speech in NVDA/JAWS? Guidepup
   NVDA nightly can measure the cost of the second option.
   *Resolved in add-a11y-foundations:* gate on Apple platforms via the `vo-activedescendant` quirk entry.
2. **Sentinel-free non-modal popovers.** Does `focusout` handling keep the VO
   virtual cursor in order on iOS (BU#5794)? This needs a prototype tested on a
   device during the Popover research.
3. **JAWS coverage.** JAWS is 55% of primary desktop SRs and cannot be automated
   (Guidepup has no JAWS driver). Do we buy a licence or a hosted service for
   the release checklist?
4. **Chromium inert-labelling bug** (crbug 489792331). Copy names onto content
   (and duplicate the source of truth), or keep the trigger outside the inert
   set with `aria-hidden` (RA's idea, RA#9737)? Decide in the Menu research.
5. **ARIA snapshots in docs.** Generate them per state story, or per contract
   state from `testMachine` runs, so they cannot drift from the machine?
   *Resolved in add-a11y-foundations:* per state story, with a check that every contract state has one.

