/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type CompositeHost,
  createListCollection,
  layoutCapability,
  type SeparatorOrientation,
  toolbarConnect,
  toolbarIds,
  toolbarMachine,
} from "@rind-ui/core"
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  splitProps,
} from "solid-js"
import { Button, type ButtonProps } from "../button/button"
import { CompositeHostContext, useCompositeHost, useHostItem } from "../composite-host"
import { afterMount } from "../lifecycle"
import { Link, type LinkProps } from "../link/link"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { SeparatorHostContext } from "../separator/separator"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** The toolbar's parts read its connect through the host (groups re-provide it). */
type ToolbarHost = CompositeHost & { readonly api: ReturnType<typeof toolbarConnect> }
function useToolbar(part: string): ToolbarHost {
  const host = useCompositeHost()
  if (!host || !("api" in host)) throw new Error(`Toolbar.${part} must be inside Toolbar.Root`)
  return host as ToolbarHost // the toolbar's own host object (the only one with `api`)
}

/** What the Root hands to `actionsRef`. */
export interface ToolbarActions {
  /** Focuses the toolbar's tab stop (for an application shortcut such as Alt+F10). */
  focus(): void
}

export interface ToolbarState {
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
}

export type ToolbarRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children" | "id"> & {
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled controls stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Receives the actions once (a ref to call `focus()` from an application shortcut). */
  readonly actionsRef?: ((actions: ToolbarActions) => void) | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<ToolbarState> | undefined
  /** The toolbar's controls and separators. */
  readonly children?: JSX.Element | ((state: ToolbarState) => JSX.Element)
}

