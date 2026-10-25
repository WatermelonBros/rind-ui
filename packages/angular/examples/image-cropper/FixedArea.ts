import { Component } from "@angular/core"
import { ImageCropper } from "@rind-ui/angular"

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

@Component({
  selector: "app-fixed-area",
  imports: [ImageCropper],
  template: `
    <div style="display: grid; gap: 12px; inline-size: min(100%, 520px)">
      <div rindImageCropperRoot aria-label="Banner" fixedCropArea [aspectRatio]="3" [defaultZoom]="1.5">
        <div rindImageCropperViewport style="inline-size: 100%; block-size: 300px">
          <img rindImageCropperImage [src]="landscape" />
          <div rindImageCropperSelection>
            <div rindImageCropperGrid axis="horizontal"></div>
            <div rindImageCropperGrid axis="vertical"></div>
            @for (p of handles; track p) {
              <div rindImageCropperHandle [position]="p"></div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class FixedArea {
  readonly landscape = LANDSCAPE
  readonly handles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const
}
