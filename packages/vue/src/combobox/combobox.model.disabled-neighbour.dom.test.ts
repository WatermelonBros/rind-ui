// The Combobox model over the "disabled neighbour" props class (helper: fixtures/combobox-model.ts).
import { CITIES, config } from "../../fixtures/combobox-model"

config("disabled neighbour", {
  items: CITIES.map((c) => (c.key === "paris" ? { ...c, disabled: true } : c)),
})
