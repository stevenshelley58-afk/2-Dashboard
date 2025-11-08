'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { DayPicker, DateRange as DayPickerDateRange } from 'react-day-picker'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subHours,
  subMinutes,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'
import { cn } from '@/lib/utils'
import * as Popover from '@radix-ui/react-popover'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { Separator } from './separator'

export interface DateRange {
  from: Date
  to: Date
}

export interface DateRangePickerProps {
  /**
   * Current date range
   */
  value?: DateRange
  /**
   * Callback when date range changes
   */
  onChange?: (range: DateRange) => void
  /**
   * Currency or metric type for display
   */
  currencySymbol?: string
  /**
   * ISO currency code for display (overrides default label)
   */
  currencyCode?: string
  /**
   * Show comparison toggle
   */
  showComparison?: boolean
  /**
   * Comparison enabled state
   */
  comparisonEnabled?: boolean
  /**
   * Callback when comparison changes
   */
  onComparisonChange?: (enabled: boolean) => void
  /**
   * Additional CSS classes
   */
  className?: string
}

type PresetValue = 'today' | 'yesterday' | 'last_30_min' | 'last_12_hours' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_365_days' | 'last_12_months' | 'last_week' | 'last_month' | 'this_week'

interface Preset {
  label: string
  value: PresetValue
  getRange: (includeCurrent: boolean) => DateRange
}

const PRESETS: Preset[] = [
  {
    label: 'Today',
    value: 'today',
    getRange: (includeCurrent) => {
      const today = new Date()
      if (!includeCurrent) {
        const yesterday = subDays(today, 1)
        return {
          from: startOfDay(yesterday),
          to: endOfDay(yesterday),
        }
      }

      return {
        from: startOfDay(today),
        to: endOfDay(today),
      }
    },
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      }
    },
  },
  {
    label: 'Last 30 minutes',
    value: 'last_30_min',
    getRange: (includeCurrent) => {
      const now = new Date()
      if (!includeCurrent) {
        const to = subMinutes(now, 30)
        return {
          from: subMinutes(to, 30),
          to,
        }
      }

      return {
        from: subMinutes(now, 30),
        to: now,
      }
    },
  },
  {
    label: 'Last 12 hours',
    value: 'last_12_hours',
    getRange: (includeCurrent) => {
      const now = new Date()
      if (!includeCurrent) {
        const to = subHours(now, 12)
        return {
          from: subHours(to, 12),
          to,
        }
      }

      return {
        from: subHours(now, 12),
        to: now,
      }
    },
  },
  {
    label: 'Last 7 days',
    value: 'last_7_days',
    getRange: (includeCurrent) => {
      const today = new Date()
      const end = includeCurrent ? endOfDay(today) : endOfDay(subDays(today, 1))
      return {
        from: startOfDay(subDays(end, 6)),
        to: end,
      }
    },
  },
  {
    label: 'Last 30 days',
    value: 'last_30_days',
    getRange: (includeCurrent) => {
      const today = new Date()
      const end = includeCurrent ? endOfDay(today) : endOfDay(subDays(today, 1))
      return {
        from: startOfDay(subDays(end, 29)),
        to: end,
      }
    },
  },
  {
    label: 'Last 90 days',
    value: 'last_90_days',
    getRange: (includeCurrent) => {
      const today = new Date()
      const end = includeCurrent ? endOfDay(today) : endOfDay(subDays(today, 1))
      return {
        from: startOfDay(subDays(end, 89)),
        to: end,
      }
    },
  },
  {
    label: 'Last 365 days',
    value: 'last_365_days',
    getRange: (includeCurrent) => {
      const today = new Date()
      const end = includeCurrent ? endOfDay(today) : endOfDay(subDays(today, 1))
      return {
        from: startOfDay(subDays(end, 364)),
        to: end,
      }
    },
  },
  {
    label: 'Last 12 months',
    value: 'last_12_months',
    getRange: (includeCurrent) => {
      const today = new Date()
      const end = includeCurrent ? endOfDay(today) : endOfDay(subMonths(today, 1))
      return {
        from: startOfDay(subMonths(end, 12)),
        to: end,
      }
    },
  },
  {
    label: 'This week',
    value: 'this_week',
    getRange: (includeCurrent) => {
      const now = includeCurrent ? new Date() : subWeeks(new Date(), 1)
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      }
    },
  },
  {
    label: 'Last week',
    value: 'last_week',
    getRange: () => {
      const lastWeek = subWeeks(new Date(), 1)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      }
    },
  },
  {
    label: 'Last month',
    value: 'last_month',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
]

