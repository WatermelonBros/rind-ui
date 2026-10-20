"use client"

import {
  type CompositeHost,
  type PartProps as CorePartProps,
  createListCollection,
  type SeparatorOrientation,
  toolbarConnect,
  toolbarIds,
  toolbarMachine,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import { Button, type ButtonProps } from "../button/button"
import { CompositeHostContext, useCompositeHost, useHostItem } from "../composite-host"
import { Link, type LinkProps } from "../link/link"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { SeparatorHostContext } from "../separator/separator"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** The toolbar's parts read its connect through the host (groups re-provide it). */
type ToolbarHost = CompositeHost & {
  readonly api: ReturnType<typeof toolbarConnect>
}
function useToolbar(part: string): ToolbarHost {
  const host = useCompositeHost()
  if (!host || !("api" in host)) throw new Error(`Toolbar.${part} must be inside Toolbar.Root`)
  return host as ToolbarHost // the toolbar's own host object (the only one with `api`)
}

/** What `actionsRef` exposes. */
export interface ToolbarActions {
  /** Focuses the toolbar's tab stop (for an application shortcut such as Alt+F10). */
  focus(): void
}

export interface ToolbarState {
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
}

export type ToolbarRootProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  /** The toolbar's controls and separators. */
  readonly children?: ReactNode
  readonly orientation?: "horizontal" | "vertical"
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean
  readonly disabled?: boolean
  /** Disabled controls stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled?: boolean
  readonly actionsRef?: Ref<ToolbarActions>
  readonly render?: RenderProp<ToolbarState>
}

function Root({
  orientation = "horizontal",
  loop = true,
  disabled = false,
  focusableWhenDisabled = true,
  actionsRef,
  render,
  id,
  ref,
  children,
  ...rest
}: ToolbarRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const ids = useMemo(() => toolbarIds(instance), [instance])
  const { collection: registered, registry } = useCollectionItems()
  const collection = registered ?? EMPTY
  const { view, send } = useMachine(toolbarMachine, {
    collection,
    strategy: "roving",
    ids,
    loop,
    // Each control registers as skipped when it is not focusable while disabled.
    focusableWhenDisabled: false,
    orientation,
    disabled,
  })
  const api = toolbarConnect(
    {
      instance,
      collection,
      highlightedKey: view.context.highlightedKey,
      focusWithin: view.matches("focused"),
      pending: registered === null,
      orientation,
      disabled,
      focusableWhenDisabled,
    },
    send,
    env,
  )
  useImperativeHandle(actionsRef, () => ({ focus: () => send({ type: "FOCUS_TOOLBAR" }) }), [send])
  // Render order (the server tab stop): reset on every render of the root.
  const first = useRef<string | null>(null)
  first.current = null
  const host: ToolbarHost = {
    kind: "toolbar",
    orientation,
    disabled,
    focusableWhenDisabled,
    register: registry.register,
    itemProps: (item) => api.control(item),
    claimFirst: (id) => {
      first.current ??= id
      return first.current === id
    },
    api,
  }
  const el = useRef<HTMLElement | null>(null)
  // Development: a toolbar needs a name (aria-label or aria-labelledby).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
      console.warn(
        `[rind-ui] toolbar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
      )
    }
  })
  const separators = useMemo(
    () => ({
      context: "toolbar" as const,
      defaultOrientation: (orientation === "horizontal"
        ? "vertical"
        : "horizontal") as SeparatorOrientation,
    }),
    [orientation],
  )
  const props = mergeProps({ ...normalizeProps(api.root()), ref: composeRefs(el, ref) }, rest)
  return (
    <CompositeHostContext value={host}>
      <SeparatorHostContext value={separators}>
        {renderPart("div", { ...props, children }, render, { orientation, disabled })}
      </SeparatorHostContext>
    </CompositeHostContext>
  )
}

/**
 * A control's roving wiring: its element id is its key; disabled from itself, its group or
 * the toolbar; skipped by arrows when not focusable while disabled.
 */
function useControl(
  part: string,
  own: { readonly id?: string | undefined; readonly disabled: boolean },
  focusable: boolean | undefined,
  el: { current: Element | null },
) {
  const host = useToolbar(part)
  const generated = useId()
  const id = own.id ?? `toolbar-control-${generated.replace(/:/g, "")}`
  const disabled = host.disabled || own.disabled
  const keepsFocus = focusable ?? host.focusableWhenDisabled
  useHostItem(host, { id, skip: disabled && !keepsFocus }, el)
  const first = host.claimFirst(id)
  return { host, id, disabled, keepsFocus, roving: host.itemProps({ id, disabled, first }) }
}

/** Roving props as React props, without the handler the caller joins itself. */
const reactProps = (p: CorePartProps) => normalizeProps(p)

export type ToolbarButtonProps = ButtonProps

function ToolbarButton({ id, disabled = false, focusableWhenDisabled, ref, ...rest }: ButtonProps) {
  const el = useRef<HTMLElement | null>(null)
  const c = useControl("Button", { id, disabled }, focusableWhenDisabled, el)
  const props = mergeProps(
    {
      ...reactProps({ ...c.roving, ...c.host.api.part("button", c.id) }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return <Button {...props} id={c.id} disabled={c.disabled} focusableWhenDisabled={c.keepsFocus} />
}

export type ToolbarLinkProps = LinkProps

function ToolbarLink({ id, disabled = false, focusableWhenDisabled, ref, ...rest }: LinkProps) {
  const el = useRef<HTMLElement | null>(null)
  const c = useControl("Link", { id, disabled }, focusableWhenDisabled, el)
  const props = mergeProps(
    {
      ...reactProps({ ...c.roving, ...c.host.api.part("link", c.id) }),
      // Space activates a link once without scrolling the page (Enter stays native).
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== " " || e.defaultPrevented || e.target !== e.currentTarget) return
        e.preventDefault()
        if (!e.repeat) e.currentTarget.click()
      },
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return <Link {...props} id={c.id} disabled={c.disabled} focusableWhenDisabled={c.keepsFocus} />
}

export interface ToolbarItemState {
  readonly disabled: boolean
}

export type ToolbarItemProps = Omit<ComponentPropsWithRef<"button">, "disabled"> & {
  /** Disables this control (the toolbar's or its group's `disabled` also does). */
  readonly disabled?: boolean
  /** Overrides the toolbar's `focusableWhenDisabled` for this control. */
  readonly focusableWhenDisabled?: boolean
  /** The control: another component's part (a Menu trigger), a checkbox, a text input. */
  readonly render: RenderProp<ToolbarItemState>
}

const TEXT_TAGS = new Set(["input", "textarea"])

function ToolbarItem({
  id,
  disabled = false,
  focusableWhenDisabled,
  render,
  ref,
  ...rest
}: ToolbarItemProps) {
  const el = useRef<HTMLElement | null>(null)
  const c = useControl("Item", { id, disabled }, focusableWhenDisabled, el)
  const tag = useRenderedTag("button", render, el)
  const disabledProps = !c.disabled
    ? {}
    : c.keepsFocus
      ? // Focusable while disabled: announced, and a text field takes no input (base-ui#5366).
        { "aria-disabled": "true", ...(TEXT_TAGS.has(tag) ? { readOnly: true } : {}) }
      : { disabled: true }
  const props = mergeProps(
    {
      ...reactProps({ ...c.roving, ...c.host.api.part("item", c.id) }),
      ...disabledProps,
      id: c.id,
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, { disabled: c.disabled })
}

export interface ToolbarGroupState {
  readonly disabled: boolean
}

export type ToolbarGroupProps = ComponentPropsWithRef<"div"> & {
  /** Disables every control inside the group. */
  readonly disabled?: boolean
  readonly render?: RenderProp<ToolbarGroupState>
}

function ToolbarGroup({ disabled = false, render, children, ...rest }: ToolbarGroupProps) {
  const host = useToolbar("Group")
  const groupDisabled = host.disabled || disabled
  // The same host, disabled for the controls inside (hosted composites included).
  const inner: ToolbarHost = { ...host, disabled: groupDisabled }
  const props = mergeProps(normalizeProps(host.api.group(groupDisabled)), rest)
  return (
    <CompositeHostContext value={inner}>
      {renderPart("div", { ...props, children }, render, { disabled: groupDisabled })}
    </CompositeHostContext>
  )
}

export type ToolbarSeparatorProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  /** Default: perpendicular to the toolbar. */
  readonly orientation?: SeparatorOrientation
  readonly render?: RenderProp<{ readonly orientation: SeparatorOrientation }>
}

function ToolbarSeparator({ orientation, render, ref, ...rest }: ToolbarSeparatorProps) {
  const host = useToolbar("Separator")
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("div", render, el)
  const own = normalizeProps(host.api.separator({ orientation, tag }))
  const props = mergeProps({ ...own, ref: composeRefs(el, ref) }, rest)
  return renderPart("div", props, render, {
    orientation: own["data-orientation"] as SeparatorOrientation, // set by separatorProps
  })
}

export const Toolbar = {
  Root,
  Button: ToolbarButton,
  Link: ToolbarLink,
  Item: ToolbarItem,
  Group: ToolbarGroup,
  Separator: ToolbarSeparator,
}
