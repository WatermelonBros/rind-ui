import { Component } from "@angular/core"
import { Avatar } from "@rind-ui/angular"

// An inline SVG data URL: the example needs no network.
const face = (bg: string, fg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="${bg}"/><circle cx="40" cy="32" r="14" fill="${fg}"/><path d="M14 80c2-16 13-24 26-24s24 8 26 24z" fill="${fg}"/></svg>`,
  )}`

@Component({
  selector: "app-basic",
  imports: [Avatar],
  template: `
    <div class="row">
      <span rindAvatarRoot aria-label="Ada Lovelace">
        <img rindAvatarImage [src]="ada" />
        <span rindAvatarFallback>AL</span>
      </span>
      <span rindAvatarRoot aria-label="Alan Turing" data-size="lg">
        <img rindAvatarImage [src]="alan" />
        <span rindAvatarFallback>AT</span>
      </span>
    </div>
  `,
})
export class Basic {
  readonly ada = face("#c4b5fd", "#4c1d95")
  readonly alan = face("#99f6e4", "#134e4a")
}
