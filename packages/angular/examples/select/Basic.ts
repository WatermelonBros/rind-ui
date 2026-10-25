import { Component } from "@angular/core"
import { Select } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Select],
  template: `
    <ng-container rindSelectRoot [items]="fruits" placeholder="Pick one" defaultValue="banana">
      <span rindSelectLabel>Fruit</span>
      <button rindSelectTrigger>
        <span rindSelectValueText></span>
        <span rindSelectIndicator>▾</span>
      </button>
      <ng-template rindSelectPortal>
        <div rindSelectPositioner>
          <div rindSelectContent>
            <div rindSelectList>
              @for (f of fruits; track f.key) {
                <div rindSelectItem [value]="f.key">
                  <span rindSelectItemText>{{ f.label }}</span>
                  <span rindSelectItemIndicator>✓</span>
                </div>
              }
            </div>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
})
export class Basic {
  readonly fruits = ["Apple", "Banana", "Cherry", "Grape", "Mango", "Peach"].map((f) => ({
    key: f.toLowerCase(),
    label: f,
  }))
}