function Root(props: ToolbarRootProps) {
  const [local, rest] = splitProps(props, [
    "orientation",
    "loop",
    "disabled",
    "focusableWhenDisabled",
    "actionsRef",
    "id",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => local.id)
  const ids = createMemo(() => toolbarIds(instance()))
  const orientation = () => local.orientation ?? "horizontal"
  const disabled = () => local.disabled === true
  const focusableWhenDisabled = () => local.focusableWhenDisabled ?? true
  const { collection: registered, registry } = useCollectionItems()
  const collection = () => registered() ?? EMPTY
  const { view, send } = useMachine(
    toolbarMachine,
    () => ({
      collection: collection(),
      strategy: "roving" as const,
      ids: ids(),
      loop: local.loop ?? true,
      // Each control registers as skipped when it is not focusable while disabled.
      focusableWhenDisabled: false,
      orientation: orientation(),
      disabled: disabled(),
    }),
    env,
  )
  const api = createMemo(() =>
    toolbarConnect(
      {
        instance: instance(),
        collection: collection(),
        highlightedKey: view().context.highlightedKey,
        focusWithin: view().matches("focused"),
        pending: registered() === null,
        orientation: orientation(),
        disabled: disabled(),
        focusableWhenDisabled: focusableWhenDisabled(),
      },
      send,
      env,
    ),
  )
  local.actionsRef?.({ focus: () => send({ type: "FOCUS_TOOLBAR" }) })
  // The first control rendered claims the server tab stop (render order).
  let first: string | null = null
  // Getters: the controls read the toolbar's current props in their own computations.
  const host: ToolbarHost = {
    kind: "toolbar",
    get orientation() {
      return orientation()
    },
    get disabled() {
      return disabled()
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled()
    },
    register: registry.register,
    itemProps: (item) => api().control(item),
    claimFirst: (id) => {
      first ??= id
      return first === id
    },
    get api() {
      return api()
    },
  }
  const separatorHost = {
    context: "toolbar" as const,
    get defaultOrientation(): SeparatorOrientation {
      return orientation() === "horizontal" ? "vertical" : "horizontal"
    },
  }
  const [el, setEl] = createSignal<Element | null>(null)
  // Development: a toolbar needs a name (aria-label or aria-labelledby).
  afterMount(() =>
    createEffect(() => {
      const node = el()
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] toolbar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    }),
  )
  const state = reactive<ToolbarState>(() => ({
    orientation: orientation(),
    disabled: disabled(),
  }))
  const merged = createMemo(() => mergeProps({ ...normalizeProps(api().root()), ref: setEl }, rest))
  const children = () => resolveChildren(local.children, state)
  return (
    <CompositeHostContext.Provider value={host}>
      <SeparatorHostContext.Provider value={separatorHost}>
        {renderPart(local.render, merged, state, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </SeparatorHostContext.Provider>
    </CompositeHostContext.Provider>
  )
}

/**
 * A control's roving wiring: its element id is its key; disabled from itself, its group or
 * the toolbar; skipped by arrows when not focusable while disabled. Call in a component.
 */
function useControl(
  part: string,
  own: () => {
    readonly id?: string | undefined
    readonly disabled: boolean
    readonly focusable: boolean | undefined
  },
) {
  const host = useToolbar(part)
  const generated = createUniqueId()
  const [el, setEl] = createSignal<Element | null>(null)
  const id = () => own().id ?? `toolbar-control-${generated.replace(/:/g, "")}`
  const disabled = () => host.disabled || own().disabled
  const keepsFocus = () => own().focusable ?? host.focusableWhenDisabled
  useHostItem(host, () => ({ id: id(), skip: disabled() && !keepsFocus() }), el)
  return {
    host,
    el,
    setEl,
    id,
    disabled,
    keepsFocus,
    /** The roving props; claims the server tab stop in render order. */
    roving: () => host.itemProps({ id: id(), disabled: disabled(), first: host.claimFirst(id()) }),
  }
}

interface ControlOptions {
  readonly id?: string | undefined
  readonly disabled?: boolean | undefined
  /** Overrides the toolbar's `focusableWhenDisabled` for this control. */
  readonly focusableWhenDisabled?: boolean | undefined
}

export type ToolbarButtonProps = Omit<ButtonProps, keyof ControlOptions | "href"> & ControlOptions

function ToolbarButton(props: ToolbarButtonProps) {
  const [local, rest] = splitProps(props, ["id", "disabled", "focusableWhenDisabled", "children"])
  const c = useControl("Button", () => ({
    id: local.id,
    disabled: local.disabled === true,
    focusable: local.focusableWhenDisabled,
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps({ ...c.roving(), ...c.host.api.part("button", c.id()) }),
        ref: c.setEl,
      },
      rest,
    ),
  )
  return (
    <Button
      {...(merged() as ButtonProps)}
      id={c.id()}
      disabled={c.disabled()}
      focusableWhenDisabled={c.keepsFocus()}
    >
      {local.children as JSX.Element}
    </Button>
  )
}

export type ToolbarLinkProps = Omit<LinkProps, keyof ControlOptions> & ControlOptions

function ToolbarLink(props: ToolbarLinkProps) {
  const [local, rest] = splitProps(props, ["id", "disabled", "focusableWhenDisabled", "children"])
  const c = useControl("Link", () => ({
    id: local.id,
    disabled: local.disabled === true,
    focusable: local.focusableWhenDisabled,
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps({ ...c.roving(), ...c.host.api.part("link", c.id()) }),
        // Space activates a link once without scrolling the page (Enter stays native).
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key !== " " || e.defaultPrevented || e.target !== e.currentTarget) return
          e.preventDefault()
          if (!e.repeat) (e.currentTarget as HTMLElement).click()
        },
        ref: c.setEl,
      },
      rest,
    ),
  )
  return (
    <Link
      {...(merged() as LinkProps)}
      id={c.id()}
      disabled={c.disabled()}
      focusableWhenDisabled={c.keepsFocus()}
    >
      {local.children as JSX.Element}
    </Link>
  )
}

export interface ToolbarItemState {
  readonly disabled: boolean
}

const TEXT_TAGS = new Set(["input", "textarea"])

