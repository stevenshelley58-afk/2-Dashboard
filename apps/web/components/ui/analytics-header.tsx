'use client'

import * as React from 'react'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateRangePicker } from './date-range-picker'
import { useDateFilter } from '@/contexts/date-filter-context'

export interface AnalyticsHeaderProps {
  /**
   * Page title
   */
  title?: string
  /**
   * Show last refreshed time
   */
  showRefreshTime?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Analytics Header Component
 *
 * Displays page title, date range picker, and refresh time.
 * Integrates with DateFilterContext for global date filtering.
 *
 * @example
 * <AnalyticsHeader title="Analytics" showRefreshTime />
 */
export const AnalyticsHeader = React.forwardRef<
  HTMLDivElement,
  AnalyticsHeaderProps
>(({ title = 'Analytics', showRefreshTime = true, className, ...props }, ref) => {
  const {
    dateRange,
    setDateRange,
    comparisonEnabled,
    setComparisonEnabled,
    currency,
  } = useDateFilter()

  const [lastRefreshed, setLastRefreshed] = React.useState(new Date())

  // Update refresh time when date range changes
  React.useEffect(() => {
    setLastRefreshed(new Date())
  }, [dateRange])

  const formatRefreshTime = () => {
    return lastRefreshed.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col md:flex-row md:items-center md:justify-between',
        'gap-4 pb-6 border-b border-border',
        className
      )}
      {...props}
    >
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-50 rounded-control">
          <BarChart3 className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-page-title text-gray-900">{title}</h1>
          {showRefreshTime && (
            <p className="text-meta text-gray-500">
              Last refreshed: {formatRefreshTime()}
            </p>
          )}
        </div>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        currencySymbol="$"
        showComparison
        comparisonEnabled={comparisonEnabled}
        onComparisonChange={setComparisonEnabled}
      />
    </div>
  )
})

AnalyticsHeader.displayName = 'AnalyticsHeader'
