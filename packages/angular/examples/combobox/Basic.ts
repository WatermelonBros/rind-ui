import { Component } from "@angular/core"
import { Combobox } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Combobox],
  template: `
    <ng-container
      rindComboboxRoot
      #cb="rindComboboxRoot"
      [items]="cities"
      defaultValue="paris"
      defaultInputValue="Paris"
    >
      <label rindComboboxLabel>City</label>
      <div rindComboboxControl data-variant="outline">
        <input rindComboboxInput />
        <button rindComboboxClearTrigger></button>
        <button rindComboboxTrigger></button>
      </div>
      <div rindComboboxPositioner>
        <div rindComboboxPopup>
          <div rindComboboxList>
            @for (g of cb.groups(); track $index) {
              @for (i of g.items; track i.key) {
                <div rindComboboxItem [value]="i.key" [textValue]="i.label" [disabled]="i.disabled">
                  <span rindComboboxItemText>{{ i.label }}</span>
                  <span rindComboboxItemIndicator></span>
                </div>
              }
            }
          </div>
          <div rindComboboxEmpty>No results</div>
        </div>
      </div>
    </ng-container>
  `,
})
export class Basic {
  readonly cities = [
    { key: "rome", label: "Rome" },
    { key: "paris", label: "Paris" },
    { key: "prague", label: "Prague" },
    { key: "oslo", label: "Oslo" },
    { key: "lisbon", label: "Lisbon" },
  ]
}
