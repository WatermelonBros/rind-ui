/** @jsxImportSource solid-js */
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
import { type Accessor, createMemo, createSignal, For, type JSX, splitProps } from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
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

/**
 * The platform: the prop, else the environment's after mount; server and hydration render
 * "other", so the first client render matches the server's HTML.
 */
function usePlatform(own: () => "apple" | "other" | undefined): Accessor<"apple" | "other"> {
  const env = useEnvironment()
  const [detected, setDetected] = createSignal<"apple" | "other">("other")
  afterMount(() => setDetected(env.platform.apple ? "apple" : "other"))
  return () => own() ?? detected()
}

/**
 * The `aria-keyshortcuts` value for the control a shortcut activates, from the same keys a
 * Kbd shows, on the environment's platform (`undefined` for a sequence). Call it in a component.
 */
export function useKeyShortcuts(
  keys: () => KbdKeys,
  platform: () => "apple" | "other" | undefined = () => undefined,
): Accessor<string | undefined> {
  const resolved = usePlatform(platform)
  return () => keyShortcuts(keys(), resolved() === "apple")
}

export type KbdRootProps = Omit<JSX.HTMLAttributes<HTMLElement>, "children"> & {
  /** "mod+shift+p" (a chord), "g i" (a sequence), or one chord's key names. */
  readonly keys?: KbdKeys | undefined
  /** Overrides the environment's platform. */
  readonly platform?: "apple" | "other" | undefined
  readonly messages?: MessageOverrides<KbdMessages> | undefined
  readonly render?: RenderProp<KbdRenderState> | undefined
  readonly children?: JSX.Element
}

function Root(props: KbdRootProps) {
  const [local, rest] = splitProps(props, [
    "keys",
    "platform",
    "messages",
    "render",
    "id",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const messages = useMessages("kbd", kbdMessages, () => local.messages)
  const platform = usePlatform(() => local.platform)
  const api = createMemo(() =>
    kbdConnect({
      instance: instance(),
      chords: local.keys === undefined ? [] : parseKeys(local.keys),
      apple: platform() === "apple",
      messages: messages(),
    }),
  )
  const state = reactive<KbdRenderState>(() => ({ platform: platform() }))
  const hidden = () => normalizeProps(api().hiddenProps())
  const item = (it: KbdItem) =>
    it.type === "key" ? (
      <kbd {...normalizeProps(api().key(it.key))}>
        <span {...normalizeProps(api().glyph(it.key))}>{it.key.glyph}</span>
        {api().keyLabel(it.key) === null ? null : (
          <span {...hidden()}>{api().keyLabel(it.key)}</span>
        )}
      </kbd>
    ) : (
      <span {...normalizeProps(api().separator(it.kind))}>
        <span aria-hidden="true">{api().separatorText(it.kind)}</span>
        <span {...hidden()}>{api().separatorSpoken(it.kind)}</span>
      </span>
    )
  const children = () =>
    local.keys === undefined ? local.children : <For each={api().items}>{item}</For>
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  return renderPart(local.render, merged, state, children, (p) => <kbd {...p}>{children()}</kbd>)
}

/** The parts, by name: `kbd.parts.ts` re-exports them as the `Kbd` namespace. */
export { Root }