function resolveCurrencySymbolFromCode(code?: string): string | undefined {
  if (!code) {
    return undefined
  }

  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })

    const symbolPart = formatter.formatToParts(0).find((part) => part.type === 'currency')
    return symbolPart?.value || code
  } catch (error) {
    console.warn('[DateRangePicker] Failed to resolve currency symbol', error)
    return code
  }
}

/**
 * Advanced Date Range Picker Component
 *
 * Features:
 * - Rolling period (dynamic, updates with current time)
 * - Fixed period (static date range)
 * - Quick presets (Today, Last 7 days, etc.)
 * - Custom calendar selection
 * - Include current period toggle
 * - Comparison mode
 * - WCAG accessible
 *
 * @example
 * <DateRangePicker
 *   value={dateRange}
 *   onChange={setDateRange}
 *   showComparison
 *   comparisonEnabled={comparison}
 *   onComparisonChange={setComparison}
 * />
 */
export const DateRangePicker = React.forwardRef<
  HTMLDivElement,
  DateRangePickerProps
>(
  (
    {
      value,
      onChange,
      currencySymbol,
      currencyCode,
      showComparison = true,
      comparisonEnabled = false,
      onComparisonChange,
      className,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [mode, setMode] = React.useState<'rolling' | 'fixed'>('fixed')
    const [selectedPreset, setSelectedPreset] = React.useState<PresetValue>('last_90_days')
    const [rollingNumber, setRollingNumber] = React.useState(90)
    const [rollingUnit, setRollingUnit] = React.useState<'days' | 'hours' | 'minutes'>('days')
    const [includeCurrentPeriod, setIncludeCurrentPeriod] = React.useState(true)
    const [customRange, setCustomRange] = React.useState<DayPickerDateRange | undefined>(
      value ? { from: value.from, to: value.to } : undefined
    )
    const [lastSelection, setLastSelection] = React.useState<'preset' | 'custom' | 'rolling'>(
      value ? 'custom' : 'preset'
    )

    const selectedPresetDefinition = React.useMemo(
      () => PRESETS.find((preset) => preset.value === selectedPreset),
      [selectedPreset]
    )

    const computedRange = React.useMemo(() => {
      if (value) {
        return value
      }

      if (lastSelection === 'preset' && selectedPresetDefinition) {
        return selectedPresetDefinition.getRange(includeCurrentPeriod)
      }

      if (customRange?.from && customRange?.to) {
        return { from: customRange.from, to: customRange.to }
      }

      return undefined
    }, [value, lastSelection, selectedPresetDefinition, includeCurrentPeriod, customRange])

    React.useEffect(() => {
      if (value) {
        setCustomRange({ from: value.from, to: value.to })
        setLastSelection('custom')
      }
    }, [value])

    const applyIncludeToCustomRange = React.useCallback(
      (range: DateRange): DateRange => {
        if (includeCurrentPeriod) {
          return range
        }

        const adjustedTo = endOfDay(subDays(range.to, 1))
        if (adjustedTo.getTime() < range.from.getTime()) {
          return {
            from: range.from,
            to: range.from,
          }
        }

        return {
          from: range.from,
          to: adjustedTo,
        }
      },
      [includeCurrentPeriod]
    )

    const hasMounted = React.useRef(false)

    React.useEffect(() => {
      if (!hasMounted.current) {
        hasMounted.current = true
        return
      }

      if (lastSelection === 'preset' && selectedPresetDefinition) {
        const range = selectedPresetDefinition.getRange(includeCurrentPeriod)
        setCustomRange({ from: range.from, to: range.to })
        onChange?.(range)
        return
      }

      if (lastSelection === 'custom' && customRange?.from && customRange?.to) {
        const adjusted = applyIncludeToCustomRange({
          from: customRange.from,
          to: customRange.to,
        })
        if (
          customRange.from.getTime() === adjusted.from.getTime() &&
          customRange.to.getTime() === adjusted.to.getTime()
        ) {
          return
        }
        setCustomRange({ from: adjusted.from, to: adjusted.to })
        onChange?.(adjusted)
      }
    }, [
      includeCurrentPeriod,
      lastSelection,
      onChange,
      selectedPresetDefinition,
      customRange,
      applyIncludeToCustomRange,
    ])

    const currencyLabel = React.useMemo(() => {
      const resolvedSymbol = currencySymbol ?? resolveCurrencySymbolFromCode(currencyCode)

      if (resolvedSymbol && currencyCode) {
        return `${resolvedSymbol} ${currencyCode}`
      }

      return resolvedSymbol ?? currencyCode ?? '—'
    }, [currencySymbol, currencyCode])

    const handlePresetSelect = (preset: Preset) => {
      setSelectedPreset(preset.value)
      setLastSelection('preset')
      const range = preset.getRange(includeCurrentPeriod)
      setCustomRange({ from: range.from, to: range.to })
      onChange?.(range)
    }

    const handleCustomRangeSelect = (range: DayPickerDateRange | undefined) => {
      setCustomRange(range)
      if (range?.from && range?.to) {
        setLastSelection('custom')
        const adjusted = applyIncludeToCustomRange({ from: range.from, to: range.to })
        onChange?.(adjusted)
      }
    }

    const handleRollingApply = () => {
      const now = new Date()
      const unitMs =
        rollingUnit === 'minutes'
          ? 60 * 1000
          : rollingUnit === 'hours'
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000

      const to = includeCurrentPeriod ? now : new Date(now.getTime() - unitMs)
      const from = new Date(to.getTime() - rollingNumber * unitMs)

      setLastSelection('rolling')
      onChange?.({ from, to })
      setOpen(false)
    }

    const formatDateRange = () => {
      if (!computedRange) return 'Select date range'

      const { from, to } = computedRange
      const sameDay = format(from, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd')

      if (sameDay) {
        return format(from, 'MMM d, yyyy')
      }

      return `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`
    }

    return (
      <div ref={ref} className={cn('flex items-center gap-3', className)} {...props}>
        {/* Main Date Range Picker */}
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2',
                'rounded-control border border-border bg-surface',
                'text-body text-gray-700 font-medium',
                'hover:bg-gray-50 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
              )}
              aria-label="Select date range"
            >
              <CalendarIcon className="h-4 w-4 text-gray-500" />
              <span>
                {lastSelection === 'preset' && !value && selectedPresetDefinition
                  ? selectedPresetDefinition.label
                  : formatDateRange()}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={8}
              className={cn(
                'z-50 w-auto rounded-card bg-surface p-0 shadow-sm border border-border',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
              )}
            >
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'rolling' | 'fixed')}>
                <div className="flex items-center gap-4 p-4 pb-0">
                  <TabsList>
                    <TabsTrigger value="fixed">Fixed</TabsTrigger>
                    <TabsTrigger value="rolling">Rolling</TabsTrigger>
                  </TabsList>
                </div>

                {/* Fixed Period Tab */}
                <TabsContent value="fixed" className="mt-0 p-4">
                  <div className="flex gap-4">
                    {/* Presets Sidebar */}
                    <div className="w-48 space-y-1">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => {
                            handlePresetSelect(preset)
                            setMode('fixed')
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-control text-body',
                            'hover:bg-gray-100 transition-colors',
                            selectedPreset === preset.value &&
                              'bg-primary-50 text-primary-700 font-medium'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <Separator orientation="vertical" className="h-auto" />

                    {/* Calendar */}
                    <div>
                      <DayPicker
                        mode="range"
                        selected={customRange}
                        onSelect={handleCustomRangeSelect}
                        numberOfMonths={2}
                        classNames={{
                          months: 'flex gap-4',
                          month: 'space-y-4',
                          caption: 'flex justify-center pt-1 relative items-center',
                          caption_label: 'text-body font-medium',
                          nav: 'space-x-1 flex items-center',
                          nav_button: cn(
                            'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                            'rounded-control hover:bg-gray-100'
                          ),
                          nav_button_previous: 'absolute left-1',
                          nav_button_next: 'absolute right-1',
                          table: 'w-full border-collapse space-y-1',
                          head_row: 'flex',
                          head_cell: 'text-gray-500 rounded-control w-9 font-normal text-meta',
                          row: 'flex w-full mt-2',
                          cell: 'text-center text-body p-0 relative',
                          day: cn(
                            'h-9 w-9 p-0 font-normal rounded-control',
                            'hover:bg-gray-100 focus:bg-gray-100'
                          ),
                          day_selected: 'bg-primary-500 text-white hover:bg-primary-600',
                          day_today: 'bg-gray-100 text-gray-900',
                          day_outside: 'text-gray-400 opacity-50',
                          day_disabled: 'text-gray-400 opacity-50',
                          day_range_middle: 'bg-primary-100',
                          day_hidden: 'invisible',
                        }}
                      />

                      <div className="mt-4 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="include-current"
                          checked={includeCurrentPeriod}
                          onChange={(e) => setIncludeCurrentPeriod(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="include-current" className="text-body text-gray-700">
                          Include current period
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 text-body rounded-control hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (customRange?.from && customRange?.to) {
                          setLastSelection('custom')
                          const adjusted = applyIncludeToCustomRange({
                            from: customRange.from,
                            to: customRange.to,
                          })
                          onChange?.(adjusted)
                        }
                        setOpen(false)
                      }}
                      className="px-4 py-2 text-body rounded-control bg-primary-500 text-white hover:bg-primary-600"
                    >
                      Apply
                    </button>
                  </div>
                </TabsContent>

                {/* Rolling Period Tab */}
                <TabsContent value="rolling" className="mt-0 p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-body font-medium text-gray-700 mb-2 block">
                        Last
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={rollingNumber}
                          onChange={(e) => setRollingNumber(parseInt(e.target.value) || 1)}
                          className={cn(
                            'w-24 px-3 py-2 rounded-control border border-border',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500'
                          )}
                        />
                        <select
                          value={rollingUnit}
                          onChange={(e) => setRollingUnit(e.target.value as any)}
                          className={cn(
                            'flex-1 px-3 py-2 rounded-control border border-border',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500'
                          )}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="include-current-rolling"
                        checked={includeCurrentPeriod}
                        onChange={(e) => setIncludeCurrentPeriod(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="include-current-rolling" className="text-body text-gray-700">
                        Include current period
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-border">
                      <button
                        onClick={() => setOpen(false)}
                        className="px-4 py-2 text-body rounded-control hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRollingApply}
                        className="px-4 py-2 text-body rounded-control bg-primary-500 text-white hover:bg-primary-600"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Comparison Toggle */}
        {showComparison && (
          <button
            onClick={() => onComparisonChange?.(!comparisonEnabled)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2',
              'rounded-control border border-border bg-surface',
              'text-body text-gray-700 font-medium',
              'hover:bg-gray-50 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              comparisonEnabled && 'bg-primary-50 border-primary-500 text-primary-700'
            )}
            aria-label="Toggle comparison"
            aria-pressed={comparisonEnabled}
          >
            <span>{comparisonEnabled ? '✓' : ''} {comparisonEnabled ? 'Comparison enabled' : 'No comparison'}</span>
          </button>
        )}

        {/* Currency Display */}
        <div className="px-3 py-2 rounded-control border border-border bg-surface text-body text-gray-700 font-medium">
          {currencyLabel}
        </div>
      </div>
    )
  }
)

DateRangePicker.displayName = 'DateRangePicker'
