<script lang="ts">
import {
  announcerCapability,
  defaultCount,
  focusSafely,
  type TextFieldDetails,
  type TextFieldReason,
  type TextFieldVisibilityHideReason,
  textFieldMachine,
  textFieldMessages,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import {
  type CountState,
  keys,
  type TextFieldHostContext,
  textFieldContext,
  visibilityRootData,
} from "./context"
import type { TextFieldRootProps } from "./types"

let {
  type,
  visible = $bindable(),
  defaultVisible,
  onVisibleChange,
  escapeClears,
  onSubmit,
  value = $bindable(),
  defaultValue,
  onValueChange,
  focusableWhenDisabled = false,
  countThreshold,
  messages: ownMessages,
  fieldMessages,
  id,
  children,
  ...fieldProps
}: TextFieldRootProps = $props()

const scope = "text-field"
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("text-field", textFieldMessages, () => ownMessages)
const enclosing = useFieldBindingPeek()
const fieldsetDisabled = useFieldsetDisabled()
const disabled = $derived(
  fieldProps.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled(),
)
const readOnly = $derived(fieldProps.readonly === true || enclosing?.().state.readOnly === true)
let countState = $state.raw<CountState | null>(null)
let maxLength = $state<number | undefined>(undefined)
const limit = $derived(maxLength ?? countState?.max)
const controlEl: TextFieldHostContext["controlEl"] = { current: null }
let reason: TextFieldReason | undefined
const controls = { current: 0 }
const pendingSelection: TextFieldHostContext["pendingSelection"] = { current: null }
let controlId = $state<string | undefined>(undefined)
let mounted = $state({ clearTriggers: 0, triggers: 0 })
/** The `type` last rendered (the `data-state` it carries agrees with it). */
const renderedType = (el: HTMLInputElement) =>
  el.getAttribute("data-state") === "visible" ? "text" : "password"
const machine = useMachine(
  textFieldMachine,
  () => ({
    visible,
    defaultVisible,
    onVisibleChange: (next: boolean, details: unknown) => {
      const e = (details as { event: { type: string; reason?: TextFieldVisibilityHideReason } })
        .event
      onVisibleChange?.(next, {
        reason: e.type === "VISIBILITY.HIDE" ? (e.reason ?? "SUBMIT") : "PRESS",
      })
      if (visible !== undefined) visible = next
    },
    keepSelection: (selection: readonly [number, number]) => {
      pendingSelection.current = selection
    },
    watchForm:
      type !== "password"
        ? undefined
        : (on: { readonly submit: () => void; readonly reset: () => void }) => {
            const form = controlEl.current?.form
            if (!form) return () => {}
            const onFormSubmit = () => {
              const el = controlEl.current
              // The browser builds the form data (and a password manager reads it) right
              // after this event: the input is a password input by then.
              if (el instanceof HTMLInputElement && el.type !== "password") {
                el.type = "password"
                env.scheduler.setTimeout(() => {
                  if (controlEl.current === el) el.type = renderedType(el)
                }, 0)
              }
              on.submit()
            }
            // The consumer may prevent the reset in a later listener: read it once dispatch ends.
            const onReset = (e: Event) =>
              env.scheduler.setTimeout(() => {
                if (!e.defaultPrevented) on.reset()
              }, 0)
            form.addEventListener("submit", onFormSubmit)
            form.addEventListener("reset", onReset)
            return () => {
              form.removeEventListener("submit", onFormSubmit)
              form.removeEventListener("reset", onReset)
            }
          },
    escapeClears: escapeClears ?? type === "search",
    onSubmit,
    value: value === undefined ? undefined : (value ?? ""),
    defaultValue: defaultValue ?? "",
    onValueChange: (next: string, details: unknown) => {
      // Machine details → the public ones (reason, native event, isComposing).
      const e = (
        details as {
          event: { type: string; reason?: string; event?: Event | null; composing?: boolean }
        }
      ).event
      onValueChange?.(next, {
        reason: e.type === "RESET" ? "RESET" : (e.reason ?? "INPUT"),
        event: e.event ?? null,
        isComposing: e.composing === true,
      } as TextFieldDetails)
      if (value !== undefined) value = next
    },
    disabled,
    readOnly,
    focusableWhenDisabled,
    limit,
    threshold: countThreshold,
    count: countState?.count,
    messages: messages(),
    id: instance,
    // The only DOM write: the native setter, then one bubbling `input` event, which comes
    // back as an ordinary INPUT carrying this reason (base-ui#4643).
    clearInput: (why: TextFieldReason, focus: boolean) => {
      const el = controlEl.current
      if (!el) return
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set
      reason = why
      setter?.call(el, "")
      el.dispatchEvent(new Event("input", { bubbles: true }))
      reason = undefined
      if (focus && el.ownerDocument.activeElement !== el) void focusSafely(el, env, "programmatic")
    },
  }),
  env,
)
const modality = useModality(env.modality, () => machine.view.context.focused)
// Exactly one Input or Textarea (development error otherwise).
$effect(() =>
  untrack(() => {
    if (DEV && controls.current !== 1) {
      console.error(
        `[rind-ui] text-field: renders ${controls.current} Input/Textarea parts; exactly one is required.`,
      )
    }
  }),
)
// A soft limit is a control-owned validity message (the Field displays it), written from
// the new value synchronously, before the change is reported.
let softSet = false
const applySoftLimit = (next: string) => {
  const el = controlEl.current
  const max = countState?.max
  if (!el || max === undefined) return
  const used = (countState?.count ?? defaultCount)(next)
  if (used > max) {
    el.setCustomValidity(messages().charactersOver(used - max))
    softSet = true
  } else if (softSet) {
    el.setCustomValidity("")
    softSet = false
  }
}
const ctx: TextFieldHostContext = {
  own: () => ({ type }),
  mounted: () => mounted,
  setMounted: (part, delta) => {
    mounted[part] += delta
  },
  scope,
  instance: () => instance,
  view: () => machine.view,
  send: machine.send,
  controlled: () => value !== undefined,
  defaultValue: () => defaultValue,
  disabled: () => disabled,
  readOnly: () => readOnly,
  focusableWhenDisabled: () => focusableWhenDisabled,
  messages: () => messages(),
  limit: () => limit,
  count: () => countState?.count,
  countId: () => countState?.id,
  applySoftLimit,
  setCount: (state) => {
    countState = state
  },
  setMaxLength: (n) => {
    maxLength = n
  },
  controlEl,
  controlId: () => controlId,
  setControlId: (next) => {
    controlId = next
  },
  pendingSelection,
  takeReason: () => reason,
  controls,
}
textFieldContext.set(ctx)
// After the `type` change is in the DOM: the caret stays where the user left it.
$effect(() => {
  void machine.view
  untrack(() => {
    const selection = pendingSelection.current
    pendingSelection.current = null
    const el = controlEl.current
    if (selection && el && el.ownerDocument.activeElement === el)
      el.setSelectionRange(selection[0], selection[1])
  })
})
const rootData = $derived({
  "data-focus": machine.view.context.focused ? "" : undefined,
  "data-focus-visible":
    machine.view.context.focused && modality.current !== "pointer" && modality.current !== "touch"
      ? ""
      : undefined,
  "data-composing": machine.view.matches("composing") ? "" : undefined,
  ...keys(ctx).root(),
  ...visibilityRootData(ctx),
})
</script>

<FieldHost {...fieldProps} {scope} id={instance} {...fieldMessages ? { messages: fieldMessages } : {}} {...rootData}>
  {@render children?.()}
</FieldHost>
