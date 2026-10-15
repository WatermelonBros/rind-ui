// Browser-suite harness for the anchored fixture: the fixture's own machine, connect and
// contract, with the knobs the fixture component hides (portal container, document or shadow
// root, placement tap, service handle, styles). Test support only.
import {
  domEnvironment,
  domPositioning,
  type Placement,
  type Positioning,
  type Service,
} from "@rind-ui/core"
import { mergeProps, normalizeProps, Portal, useMachine } from "@rind-ui/react"
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { collectDom } from "../../src/collect"
import { layoutInvariant, type StepFacts } from "../../src/index"
import { connect } from "./anchored.connect"
import { anchoredContract } from "./anchored.contract"
import {
  type AnchoredMachine,
  type AnchoredProps,
  anchoredIds,
  anchoredMachine,
  optionsOf,
} from "./anchored.machine"

export interface PopProps extends Omit<AnchoredProps, "root"> {
  readonly id: string
  readonly label?: string
  /** Size of the filler inside the content. */
  readonly width?: number
  readonly height?: number
  readonly contentStyle?: CSSProperties
  readonly positionerStyle?: CSSProperties
  readonly triggerStyle?: CSSProperties
  /** The document or shadow root the instance lives in (default: the global document). */
  readonly rootNode?: () => Document | ShadowRoot
  /** Portal container (default: resolved from the trigger, as a real component would). */
  readonly container?: Element | null
  readonly keepMounted?: boolean
  /** Every placement the machine is sent (the events that reach it). */
  readonly onPlacement?: (placement: Placement, first: boolean) => void
  readonly onService?: (service: Service<AnchoredMachine>) => void
}

export function Pop(p: PopProps) {
  const { id, label = "Open", width = 160, height = 80, rootNode, container, keepMounted } = p
  const { contentStyle, positionerStyle, triggerStyle, onPlacement, onService, ...machineProps } = p
  const tap = useRef(onPlacement)
  tap.current = onPlacement
  // biome-ignore lint/correctness/useExhaustiveDependencies: one environment per instance
  const env = useMemo(() => {
    const base = domEnvironment(rootNode ? { getRootNode: rootNode } : {})
    const inner = domPositioning(base)
    const position: Positioning = {
      ...inner,
      track: (r) =>
        inner.track({
          ...r,
          onPlacement: (pl, first) => {
            tap.current?.(pl, first)
            r.onPlacement(pl, first)
          },
        }),
    }
    return { ...base, position }
  }, [])
  const root = { ...machineProps, root: id } satisfies AnchoredProps
  const { view, send, service } = useMachine(anchoredMachine, root, env)
  useEffect(() => {
    onService?.(service)
  }, [service, onService])
  const open = view.matches("open")
  const ids = anchoredIds(id)
  const triggerEl = () => (rootNode?.() ?? document).getElementById(ids.trigger)
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: triggerEl reads stable ids
  useLayoutEffect(() => {
    if (!open) return
    setDir(triggerEl()?.closest("[dir]")?.getAttribute("dir") === "rtl" ? "rtl" : "ltr")
  }, [open])
  const [focusWithin, setFocusWithin] = useState(false)
  const parts = connect(
    {
      open,
      placement: view.context.placement,
      dir,
      focusWithin,
      manual: optionsOf(root).mode === "manual",
    },
    send,
    id,
  )
  const arrow = p.arrow ? normalizeProps(parts.arrow()) : null
  return (
    <>
      <button
        type="button"
        {...mergeProps(normalizeProps(parts.trigger()), { style: triggerStyle })}
      >
        {label}
      </button>
      {open || keepMounted ? (
        <Portal container={container} logicalParent={triggerEl}>
          <div
            {...mergeProps(normalizeProps(parts.positioner()), open ? {} : { hidden: true }, {
              style: positionerStyle,
            })}
          >
            <div
              {...mergeProps(normalizeProps(parts.content()), {
                style: contentStyle,
                onFocus: () => setFocusWithin(true),
                onBlur: (e: { relatedTarget: EventTarget | null; currentTarget: Element }) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    setFocusWithin(false)
                },
              })}
            >
              {arrow ? (
                <div
                  {...mergeProps(arrow, { style: { width: 10, height: 10, background: "gray" } })}
                />
              ) : null}
              <h2 {...normalizeProps(parts.title())}>Details</h2>
              {/* Fixed width: the UA default (size=20) is font-dependent, 212 px in WebKit on Linux. */}
              <input aria-label="Note" style={{ width: 100 }} />
              <div data-filler style={{ width, height }} />
              <button type="button" {...normalizeProps(parts.close())}>
                Close
              </button>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  )
}

/** A trigger placed at a viewport-absolute position. */
export function At({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <div style={{ position: "absolute", left: x, top: y }}>{children}</div>
}

export const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel) as T
export const positioner = (root?: ParentNode) => q('[data-part="positioner"]', root)
export const triggerOf = (root?: ParentNode) => q('[data-part="trigger"]', root)
export const rect = (el: Element) => el.getBoundingClientRect()
export const css = (el: HTMLElement, name: string) => el.style.getPropertyValue(name)
export const px = (el: HTMLElement, name: string) => Number.parseFloat(css(el, name))

/** Resolves after `n` animation frames. */
export const frames = (n: number, win: Window = window) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : win.requestAnimationFrame(() => step(left - 1))
    step(n)
  })

/** The layout invariant on a fresh snapshot of an instance (browser mode only). */
export function layoutProblems(instance: string): readonly string[] {
  const after = collectDom({ scope: "anchored", instance })
  // The invariant reads only `after` and `semantics`; a full StepFacts needs a model run.
  return layoutInvariant({ after, semantics: anchoredContract.semantics } as unknown as StepFacts)
}

/** Collects window `error` events (the "ResizeObserver loop" trap); returns the list and a stop. */
export function trapErrors() {
  const seen: string[] = []
  const on = (e: ErrorEvent) => {
    seen.push(e.message)
  }
  window.addEventListener("error", on)
  return { seen, stop: () => window.removeEventListener("error", on) }
}
