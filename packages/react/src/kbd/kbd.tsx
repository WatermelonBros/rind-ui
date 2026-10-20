import {
  type KbdItem,
  type KbdKeys,
  type KbdMessages,
  kbdConnect,
  kbdMessages,
  keyShortcuts,
  type MessageOverrides,
  parseKeys,
} from "@rind-ui/core"
import { type ComponentPropsWithRef, useSyncExternalStore } from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    kbd: KbdMessages
  }
}

/** What every part's `render` receives. */
export interface KbdRenderState {
  readonly platform: "apple" | "other"
}

const noSubscribe = () => () => {}

/**
 * The platform: the prop, else the environment's after hydration; the server snapshot is
 * "other", so the first client render matches the server's HTML.
 */
function usePlatform(own: "apple" | "other" | undefined): "apple" | "other" {
  const env = useEnvironment()
  const detected = useSyncExternalStore(
    noSubscribe,
    // platform-convention: ⌘ on Apple, Ctrl elsewhere (the Kbd's whole point)
    () => (env.platform.apple ? "apple" : "other"),
    () => "other" as const,
  )
  return own ?? detected
}

/**
 * The `aria-keyshortcuts` value for the control a shortcut activates, from the same keys a
 * Kbd shows, on the environment's platform (`undefined` for a sequence).
 */
export function useKeyShortcuts(keys: KbdKeys, platform?: "apple" | "other"): string | undefined {
  return keyShortcuts(keys, usePlatform(platform) === "apple")
}

export type KbdRootProps = ComponentPropsWithRef<"kbd"> & {
  /** "mod+shift+p" (a chord), "g i" (a sequence), or one chord's key names. */
  readonly keys?: KbdKeys
  /** Overrides the environment's platform. */
  readonly platform?: "apple" | "other"
  readonly messages?: MessageOverrides<KbdMessages>
  readonly render?: RenderProp<KbdRenderState>
}

function Root({
  keys,
  platform: ownPlatform,
  messages: ownMessages,
  render,
  id,
  children,
  ...rest
}: KbdRootProps) {
  const instance = useRootId(id)
  const messages = useMessages("kbd", kbdMessages, ownMessages)
  const platform = usePlatform(ownPlatform)
  const api = kbdConnect({
    instance,
    chords: keys === undefined ? [] : parseKeys(keys),
    apple: platform === "apple",
    messages,
  })
  const state: KbdRenderState = { platform }
  const hidden = normalizeProps(api.hiddenProps())
  const item = (it: KbdItem, i: number) =>
    it.type === "key" ? (
      <kbd key={i} {...normalizeProps(api.key(it.key))}>
        <span {...normalizeProps(api.glyph(it.key))}>{it.key.glyph}</span>
        {api.keyLabel(it.key) === null ? null : <span {...hidden}>{api.keyLabel(it.key)}</span>}
      </kbd>
    ) : (
      <span key={i} {...normalizeProps(api.separator(it.kind))}>
        <span aria-hidden="true">{api.separatorText(it.kind)}</span>
        <span {...hidden}>{api.separatorSpoken(it.kind)}</span>
      </span>
    )
  const content = keys === undefined ? children : api.items.map(item)
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) },
    rest,
  )
  return renderPart("kbd", { ...props, children: content }, render, state)
}

export const Kbd = { Root }
