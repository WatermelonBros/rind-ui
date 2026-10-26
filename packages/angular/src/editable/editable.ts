// Editable (add-editable): a value shown in a Preview (a button) that turns into an Input on
// activation; Enter submits, Escape restores what was there at entry, an outside press submits
// or cancels by `submitMode`. A hidden input carries the committed value into forms.
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  type ActivationMode,
  activates,
  type ChangeDetails,
  type EditableEvent,
  type EditableFocusInput,
  type EditableMessages,
  type EditableState,
  type EditReason,
  editableConnect,
  editableMachine,
  editableMessages,
  hiddenFormInput,
  type MessageOverrides,
  type PartProps,
  partId,
  type SubmitMode,
  watchLeave,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

/** The field's state, for the template (`#e="rindEditableRoot"`, `e.state()`). */
export interface EditableRenderState {
  readonly state: EditableState
  readonly editing: boolean
  readonly value: string
  readonly draft: string
}

const EDITABLE = new InjectionToken<EditableRoot>("rind-ui.editable")

function injectEditable(part: string): EditableRoot {
  const root = inject(EDITABLE, { optional: true })
  if (!root) throw new Error(`rindEditable${part} must be inside rindEditableRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))

/**
 * A value edited in place: `<div rindEditableRoot name="title" defaultValue="Draft">` with a
 * Label, an Area (Preview and Input) and a Control (Edit, Submit and Cancel triggers); it
 * renders the hidden form input after its content.
 */
@Component({
  selector: "[rindEditableRoot]",
  exportAs: "rindEditableRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: EDITABLE, useExisting: forwardRef(() => EditableRoot) }],
  template: `<ng-content /><input #hidden [rindProps]="hiddenProps()" />`,
})
export class EditableRoot {
  /** Controlled committed value (`[(value)]`). */
  readonly value = input<string>()
  /** Uncontrolled committed value. Default "". */
  readonly defaultValue = input<string>()
  /** Controlled edit state (`[(edit)]`). */
  readonly edit = input<boolean | undefined>(undefined)
  /** Uncontrolled edit state. */
  readonly defaultEdit = input(false, { transform: booleanAttribute })
  /** How the Preview enters edit (Enter and Space always do, except `none`). Default "click". */
  readonly activationMode = input<ActivationMode>()
  /** Whether an outside press submits (both, blur) or cancels (enter, none). Default "both". */
  readonly submitMode = input<SubmitMode>()
  /** Select the text on entering edit. Default true. */
  readonly selectOnFocus = input(true, { transform: booleanAttribute })
  /** Shown when the value is empty. */
  readonly placeholder = input<string | { readonly edit: string; readonly preview: string }>()
  /** The Input's maximum length. */
  readonly maxLength = input(undefined, { transform: optionalNumber })
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  /** An empty value blocks submit. */
  readonly required = input(false, { transform: booleanAttribute })
  readonly invalid = input(false, { transform: booleanAttribute })
  /** The form field's name. */
  readonly name = input<string>()
  /** The form id, when the Editable is outside it. */
  readonly form = input<string>()
  readonly messages = input<MessageOverrides<EditableMessages>>()
  readonly id = input<string>()
  readonly valueChange = output<string>()
  readonly valueChangeDetails = output<{ value: string; details: ChangeDetails<EditableEvent> }>()
  readonly editChange = output<boolean>()
  /** Each edit of the draft. */
  readonly draftChange = output<string>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof editableConnect>>
  /** @internal */
  readonly send: (event: EditableEvent) => void
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"label">>
  /** @internal */
  readonly ids: () => { label: string; preview: string; input: string; hidden: string }
  /** @internal */
  previewEl: HTMLElement | null = null
  /** @internal */
  inputEl: HTMLElement | null = null
  readonly state: Signal<EditableRenderState>
  /** @internal */
  protected readonly hiddenProps: Signal<PartProps>
  private readonly hiddenRef = viewChild<ElementRef<HTMLInputElement>>("hidden")

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment()
    const messages = injectMessages("editable", editableMessages, () => this.messages())
    this.registry = injectPartRegistry<"label">(() => ({ scope: "editable", root: instance() }))
    const labelId = injectRenderedId(this.registry, "label")
    this.ids = () => ({
      label: partId("editable", instance(), "label"),
      preview: partId("editable", instance(), "preview"),
      input: partId("editable", instance(), "input"),
      hidden: partId("editable", instance(), "hidden-input"),
    })
    const hidden = () => this.hiddenRef()?.nativeElement ?? null
    const formInput = hiddenFormInput({ input: hidden }, env)
    let focusNext: "input" | "preview" | null = null
    let entry = ""
    const { view, send } = injectMachine(
      editableMachine,
      () => ({
        ...(this.value() === undefined ? {} : { value: this.value() }),
        defaultValue: this.defaultValue(),
        onValueChange: (v: string, d: ChangeDetails<EditableEvent>) => {
          this.valueChange.emit(v)
          this.valueChangeDetails.emit({ value: v, details: d })
        },
        ...(this.edit() === undefined ? {} : { edit: this.edit() }),
        defaultEdit: this.defaultEdit(),
        onEditChange: (e: boolean) => this.editChange.emit(e),
        onDraftChange: (d: string) => this.draftChange.emit(d),
        activationMode: this.activationMode(),
        submitMode: this.submitMode(),
        disabled: this.disabled(),
        readOnly: this.readonly(),
        // After the render that shows the Input or the Preview (each is hidden until then).
        focusInput: () => {
          focusNext = "input"
          // The committed value at entry (the draft starts from it).
          entry = untracked(value)
        },
        focusPreview: () => {
          focusNext = "preview"
        },
      }),
      {},
    )
    this.send = send
    const value = () => view().values.value ?? ""
    this.api = computed(() =>
      editableConnect(
        {
          instance: instance(),
          state: view().state as EditableState,
          value: value(),
          draft: view().context.draft,
          placeholder: this.placeholder(),
          disabled: this.disabled(),
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
          maxLength: this.maxLength(),
          messages: messages(),
          ids: { ...this.ids(), label: labelId() ?? this.ids().label },
          rendered: { label: labelId() !== undefined },
        },
        env,
      ),
    )
    this.state = computed(() => ({
      state: view().state as EditableState,
      editing: this.api().editing,
      value: value(),
      draft: view().context.draft,
    }))
    this.hiddenProps = computed(() => {
      const form = this.form()
      return form === undefined ? this.api().hiddenInput() : { ...this.api().hiddenInput(), form }
    })
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "activationmode",
          "defaultedit",
          "defaultvalue",
          "disabled",
          "edit",
          "form",
          "id",
          "invalid",
          "maxlength",
          "messages",
          "name",
          "placeholder",
          "readonly",
          "required",
          "selectonfocus",
          "submitmode",
          "value",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // The hidden input mirrors the committed value; a form reset restores the default.
    afterEveryRender(() => {
      formInput.sync({ value: untracked(value) }, { dispatch: false })
      const next = focusNext
      focusNext = null
      if (next === "preview") this.previewEl?.focus({ preventScroll: true })
      if (next === "input") {
        const el = this.inputEl as HTMLInputElement | null
        el?.focus({ preventScroll: true })
        // Keys typed before the focus landed (Enter on EditTrigger, then typing) are kept.
        if (untracked(this.selectOnFocus) && el?.value === entry) el.select?.()
      }
    })
    afterNextRender(() =>
      destroy.onDestroy(
        formInput.track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: untracked(value) }),
        }),
      ),
    )
    // While editing, a press or focus outside the Root (Area, Control, triggers) is OUTSIDE.
    const rootEl: Element = inject(ElementRef).nativeElement
    effect((onCleanup) => {
      if (!this.api().editing) return
      onCleanup(watchLeave(rootEl, () => send({ type: "OUTSIDE" })))
    })
  }
}

