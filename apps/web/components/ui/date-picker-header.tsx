'use client'

import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DayPicker, DateRange as DayPickerDateRange } from 'react-day-picker'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import * as Popover from '@radix-ui/react-popover'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { Separator } from './separator'
import 'react-day-picker/dist/style.css'

export interface DateRange {
  from: Date
  to: Date
}

export interface DatePickerHeaderProps {
  /**
   * Current date range
   */
  value?: DateRange
  /**
   * Callback when date range changes
   */
  onChange?: (range: DateRange) => void
  /**
   * Additional CSS classes
   */
  className?: string
}

type QuickPreset = 'today' | 'yesterday' | 'last_7' | 'this_week'

interface Preset {
  label: string
  value: QuickPreset
  getRange: () => DateRange
}

const QUICK_PRESETS: Preset[] = [
  {
    label: 'Today',
    value: 'today',
    getRange: () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const endOfDay = new Date(today)
      endOfDay.setHours(23, 59, 59, 999)
      return { from: today, to: endOfDay }
    },
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      yesterday.setHours(0, 0, 0, 0)
      const endOfDay = new Date(yesterday)
      endOfDay.setHours(23, 59, 59, 999)
      return { from: yesterday, to: endOfDay }
    },
  },
  {
    label: 'Last 7',
    value: 'last_7',
    getRange: () => {
      const from = subDays(new Date(), 6)
      from.setHours(0, 0, 0, 0)
      const to = new Date()
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    label: 'This Week',
    value: 'this_week',
    getRange: () => {
      const now = new Date()
      const from = startOfWeek(now, { weekStartsOn: 1 }) // Monday
      const to = endOfWeek(now, { weekStartsOn: 1 }) // Sunday
      return { from, to }
    },
  },
]

const CALENDAR_PRESETS = [
  {
    label: 'Today',
    getRange: () => {
      const today = new Date()
      return { from: today, to: today }
    },
  },
  {
    label: 'Yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      return { from: yesterday, to: yesterday }
    },
  },
  {
    label: 'Last 7 days',
    getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: 'Last 30 days',
    getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
  {
    label: 'Last 90 days',
    getRange: () => ({ from: subDays(new Date(), 89), to: new Date() }),
  },
  {
    label: 'This week',
    getRange: () => {
      const now = new Date()
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      }
    },
  },
  {
    label: 'Last week',
    getRange: () => {
      const lastWeek = subDays(new Date(), 7)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      }
    },
  },
  {
    label: 'This month',
    getRange: () => {
      const now = new Date()
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
      }
    },
  },
]

/**
 * Simplified Date Picker Header for Overview Page
 *
 * Features:
 * - Quick preset pills (Today, Yesterday, Last 7, This Week)
 * - Custom button that opens advanced calendar picker
 * - Fixed/Rolling period selection
 * - Calendar with presets sidebar
 *
 * @example
 * <DatePickerHeader
 *   value={dateRange}
 *   onChange={setDateRange}
 * />
 */
export const DatePickerHeader = React.forwardRef<HTMLDivElement, DatePickerHeaderProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [open, setOpen] = React.useState(false)
    const [mode, setMode] = React.useState<'fixed' | 'rolling'>('fixed')
    const [selectedQuick, setSelectedQuick] = React.useState<QuickPreset | null>(null)
    const [rollingNumber, setRollingNumber] = React.useState(90)
    const [rollingUnit, setRollingUnit] = React.useState<'days' | 'hours' | 'minutes'>('days')
    const [includeCurrentPeriod, setIncludeCurrentPeriod] = React.useState(true)
    const [customRange, setCustomRange] = React.useState<DayPickerDateRange | undefined>(
      value ? { from: value.from, to: value.to } : undefined
    )

    const handleQuickPresetClick = (preset: Preset) => {
      setSelectedQuick(preset.value)
      const range = preset.getRange()
      setCustomRange({ from: range.from, to: range.to })
      onChange?.(range)
    }

    const handleCalendarPresetSelect = (preset: typeof CALENDAR_PRESETS[0]) => {
      const range = preset.getRange()
      setCustomRange({ from: range.from, to: range.to })
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
      const to = new Date()

      if (rollingUnit === 'minutes') {
        from = new Date(Date.now() - rollingNumber * 60 * 1000)
      } else if (rollingUnit === 'hours') {
        from = new Date(Date.now() - rollingNumber * 60 * 60 * 1000)
      } else {
        from = subDays(new Date(), rollingNumber)
      }

      onChange?.({ from, to })
      setSelectedQuick(null)
      setOpen(false)
    }

    const handleApply = () => {
      if (customRange?.from && customRange?.to) {
        onChange?.({ from: customRange.from, to: customRange.to })
        setSelectedQuick(null)
        setOpen(false)
      }
    }

    const fromTime = value?.from ? value.from.getTime() : null
    const toTime = value?.to ? value.to.getTime() : null

    React.useEffect(() => {
      if (!value?.from || !value?.to) return

      setCustomRange({ from: value.from, to: value.to })

      const matchingPreset = QUICK_PRESETS.find((preset) => {
        const presetRange = preset.getRange()
        return isSameDay(presetRange.from, value.from) && isSameDay(presetRange.to, value.to)
      })

      setSelectedQuick(matchingPreset ? matchingPreset.value : null)
    }, [fromTime, toTime])

    return (
      <div ref={ref} className={cn('flex items-center gap-2', className)} {...props}>
        {/* Quick Preset Pills */}
        {QUICK_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handleQuickPresetClick(preset)}
            className={cn(
              'px-4 py-2 text-body font-medium rounded-control transition-colors',
              selectedQuick === preset.value
                ? 'bg-primary-500 text-white'
                : 'bg-surface text-gray-600 hover:bg-gray-100 border border-border'
            )}
          >
            {preset.label}
          </button>
        ))}

        {/* Custom Button with Calendar Popover */}
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              className={cn(
                'px-4 py-2 text-body font-medium rounded-control transition-colors',
                'inline-flex items-center gap-2',
                selectedQuick === null
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface text-gray-600 hover:bg-gray-100 border border-border'
              )}
              aria-label="Open custom date picker"
            >
              <CalendarIcon className="h-4 w-4" />
              Custom
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={8}
              className={cn(
                'z-50 w-auto rounded-card bg-surface p-0 shadow-sm border border-border',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
              )}
            >
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'fixed' | 'rolling')}>
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
                      {CALENDAR_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleCalendarPresetSelect(preset)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-control text-body',
                            'hover:bg-gray-100 transition-colors'
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
                      onClick={handleApply}
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
                      <label className="text-body font-medium text-gray-700 mb-2 block">Last</label>
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
      </div>
    )
  }
)

DatePickerHeader.displayName = 'DatePickerHeader'
