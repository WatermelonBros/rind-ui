import { Directive, input } from "@angular/core"
import type { PartProps } from "@rind-ui/core"
import { bindProps } from "./bind-props"

/**
 * Applies a part's props to an element a component renders itself (Kbd's keys, Badge's hidden
 * label): `<span [rindProps]="api().glyph(key)">`.
 */
@Directive({ selector: "[rindProps]" })
export class RindProps {
  readonly rindProps = input.required<PartProps>()
  constructor() {
    bindProps(() => this.rindProps())
  }
}
