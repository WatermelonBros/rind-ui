// Link has no machine (design §1): its one part is `linkProps` plus its scope attributes.

import { type PartProps, scopeAttrs } from "../../connect/props"
import { type LinkEnv, type LinkInput, linkProps } from "../../dom/link"

declare const process: { env: { NODE_ENV?: string } }

export interface LinkConnectInput extends LinkInput {
  readonly instance: string
}

export function linkConnect(input: LinkConnectInput, env: LinkEnv): PartProps {
  return { ...scopeAttrs("link", "link", input.instance), ...linkProps(input, env) }
}

const warnedFallback = new WeakSet<Element>()

/** Development: a link rendered as another element loses the browser's link features. */
export function warnLinkFallback(el: Element): void {
  if (process.env.NODE_ENV === "production" || el.tagName === "A" || warnedFallback.has(el)) return
  warnedFallback.add(el)
  console.warn(
    `[rind-ui] link: rendered as <${el.tagName.toLowerCase()}>, it loses the browser's link features (context menu, middle click, drag, status-bar URL); render an <a> when you can`,
  )
}