export type ToolbarItemProps = Omit<JSX.HTMLAttributes<HTMLElement>, "children" | "id"> &
  ControlOptions & {
    /** The control: the element the toolbar's props go on (default: a button). */
    readonly render?: RenderProp<ToolbarItemState> | undefined
    readonly children?: JSX.Element | ((state: ToolbarItemState) => JSX.Element)
  }

/** A control rendered by `render` (a Menu trigger, a checkbox, a text input). */
function ToolbarItem(props: ToolbarItemProps) {
  const [local, rest] = splitProps(props, [
    "id",
    "disabled",
    "focusableWhenDisabled",
    "render",
    "children",
  ])
  const c = useControl("Item", () => ({
    id: local.id,
    disabled: local.disabled === true,
    focusable: local.focusableWhenDisabled,
  }))
  const tag = () => (local.render ? (c.el()?.tagName.toLowerCase() ?? "button") : "button")
  const merged = createMemo(() => {
    const disabledProps = !c.disabled()
      ? {}
      : c.keepsFocus()
        ? // Focusable while disabled: announced, and a text field takes no input (base-ui#5366).
          { "aria-disabled": "true", ...(TEXT_TAGS.has(tag()) ? { readOnly: true } : {}) }
        : { disabled: true }
    return mergeProps(
      {
        ...normalizeProps({ ...c.roving(), ...c.host.api.part("item", c.id()) }),
        ...disabledProps,
        id: c.id(),
        ref: c.setEl,
      },
      rest,
    )
  })
  const state = reactive<ToolbarItemState>(() => ({ disabled: c.disabled() }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export interface ToolbarGroupState {
  readonly disabled: boolean
}

export type ToolbarGroupProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Disables every control inside the group. */
  readonly disabled?: boolean | undefined
  readonly render?: RenderProp<ToolbarGroupState> | undefined
  readonly children?: JSX.Element | ((state: ToolbarGroupState) => JSX.Element)
}

function ToolbarGroup(props: ToolbarGroupProps) {
  const [local, rest] = splitProps(props, ["disabled", "render", "children"])
  const host = useToolbar("Group")
  const groupDisabled = () => host.disabled || local.disabled === true
  // The same host, disabled for the controls inside (hosted composites included).
  const inner: ToolbarHost = Object.create(host, {
    disabled: { get: groupDisabled, enumerable: true },
  })
  const state = reactive<ToolbarGroupState>(() => ({ disabled: groupDisabled() }))
  const merged = createMemo(() => mergeProps(normalizeProps(host.api.group(groupDisabled())), rest))
  const children = () => resolveChildren(local.children, state)
  return (
    <CompositeHostContext.Provider value={inner}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </CompositeHostContext.Provider>
  )
}

export type ToolbarSeparatorProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Default: perpendicular to the toolbar. */
  readonly orientation?: SeparatorOrientation | undefined
  readonly render?: RenderProp<{ readonly orientation: SeparatorOrientation }> | undefined
  readonly children?:
    | JSX.Element
    | ((state: { readonly orientation: SeparatorOrientation }) => JSX.Element)
}

function ToolbarSeparator(props: ToolbarSeparatorProps) {
  const [local, rest] = splitProps(props, ["orientation", "render", "children"])
  const host = useToolbar("Separator")
  const [el, setEl] = createSignal<Element | null>(null)
  const own = createMemo(() =>
    normalizeProps(
      host.api.separator({
        orientation: local.orientation,
        tag: local.render ? (el()?.tagName.toLowerCase() ?? "div") : "div",
      }),
    ),
  )
  const state = reactive(() => ({ orientation: own()["data-orientation"] as SeparatorOrientation }))
  const merged = createMemo(() => mergeProps({ ...own(), ref: setEl }, rest))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

/** The parts, by name: `toolbar.parts.ts` re-exports them as the `Toolbar` namespace. */
export {
  Root,
  ToolbarButton as Button,
  ToolbarGroup as Group,
  ToolbarItem as Item,
  ToolbarLink as Link,
  ToolbarSeparator as Separator,
}
