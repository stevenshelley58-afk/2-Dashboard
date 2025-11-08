import * as React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatNumber, formatCurrency, formatPercent } from '@/lib/utils'
import { Card } from './card'

export interface KPITileProps {
  /**
   * Main metric value
   */
  value: number
  /**
   * Label describing the metric
   */
  label: string
  /**
   * Change percentage (positive or negative)
   */
  delta?: number
  /**
   * Format type for the value
   */
  format?: 'number' | 'currency' | 'percent'
  /**
   * Currency code for currency format
   */
  currency?: string
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Loading state
   */
  isLoading?: boolean
}

/**
 * KPI Tile Component
 *
 * Displays a single metric with:
 * - Large number value
 * - Descriptive label
 * - Optional delta indicator
 * - WCAG AA compliant contrast
 * - Keyboard accessible
 *
 * @example
 * <KPITile
 *   value={45230}
 *   label="Total Revenue"
 *   delta={12.5}
 *   format="currency"
 * />
 */
export const KPITile = React.forwardRef<HTMLDivElement, KPITileProps>(
  (
    {
      value,
      label,
      delta,
      format = 'number',
      currency = 'USD',
      className,
      isLoading = false,
      ...props
    },
    ref
  ) => {
    const formattedValue = React.useMemo(() => {
      if (isLoading) return '---'

      switch (format) {
        case 'currency':
          return formatCurrency(value, currency)
        case 'percent':
          return formatPercent(value)
        case 'number':
        default:
          return formatNumber(value)
      }
    }, [value, format, currency, isLoading])

    const deltaFormatted = delta !== undefined ? formatPercent(delta) : null
    const isPositive = delta !== undefined && delta >= 0
    const isNegative = delta !== undefined && delta < 0

    return (
      <Card
        ref={ref}
        className={cn(
          'flex flex-col justify-between',
          'transition-shadow hover:shadow-sm',
          'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
          className
        )}
        role="article"
        aria-label={`${label}: ${formattedValue}${deltaFormatted ? `, ${deltaFormatted}` : ''}`}
        {...props}
      >
        {/* Value */}
        <div
          className={cn(
            'text-3xl font-semibold text-gray-900',
            'tabular-nums',
            isLoading && 'animate-pulse'
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {formattedValue}
        </div>

        {/* Label */}
        <div className="mt-1 text-meta text-gray-500">
          {label}
        </div>

        {/* Delta indicator */}
        {deltaFormatted && !isLoading && (
          <div
            className={cn(
              'mt-2 flex items-center gap-1 text-meta-sm font-medium',
              isPositive && 'text-green-600',
              isNegative && 'text-red-600'
            )}
            aria-label={`Change: ${deltaFormatted}`}
          >
            {isPositive && (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            )}
            {isNegative && (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{deltaFormatted}</span>
          </div>
        )}
      </Card>
    )
  }
)

KPITile.displayName = 'KPITile'
