// The element, `type`, substitution and disabled rules every button-like part shares
// (openspec button-like-element): Button, Toggle, the Switch and Checkbox controls and
// every trigger. Keyboard rules are press interactions' (by rendered tag and role); an
// `<a href>` takes link-navigation's rules through `linkProps`.

import { dataFlag, type PartProps } from "../../connect/props"
import { type LinkEnv, type LinkInput, linkProps } from "../../dom/link"
import type { Href, RouterOptions } from "../../env/router"

export interface ButtonLikeInput {
  /** The role the component declares for a non-native element. */
  readonly role: "button" | "checkbox" | "switch" | "radio"
  /** The rendered tag (lowercase): the default element's on the server. */
  readonly tag: string
  /** The rendered element's `href`, when it is an anchor (`<a href>` takes link rules). */
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  /** Button only; every other part is always "button". */
  readonly type?: "button" | "submit" | "reset" | undefined
  /** The document's origin, for the link branch (`linkProps`); undefined while hydrating. */
  readonly origin?: string | undefined
  readonly onActivate?: LinkInput["onActivate"]
}

/** Which rules apply to the rendered element. */
export type ButtonLikeKind = "native" | "link" | "generic"

export function buttonLikeKind(tag: string, href: unknown): ButtonLikeKind {
  if (tag === "button" || tag === "input") return "native"
  if ((tag === "a" || tag === "area") && href !== undefined) return "link"
  return "generic"
}

export function buttonLikeProps(input: ButtonLikeInput, env: LinkEnv): PartProps {
  const { disabled, focusableWhenDisabled } = input
  const kind = buttonLikeKind(input.tag, input.href)
  if (kind === "link") {
    // An <a href> is a link: link-navigation decides activation, disabled and routing.
    return linkProps(
      {
        href: input.href,
        routerOptions: input.routerOptions,
        disabled,
        focusableWhenDisabled,
        origin: input.origin,
        onActivate: input.onActivate,
        tag: input.tag,
      },
      env,
    )
  }
  if (kind === "native") {
    return {
      type: input.type ?? "button",
      disabled: disabled && !focusableWhenDisabled ? true : undefined,
      "aria-disabled": disabled && focusableWhenDisabled ? "true" : undefined,
      "data-disabled": dataFlag(disabled),
    }
  }
  return {
    role: input.role,
    tabindex: disabled && !focusableWhenDisabled ? -1 : 0,
    "aria-disabled": disabled ? "true" : undefined,
    "data-disabled": dataFlag(disabled),
  }
}
