import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  type CheckboxGroupEvent,
  checkboxGroupConnect,
  checkboxGroupMachine,
  focusSafely,
  type Modality,
  mergeFieldProps,
  partId,
  readValidity,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import {
  Checkbox,
  CheckboxControl,
  CheckboxDescription,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxRoot,
} from "../checkbox/checkbox"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import {
  FORM_TOGGLE,
  FORM_TOGGLE_GROUPING,
  FORM_TOGGLE_TEMPLATE,
  type FormToggleGrouped,
  type FormToggleGrouping,
} from "../form-toggle/form-toggle"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

declare const process: { env: { NODE_ENV?: string } }

type GroupPart = "label" | "description" | "error-message"

export interface CheckboxGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

const GROUP = new InjectionToken<CheckboxGroupRoot>("rind-ui.checkbox-group")

function injectGroup(part: string): CheckboxGroupRoot {
  const root = inject(GROUP, { optional: true })
  if (!root) throw new Error(`rindCheckboxGroup${part} must be inside rindCheckboxGroupRoot`)
  return root
}

/**
 * A set of checkboxes with one value: `<div rindCheckboxGroupRoot [(value)]="toppings">` with a
 * Label and `rindCheckboxGroupItem` checkboxes (each with a `value`), and an optional select-all
 * Parent (`allValues` required then).
 */
@Directive({
  selector: "[rindCheckboxGroupRoot]",
  exportAs: "rindCheckboxGroupRoot",
  providers: [
    { provide: GROUP, useExisting: forwardRef(() => CheckboxGroupRoot) },
    {
      provide: FORM_TOGGLE_GROUPING,
      useFactory: () => inject(forwardRef(() => CheckboxGroupRoot)).itemGrouping,
    },
  ],
})
export class CheckboxGroupRoot {
  /** Controlled value (`[(value)]`). */
  readonly value = input<readonly string[]>()
  readonly defaultValue = input<readonly string[]>()
  /** Every item value: what the select-all Parent selects (required with a Parent). */
  readonly allValues = input<readonly string[]>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Valid with at least one item checked. */
  readonly required = input(false, { transform: booleanAttribute })
  readonly invalid = input(false, { transform: booleanAttribute })
  /** Submitted for every checked item (an item's own `name` is ignored). */
  readonly name = input<string>()
  readonly form = input<string>()
  readonly id = input<string>()
  /** Every change proposes a new value; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ChangeEvent<readonly string[], CheckboxGroupEvent>>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<readonly string[]>()

  private readonly emit = changeEmitter<readonly string[], CheckboxGroupEvent>(
    this.valueChangeDetails,
    this.valueChange,
  )
  /** @internal */
  readonly api: Signal<ReturnType<typeof checkboxGroupConnect>>
  /** @internal */
  readonly registry: () => PartRegistry<GroupPart>
  /** @internal */
  readonly ids: () => { label: string; description: string; errorMessage: string }
  /** @internal The Label's tag (a `<label>` would name the group twice). */
  labelTag = "span"
  /** @internal The group's own ErrorMessage defers to the Field's inside one. */
  readonly inField: boolean
  /** @internal */
  readonly isInvalid: () => boolean
  /** @internal */
  readonly itemGrouping: Signal<FormToggleGrouping>
  /** @internal */
  readonly parentGrouping: FormToggleGrouping
  /** The group's state, for the template (`#g="rindCheckboxGroupRoot"`, `g.state()`). */
  readonly state: Signal<CheckboxGroupState>

