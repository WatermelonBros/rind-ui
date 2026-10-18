// The Slider's step invariants (add-slider "Slider Invariants") that need the DOM or a
// count across a step: no focus or blur on a thumb input during a key step (BU#5296), no
// other slider or focusable element inside the Slider, and one commit per committing step.
import type { PartNaming, SliderPart, sliderContract } from "@rind-ui/core"
import type { ConsumerInvariant } from "./model"

export interface SliderStepInvariants {
  readonly invariants: readonly ConsumerInvariant<typeof sliderContract>[]
  /** Forgets what was recorded (call in `setup`). */
  reset(): void
}

const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], [role="slider"]'

/**
 * `commits` reads how often the page's `onValueCommit` ran; `expectedCommits` how often the
 * oracle's did (pass a spy as the oracle's `onValueCommit` prop).
 */
export function sliderStepInvariants(
  options: {
    readonly commits?: () => number
    readonly expectedCommits?: () => number
    /** A Slider rendered as another component's part: the host's scope and part names. */
    readonly naming?: PartNaming<SliderPart>
  } = {},
): SliderStepInvariants {
  const scope = options.naming?.scope ?? "slider"
  const name = (part: SliderPart) => options.naming?.part(part) ?? part
  const THUMB_INPUT = `[data-scope="${scope}"][data-part="${name("hidden-input")}"]`
  const ROOT = `[data-scope="${scope}"][data-part="${name("root")}"]`
  let refocused: string[] = []
  let inKey = false
  const doc = globalThis.document
  // From the keydown's capture until the task ends (a handler may stop its propagation).
  const onKeyDown = () => {
    inKey = true
    setTimeout(() => {
      inKey = false
    }, 0)
  }
  const onFocusChange = (e: Event) => {
    const target = e.target as Element | null
    if (inKey && target?.matches?.(THUMB_INPUT))
      refocused.push(`${e.type} on thumb input ${target.getAttribute("data-index")}`)
  }
  if (doc) {
    doc.addEventListener("keydown", onKeyDown, true)
    doc.addEventListener("focusin", onFocusChange, true)
    doc.addEventListener("focusout", onFocusChange, true)
  }
  return {
    invariants: [
      {
        name: "slider-no-refocus-on-key",
        check: async () => {
          const out = refocused
          refocused = []
          return out.length > 0 ? `focus moved during a key step: ${out.join(", ")}` : undefined
        },
      },
      {
        name: "slider-only-thumb-inputs-focusable",
        check: async () => {
          if (!doc) return undefined
          for (const root of Array.from(doc.querySelectorAll(ROOT))) {
            const extra = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
              (el) => !el.matches(THUMB_INPUT),
            )
            if (extra.length > 0) {
              return `elements other than the thumb inputs are focusable or sliders: ${extra
                .map((el) => el.outerHTML.slice(0, 80))
                .join(", ")}`
            }
          }
          return undefined
        },
      },
      {
        name: "slider-commit-count",
        check: async () => {
          if (!options.commits || !options.expectedCommits) return undefined
          const [have, want] = [options.commits(), options.expectedCommits()]
          return have === want ? undefined : `onValueCommit ran ${have} times, the oracle ${want}`
        },
      },
    ],
    reset() {
      refocused = []
      inKey = false
    },
  }
}
