import type { MetricUnit } from "@/server/metrics"

const decimal = new Intl.NumberFormat("de", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * A metric's value as shown: "15", "22 %", "0,41"; "–" for a rate without
 * any Game.
 */
export function formatMetricValue(
  value: number | null,
  unit: MetricUnit
): string {
  if (value === null) return "–"
  switch (unit) {
    case "percent":
      return `${Math.round(value * 100)}\u00a0%`
    case "decimal":
      return decimal.format(value)
    case "count":
      return String(value)
  }
}
