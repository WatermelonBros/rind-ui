// The page avatar.pw.test.ts drives: themed Avatars whose images come from routes the test
// controls (a slow image, a broken one), bundled by the test itself (no Storybook, no site).
import { Avatar } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const IMG = "https://img.rind.test"

function Person({ name, src, delay }: { name: string; src?: string; delay?: number }) {
  return (
    <Avatar.Root aria-label={name} fallbackDelay={delay}>
      <Avatar.Image src={src} referrerPolicy="no-referrer" crossOrigin="anonymous" />
      <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
    </Avatar.Root>
  )
}

function Group({ dir }: { dir: "ltr" | "rtl" }) {
  return (
    <div dir={dir}>
      <Avatar.Group aria-label={`Reviewers ${dir}`}>
        <Person name={`Ada ${dir}`} />
        <Person name={`Alan ${dir}`} />
        <Avatar.GroupOverflow count={4} />
      </Avatar.Group>
    </div>
  )
}

function App() {
  return (
    <div style={{ display: "grid", gap: 16, padding: 24, justifyItems: "start" }}>
      <Person name="Slow" src={`${IMG}/slow.png`} />
      <Person name="Slow delayed" src={`${IMG}/slow-2.png`} delay={300} />
      <Person name="Broken" src={`${IMG}/missing.png`} />
      <Person name="Empty" />
      <Group dir="ltr" />
      <Group dir="rtl" />
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
