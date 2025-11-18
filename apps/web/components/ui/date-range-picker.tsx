'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { DayPicker, DateRange as DayPickerDateRange } from 'react-day-picker'
import { format, subDays, subMonths, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { cn } from '@/lib/utils'
import * as Popover from '@radix-ui/react-popover'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { Separator } from './separator'
import 'react-day-picker/dist/style.css'

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
  getRange: () => DateRange
}

const PRESETS: Preset[] = [
  {
    label: 'Today',
    value: 'today',
    getRange: () => ({ from: new Date(), to: new Date() }),
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      return { from: yesterday, to: yesterday }
    },
  },
  {
    label: 'Last 30 minutes',
    value: 'last_30_min',
    getRange: () => ({
      from: new Date(Date.now() - 30 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'Last 12 hours',
    value: 'last_12_hours',
    getRange: () => ({
      from: new Date(Date.now() - 12 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'Last 7 days',
    value: 'last_7_days',
    getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }),
  },
  {
    label: 'Last 30 days',
    value: 'last_30_days',
    getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }),
  },
  {
    label: 'Last 90 days',
    value: 'last_90_days',
    getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }),
  },
  {
    label: 'Last 365 days',
    value: 'last_365_days',
    getRange: () => ({ from: subDays(new Date(), 365), to: new Date() }),
  },
  {
    label: 'Last 12 months',
    value: 'last_12_months',
    getRange: () => ({ from: subMonths(new Date(), 12), to: new Date() }),
  },
  {
    label: 'This week',
    value: 'this_week',
    getRange: () => {
      const now = new Date()
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        to: endOfWeek(now, { weekStartsOn: 1 }), // Sunday
      }
    },
  },
  {
    label: 'Last week',
    value: 'last_week',
    getRange: () => {
      const lastWeek = subDays(new Date(), 7)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }), // Monday
        to: endOfWeek(lastWeek, { weekStartsOn: 1 }), // Sunday
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
      currencySymbol = '$',
      showComparison = true,
      comparisonEnabled = false,
      onComparisonChange,
      className,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [mode, setMode] = React.useState<'rolling' | 'fixed'>('rolling')
    const [selectedPreset, setSelectedPreset] = React.useState<PresetValue>('last_90_days')
    const [rollingNumber, setRollingNumber] = React.useState(90)
    const [rollingUnit, setRollingUnit] = React.useState<'days' | 'hours' | 'minutes'>('days')
    const [includeCurrentPeriod, setIncludeCurrentPeriod] = React.useState(true)
    const [customRange, setCustomRange] = React.useState<DayPickerDateRange | undefined>(
      value ? { from: value.from, to: value.to } : undefined
    )

    const currentRange = value || PRESETS.find(p => p.value === selectedPreset)?.getRange() || PRESETS[5].getRange()

    const handlePresetSelect = (preset: Preset) => {
      setSelectedPreset(preset.value)
      const range = preset.getRange()
      onChange?.(range)
    }

    const handleCustomRangeSelect = (range: DayPickerDateRange | undefined) => {
      setCustomRange(range)
      if (range?.from && range?.to) {
        onChange?.({ from: range.from, to: range.to })
      }
    }

    const handleRollingApply = () => {
      let from: Date
      const to = includeCurrentPeriod ? new Date() : new Date()

      if (rollingUnit === 'minutes') {
        from = new Date(Date.now() - rollingNumber * 60 * 1000)
      } else if (rollingUnit === 'hours') {
        from = new Date(Date.now() - rollingNumber * 60 * 60 * 1000)
      } else {
        from = subDays(new Date(), rollingNumber)
      }

      onChange?.({ from, to })
      setOpen(false)
    }

    const formatDateRange = () => {
      if (!currentRange) return 'Select date range'

      const { from, to } = currentRange
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
              <span>{selectedPreset === 'last_90_days' ? 'Last 90 days' : formatDateRange()}</span>
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
                          onChange?.({ from: customRange.from, to: customRange.to })
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
                      <label
                        className="text-body font-medium text-gray-700 mb-2 block"
                        htmlFor="date-range-rolling-length"
                      >
                        Last
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          id="date-range-rolling-length"
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
                          aria-label="Rolling interval unit"
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
          {currencySymbol} AUD $
        </div>
      </div>
    )
  }
)

DateRangePicker.displayName = 'DateRangePicker'
