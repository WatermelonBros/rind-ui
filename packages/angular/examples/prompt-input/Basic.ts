import { Component } from "@angular/core"
import { PromptInput } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [PromptInput],
  template: `
    <!-- The composer: attachments, the draft, then attach and Submit on one row. -->
    <form rindPromptInputRoot [submitHandler]="send">
      <label rindPromptInputLabel>Message</label>
      <div rindPromptInputAttachments></div>
      <textarea rindPromptInputTextarea placeholder="Ask anything"></textarea>
      <button rindPromptInputAttachTrigger>
        <svg aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
          <path d="M209.66,122.34a8,8,0,0,1,0,11.32l-82.05,82a56,56,0,0,1-79.2-79.21L147.67,35.73a40,40,0,1,1,56.61,56.55L105,193A24,24,0,1,1,71,159L154.3,74.38A8,8,0,1,1,165.7,85.6L82.39,170.31a8,8,0,1,0,11.27,11.36L192.93,81A24,24,0,1,0,159,47L59.76,147.68a40,40,0,1,0,56.53,56.62l82.06-82A8,8,0,0,1,209.66,122.34Z" />
        </svg>
      </button>
      <button rindPromptInputSubmit>
        <svg aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor"><path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" /></svg>
      </button>
    </form>
  `,
})
export class Basic {
  readonly send = () => {}
}
