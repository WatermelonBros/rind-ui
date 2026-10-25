import { Component } from "@angular/core"
import { Pagination } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Pagination],
  template: `
    <nav rindPaginationRoot [totalPages]="10" #p="rindPaginationRoot">
      <ul rindPaginationList>
        <li rindPaginationItem type="trigger"><button rindPaginationPrevious></button></li>
        @for (e of p.state().pages; track e.key) {
          @if (e.type === "page") {
            <li rindPaginationItem><button rindPaginationPage [value]="e.value"></button></li>
          } @else {
            <li rindPaginationItem type="ellipsis">
              <span rindPaginationEllipsis [position]="e.position"></span>
            </li>
          }
        }
        <li rindPaginationItem type="trigger"><button rindPaginationNext></button></li>
      </ul>
    </nav>
  `,
})
export class Basic {}
