// The page qr-code.pw.test.ts drives: a themed QR code with the "Value" input that calls
// setValue and a PNG download trigger, bundled by the test itself (no site build).
import { QrCode } from "@rind-ui/react"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [value, setValue] = useState("https://reado.app")
  return (
    <main>
      <h1>Share link</h1>
      <label>
        Value <input value={value} onChange={(e) => setValue(e.currentTarget.value)} />
      </label>
      <QrCode.Root value={value} onValueChange={setValue}>
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.Overlay>
          <img
            alt=""
            width={24}
            height={24}
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs="
          />
        </QrCode.Overlay>
        <QrCode.ValueText />
        <QrCode.DownloadTrigger fileName="reado.png">Download</QrCode.DownloadTrigger>
      </QrCode.Root>
    </main>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
