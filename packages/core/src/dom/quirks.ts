// The registry of every browser-, platform- and assistive-technology-specific workaround
// in rind-ui. Code checks an entry by id (`quirkActive`), never the user agent. This file
// has no runtime imports, so `scripts/quirks-check.ts` can load it directly in Node.

import type { GenericInvariantId } from "../contract/invariant-ids"
import type { PlatformFlags, PlatformInfo } from "../env/capabilities"

export interface Quirk<Id extends string = string> {
  readonly id: Id
  /** When the workaround applies, from the injected platform. */
  readonly when: (platform: PlatformFlags) => boolean
  /** At least one bug or issue link. */
  readonly links: readonly [string, ...string[]]
  /** Repo path of the test that reproduces the problem. */
  readonly test: string
  /** When the entry can be deleted. */
  readonly removeWhen: string
  /** Last time the repro was checked against current browsers (YYYY-MM-DD). */
  readonly verified: `${number}-${number}-${number}`
  /** Generic invariants the quirk affects (allowed contract exceptions). */
  readonly invariants?: readonly GenericInvariantId[]
}

/** Declares the registry; entry ids become the `QuirkId` union. */
export function defineQuirks<const Q extends readonly Quirk[]>(entries: Q): Q {
  return entries
}

export const quirks = defineQuirks([
  {
    id: "firefox-textarea-overflow",
    // Firefox shows a scrollbar when overflow is toggled on an autosizing textarea; it keeps
    // its own overflow (as React Aria does).
    when: (p) => p.firefox,
    links: ["https://bugzilla.mozilla.org/show_bug.cgi?id=1787062"],
    test: "packages/core/src/dom/autosize.browser.test.ts",
    removeWhen: "Firefox supports field-sizing: content (the measured fallback is then unused)",
    verified: "2026-10-15",
  },
  {
    id: "talkback-unfocusable-link",
    // TalkBack cannot be detected: always on, and harmless elsewhere (Tab still skips it).
    when: () => true,
    links: [
      "https://github.com/adobe/react-spectrum/issues/3998",
      "https://issuetracker.google.com/issues/267670776",
    ],
    test: "packages/core/src/dom/link.dom.test.ts",
    removeWhen: "TalkBack swipe reaches a role=link without tabindex (yearly re-test)",
    verified: "2026-10-15",
  },
  {
    id: "webkit-synthetic-click-modifiers",
    when: (p) => p.webkit && p.mac && !p.ios,
    links: [
      "https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/HTMLAnchorElement.cpp",
      "https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/utils/src/openLink.tsx",
    ],
    test: "packages/core/src/dom/link.dom.test.ts",
    removeWhen: "WebKit honours modifier keys on a synthetic click on an anchor",
    verified: "2026-10-15",
  },
  {
    id: "ios-vo-zero-size-pointer",
    when: (p) => p.ios,
    links: [
      "https://bugs.webkit.org/show_bug.cgi?id=222627",
      "https://bugs.webkit.org/show_bug.cgi?id=223202",
    ],
    test: "packages/core/src/dom/modality.dom.test.ts",
    removeWhen: "iOS VoiceOver dispatches pointer events with a real contact size",
    verified: "2026-10-14",
  },
  {
    id: "chromium-at-click-1x1",
    when: (p) => p.chromium,
    links: ["https://github.com/adobe/react-spectrum/issues/10310"],
    test: "packages/core/src/dom/modality.dom.test.ts",
    removeWhen: "Chromium marks AT-synthesised pointer events (e.g. detail 0 or pointerType '')",
    verified: "2026-10-14",
  },
  {
    id: "macos-meta-keyup",
    when: (p) => p.mac,
    links: [
      "https://crbug.com/1393524",
      "https://bugs.webkit.org/show_bug.cgi?id=55291",
      "https://bugzilla.mozilla.org/show_bug.cgi?id=1299553",
    ],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "macOS browsers fire keyup for keys released while ⌘ is held",
    verified: "2026-10-14",
  },
  {
    id: "webkit-menuitem-double-click",
    when: (p) => p.webkit,
    links: ["https://bugs.webkit.org/show_bug.cgi?id=228318"],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "VoiceOver dispatches one click for VO+Space on a button with role=menuitem",
    verified: "2026-10-14",
  },
  {
    // VoiceOver announces the expanded-state change of a submenu trigger instead of the
    // submenu's first item; without aria-expanded it reads the item focus moved to.
    id: "vo-submenu-expanded",
    when: (p) => p.apple,
    links: [
      "https://github.com/mui/base-ui/blob/master/packages/react/src/menu/submenu-trigger/MenuSubmenuTrigger.tsx",
    ],
    test: "packages/core/src/components/menu/menu.connect.test.ts",
    removeWhen: "VoiceOver reads the focused submenu item after an aria-expanded change",
    verified: "2026-10-16",
    invariants: ["state-attrs"],
  },
  {
    id: "ios-emulated-mouse-after-touch",
    when: (p) => p.ios,
    links: ["https://bugs.webkit.org/show_bug.cgi?id=214609"],
    test: "packages/core/src/dom/hover.dom.test.ts",
    removeWhen: "iOS stops firing emulated mouse pointer events after touch",
    verified: "2026-10-14",
  },
  {
    id: "webkit-touch-action-manipulation",
    when: (p) => p.webkit,
    links: ["https://bugs.webkit.org/show_bug.cgi?id=240917"],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "Safari fires pointercancel on scroll with touch-action: manipulation",
    verified: "2026-10-14",
  },
  {
    id: "ios-text-selection",
    when: (p) => p.ios,
    links: [
      "https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/interactions/src/textSelection.ts",
    ],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "iOS honours user-select: none on the pressed element during a long touch",
    verified: "2026-10-14",
  },
  {
    id: "safari-ime-commit-enter",
    when: (p) => p.webkit,
    links: ["https://bugs.webkit.org/show_bug.cgi?id=165004"],
    test: "packages/core/src/dom/keyboard.dom.test.ts",
    removeWhen: "Safari fires the composition-committing Enter keydown before compositionend",
    verified: "2026-10-14",
  },
  {
    id: "vo-activedescendant",
    // VoiceOver in Chrome speaks the highlighted option itself: announcing there doubles it.
    when: (p) => p.apple && p.engine === "webkit",
    links: [
      "https://github.com/chakra-ui/zag/issues/2936",
      "https://github.com/adobe/react-spectrum/issues/10326",
      "https://github.com/mui/base-ui/issues/5721",
      "https://github.com/adobe/react-spectrum/pull/10503",
    ],
    test: "packages/core/src/dom/quirks.test.ts",
    removeWhen: "VoiceOver in Safari announces aria-activedescendant changes on macOS and iOS",
    verified: "2026-10-14",
    invariants: ["announcement-parity"],
  },
  {
    id: "vo-section-entry",
    // VoiceOver is silent on entering a section and on committing a selection in every
    // browser, so these are announced on every Apple platform.
    when: (p) => p.apple,
    links: ["https://github.com/adobe/react-spectrum/pull/10503"],
    test: "packages/core/src/dom/quirks.test.ts",
    removeWhen: "VoiceOver announces section changes and committed selections in composites",
    verified: "2026-10-14",
  },
  {
    id: "react-action-form-reset",
    // Not a platform quirk: React 19 itself resets a form after its action completes, with
    // no user event in progress; the React adapter tells it from a user reset (add-form).
    when: () => true,
    links: [
      "https://github.com/adobe/react-spectrum/issues/6830",
      "https://github.com/adobe/react-spectrum/issues/7708",
    ],
    test: "packages/react/src/action-form-reset.dom.test.tsx",
    removeWhen: "React exposes the reason for a form reset",
    verified: "2026-10-14",
  },
  {
    id: "ios-vo-spinbutton-input",
    // VoiceOver on iOS cannot focus or edit an <input role="spinbutton">; React Aria drops the
    // role there. The Number Input change (add-number-input) gates on this entry.
    when: (p) => p.ios,
    links: [
      "https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/numberfield/useNumberField.ts",
    ],
    test: "packages/core/src/dom/quirks-input.test.ts",
    removeWhen:
      'a device test shows iOS VoiceOver focusing and editing an <input role="spinbutton">',
    verified: "2026-10-14",
  },
  {
    id: "keypad-decimal-separator",
    // Touch numeric keypads insert a decimal separator chosen by the device, not the field
    // locale; the mapping belongs to add-number-input and is gated by this entry.
    when: (p) => p.ios || p.android,
    links: [
      "https://github.com/adobe/react-spectrum/issues/5731",
      "https://github.com/chakra-ui/ark/issues/3500",
    ],
    test: "packages/core/src/dom/quirks-input.test.ts",
    removeWhen: "touch decimal keypads follow the field's lang or inputmode locale",
    verified: "2026-10-14",
  },
  {
    id: "ios-overflow-hidden-scroll",
    // iOS Safari scrolls the page under overflow:hidden on the root: the scroll lock adds a
    // touchmove policy there (no position:fixed body, no focus() patching).
    when: (p) => p.ios,
    links: [
      "https://bugs.webkit.org/show_bug.cgi?id=153852",
      "https://github.com/tailwindlabs/headlessui/issues/3890",
    ],
    test: "packages/core/src/dom/scroll-lock.dom.test.ts",
    removeWhen: "iOS Safari stops page scrolling under overflow: hidden on the root",
    verified: "2026-10-14",
  },
  {
    id: "firefox-label-focus-unfocused-window",
    // Firefox on Linux (headless CI) forwards a label's activation click to its control but
    // does not move focus, even when the document reports focus (macOS Firefox does). Tests
    // assert the forwarded click and check focus outside Firefox. No runtime workaround.
    when: (p) => p.firefox,
    links: ["https://github.com/WatermelonBros/rind-ui/pull/5"],
    test: "packages/testing/src/components/label-activation.browser.test.tsx",
    removeWhen: "Firefox on Linux focuses a label's control on activation",
    verified: "2026-10-16",
  },
])

export type QuirkId = (typeof quirks)[number]["id"]

/** Whether a registered workaround applies on the injected platform. */
export function quirkActive(id: QuirkId, env: PlatformInfo): boolean {
  return quirks.find((q) => q.id === id)?.when(env.platform) ?? false
}

type Entry = (typeof quirks)[number]

/** Ids of the entries that list `invariant` (what a contract exception may reference). */
export type QuirksAffecting<I extends GenericInvariantId> = Entry extends infer E
  ? E extends { readonly id: infer Id; readonly invariants: readonly (infer L)[] }
    ? I extends L
      ? Id
      : never
    : never
  : never
