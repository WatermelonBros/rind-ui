import { Component, signal } from "@angular/core"
import { Button } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Button],
  template: `
    <div class="row">
      <button rindButton (press)="count.set(count() + 1)">Pressed {{ count() }}×</button>
      <button rindButton [pending]="pending()" (press)="save()">
        {{ pending() ? "Saving…" : "Save" }}
      </button>
      <button rindButton disabled>Disabled</button>
    </div>
  `,
})
export class Basic {
  readonly pending = signal(false)
  readonly count = signal(0)

  save() {
    this.pending.set(true)
    setTimeout(() => this.pending.set(false), 1500)
  }
}
