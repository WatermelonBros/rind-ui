import {
  afterRenderEffect,
  Directive,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from "@angular/core"
import {
  checkLabelTarget,
  labelConnect,
  labelForwardsFocus,
  labelInteraction,
  labelTarget,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectEnvironment } from "../provider"

/** A native `<label rindLabel>`: names its control through `for` or by wrapping it. */
@Directive({ selector: "[rindLabel]", exportAs: "rindLabel" })
export class Label {
  /** The labelled control's id (the `for` attribute). */
  readonly for = input<string>()
  readonly id = input<string>()

  constructor() {
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const instance = injectRootId(() => this.id())
    // Known after the first render only: the server keeps the consumer's `for`.
    const nonLabelable = signal(false)
    const forwardsFocus = () => labelForwardsFocus(tag, nonLabelable())
    bindProps(
      () =>
        joinHandlers(
          labelConnect({
            instance: instance(),
            id: instance(),
            htmlFor: this.for(),
            tag,
            forwardsFocus: forwardsFocus(),
          }),
          labelInteraction(env, {
            target: () => labelTarget(el, this.for()),
            forwardsFocus,
          }),
        ),
      { owns: ["for", "id"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    afterRenderEffect(() => nonLabelable.set(checkLabelTarget(el, this.for())))
  }
}
