import { Component } from "@angular/core"
import { CheckboxGroup } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [CheckboxGroup],
  template: `
    <div rindCheckboxGroupRoot [allValues]="toppings" [defaultValue]="['Ham']">
      <span rindCheckboxGroupLabel>Toppings</span>
      <div rindCheckboxGroupParent #all="rindCheckboxGroupParent">
        <button rindCheckboxGroupItemControl>
          <span rindCheckboxGroupItemIndicator>{{
            all.state().checked === "indeterminate" ? "–" : "✓"
          }}</span>
        </button>
        <label rindCheckboxGroupItemLabel>All toppings</label>
      </div>
      @for (value of toppings; track value) {
        <div rindCheckboxGroupItem [value]="value">
          <button rindCheckboxGroupItemControl>
            <span rindCheckboxGroupItemIndicator>✓</span>
          </button>
          <label rindCheckboxGroupItemLabel>{{ value }}</label>
        </div>
      }
    </div>
  `,
})
export class Basic {
  readonly toppings = ["Ham", "Cheese", "Olives"]
}
