import {
  afterRenderEffect,
  booleanAttribute,
  computed,
  Directive,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
} from "@angular/core"
import {
  type FieldsetPart,
  type FieldsetScope,
  fieldsetConnect,
  labelInteraction,
  legendScope,
  partId,
  scopeDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectEnvironment } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { FIELDSET_SCOPE } from "./context"

export interface FieldsetState {
  readonly disabled: boolean
  readonly invalid: boolean
}

const FIELDSET = new InjectionToken<FieldsetRoot>("rind-ui.fieldset")

function injectFieldset(part: string): FieldsetRoot {
  const root = inject(FIELDSET, { optional: true })
  if (!root) throw new Error(`rindFieldset${part} must be inside rindFieldsetRoot`)
  return root
}

/**
 * A group of fields with a shared label: `<fieldset rindFieldsetRoot [disabled]="busy">` with
 * a Legend, a Description and an ErrorMessage. Disabled, it disables every control inside,
 * native and rind-ui (portalled parts too).
 */
@Directive({
  selector: "[rindFieldsetRoot]",
  exportAs: "rindFieldsetRoot",
  providers: [
    { provide: FIELDSET, useExisting: forwardRef(() => FieldsetRoot) },
    { provide: FIELDSET_SCOPE, useFactory: () => inject(forwardRef(() => FieldsetRoot)).scope },
  ],
})
export class FieldsetRoot {
  /** Disables every control inside, native and rind-ui (portalled parts too). */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Shows the ErrorMessage; never passed to the controls inside. */
  readonly invalid = input(false, { transform: booleanAttribute })
  readonly id = input<string>()

  private readonly parent = inject(FIELDSET_SCOPE, { optional: true, skipSelf: true })
  /** @internal */
  readonly scope = computed<FieldsetScope>(() => ({
    disabled: this.disabled(),
    parent: this.parent?.() ?? null,
  }))
  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal No expected parts: a relation exists only once its part is rendered (ark#3707). */
  readonly registry: () => PartRegistry<FieldsetPart> = injectPartRegistry<FieldsetPart>(() => ({
    scope: "fieldset",
    root: this.instance(),
  }))
  /** @internal */
  readonly isDisabled = computed(() => scopeDisabled(this.scope()))
  /** The fieldset's state, for the template (`#f="rindFieldsetRoot"`, `f.state()`). */
  readonly state = computed<FieldsetState>(() => ({
    disabled: this.isDisabled(),
    invalid: this.invalid(),
  }))
  /** @internal The connect output for the parts (their ids are their own). */
  readonly parts = computed(() =>
    fieldsetConnect({
      instance: this.instance(),
      disabled: this.isDisabled(),
      invalid: this.invalid(),
      rootTag: "fieldset",
      nativeLegend: true,
      ids: {},
    }),
  )

  constructor() {
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    // The server assumes the default markup; after the first render the real first child does.
    const nativeLegend = signal(true)
    const describedBy =
      inject(new HostAttributeToken("aria-describedby"), { optional: true }) ?? undefined
    const ids = {
      legend: injectRenderedId(this.registry, "legend"),
      description: injectRenderedId(this.registry, "description"),
      "error-message": injectRenderedId(this.registry, "error-message"),
    }
    bindProps(
      () => ({
        ...fieldsetConnect({
          instance: this.instance(),
          disabled: this.isDisabled(),
          invalid: this.invalid(),
          rootTag: tag,
          nativeLegend: nativeLegend(),
          ids: {
            legend: ids.legend(),
            description: ids.description(),
            "error-message": ids["error-message"](),
          },
          describedBy,
        }).root(),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      // The consumer's aria-describedby is joined into the part's.
      { owns: ["aria-describedby", "disabled", "id", "invalid"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    afterRenderEffect(() => {
      const first = el.firstElementChild
      nativeLegend.set(first?.tagName === "LEGEND" && first.getAttribute("data-part") === "legend")
    })
  }
}

/**
 * The fieldset's name: `<legend rindFieldsetLegend>`. Controls inside the fieldset's first
 * `<legend>` are exempt from its disabled state (HTML).
 */
@Directive({
  selector: "[rindFieldsetLegend]",
  exportAs: "rindFieldsetLegend",
  providers: [
    {
      provide: FIELDSET_SCOPE,
      useFactory: () => inject(forwardRef(() => FieldsetLegend)).scope,
    },
  ],
})
export class FieldsetLegend {
  readonly id = input<string>()
  /** @internal */
  readonly scope: Signal<FieldsetScope | null>
  constructor() {
    const root = injectFieldset("Legend")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const own = () => this.id() ?? partId("fieldset", root.instance(), "legend")
    injectRegisterPart(root.registry, "legend", own)
    // HTML exempts only the fieldset's first <legend> child. The server assumes the default
    // markup (first); after the first render the real position decides.
    const first = signal(true)
    this.scope = computed(() => (first() ? legendScope(root.scope()) : root.scope()))
    // A legend activates nothing: only the label double-click selection guard.
    const { onMouseDown } = labelInteraction(env, {
      target: () => null,
      forwardsFocus: () => false,
    })
    bindProps(() => ({ ...root.parts().legend(own()), onMouseDown }), { owns: ["id"] })
    if (inject(PLATFORM_ID) !== "browser") return
    afterRenderEffect(() => {
      const legend = el.parentElement
        ? Array.from(el.parentElement.children).find((c) => c.tagName === "LEGEND")
        : undefined
      first.set(el.tagName === "LEGEND" && legend === el)
    })
  }
}

@Directive({ selector: "[rindFieldsetDescription]", exportAs: "rindFieldsetDescription" })
export class FieldsetDescription {
  readonly id = input<string>()
  constructor() {
    const root = injectFieldset("Description")
    const own = () => this.id() ?? partId("fieldset", root.instance(), "description")
    injectRegisterPart(root.registry, "description", own)
    bindProps(() => root.parts().description(own()), { owns: ["id"] })
  }
}

/** Shown while the fieldset is invalid (or with `forceMount`); hidden otherwise. */
@Directive({ selector: "[rindFieldsetErrorMessage]", exportAs: "rindFieldsetErrorMessage" })
export class FieldsetErrorMessage {
  readonly id = input<string>()
  readonly forceMount = input(false, { transform: booleanAttribute })
  constructor() {
    const root = injectFieldset("ErrorMessage")
    const own = () => this.id() ?? partId("fieldset", root.instance(), "error-message")
    const shown = () => root.invalid() || this.forceMount()
    injectRegisterPart(root.registry, "error-message", () => (shown() ? own() : undefined))
    bindProps(
      () => (shown() ? root.parts().errorMessage(own()) : absentProps("fieldset", root.instance())),
      { owns: ["forcemount", "id"] },
    )
  }
}

/** The Fieldset's parts, for a standalone component's `imports`. */
export const Fieldset = [
  FieldsetRoot,
  FieldsetLegend,
  FieldsetDescription,
  FieldsetErrorMessage,
] as const
