// Runtime half of the quirks registry: when each workaround applies, by id. Checking a quirk
// loads only this module; the bug links, repro tests and removal conditions live in
// `quirk-meta.ts` (tooling and docs only), keyed by the same ids. Adding an entry means adding
// it to both: the compiler fails until they match.

import type { PlatformFlags, PlatformInfo } from "../env/capabilities"

export const quirkConditions = {
  // VoiceOver with WebKit does not speak aria-selected changes on grid rows: Grid List
  // announces "{name} selected" itself (as React Aria's useGridSelectionAnnouncement).
  "webkit-grid-selection-not-announced": (p) => p.apple && p.webkit,
  // Firefox shows a scrollbar when overflow is toggled on an autosizing textarea; it keeps
  // its own overflow (as React Aria does).
  "firefox-textarea-overflow": (p) => p.firefox,
  // TalkBack cannot be detected: always on, and harmless elsewhere (Tab still skips it).
  "talkback-unfocusable-link": () => true,
  "webkit-synthetic-click-modifiers": (p) => p.webkit && p.mac && !p.ios,
  "ios-vo-zero-size-pointer": (p) => p.ios,
  "chromium-at-click-1x1": (p) => p.chromium,
  "macos-meta-keyup": (p) => p.mac,
  "webkit-menuitem-double-click": (p) => p.webkit,
  // VoiceOver announces the expanded-state change of a submenu trigger instead of the
  // submenu's first item; without aria-expanded it reads the item focus moved to.
  "vo-submenu-expanded": (p) => p.apple,
  "ios-emulated-mouse-after-touch": (p) => p.ios,
  "webkit-touch-action-manipulation": (p) => p.webkit,
  "ios-text-selection": (p) => p.ios,
  "safari-ime-commit-enter": (p) => p.webkit,
  // VoiceOver in Chrome speaks the highlighted option itself: announcing there doubles it.
  "vo-activedescendant": (p) => p.apple && p.engine === "webkit",
  // VoiceOver is silent on entering a section and on committing a selection in every
  // browser, so these are announced on every Apple platform.
  "vo-section-entry": (p) => p.apple,
  // Not a platform quirk: React 19 itself resets a form after its action completes, with
  // no user event in progress; the React adapter tells it from a user reset (add-form).
  "react-action-form-reset": () => true,
  // VoiceOver on iOS cannot focus or edit an <input role="spinbutton">; React Aria drops the
  // role there. Number Input and the Date Field's segments (the same element) gate on it.
  "ios-vo-spinbutton-input": (p) => p.ios,
  // Touch numeric keypads insert a decimal separator chosen by the device, not the field
  // locale; the mapping belongs to add-number-input and is gated by this entry.
  "keypad-decimal-separator": (p) => p.ios || p.android,
  // iOS Safari scrolls the page under overflow:hidden on the root: the scroll lock adds a
  // touchmove policy there (no position:fixed body, no focus() patching).
  "ios-overflow-hidden-scroll": (p) => p.ios,
  // Firefox on Linux (headless CI) forwards a label's activation click to its control but
  // does not move focus, even when the document reports focus (macOS Firefox does). Tests
  // assert the forwarded click and check focus outside Firefox. No runtime workaround.
  "firefox-label-focus-unfocused-window": (p) => p.firefox,
  // NVDA (and JAWS) drop the name of a progressbar or meter with no text content: Root
  // ends with one visually hidden, presentational character. NVDA cannot be detected and
  // the markup must match on the server, so it is always on (Progress, Meter).
  "nvda-progressbar-name": () => true,
  // TalkBack does not read aria-sort on a column header: the sorted column's SortTrigger
  // carries a visually hidden "sorted ascending" description (Table).
  "talkback-aria-sort": (p) => p.android,
  // Firefox makes an overflowing scroll container a tab stop even when it holds focusable
  // controls; the Table takes its Root out of the order (tabindex -1) while it holds them, so
  // Tab goes straight to the sort buttons. Harmless elsewhere: always on.
  "firefox-scroller-tab-stop": () => true,
} satisfies Record<string, (platform: PlatformFlags) => boolean>

export type QuirkId = keyof typeof quirkConditions

/** Whether a registered workaround applies on the injected platform. */
export function quirkActive(id: QuirkId, env: PlatformInfo): boolean {
  return quirkConditions[id](env.platform)
}
