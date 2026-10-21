// Tooling half of the quirks registry: for each id in `quirk-conditions.ts`, its bug links,
// repro test, removal condition and last verification. Never imported by runtime code (the
// size check fails if a component bundle contains it). Type-only imports, so the scripts can
// load it directly in Node.

import type { GenericInvariantId } from "../contract/invariant-ids"
import type { QuirkId } from "./quirk-conditions"

export interface QuirkMeta {
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

export const quirkMeta = {
  "webkit-grid-selection-not-announced": {
    links: ["https://bugs.webkit.org/show_bug.cgi?id=235068"],
    test: "packages/testing/src/components/grid-list.dom.test.tsx",
    removeWhen: "VoiceOver speaks aria-selected changes on grid rows in Safari",
    verified: "2026-10-18",
    invariants: ["announcement-parity"],
  },
  "firefox-textarea-overflow": {
    links: ["https://bugzilla.mozilla.org/show_bug.cgi?id=1787062"],
    test: "packages/core/src/dom/autosize.browser.test.ts",
    removeWhen: "Firefox supports field-sizing: content (the measured fallback is then unused)",
    verified: "2026-10-15",
  },
  "talkback-unfocusable-link": {
    links: [
      "https://github.com/adobe/react-spectrum/issues/3998",
      "https://issuetracker.google.com/issues/267670776",
    ],
    test: "packages/core/src/dom/link.dom.test.ts",
    removeWhen: "TalkBack swipe reaches a role=link without tabindex (yearly re-test)",
    verified: "2026-10-15",
  },
  "webkit-synthetic-click-modifiers": {
    links: [
      "https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/HTMLAnchorElement.cpp",
      "https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/utils/src/openLink.tsx",
    ],
    test: "packages/core/src/dom/link.dom.test.ts",
    removeWhen: "WebKit honours modifier keys on a synthetic click on an anchor",
    verified: "2026-10-15",
  },
  "ios-vo-zero-size-pointer": {
    links: [
      "https://bugs.webkit.org/show_bug.cgi?id=222627",
      "https://bugs.webkit.org/show_bug.cgi?id=223202",
    ],
    test: "packages/core/src/dom/modality.dom.test.ts",
    removeWhen: "iOS VoiceOver dispatches pointer events with a real contact size",
    verified: "2026-10-14",
  },
  "chromium-at-click-1x1": {
    links: ["https://github.com/adobe/react-spectrum/issues/10310"],
    test: "packages/core/src/dom/modality.dom.test.ts",
    removeWhen: "Chromium marks AT-synthesised pointer events (e.g. detail 0 or pointerType '')",
    verified: "2026-10-14",
  },
  "macos-meta-keyup": {
    links: [
      "https://crbug.com/1393524",
      "https://bugs.webkit.org/show_bug.cgi?id=55291",
      "https://bugzilla.mozilla.org/show_bug.cgi?id=1299553",
    ],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "macOS browsers fire keyup for keys released while ⌘ is held",
    verified: "2026-10-14",
  },
  "webkit-menuitem-double-click": {
    links: ["https://bugs.webkit.org/show_bug.cgi?id=228318"],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "VoiceOver dispatches one click for VO+Space on a button with role=menuitem",
    verified: "2026-10-14",
  },
  "vo-submenu-expanded": {
    links: [
      "https://github.com/mui/base-ui/blob/master/packages/react/src/menu/submenu-trigger/MenuSubmenuTrigger.tsx",
    ],
    test: "packages/core/src/components/menu/menu.connect.test.ts",
    removeWhen: "VoiceOver reads the focused submenu item after an aria-expanded change",
    verified: "2026-10-16",
    invariants: ["state-attrs"],
  },
  "ios-emulated-mouse-after-touch": {
    links: ["https://bugs.webkit.org/show_bug.cgi?id=214609"],
    test: "packages/core/src/dom/hover.dom.test.ts",
    removeWhen: "iOS stops firing emulated mouse pointer events after touch",
    verified: "2026-10-14",
  },
  "webkit-touch-action-manipulation": {
    links: ["https://bugs.webkit.org/show_bug.cgi?id=240917"],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "Safari fires pointercancel on scroll with touch-action: manipulation",
    verified: "2026-10-14",
  },
  "ios-text-selection": {
    links: [
      "https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/interactions/src/textSelection.ts",
    ],
    test: "packages/core/src/dom/press.dom.test.ts",
    removeWhen: "iOS honours user-select: none on the pressed element during a long touch",
    verified: "2026-10-14",
  },
  "safari-ime-commit-enter": {
    links: ["https://bugs.webkit.org/show_bug.cgi?id=165004"],
    test: "packages/core/src/dom/keyboard.dom.test.ts",
    removeWhen: "Safari fires the composition-committing Enter keydown before compositionend",
    verified: "2026-10-14",
  },
  "vo-activedescendant": {
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
  "vo-section-entry": {
    links: ["https://github.com/adobe/react-spectrum/pull/10503"],
    test: "packages/core/src/dom/quirks.test.ts",
    removeWhen: "VoiceOver announces section changes and committed selections in composites",
    verified: "2026-10-14",
  },
  "react-action-form-reset": {
    links: [
      "https://github.com/adobe/react-spectrum/issues/6830",
      "https://github.com/adobe/react-spectrum/issues/7708",
    ],
    test: "packages/react/src/action-form-reset.dom.test.tsx",
    removeWhen: "React exposes the reason for a form reset",
    verified: "2026-10-14",
  },
  "ios-vo-spinbutton-input": {
    links: [
      "https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/numberfield/useNumberField.ts",
    ],
    test: "packages/core/src/dom/quirks-input.test.ts",
    removeWhen:
      'a device test shows iOS VoiceOver focusing and editing an <input role="spinbutton">',
    verified: "2026-10-14",
  },
  "keypad-decimal-separator": {
    links: [
      "https://github.com/adobe/react-spectrum/issues/5731",
      "https://github.com/chakra-ui/ark/issues/3500",
    ],
    test: "packages/core/src/dom/quirks-input.test.ts",
    removeWhen: "touch decimal keypads follow the field's lang or inputmode locale",
    verified: "2026-10-14",
  },
  "ios-overflow-hidden-scroll": {
    links: [
      "https://bugs.webkit.org/show_bug.cgi?id=153852",
      "https://github.com/tailwindlabs/headlessui/issues/3890",
    ],
    test: "packages/core/src/dom/scroll-lock.dom.test.ts",
    removeWhen: "iOS Safari stops page scrolling under overflow: hidden on the root",
    verified: "2026-10-14",
  },
  "firefox-label-focus-unfocused-window": {
    links: ["https://github.com/WatermelonBros/rind-ui/pull/5"],
    test: "packages/testing/src/components/label-activation.browser.test.tsx",
    removeWhen: "Firefox on Linux focuses a label's control on activation",
    verified: "2026-10-16",
  },
  "nvda-progressbar-name": {
    links: [
      "https://github.com/mui/base-ui/issues/4184",
      "https://github.com/nvaccess/nvda/issues/13904",
      "https://github.com/nvaccess/nvda/issues/16204",
      "https://github.com/FreedomScientific/standards-support/issues/354",
    ],
    test: "packages/core/src/components/progress/progress.connect.test.ts",
    removeWhen:
      "NVDA reads progressbar/meter names without text content (nvda#16204 fixed) in the two latest NVDA releases",
    verified: "2026-10-16",
  },
  "talkback-aria-sort": {
    links: [
      "https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/table/useTableColumnHeader.ts",
    ],
    test: "packages/core/src/components/table/table.connect.test.ts",
    removeWhen:
      "a device test shows TalkBack reading the sort direction of a column header with aria-sort (manual protocol)",
    verified: "2026-10-19",
  },
  "firefox-scroller-tab-stop": {
    links: ["https://bugzilla.mozilla.org/show_bug.cgi?id=1069739"],
    test: "packages/testing/src/components/table.browser.test.tsx",
    removeWhen:
      "Firefox skips a scroll container that holds focusable descendants in sequential focus",
    verified: "2026-10-19",
  },
} as const satisfies Record<QuirkId, QuirkMeta>

/** Ids of the entries that list `invariant` (what a contract exception may reference). */
export type QuirksAffecting<I extends GenericInvariantId> = {
  [K in QuirkId]: (typeof quirkMeta)[K] extends { readonly invariants: readonly (infer L)[] }
    ? I extends L
      ? K
      : never
    : never
}[QuirkId]
