import { Component, input } from "@angular/core"
import type { PartProps } from "@rind-ui/core"
import { bindProps } from "./bind-props"

/**
 * A hidden form input a part renders as its host's sibling (a segment's: never inside the
 * button, reka-ui#1597), created in the part's view container so hydration knows it.
 */
@Component({ selector: "input[rindHiddenInput]", template: "" })
export class HiddenInput {
  readonly props = input.required<PartProps>()
  constructor() {
    bindProps(() => this.props())
  }
}
