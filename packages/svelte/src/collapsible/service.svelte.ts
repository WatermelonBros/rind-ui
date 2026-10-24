import {
  type ChangeDetails,
  type ClosedContent,
  type CollapsibleEvent,
  type CollapsiblePart,
  type PartProps as CorePartProps,
  collapsibleConnect,
  collapsibleMachine,
  focusSafely,
  type HeadingLevel,
  type Modality,
  partId,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { createContext } from "../context"
import { useEnvironment } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"

/**
 * What an embedding component (an Accordion item) adds to the Trigger, Content and Indicator:
 * its connect output, merged over the Collapsible's.
 */
export interface CollapsibleDecoration {
  readonly trigger?: () => CorePartProps
  /** `triggerId`: the trigger's rendered id (a consumer id included). */
  readonly content?: (triggerId: string) => CorePartProps
  readonly indicator?: () => CorePartProps
  /** The content's children are one heading level deeper (an Accordion panel). */
  readonly contentLevel?: () => HeadingLevel
}

type Machine = ReturnType<typeof useMachine<typeof collapsibleMachine>>

/** The context the Collapsible parts read; an Accordion item provides its own. */
export interface CollapsibleCtx {
  readonly scope: string
  readonly instance: () => string
  readonly idBase: () => string
  readonly label: string
  readonly decoration: CollapsibleDecoration
  readonly view: () => Machine["view"]
  readonly send: Machine["send"]
  readonly registry: PartRegistry<CollapsiblePart>
  readonly disabled: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly closedContent: () => ClosedContent
  readonly triggerEl: { current: Element | null }
  /** The consumer's trigger id, so a Content rendered after it labels itself with it. */
  readonly triggerId: { current: string | undefined }
  readonly contentEl: { current: Element | null }
}
export const collapsibleContext = createContext<CollapsibleCtx>("collapsible")

export interface CollapsibleServiceOptions {
  readonly scope: string
  readonly instance: () => string
  readonly idBase: () => string
  readonly label: string
  readonly decoration: CollapsibleDecoration
  readonly props: () => {
    readonly open: boolean | undefined
    readonly defaultOpen: boolean | undefined
    readonly onOpenChange:
      | ((open: boolean, details: ChangeDetails<CollapsibleEvent>) => void)
      | undefined
    readonly disabled: boolean
    readonly focusableWhenDisabled: boolean
    readonly closedContent: ClosedContent
  }
}

/** One disclosure's service and context (a Collapsible Root, or an Accordion item). */
export function useCollapsibleService(o: CollapsibleServiceOptions): CollapsibleCtx {
  const env = useEnvironment()
  const triggerEl: { current: Element | null } = { current: null }
  const contentEl: { current: Element | null } = { current: null }
  const registry = usePartRegistry<CollapsiblePart>(
    untrack(() => ({
      scope: o.scope,
      root: o.idBase(),
      // Kept-mounted content is rendered on the server too: aria-controls is in the HTML.
      ...(o.props().closedContent !== "unmount" ? { expected: ["content"] as const } : {}),
    })),
  )
  const machine = useMachine(collapsibleMachine, () => {
    const p = o.props()
    return {
      open: p.open,
      defaultOpen: p.defaultOpen,
      onOpenChange: p.onOpenChange,
      disabled: p.disabled,
      // Closing with focus inside: the trigger, keeping the modality, before hiding.
      focusOutOfContent: () => {
        const content = contentEl.current
        const trigger = triggerEl.current
        const active = content?.ownerDocument.activeElement
        if (content && trigger instanceof HTMLElement && active && content.contains(active)) {
          void focusSafely(trigger, env, "programmatic")
        }
      },
    }
  })
  return {
    scope: o.scope,
    instance: o.instance,
    idBase: o.idBase,
    label: o.label,
    decoration: o.decoration,
    view: () => machine.view,
    send: machine.send,
    registry,
    disabled: () => o.props().disabled,
    focusableWhenDisabled: () => o.props().focusableWhenDisabled,
    closedContent: () => o.props().closedContent,
    triggerEl,
    triggerId: { current: undefined },
    contentEl,
  }
}

/** The connect output for a part, with that part's interaction state. Call during initialisation. */
export function useApi(ctx: CollapsibleCtx) {
  const env = useEnvironment()
  const content = useRenderedId(ctx.registry, "content")
  const trigger = useRenderedId(ctx.registry, "trigger")
  return (
    s: {
      triggerFocused?: boolean
      modality?: Modality
      pressed?: boolean
      hovered?: boolean
      triggerTag?: string
    } = {},
  ) => {
    const triggerId = trigger.current ?? ctx.triggerId.current
    return collapsibleConnect(
      {
        scope: ctx.scope,
        instance: ctx.instance(),
        open: ctx.view().matches("open"),
        reveal: ctx.view().context.reveal,
        disabled: ctx.disabled(),
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        closedContent: ctx.closedContent(),
        triggerTag: s.triggerTag ?? "button",
        triggerFocused: s.triggerFocused ?? false,
        modality: s.modality ?? "keyboard",
        pressed: s.pressed ?? false,
        hovered: s.hovered ?? false,
        triggerId: triggerId ?? partId(ctx.scope, ctx.idBase(), "trigger"),
        contentId: content.current ?? partId(ctx.scope, ctx.idBase(), "content"),
        contentRendered: content.current !== undefined,
      },
      env,
    )
  }
}

export const stateOf = (ctx: CollapsibleCtx) => ({
  open: ctx.view().matches("open"),
  disabled: ctx.disabled(),
})
