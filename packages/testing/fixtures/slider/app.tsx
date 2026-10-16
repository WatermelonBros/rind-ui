// The page slider.pw.test.ts drives: themed Sliders in each configuration, bundled by the
// test itself (no Storybook, no site build).
import { Slider, type SliderRootProps } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function S({ label, count = 1, ...props }: SliderRootProps & { label: string; count?: number }) {
  return (
    <Slider.Root {...props}>
      <Slider.Label>{label}</Slider.Label>
      <Slider.ValueText />
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
        </Slider.Track>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are identified by index
          <Slider.Thumb key={i} index={i} />
        ))}
      </Slider.Control>
    </Slider.Root>
  )
}

function App() {
  return (
    <form style={{ display: "grid", gap: 24, width: 320, padding: 24 }}>
      <S label="Volume" name="volume" defaultValue={50} />
      <S label="Price" name="price" count={2} defaultValue={[20, 80]} />
      <div dir="rtl">
        <S label="Balance" defaultValue={25} dir="rtl" />
      </div>
      <S label="Height" orientation="vertical" defaultValue={25} />
      <S
        label="Zoom"
        thumbAlignment="contain"
        defaultValue={0}
        style={{ "--rind-slider-thumb-size": "1.25rem" } as never}
      />
      <button type="reset">Reset</button>
    </form>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
