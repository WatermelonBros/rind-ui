"use client"

import { type CropData, cropImage } from "@rind-ui/core"
import { Button, ImageCropper, Slider } from "@rind-ui/react"
import { useRef, useState } from "react"
import type { States, Variants } from "./types"

/** `dragging` and `settling` last while the user moves the crop: reached by any example. */
export const states: States = { "image-cropper": { idle: "Avatar" } }

/** Inline layout: theme pages do not load the site's helper classes. */
const COLUMN = { display: "grid", gap: 12, inlineSize: "min(100%, 520px)" } as const
const ROW = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" } as const

/** An illustrated landscape (same-origin data URL: the canvas is never tainted). */
const LANDSCAPE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb37a"/><stop offset="1" stop-color="#ffe3c4"/></linearGradient></defs>
  <rect width="1200" height="800" fill="url(#sky)"/>
  <circle cx="860" cy="250" r="110" fill="#ff7a59"/>
  <path d="M0 520 Q300 380 600 500 T1200 460 V800 H0Z" fill="#6aa66b"/>
  <path d="M0 620 Q350 520 700 620 T1200 600 V800 H0Z" fill="#3f7d4f"/>
  <path d="M120 640 l40 -120 l40 120z M240 660 l30 -90 l30 90z" fill="#24543a"/>
</svg>`,
)}`

function Stage({ round = false }: { readonly round?: boolean }) {
  return (
    <ImageCropper.Viewport style={{ inlineSize: "100%", blockSize: 300 }}>
      <ImageCropper.Image src={LANDSCAPE} />
      <ImageCropper.Selection>
        {round ? null : (
          <>
            <ImageCropper.Grid axis="horizontal" />
            <ImageCropper.Grid axis="vertical" />
          </>
        )}
        {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((p) => (
          <ImageCropper.Handle key={p} position={p} />
        ))}
      </ImageCropper.Selection>
    </ImageCropper.Viewport>
  )
}

/** Crops the current data to a preview image. */
function usePreview() {
  const [preview, setPreview] = useState<string | null>(null)
  const data = useRef<CropData | null>(null)
  const make = async () => {
    const img = document.querySelector<HTMLImageElement>(
      '[data-scope="image-cropper"][data-part="image"]',
    )
    if (!img || !data.current) return
    setPreview((await cropImage(img, data.current, { output: "dataUrl" })) as string)
  }
  return { preview, data, make }
}

export function Avatar() {
  const [zoom, setZoom] = useState(1)
  const { preview, data, make } = usePreview()
  return (
    <div style={COLUMN}>
      <ImageCropper.Root
        aria-label="Avatar"
        cropShape="circle"
        zoom={zoom}
        onZoomChange={setZoom}
        onCropChange={(_, details) => {
          data.current = details.data
        }}
      >
        <Stage round />
      </ImageCropper.Root>
      <Slider.Root
        value={zoom}
        onValueChange={(v) => setZoom(v as number)}
        min={1}
        max={5}
        step={0.1}
      >
        <Slider.Label>Zoom</Slider.Label>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb index={0} />
        </Slider.Control>
      </Slider.Root>
      <div style={ROW}>
        <Button onPress={make}>Crop</Button>
        {preview ? (
          <img
            src={preview}
            alt="Cropped avatar"
            width={64}
            height={64}
            style={{ borderRadius: "50%" }}
          />
        ) : null}
      </div>
    </div>
  )
}

export function RotateAndFlip() {
  const [rotation, setRotation] = useState(0)
  const [flip, setFlip] = useState({ horizontal: false, vertical: false })
  return (
    <div style={COLUMN}>
      <ImageCropper.Root
        aria-label="Cover image"
        aspectRatio={16 / 9}
        rotation={rotation}
        onRotationChange={setRotation}
        flip={flip}
        onFlipChange={setFlip}
      >
        <Stage />
      </ImageCropper.Root>
      <div style={ROW}>
        <Button onPress={() => setRotation((r) => (r + 270) % 360)}>Rotate left</Button>
        <Button onPress={() => setRotation((r) => (r + 90) % 360)}>Rotate right</Button>
        <Button onPress={() => setFlip((f) => ({ ...f, horizontal: !f.horizontal }))}>Flip</Button>
      </div>
    </div>
  )
}

export function FixedArea() {
  return (
    <div style={COLUMN}>
      <ImageCropper.Root aria-label="Banner" fixedCropArea aspectRatio={3} defaultZoom={1.5}>
        <Stage />
      </ImageCropper.Root>
    </div>
  )
}

export function FreeRotation() {
  const [rotation, setRotation] = useState(12)
  return (
    <div style={COLUMN}>
      <ImageCropper.Root
        aria-label="Straightened photo"
        rotation={rotation}
        onRotationChange={setRotation}
      >
        <Stage />
      </ImageCropper.Root>
      <Slider.Root
        value={rotation}
        onValueChange={(v) => setRotation(v as number)}
        min={-45}
        max={45}
        step={1}
      >
        <Slider.Label>Straighten</Slider.Label>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb index={0} />
        </Slider.Control>
      </Slider.Root>
    </div>
  )
}

export const variants: Variants = {
  Avatar: {
    title: "Avatar",
    description:
      "A circle with a zoom slider; Crop draws the natural-pixel crop. Tab to the crop: arrows move it (Shift, Ctrl further), Alt resizes, + / − zoom.",
  },
  RotateAndFlip: {
    title: "Rotate and flip",
    description: "16:9, with rotation and flip bound to buttons.",
  },
  FixedArea: {
    title: "Fixed area",
    description: "`fixedCropArea`: the crop stays, the image pans under it (drag, arrows, wheel).",
  },
  FreeRotation: {
    title: "Free rotation",
    description: "Any angle: zoom rises just enough for the image to cover the crop's corners.",
  },
}
