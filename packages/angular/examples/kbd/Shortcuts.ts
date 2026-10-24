import { Component } from "@angular/core"
import { Kbd } from "@rind-ui/angular"

@Component({
  selector: "app-shortcuts",
  imports: [Kbd],
  template: `
    <dl
      style="
        display: grid;
        grid-template-columns: max-content max-content;
        gap: 10px 24px;
        align-items: center;
        margin: 0;
      "
    >
      @for (s of shortcuts; track s.action) {
        <div style="display: contents">
          <dt>{{ s.action }}</dt>
          <dd style="margin: 0"><kbd rindKbdRoot [keys]="s.keys"></kbd></dd>
        </div>
      }
    </dl>
  `,
})
export class Shortcuts {
  readonly shortcuts = [
    { action: "Command palette", keys: "mod+k" },
    { action: "Save", keys: "mod+s" },
    { action: "Find in files", keys: "mod+shift+f" },
    { action: "Go to inbox", keys: "g i" },
    { action: "Close", keys: "escape" },
  ]
}
