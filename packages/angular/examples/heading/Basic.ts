import { Component } from "@angular/core"
import { Heading, HeadingLevelSection } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Heading, HeadingLevelSection],
  template: `
    <h2 rindHeading>Settings</h2>
    <ng-container rindHeadingLevel>
      <h3 rindHeading>Profile</h3>
      <ng-container rindHeadingLevel>
        <h4 rindHeading>Avatar</h4>
      </ng-container>
    </ng-container>
  `,
})
export class Basic {}
