import { NgTemplateOutlet } from "@angular/common"
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  ViewEncapsulation,
} from "@angular/core"
import { badgeConnect, badgeWarnings, checkBadgeHost } from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { RindProps } from "../rind-props"

export interface BadgeState {
  /** A `label` replaces what assistive technology hears. */
  readonly labelled: boolean
}

/**
 * A short status or count: `<span rindBadgeRoot>Beta</span>`. With a `label`, the visible
 * content is hidden from assistive technology and the label is read instead.
 */
@Component({
  selector: "[rindBadgeRoot]",
  exportAs: "rindBadgeRoot",
  imports: [NgTemplateOutlet, RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-template #content><ng-content /></ng-template>
    @if (labelled()) {
      <span [rindProps]="parts().content!"><ng-container [ngTemplateOutlet]="content" /></span
      ><span [rindProps]="parts().label!">{{ label() }}</span>
    } @else {
      <ng-container [ngTemplateOutlet]="content" />
    }`,
})
export class BadgeRoot {
  /** The text assistive technology gets instead of the visible content ("99+"). */
  readonly label = input<string>()
  readonly id = input<string>()

  private readonly instance = injectRootId(() => this.id())
  private readonly api = computed(() =>
    badgeConnect({ label: this.label(), instance: this.instance() }),
  )
  /** @internal */
  protected readonly parts = computed(() => ({
    content: this.api().content(),
    label: this.api().label(),
  }))
  /** @internal */
  protected readonly labelled = computed(
    () => this.parts().content !== null && this.parts().label !== null,
  )
  /** The badge's state, for the template. */
  readonly state = computed<BadgeState>(() => ({ labelled: this.parts().content !== null }))

  constructor() {
    const { statics } = bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      { owns: ["id", "label"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    badgeWarnings(Object.fromEntries(statics))
    afterRenderEffect(() => checkBadgeHost(el, this.label()))
  }
}

/** The Badge's directives, for a standalone component's `imports`. */
export const Badge = [BadgeRoot] as const
