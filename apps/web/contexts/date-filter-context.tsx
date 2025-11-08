'use client'

import * as React from 'react'
import { subDays } from 'date-fns'
import { DateRange } from '@/components/ui/date-range-picker'

export interface DateFilterContextValue {
  /**
   * Current date range
   */
  dateRange: DateRange
  /**
   * Update date range
   */
  setDateRange: (range: DateRange) => void
  /**
   * Comparison enabled
   */
  comparisonEnabled: boolean
  /**
   * Toggle comparison
   */
  setComparisonEnabled: (enabled: boolean) => void
  /**
   * Comparison date range (automatically calculated)
   */
  comparisonRange?: DateRange
  /**
   * Currency symbol
   */
  currency: string
  /**
   * Set currency
   */
  setCurrency: (currency: string) => void
}

const DateFilterContext = React.createContext<DateFilterContextValue | undefined>(
  undefined
)

export interface DateFilterProviderProps {
  children: React.ReactNode
  /**
   * Initial date range
   */
  initialRange?: DateRange
  /**
   * Initial currency
   */
  initialCurrency?: string
}

/**
 * Date Filter Provider
 *
 * Provides global date range filtering state for the entire application.
 * All analytics components can subscribe to this context to filter data.
 *
 * @example
 * <DateFilterProvider>
 *   <App />
 * </DateFilterProvider>
 */
export function DateFilterProvider({
  children,
  initialRange,
  initialCurrency = 'AUD',
}: DateFilterProviderProps) {
  const [dateRange, setDateRange] = React.useState<DateRange>(
    initialRange || {
      from: subDays(new Date(), 90),
      to: new Date(),
    }
  )

  const [comparisonEnabled, setComparisonEnabled] = React.useState(false)
  const [currency, setCurrency] = React.useState(initialCurrency)

  // Calculate comparison range automatically
  const comparisonRange = React.useMemo<DateRange | undefined>(() => {
    if (!comparisonEnabled) return undefined

    const diff = dateRange.to.getTime() - dateRange.from.getTime()
    const comparisonTo = new Date(dateRange.from.getTime() - 1)
    const comparisonFrom = new Date(comparisonTo.getTime() - diff)

    return {
      from: comparisonFrom,
      to: comparisonTo,
    }
  }, [dateRange, comparisonEnabled])

  const value = React.useMemo<DateFilterContextValue>(
    () => ({
      dateRange,
      setDateRange,
      comparisonEnabled,
      setComparisonEnabled,
      comparisonRange,
      currency,
      setCurrency,
    }),
    [dateRange, comparisonEnabled, comparisonRange, currency]
  )

  return (
    <DateFilterContext.Provider value={value}>
      {children}
    </DateFilterContext.Provider>
  )
}

/**
 * Hook to use date filter context
 *
 * @example
 * const { dateRange, setDateRange, comparisonEnabled } = useDateFilter()
 */
export function useDateFilter() {
  const context = React.useContext(DateFilterContext)

  if (context === undefined) {
    throw new Error('useDateFilter must be used within a DateFilterProvider')
  }

  return context
}