  constructor() {
    const env = injectEnvironment()
    const instance = injectRootId(() => this.id())
    const binding = injectFieldControl()
    this.inField = binding !== null
    const fieldsetDisabled = injectFieldsetDisabled()
    const el: Element = inject(ElementRef).nativeElement
    // A native <fieldset disabled> too: the items are disabled by it (toggle.md RA#9445).
    const fieldsetDom = signal(false)
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() => {
        const watch = watchFieldsetDisabled(el, (d) => fieldsetDom.set(d))
        fieldsetDom.set(watch.disabled)
        destroy.onDestroy(watch.stop)
      })
    }
    const tag = el.tagName.toLowerCase()
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "group",
          labelable: false,
          disabled: this.disabled() || fieldsetDisabled() || fieldsetDom(),
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
        },
        binding?.() ?? null,
      ),
    )
    this.isInvalid = () => field().invalid
    // The reason of the latest accepted change, for the Field: only a user's clears its
    // external (server) errors (base-ui#1745); a parent's value or a reset does not.
    let lastReason: string | null = null
    const { view, send } = injectMachine(checkboxGroupMachine, () => ({
      value: this.value(),
      defaultValue: this.defaultValue(),
      onValueChange: (next: readonly string[], details) => {
        lastReason = details.reason
        this.emit(next, details)
      },
      allValues: this.allValues(),
      disabled: field().disabled,
      readOnly: field().readOnly,
    }))
    const current = () => view().values.value ?? []
    this.registry = injectPartRegistry<GroupPart>(() => ({
      scope: "checkbox-group",
      root: instance(),
    }))
    const ids = () => ({
      label: partId("checkbox-group", instance(), "label"),
      description: partId("checkbox-group", instance(), "description"),
      errorMessage: partId("checkbox-group", instance(), "error-message"),
    })
    this.ids = ids
    const rendered = {
      label: injectRenderedId(this.registry, "label"),
      description: injectRenderedId(this.registry, "description"),
      errorMessage: injectRenderedId(this.registry, "error-message"),
    }
    const api = computed(() => {
      // Rendered item Control ids in `allValues` order (the Parent's aria-controls).
      const items = view().context.items
      const order = this.allValues() ?? [...items.keys()]
      const controls = order.flatMap((v) => {
        const item = items.get(v)
        return item ? [item.id] : []
      })
      return checkboxGroupConnect({
        instance: instance(),
        value: current(),
        allValues: this.allValues() ?? [],
        disabled: field().disabled,
        readOnly: field().readOnly,
        required: field().required || field()["aria-required"] === "true",
        invalid: field().invalid,
        name: field().name,
        form: this.form(),
        rootTag: tag,
        labelTag: this.labelTag,
        ids: ids(),
        rendered: {
          label: rendered.label(),
          description: rendered.description(),
          errorMessage: rendered.errorMessage(),
        },
        ...(binding ? { field: binding().ids } : {}),
        controls,
      })
    })
    this.api = api
    // One stable register function per item value: re-renders never re-register.
    const registers = new Map<string, (controlId: string, disabled: boolean) => () => void>()
    const registerFor = (v: string) => {
      let fn = registers.get(v)
      if (!fn) {
        fn = (controlId, isDisabled) => {
          send({ type: "ITEM.REGISTER", value: v, id: controlId, disabled: isDisabled })
          return () => send({ type: "ITEM.UNREGISTER", value: v, id: controlId })
        }
        registers.set(v, fn)
      }
      return fn
    }
    this.itemGrouping = computed<FormToggleGrouping>(() => {
      const a = api()
      return {
        resolve: (v, own) => {
          if (process.env.NODE_ENV !== "production" && v === "on") {
            // The Checkbox default value: an item without its own `value`.
            console.error("[rind-ui] checkbox-group: an item needs a `value`")
          }
          return {
            props: a.item(v, own),
            onChange: (checked: boolean | "indeterminate", modality: Modality) =>
              send({ type: "ITEM.TOGGLE", value: v, checked: checked === true, modality }),
            register: registerFor(v),
          } satisfies FormToggleGrouped
        },
      }
    })
    this.parentGrouping = {
      resolve: () => ({
        props: api().parent(),
        onChange: (_checked, modality) => send({ type: "PARENT.TOGGLE", modality }),
      }),
    }
    this.state = computed(() => ({ value: current(), disabled: field().disabled }))
    bindProps(
      () => ({
        ...api().root(),
        ...binding?.().data,
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      {
        owns: [
          "allvalues",
          "defaultvalue",
          "disabled",
          "form",
          "id",
          "invalid",
          "name",
          "readonly",
          "required",
          "value",
        ],
      },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // The items' hidden inputs (the Parent's submits nothing and validates nothing).
    const controlInputs = () =>
      Array.from(el.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]')).filter(
        (i) => i.closest("[data-parent]") === null,
      )
    // Development: `allValues` and the rendered items must agree (the Parent selects them).
    let lastKey: string | undefined
    afterRenderEffect(() => {
      if (process.env.NODE_ENV === "production") return
      const registeredKey = [...view().context.items.keys()].sort().join("\u0000")
      const all = this.allValues()
      const key = `${registeredKey}\n${all ? [...all].sort().join("\u0000") : ""}`
      if (key === lastKey || all === undefined || registeredKey === "") return
      lastKey = key
      const registered = registeredKey.split("\u0000")
      const extra = registered.filter((v) => !all.includes(v))
      const missing = all.filter((v) => !registered.includes(v))
      if (extra.length > 0)
        console.warn(
          `[rind-ui] checkbox-group: items ${JSON.stringify(extra)} are not in allValues`,
        )
      if (missing.length > 0)
        console.warn(
          `[rind-ui] checkbox-group: allValues ${JSON.stringify(missing)} have no rendered item`,
        )
    })
    let ready = false
    afterNextRender(() => {
      ready = true
      // A form reset is answered once, by the group, for every item (RA#7749).
      const doc = el.ownerDocument
      const onReset = (e: Event) => {
        if (e.defaultPrevented) return
        const input = el.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
        if (input && e.target === input.form) send({ type: "RESET" })
      }
      doc.addEventListener("reset", onReset)
      destroy.onDestroy(() => doc.removeEventListener("reset", onReset))
      // field-control: the group registers once as one (non-labelable) control.
      if (binding) {
        destroy.onDestroy(
          binding().register(
            {
              id: instance(),
              labelable: false,
              // The first invalid item, else the first enabled one (base-ui#5200).
              focus: (modality) => {
                const inputs = controlInputs()
                const target =
                  inputs.find((i) => !i.disabled && !readValidity(i).valid) ??
                  inputs.find((i) => !i.disabled)
                const control = target?.closest('[data-scope="checkbox"][data-part="root"]')
                const button = control?.querySelector<HTMLElement>('[data-part="control"]')
                if (button) void focusSafely(button, env, "programmatic", modality)
              },
              validityElement: () =>
                controlInputs().find((i) => !readValidity(i).valid) ?? controlInputs()[0] ?? null,
              value: () => current(),
            },
            instance(),
          ),
        )
      }
    })
    let reported: readonly string[] | undefined
    effect(() => {
      const now = current()
      if (!ready) {
        reported = now
        return
      }
      if (reported === now) return
      reported = now
      untracked(() => {
        const user = lastReason === "ITEM.TOGGLE" || lastReason === "PARENT.TOGGLE"
        lastReason = null
        binding?.().report({ type: "change", value: now, user, composing: false })
        binding?.().report({ type: "commit" })
      })
    })
  }
}

