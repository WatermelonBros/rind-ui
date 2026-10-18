import type { ComponentType } from "react"
import styles from "./home.module.css"

export interface ColourProps {
  readonly label: string
  readonly value: string
  readonly swatches: readonly string[]
  readonly onChange: (hex: string) => void
}
export type ColourComponent = ComponentType<ColourProps>

/**
 * The builder's colour control before the picker's module has loaded: the same parts and
 * attributes, so the skin draws it the same size and look, and nothing moves when it swaps.
 * Not interactive (the real one replaces it a screen before it scrolls into view).
 */
export function ColourPlaceholder({ label, value }: Pick<ColourProps, "label" | "value">) {
  return (
    <div className={styles.tuneColor} data-scope="color-picker" data-part="root" aria-hidden="true">
      <span data-scope="color-picker" data-part="label">
        {label}
      </span>
      <div data-scope="color-picker" data-part="control">
        <span data-scope="color-picker" data-part="trigger">
          <span
            data-scope="color-picker"
            data-part="value-swatch"
            style={{ ["--rind-color-picker-value" as string]: value, background: value }}
          />
        </span>
        <span data-scope="color-picker" data-part="value-text">
          {value}
        </span>
      </div>
    </div>
  )
}
