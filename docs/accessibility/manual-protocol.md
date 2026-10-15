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