/** Focus state with the modality it arrived by (keyboard focus shows the ring). */
function injectFocus() {
  const env = injectEnvironment()
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  return { focused, modality }
}

/** Names the field (`for` the Input while editing). */
@Directive({ selector: "[rindEditableLabel]", exportAs: "rindEditableLabel" })
export class EditableLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectEditable("Label")
    const own = () => this.id() ?? root.ids().label
    injectRegisterPart(root.registry, "label", own)
    bindProps(() => ({ ...root.api().label(), id: own() }), { owns: ["id"] })
  }
}

/** Holds the Preview and the Input. */
@Directive({ selector: "[rindEditableArea]", exportAs: "rindEditableArea" })
export class EditableArea {
  constructor() {
    const root = injectEditable("Area")
    bindProps(() => root.api().area())
  }
}

/** Holds the triggers. */
@Directive({ selector: "[rindEditableControl]", exportAs: "rindEditableControl" })
export class EditableControl {
  constructor() {
    const root = injectEditable("Control")
    bindProps(() => root.api().control())
  }
}

/** The value (or the placeholder) as a button that enters edit; its content replaces the text. */
@Component({
  selector: "[rindEditablePreview]",
  exportAs: "rindEditablePreview",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class EditablePreview {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectEditable("Preview")
    const el: HTMLElement = inject(ElementRef).nativeElement
    root.previewEl = el
    const { focused, modality } = injectFocus()
    this.text = computed(() => root.api().previewText)
    const edit = (kind: "press" | "dblclick" | "focus" | "key", reason: EditReason) => {
      if (activates(untracked(root.activationMode), kind)) root.send({ type: "EDIT", reason })
    }
    bindProps(() =>
      joinHandlers(
        root.api().preview({
          tag: el.tagName.toLowerCase(),
          focused: focused(),
          modality: modality(),
        }),
        {
          // A keyboard press (Enter, Space) on the native button clicks it too: `detail` 0.
          onClick: (e: MouseEvent) =>
            e.detail === 0 ? edit("key", "preview-key") : edit("press", "preview-press"),
          onDblClick: () => edit("dblclick", "preview-dblclick"),
          onFocusIn: () => {
            focused.set(true)
            edit("focus", "preview-focus")
          },
          onFocusOut: () => focused.set(false),
        },
      ),
    )
  }
}

/** `<input rindEditableInput>` (or a textarea: Ctrl/⌘+Enter submits); Escape cancels. */
@Directive({ selector: "[rindEditableInput]", exportAs: "rindEditableInput" })
export class EditableInput {
  constructor() {
    const root = injectEditable("Input")
    const el: HTMLInputElement = inject(ElementRef).nativeElement
    root.inputEl = el
    const area = el.tagName === "TEXTAREA"
    const { focused, modality } = injectFocus()
    bindProps(() =>
      joinHandlers(root.api().input({ focused: focused(), modality: modality() }), {
        onInput: () => root.send({ type: "DRAFT", draft: el.value }),
        onKeyDown: (e: KeyboardEvent) => {
          if (e.isComposing || e.keyCode === 229) return
          if (e.key === "Escape") {
            e.preventDefault()
            root.send({ type: "CANCEL", reason: "escape-key" })
          } else if (e.key === "Enter" && (!area || e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            root.send({ type: "SUBMIT", reason: "enter-key" })
          }
        },
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      }),
    )
  }
}

/** A trigger: a button sending `event`, named from messages and the Label. */
function injectTrigger(
  part: string,
  own: (api: ReturnType<typeof editableConnect>, f: EditableFocusInput) => PartProps,
  event: EditableEvent,
) {
  const root = injectEditable(part)
  const el: HTMLElement = inject(ElementRef).nativeElement
  const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
  // A consumer name replaces the default one, labelled-by included.
  const ownName = read("aria-label") !== null && read("aria-labelledby") === null
  const { focused, modality } = injectFocus()
  bindProps(() => {
    const api = own(root.api(), {
      tag: el.tagName.toLowerCase(),
      focused: focused(),
      modality: modality(),
    })
    return joinHandlers(ownName ? { ...api, "aria-labelledby": undefined } : api, {
      onClick: () => root.send(event),
      onFocusIn: () => focused.set(true),
      onFocusOut: () => focused.set(false),
    })
  })
}

/** Enters edit (hidden while editing). */
@Directive({ selector: "[rindEditableEditTrigger]", exportAs: "rindEditableEditTrigger" })
export class EditableEditTrigger {
  constructor() {
    injectTrigger("EditTrigger", (a, f) => a.editTrigger(f), {
      type: "EDIT",
      reason: "edit-trigger",
    })
  }
}

/** Submits the draft (shown while editing). */
@Directive({ selector: "[rindEditableSubmitTrigger]", exportAs: "rindEditableSubmitTrigger" })
export class EditableSubmitTrigger {
  constructor() {
    injectTrigger("SubmitTrigger", (a, f) => a.submitTrigger(f), {
      type: "SUBMIT",
      reason: "submit-trigger",
    })
  }
}

/** Restores the value at entry (shown while editing). */
@Directive({ selector: "[rindEditableCancelTrigger]", exportAs: "rindEditableCancelTrigger" })
export class EditableCancelTrigger {
  constructor() {
    injectTrigger("CancelTrigger", (a, f) => a.cancelTrigger(f), {
      type: "CANCEL",
      reason: "cancel-trigger",
    })
  }
}

/** The Editable's parts, for a standalone component's `imports`. */
export const Editable = [
  EditableRoot,
  EditableLabel,
  EditableArea,
  EditablePreview,
  EditableInput,
  EditableControl,
  EditableEditTrigger,
  EditableSubmitTrigger,
  EditableCancelTrigger,
] as const
