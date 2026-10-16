// Avatar's parts (design §3): one accessible name on Root (`role="img"`), whatever the
// image status, so the name never follows network timing; the <img> is presentational
// (`alt=""`) and only `hidden` when there is nothing to show (`idle`, `error`), never while
// loading, so `loading="lazy"` still works. No inline styles.

import { type PartProps, scopeAttrs } from "../../connect/props"
import type { ImageStatus } from "../image-status/image-status.machine"

declare const process: { env: { NODE_ENV?: string } }

export interface AvatarConnectState {
  readonly instance: string
  readonly status: ImageStatus
  /** The consumer's `aria-label` / `aria-labelledby` on Root. */
  readonly named: boolean
  /** The consumer's `aria-hidden` on Root. */
  readonly hidden: boolean
}

const dev = () => process.env.NODE_ENV !== "production"
const warn = (message: string) => console.warn(`[rind-ui] avatar: ${message}`)

/** Whether a consumer's props name the element. */
export const isNamed = (own: Readonly<Record<string, unknown>>): boolean =>
  (typeof own["aria-label"] === "string" && own["aria-label"] !== "") ||
  (typeof own["aria-labelledby"] === "string" && own["aria-labelledby"] !== "")

/** Whether a consumer's `aria-hidden` hides the element. */
export const isAriaHidden = (own: Readonly<Record<string, unknown>>): boolean =>
  own["aria-hidden"] === true || own["aria-hidden"] === "true"

export function avatarConnect(state: AvatarConnectState) {
  const dataState = state.status
  return {
    root: (): PartProps => ({
      ...scopeAttrs("avatar", "root", state.instance),
      role: state.named && !state.hidden ? "img" : undefined,
      "data-state": dataState,
    }),
    image: (): PartProps => ({
      ...scopeAttrs("avatar", "image", state.instance),
      alt: "",
      hidden: state.status === "idle" || state.status === "error" ? true : undefined,
      "data-state": dataState,
    }),
    fallback: (): PartProps => ({
      ...scopeAttrs("avatar", "fallback", state.instance),
      "data-state": dataState,
    }),
  }
}

/** The Group: a named `group` that keeps no state and chooses no avatars. */
export const avatarGroupProps = (instance: string): PartProps => ({
  ...scopeAttrs("avatar", "group", instance),
  role: "group",
})

/** GroupOverflow: "+N" visible and hidden from AT, its label visually hidden. */
export const avatarGroupOverflowProps = (instance: string): PartProps =>
  scopeAttrs("avatar", "group-overflow", instance)

/** Development: Root with neither a name nor `aria-hidden` (role img requires a name). */
export function checkAvatarName(own: Readonly<Record<string, unknown>>, instance: string): void {
  if (!dev() || isNamed(own) || isAriaHidden(own)) return
  console.error(
    `[rind-ui] avatar "${instance}" has no accessible name: pass aria-label or aria-labelledby, or aria-hidden="true" when it sits beside the person's visible name`,
  )
}

/** Development: an unnamed Group. */
export function checkAvatarGroupName(own: Readonly<Record<string, unknown>>): void {
  if (dev() && !isNamed(own)) {
    warn("Avatar.Group needs aria-label or aria-labelledby (it is a group)")
  }
}

/** Development: more than one Image in a Root. */
export function checkImageCount(count: number): void {
  if (dev() && count > 1) warn("an Avatar.Root renders more than one Avatar.Image; render one")
}

/** Development: an Image `alt` the Root's `role="img"` hides from assistive technology. */
export function checkImageAlt(alt: unknown, rootName: string | undefined): void {
  if (!dev() || typeof alt !== "string" || alt === "" || alt === rootName) return
  warn(
    `the Image alt "${alt}" is hidden by the Root's role="img"; name the Root with aria-label instead`,
  )
}
