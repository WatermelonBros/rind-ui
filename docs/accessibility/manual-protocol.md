# Manual screen-reader protocol

Required for each component **before it is marked `done`**, and for each changed
component **at release**. Source:
[assistive-tech-and-a11y-testing.md §2.8](../research/assistive-tech-and-a11y-testing.md#28-manual-testing-protocol).

## Checklist

- [ ] **Environment recorded**: OS, browser and AT versions; AT released in the last
      ~18 months. AT settings reset to defaults first (VoiceOver Utility → Reset, which
      turns off Arrow-key Quick Nav; NVDA defaults; JAWS default verbosity).
- [ ] **Matrix**: every tier-1 row of the [support matrix](support-matrix.md). JAWS on a
      licensed machine, a 40-minute demo session or a hosted service. iOS and Android on
      real devices — simulators do not run VoiceOver or TalkBack as users do.
- [ ] **Number field on iOS**: with VoiceOver on a real iOS device, check that it can focus
      and edit a number field (quirk `ios-vo-spinbutton-input`). If it can with
      `role="spinbutton"`, the quirk can be removed.
- [ ] **Scroll lock on iOS**: on a real iPhone and iPad with Safari, open a modal over a
      long page and confirm the page behind does not scroll or rubber-band while the layer's
      own content scrolls and pinch zoom works
      ([§2.8 item 7](../research/assistive-tech-and-a11y-testing.md)).
- [ ] **Announcements under a modal**: VoiceOver + Safari: announcements under an open
      `aria-modal` dialog are spoken. If not, add a quirk entry that sends announcements
      through `ariaNotify` on the topmost modal content (see "Announcer inside modal dialogs"
      in `openspec/changes/add-overlay-infrastructure/design.md`).
- [ ] **Script from the contract**: each state × each action, done
  - [ ] with the keyboard alone,
  - [ ] with the screen reader's own commands (VO+arrows, VO+Space; NVDA browse mode +
        Enter; JAWS virtual cursor; swipe and double-tap on mobile),
  - [ ] with a mouse while the screen reader runs.
- [ ] **Listened for**: name, role, state, value, position ("2 of 5"), announcements,
      and where focus lands after close, select and Escape.
- [ ] **Before filing an AT bug**: the same steps on the APG example and on the native
      control. If they fail the same way, add a quirk entry with the external bug link
      (`packages/core/src/dom/quirks.ts`, then `pnpm docs:gen`).
- [ ] **Recorded**: a video with speech output for every failure; one record per
      combination added to [tested-with.json](tested-with.json), then `pnpm docs:gen`.
- [ ] **Visual checks on the theme**: Windows High Contrast (Edge and Firefox), 400 % zoom
      and reflow, `prefers-reduced-motion`.

## Recording a pass

Add one object per combination to `records` in [tested-with.json](tested-with.json):

```json
{
  "component": "dialog",
  "at": "NVDA",
  "atVersion": "2026.3",
  "browser": "Chrome",
  "browserVersion": "141",
  "os": "Windows 11",
  "date": "2026-10-14",
  "result": "pass",
  "notes": "optional"
}
```

`result` is `pass` or `issues` (link the issue in `notes`). A component page shows the
table where it contains `<!-- tested-with:dialog --><!-- /tested-with -->`.

## Device checklist: anchored popups (positioning)

Automated tests cannot reproduce on-screen keyboards or pinch-zoom; run these on real
devices for every component that positions a popup (Select, Combobox, Menu, Popover …).

- [ ] **iOS Safari, on-screen keyboard**: focus a combobox input near the bottom of the
      page; the list flips above the input or caps its height, and stays attached and
      readable while the keyboard is open.
- [ ] **iOS Safari, pinch-zoom**: open a menu, pinch-zoom and pan; the menu stays attached
      to its trigger and is not dragged away from it. It remains usable and scrollable.
- [ ] **Android Chrome, keyboard**: the same combobox check as iOS; the popup follows the
      visual viewport and does not end up behind the keyboard.

## Device checklist: Label (add-label 10.1)

Story: Components/Label → ForInput (and AsSpan, NonLabelableTarget). Record each pass in
`tested-with.json` with `component: "label"`.

- [ ] **NVDA + Chrome (Windows)**: Tab to the input: NVDA reads "Email, edit". Click the
      Label: the input is focused and its name is read once (not twice).
- [ ] **VoiceOver + Safari (macOS)**: VO+Right onto the input reads "Email, edit text".
      Click the Label: the input is focused, and VoiceOver reads its name once.
- [ ] **Both**: on NonLabelableTarget, clicking the Label focuses the group and its name
      ("Colour") comes from the Label through `aria-labelledby`.

## Device checklist: Fieldset (add-fieldset 10.1)

Stories: Components/Fieldset → AddressGroup, Disabled, Invalid. Record each pass in
`tested-with.json` with `component: "fieldset"`.

- [ ] **NVDA + Chrome**, **JAWS + Chrome**, **VoiceOver + Safari**: Tab into the first
      field of AddressGroup: the group name "Shipping address" is spoken on entering, and
      the description is read.
- [ ] **All three**: in Disabled, the controls are announced as dimmed / unavailable.
- [ ] **All three**: in Invalid, the group's description includes the error text.

## Device checklist: Field (add-field 12.1)

Stories: Components/Field → WithDescriptionAndError, Blur. Record each pass in
`tested-with.json` with `component: "field"`.

- [ ] **NVDA + Chrome, JAWS + Chrome, VoiceOver macOS + Safari, VoiceOver iOS, TalkBack**:
      submit WithDescriptionAndError empty; focus lands on the field and the error is read
      with the name and description, once (no double reading).
- [ ] **All**: in Blur, type an invalid email and Tab on; the error announcement
      ("Email: …") is spoken once.

## Device checklist: Form (add-form 10.1)

Story: Components/Form → SignUp. Record each pass in `tested-with.json` with
`component: "form"`.

- [ ] **NVDA + Chrome, JAWS + Chrome, VoiceOver macOS + Safari, VoiceOver iOS, TalkBack**:
      submit with 1 error: focus lands on the field and its error is read; no summary.
- [ ] **All**: submit with 3 errors: focus on the first field, its error read, and
      "3 fields have errors" spoken once.