/** The group's name (a `<span>`; never a `<label>`, which names one control). */
@Directive({ selector: "[rindCheckboxGroupLabel]", exportAs: "rindCheckboxGroupLabel" })
export class CheckboxGroupLabel {
  constructor() {
    const group = injectGroup("Label")
    group.labelTag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    injectRegisterPart(group.registry, "label", () => group.ids().label)
    bindProps(() => group.api().label())
  }
}

@Directive({ selector: "[rindCheckboxGroupDescription]", exportAs: "rindCheckboxGroupDescription" })
export class CheckboxGroupDescription {
  constructor() {
    const group = injectGroup("Description")
    injectRegisterPart(group.registry, "description", () => group.ids().description)
    bindProps(() => group.api().description())
  }
}

/** Shown while the group is invalid; inside a Field the Field's ErrorMessage is the one. */
@Directive({
  selector: "[rindCheckboxGroupErrorMessage]",
  exportAs: "rindCheckboxGroupErrorMessage",
})
export class CheckboxGroupErrorMessage {
  constructor() {
    const group = injectGroup("ErrorMessage")
    const instance = (): string => String(group.api().root()["data-instance"])
    const shown = () => !group.inField && group.isInvalid()
    injectRegisterPart(group.registry, "error-message", () =>
      shown() ? group.ids().errorMessage : undefined,
    )
    bindProps(() =>
      shown() ? group.api().errorMessage() : absentProps("checkbox-group", instance()),
    )
  }
}

/** The select-all checkbox: a Checkbox whose state the group derives. */
@Component({
  selector: "[rindCheckboxGroupParent]",
  exportAs: "rindCheckboxGroupParent",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [
    { provide: FORM_TOGGLE, useExisting: forwardRef(() => CheckboxGroupParent) },
    {
      provide: FORM_TOGGLE_GROUPING,
      useFactory: () => {
        const group = injectGroup("Parent")
        return computed(() => group.parentGrouping)
      },
    },
  ],
  template: FORM_TOGGLE_TEMPLATE,
})
export class CheckboxGroupParent extends CheckboxRoot {
  constructor() {
    super()
    const group = injectGroup("Parent")
    // After the first render: the group's inputs are set by then.
    if (process.env.NODE_ENV !== "production" && inject(PLATFORM_ID) === "browser") {
      afterNextRender(() => {
        if (group.allValues() === undefined)
          console.error(
            "[rind-ui] checkbox-group: a Parent needs `allValues` on rindCheckboxGroupRoot",
          )
      })
    }
  }
}

/** The Checkbox Group's parts (its items are the Checkbox's), for `imports`. */
export const CheckboxGroup = [
  CheckboxGroupRoot,
  CheckboxGroupLabel,
  CheckboxGroupDescription,
  CheckboxGroupErrorMessage,
  CheckboxGroupParent,
  ...Checkbox,
] as const
export {
  CheckboxControl as CheckboxGroupItemControl,
  CheckboxDescription as CheckboxGroupItemDescription,
  CheckboxIndicator as CheckboxGroupItemIndicator,
  CheckboxLabel as CheckboxGroupItemLabel,
  CheckboxRoot as CheckboxGroupItem,
}
