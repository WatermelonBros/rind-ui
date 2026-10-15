// Link's API facts for the generated docs (scripts/docs-gen.ts). Data only, with type-only
// imports, so Node loads it directly. Prop names are checked against `LinkInput` here; the
// contract's actions and queries and the data attributes against the code in link.meta.test.ts.

import type { LinkInput } from "../../dom/link"
import type { ComponentMeta } from "../meta"

type LinkPropName = Exclude<keyof LinkInput, "tag" | "origin"> | "render"

export const linkMeta = {
  scope: "link",
  name: "Link",
  stateless: true,
  parts: [{ name: "Link", part: "link", element: "a", description: "The link itself." }],
  props: {
    href: { type: "Href", description: "Where it goes. Typed by an augmented `RouterConfig`." },
    target: { type: "string", description: "Passed to the anchor; not `_self` opens elsewhere." },
    rel: { type: "string", description: "Passed to the anchor." },
    download: { type: "boolean | string", description: "Download instead of navigating." },
    ping: { type: "string", description: "Passed to the anchor." },
    referrerPolicy: { type: "ReferrerPolicy", description: "Passed to the anchor." },
    hrefLang: { type: "string", description: "Passed to the anchor." },
    routerOptions: {
      type: "RouterOptions",
      description: "Passed unchanged to the router's `navigate`.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "No `href`, `aria-disabled`, out of the Tab order; nothing navigates.",
    },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Keeps a disabled link in the Tab order.",
    },
    current: {
      type: 'boolean | "page" | "step" | "location" | "date" | "time"',
      description: "Sets `aria-current` and `data-current`; the link still navigates.",
    },
    onActivate: {
      type: "(details: LinkActivation) => void",
      description:
        'Once per activation, with `href`, `modality` and `disposition` (`"same-tab"` or `"elsewhere"`).',
    },
    render: {
      type: "ReactElement | (props, state) => ReactNode",
      description:
        'Another element (`<div />` gets the `role="link"` fallback) or a component, such as a router\'s Link, which then navigates itself.',
    },
  } satisfies Record<LinkPropName, ComponentMeta["props"][string]>,
  dataAttributes: {
    link: {
      "data-scope": '"link"',
      "data-part": '"link"',
      "data-instance": "The instance id.",
      "data-current": "While `current` is set.",
      "data-disabled": "While disabled.",
      "data-external": "The resolved URL is on another origin.",
      "data-focus": "While focused.",
      "data-focus-visible": "While focused by keyboard or assistive technology.",
      "data-hover": "While a mouse or pen is over it.",
      "data-pressed": "While a press is in progress.",
    },
  },
  keyboard: [
    ["Enter", "Follows the link."],
    ["⌘/Ctrl + Enter", "Opens it in a new tab (the router is not called)."],
    ["Shift + Enter", "Opens it in a new window."],
    ["Space", "Nothing: the page scrolls, as for a native link."],
    ["Tab / Shift + Tab", "Next / previous tabbable element; a disabled link is skipped."],
  ],
  contract: {
    actions: {
      follow: ["pointer", "keyboard", "virtual"],
      followInNewTab: ["pointer", "keyboard", "virtual"],
      middleClick: ["pointer", "virtual"],
    },
    queries: ["href", "current", "isDisabled", "isExternal", "isFocusVisible"],
    traits: [],
  },
} as const satisfies ComponentMeta
