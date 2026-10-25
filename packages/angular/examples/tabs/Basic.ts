import { Component } from "@angular/core"
import { Tabs } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Tabs],
  template: `
    <div rindTabsRoot defaultValue="account">
      <div rindTabsList aria-label="Settings">
        <button rindTabsTab value="account">Account</button>
        <button rindTabsTab value="billing">Billing</button>
        <button rindTabsTab value="team">Team</button>
        <span rindTabsIndicator></span>
      </div>
      <div rindTabsPanel value="account"><p class="pad">Name, email and avatar.</p></div>
      <div rindTabsPanel value="billing"><p class="pad">Plan, invoices and payment method.</p></div>
      <div rindTabsPanel value="team"><p class="pad">Members, roles and invitations.</p></div>
    </div>
  `,
})
export class Basic {}
