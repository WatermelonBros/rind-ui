/** @jsxImportSource solid-js */
import { For } from "solid-js"
import { ImageCropper } from "../../src/image-cropper"
import { ImageViewer } from "../../src/image-viewer"
import { MessageThread } from "../../src/message-thread"
import { PromptInput } from "../../src/prompt-input"
import { Reasoning } from "../../src/reasoning"
import { StreamingMessage } from "../../src/streaming-message"

const SRC = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
const FROM = ["user", "assistant"] as const

export function App() {
  return (
    <div>
      <ImageViewer.Root id="plan">
        <ImageViewer.Viewport>
          <ImageViewer.Image src={SRC} alt="Floor plan" />
        </ImageViewer.Viewport>
        <ImageViewer.ZoomOut>−</ImageViewer.ZoomOut>
        <ImageViewer.ZoomText />
        <ImageViewer.ZoomIn />
        <ImageViewer.Reset />
      </ImageViewer.Root>
      <ImageCropper.Root id="avatar" aria-label="Avatar">
        <ImageCropper.Viewport>
          <ImageCropper.Image src={SRC} alt="" />
          <ImageCropper.Selection>
            <ImageCropper.Handle position="n" />
            <ImageCropper.Grid axis="horizontal" />
          </ImageCropper.Selection>
        </ImageCropper.Viewport>
      </ImageCropper.Root>
      <MessageThread.Root id="chat" count={2}>
        <MessageThread.Viewport>
          <For each={FROM}>
            {(from, i) => (
              <MessageThread.Message index={i()} from={from}>
                <p>message {i()}</p>
              </MessageThread.Message>
            )}
          </For>
        </MessageThread.Viewport>
        <MessageThread.JumpToLatest />
      </MessageThread.Root>
      <StreamingMessage.Root id="reply" text="Hello there." status="streaming">
        <StreamingMessage.Content />
        <StreamingMessage.Caret />
      </StreamingMessage.Root>
      <Reasoning.Root id="why" thinking={false} duration={4}>
        <Reasoning.Trigger />
        <Reasoning.Content>The moon pulls the water.</Reasoning.Content>
      </Reasoning.Root>
      <PromptInput.Root id="ask" defaultValue="hello">
        <PromptInput.Label>Message</PromptInput.Label>
        <PromptInput.Attachments />
        <PromptInput.Textarea placeholder="Ask" />
        <PromptInput.CharacterCount max={10} />
        <PromptInput.AttachTrigger />
        <PromptInput.Submit />
      </PromptInput.Root>
    </div>
  )
}
