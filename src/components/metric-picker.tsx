import { createContext, useContext, useState } from "react"
import {
  Bomb,
  ChevronDown,
  Percent,
  Shield,
  Star,
  Trophy,
  Users,
  Waves,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  RadioGroup,
  RadioRow,
  RadioRowContent,
  RadioRowDescription,
  RadioRowIndicator,
  RadioRowMedia,
  RadioRowTitle,
} from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { MetricId } from "@/server/leaderboard"

// The metric of the Group Leaderboard: the button that shows it and the
// sheet that changes it.
//
//   <MetricPicker metrics={…} value={…} onValueChange={…}>
//     <MetricPickerTrigger />
//     <MetricPickerContent />
//   </MetricPicker>

/** Each metric's icon, on the trigger and in the sheet. */
const METRIC_ICONS: Record<MetricId, LucideIcon> = {
  wins: Trophy,
  winRate: Percent,
  games: Users,
  bombsPerGame: Bomb,
  swimRate: Waves,
  unbreakable: Shield,
  untouchable: Star,
}

function MetricIcon({ id }: { id: MetricId }) {
  const Icon = METRIC_ICONS[id]
  return <Icon aria-hidden="true" />
}

type Metric = { id: MetricId; name: string; description: string }

type MetricPickerContext = {
  metrics: Array<Metric>
  /** The chosen metric. */
  value: Metric
  choose: (id: MetricId) => void
}

const Context = createContext<MetricPickerContext | null>(null)

function useMetricPicker() {
  const context = useContext(Context)
  if (!context) throw new Error("Use inside <MetricPicker>.")
  return context
}

/** Holds the metrics, the chosen one and the sheet's open state. */
export function MetricPicker({
  metrics,
  value,
  onValueChange,
  children,
}: {
  metrics: Array<Metric>
  /** The chosen metric's id; the first metric when unknown. */
  value: string | undefined
  onValueChange: (id: MetricId) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Context.Provider
      value={{
        metrics,
        value: metrics.find((m) => m.id === value) ?? metrics[0],
        choose: (id) => {
          setOpen(false)
          onValueChange(id)
        },
      }}
    >
      <Drawer open={open} onOpenChange={setOpen}>
        {children}
      </Drawer>
    </Context.Provider>
  )
}

/** The chosen metric with its icon, in the primary colour; opens the sheet. */
export function MetricPickerTrigger({ className }: { className?: string }) {
  const { value } = useMetricPicker()
  return (
    <DrawerTrigger
      render={
        <Button
          variant="selected"
          size="sm"
          className={cn("min-w-0 justify-start", className)}
        />
      }
    >
      <MetricIcon id={value.id} />
      <span className="truncate">{value.name}</span>
      <span className="sr-only">, Kennzahl ändern</span>
      <ChevronDown className="ml-auto" aria-hidden="true" />
    </DrawerTrigger>
  )
}

/** Sheet "Kennzahl": each metric with its icon and what it counts; a tap applies it. */
export function MetricPickerContent() {
  const { metrics, value, choose } = useMetricPicker()
  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Kennzahl</DrawerTitle>
      </DrawerHeader>
      <RadioGroup
        variant="list"
        aria-label="Kennzahl"
        value={value.id}
        onValueChange={(id) => choose(id as MetricId)}
      >
        {metrics.map((metric) => (
          <RadioRow key={metric.id} value={metric.id}>
            <RadioRowMedia>
              <MetricIcon id={metric.id} />
            </RadioRowMedia>
            <RadioRowContent>
              <RadioRowTitle weight="strong">{metric.name}</RadioRowTitle>
              <RadioRowDescription>{metric.description}</RadioRowDescription>
            </RadioRowContent>
            <RadioRowIndicator />
          </RadioRow>
        ))}
      </RadioGroup>
    </DrawerContent>
  )
}
