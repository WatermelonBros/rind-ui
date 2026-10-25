import { Component } from "@angular/core"
import { Accordion } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Accordion],
  template: `
    <div rindAccordionRoot [defaultValue]="['shipping']">
      @for (item of items; track item.value) {
        <div rindAccordionItem [value]="item.value">
          <h3 rindAccordionHeader>
            <button rindAccordionTrigger>
              {{ item.title }} <span rindAccordionIndicator>+</span>
            </button>
          </h3>
          <div rindAccordionContent>
            <div class="pad">{{ item.body }}</div>
          </div>
        </div>
      }
    </div>
  `,
})
export class Basic {
  readonly items = [
    { value: "shipping", title: "Shipping", body: "Ships in two days, tracked to your door." },
    { value: "returns", title: "Returns", body: "Thirty days, no questions, free pickup." },
    { value: "payment", title: "Payment", body: "Cards, transfers and the usual wallets." },
  ]
}
