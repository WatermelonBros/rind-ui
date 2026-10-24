// Alert's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in alert.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"alert"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const alertMeta = {
  scope: "alert",
  name: "Alert",
  stateless: false,
  parts: [
    {
      name: "Alert.Root",
      part: "root",
      element: "div",
      description:
        "The message in the page layout. No role and no live attribute: it announces through the Announcer.",
    },
    {
      name: "Alert.Icon",
      part: "icon",
      element: "span",
      description:
        'Decorative (`aria-hidden="true"`), or `role="img"` named by `label` so the severity is in the text.',
    },
    {
      name: "Alert.Title",
      part: "title",
      element: "div",
      description: 'The first sentence announced; its stable id names a `role="region"` Root.',
    },
    {
      name: "Alert.Description",
      part: "description",
      element: "div",
      description: "Announced after the Title.",
    },
    {
      name: "Alert.CloseTrigger",
      part: "close-trigger",
      element: "button",
      description:
        'Dismisses the alert (`reason: "close-trigger"`); named "Dismiss" when it has no text. Never announced.',
    },
  ],
  props: {
    announce: {
      type: '"polite" | "assertive" | "off"',
      default: '"polite"',
      description:
        'Root: announces once when it appears after load and when its text changes while shown. `"assertive"` for errors, `"off"` for static content.',
    },
    announcement: {
      type: "string",
      description:
        "Root: the message announced instead of the Icon label, Title and Description joined.",
    },
    open: {
      type: "boolean",
      description: "Root: controlled visibility.",
    },
    defaultOpen: {
      type: "boolean",
      default: "true",
      description: "Root: initial visibility, uncontrolled.",
    },
    onOpenChange: {
      type: "(open, details) => void",
      description: 'Root: `details.reason` is `"close-trigger"` for a dismissal.',
    },
    finalFocus: {
      type: "() => HTMLElement | null | false",
      description:
        "Root: where focus goes when the alert is dismissed with focus inside; default the next tab stop after it (else the previous). `false`: focus does not move.",
    },
    messages: {
      type: "{ dismiss?: string; announcement?: (segments) => string }",
      description: "Root: overrides the English defaults (also through the provider).",
    },
    "*.label": {
      type: "string",
      description: 'Icon: names it as an image (`role="img"`) and puts it in the announcement.',
    },
    "*.render": {
      type: "RenderProp",
      description: "Substitutes the rendered element (a Title as a Heading, say).",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-state": '"open", or "closed" while the exit animation runs.' },
    icon: base("icon"),
    title: base("title"),
    description: base("description"),
    "close-trigger": {
      ...base("close-trigger"),
      "data-focus": "While focused.",
      "data-focus-visible": "While focused from the keyboard or assistive technology.",
    },
  },
  keyboard: [["Enter / Space", "On the CloseTrigger: dismiss; focus moves to the next control."]],
  states: {
    open: "Shown; announced when it appears after load and when its text changes.",
    closed: 'Dismissed: exits with `data-state="closed"`, then unmounts. Nothing is announced.',
  },
  contract: {
    actions: { dismiss: ["pointer", "touch", "keyboard"] },
    queries: ["isOpen", "title", "description"],
    traits: ["presence"],
  },
} as const satisfies ComponentMeta
