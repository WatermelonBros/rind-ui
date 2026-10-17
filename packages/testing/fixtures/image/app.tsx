// The page image.pw.test.ts drives: themed Images whose sources come from routes the test
// controls (a held "slow" image, a broken one), bundled by the test itself.
import { Image } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const IMG = "https://img.rind.test"

function Photo({ alt, src }: { alt: string; src?: string }) {
  return (
    <Image.Root
      alt={alt}
      style={{ inlineSize: 320, ["--rind-image-aspect-ratio" as string]: "16 / 9" }}
    >
      <Image.Img src={src} />
      <Image.Fallback>Image unavailable</Image.Fallback>
    </Image.Root>
  )
}

function App() {
  return (
    <div style={{ display: "grid", gap: 16, padding: 24, justifyItems: "start" }}>
      <Photo alt="Slow" src={`${IMG}/slow.svg`} />
      <Photo alt="Broken" src={`${IMG}/missing.png`} />
      <Photo alt="Empty" />
    </div>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
