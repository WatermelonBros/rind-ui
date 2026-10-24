import {
  type Collection,
  type CollectionKey,
  type ItemRegistry,
  type LayerMeta,
  type Modality,
  type Service,
  selectConnect,
  selectionOf,
  type selectMachine,
  selectPositioning,
} from "@rind-ui/core"
import { createContext } from "../context"
import type { useEnvironment } from "../provider"

export interface Mounted {
  readonly label: boolean
  readonly description: boolean
  readonly list: boolean
  readonly empty: boolean
  readonly descriptions: ReadonlySet<CollectionKey>
}

type View = ReturnType<Service<typeof selectMachine>["view"]>

export interface SelectHost {
  readonly service: Service<typeof selectMachine>
  readonly view: () => View
  readonly instance: () => string
  readonly collection: () => Collection<unknown>
  readonly registry: () => ItemRegistry | null
  readonly multiple: () => boolean
  readonly modal: () => boolean
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly required: () => boolean
  readonly invalid: () => boolean
  readonly placeholder: () => string | undefined
  readonly keepMounted: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly typeaheadTimeout: () => number
  readonly positioning: () => Parameters<typeof selectPositioning>[0]["positioning"]
  /** Mutable shared state (a `$state` object owned by the Root). */
  readonly shared: {
    trigger: HTMLElement | null
    label: HTMLElement | null
    hidden: HTMLInputElement | null
    mounted: Mounted
    meta: LayerMeta | undefined
  }
  readonly setMounted: (part: "label" | "description" | "list" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The trigger's consumer naming (the list copies `aria-label`). */
  readonly triggerNaming: {
    current: { label?: string | undefined; labelledBy?: string | undefined }
  }
}
export const selectHost = createContext<SelectHost>("select")

const listFormatter = (locale: string) => {
  const f = new Intl.ListFormat(locale, { style: "long", type: "conjunction" })
  return (texts: readonly string[]) => f.format(texts)
}

/** The select's connect. */
export function api(
  ctx: SelectHost,
  env: ReturnType<typeof useEnvironment>,
  extra: { dir?: "ltr" | "rtl"; listFocused?: boolean; modality?: Modality } = {},
) {
  const view = ctx.view()
  const m = ctx.shared.mounted
  return selectConnect(
    {
      instance: ctx.instance(),
      open: view.matches("open"),
      collection: ctx.collection(),
      selection: selectionOf(view.values.value),
      multiple: ctx.multiple(),
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      typingAhead: () => {
        const t = ctx.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= ctx.typeaheadTimeout()
      },
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      modal: ctx.modal(),
      disabled: ctx.disabled(),
      readOnly: ctx.readOnly(),
      required: ctx.required(),
      invalid: ctx.invalid(),
      autofilled: view.context.autofilled,
      focusableWhenDisabled: ctx.focusableWhenDisabled(),
      texts: view.context.texts,
      placeholder: ctx.placeholder(),
      listFormat: listFormatter(env.locale.locale()),
      mounted: {
        label: m.label,
        description: m.description,
        list: m.list,
        empty: m.empty,
        itemDescription: (key) => m.descriptions.has(key),
      },
      meta: ctx.shared.meta,
      manual: selectPositioning({ positioning: ctx.positioning() }).mode === "manual",
      listFocused: extra.listFocused === true,
      modality: extra.modality ?? "keyboard",
      ...(extra.dir ? { dir: extra.dir } : {}),
    },
    ctx.service.send,
    env,
  )
}
