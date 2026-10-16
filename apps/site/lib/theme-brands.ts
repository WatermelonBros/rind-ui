// Sample brands for the theme pages and their contrast report (theme-presets design D10). Built
// in adjust mode, so a garish accent still ships a passing theme; the report lists what moved.
import { checkTheme, defineTheme } from "@rind-ui/theme/builder"

export const sampleBrands = [
  defineTheme({ name: "sample-yellow", accent: "oklch(0.86 0.17 95)", contrast: "adjust" }),
  defineTheme({ name: "sample-white", accent: "#f5f5f0", contrast: "adjust" }),
]

/** Brand → its contrast report. Presets are checked, not built. */
export const reports = {
  calm: checkTheme({ name: "calm", extends: "calm" }),
  crisp: checkTheme({ name: "crisp", extends: "crisp" }),
  ...Object.fromEntries(sampleBrands.map((b) => [b.name, b.report])),
}

export const brands = ["calm", "crisp", ...sampleBrands.map((b) => b.name)]

/** The sample brands' CSS (calm and crisp ship as files). */
export const sampleBrandsCss = sampleBrands.map((b) => b.css).join("\n")
