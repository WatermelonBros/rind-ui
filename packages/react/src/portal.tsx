import { portalHostAttributes, resolvePortalTarget, syncPortalHost } from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { CompositeHostContext } from "./composite-host"
import { mergeProps } from "./merge-props"
import { type RenderProp, renderPart } from "./render"
import { SeparatorHostContext } from "./separator/separator"

export type PortalProps = ComponentPropsWithRef<"div"> & {
  /** Where to render (default: resolved from the logical parent, then `body`). */
  readonly container?: Element | ShadowRoot | null | undefined
  /** The element the content belongs to (its trigger): target resolution and dir/lang/theme. */
  readonly logicalParent?: (() => Element | null) | undefined
  readonly render?: RenderProp
  readonly children?: ReactNode
}

/**
 * Renders its children into a host `div[data-rind-portal]` outside the tree. Nothing on the
 * server and nothing during hydration (no mismatch: radix#1386); mounts after. The host
 * carries the logical parent's dir, lang, data-rind-theme and data-theme, kept in sync, and
 * follows a changing `container` (radix#3599).
 */
export function Portal({ container, logicalParent, render, children, ...rest }: PortalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const parent = useRef(logicalParent)
  parent.current = logicalParent
  const [attributes, setAttributes] = useState<Record<string, string>>({})
  // State, not a ref: a new container remounts the host, and the sync must follow the new element.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!host) return
    return syncPortalHost(host, () => parent.current?.() ?? null)
  }, [host])
  // The first render after mount already has the right attributes (no flash in the wrong dir).
  useLayoutEffect(() => {
    if (mounted) setAttributes(portalHostAttributes(parent.current?.() ?? null))
  }, [mounted])
  if (!mounted) return null
  const target = resolvePortalTarget(parent.current?.() ?? null, container)
  // A component in a popup is not hosted by the toolbar its trigger sits in (nor are its
  // separators drawn in the toolbar's context).
  const props = mergeProps(
    {
      "data-rind-portal": "",
      ...attributes,
      ref: setHost,
      children: (
        <CompositeHostContext value={null}>
          <SeparatorHostContext value={null}>{children}</SeparatorHostContext>
        </CompositeHostContext>
      ),
    },
    rest,
  )
  return createPortal(renderPart("div", props, render, undefined), target)
}
