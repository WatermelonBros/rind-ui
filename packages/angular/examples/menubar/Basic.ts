import { Component, signal } from "@angular/core"
import { Menu, Menubar } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Menu, Menubar],
  template: `
    <div rindMenubarRoot aria-label="Application">
      <ng-container rindMenubarMenu value="File">
        <div rindMenubarTrigger>File</div>
        <ng-template rindMenuPortal>
          <div rindMenuPositioner>
            <div rindMenuContent>
              <div rindMenuItem aria-keyshortcuts="Control+N">
                New
                <span aria-hidden="true" data-hint="">Ctrl+N</span>
              </div>
              <div rindMenuItem aria-keyshortcuts="Control+O">
                Open…
                <span aria-hidden="true" data-hint="">Ctrl+O</span>
              </div>
              <ng-container rindMenuSubmenu>
                <div rindMenuSubmenuTrigger>Open recent</div>
                <ng-template rindMenuPortal>
                  <div rindMenuPositioner>
                    <div rindMenuContent>
                      <div rindMenuItem>notes.md</div>
                      <div rindMenuItem>plan.md</div>
                    </div>
                  </div>
                </ng-template>
              </ng-container>
              <div rindMenuSeparator></div>
              <div rindMenuItem disabled aria-keyshortcuts="Control+S">
                Save
                <span aria-hidden="true" data-hint="">Ctrl+S</span>
              </div>
            </div>
          </div>
        </ng-template>
      </ng-container>
      <ng-container rindMenubarMenu value="Edit">
        <div rindMenubarTrigger>Edit</div>
        <ng-template rindMenuPortal>
          <div rindMenuPositioner>
            <div rindMenuContent>
              <div rindMenuItem aria-keyshortcuts="Control+Z">
                Undo
                <span aria-hidden="true" data-hint="">Ctrl+Z</span>
              </div>
              <div rindMenuItem disabled aria-keyshortcuts="Control+Shift+Z">
                Redo
                <span aria-hidden="true" data-hint="">Ctrl+Shift+Z</span>
              </div>
              <div rindMenuSeparator></div>
              <div rindMenuItem aria-keyshortcuts="Control+F">
                Find…
                <span aria-hidden="true" data-hint="">Ctrl+F</span>
              </div>
            </div>
          </div>
        </ng-template>
      </ng-container>
      <ng-container rindMenubarMenu value="View">
        <div rindMenubarTrigger>View</div>
        <ng-template rindMenuPortal>
          <div rindMenuPositioner>
            <div rindMenuContent>
              <div rindMenuCheckboxItem [(checked)]="wrap">
                <span rindMenuItemIndicator>✓</span>
                Word wrap
              </div>
              <div rindMenuSeparator></div>
              <div rindMenuGroup>
                <div rindMenuGroupLabel>Zoom</div>
                <div rindMenuRadioGroup [(value)]="zoom">
                  @for (z of zooms; track z) {
                    <div rindMenuRadioItem [value]="z">
                      <span rindMenuItemIndicator>•</span>
                      {{ z }}%
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </ng-template>
      </ng-container>
    </div>
  `,
})
export class Basic {
  readonly wrap = signal(true)
  readonly zoom = signal<string | null>("100")
  readonly zooms = ["75", "100", "150"]
}
