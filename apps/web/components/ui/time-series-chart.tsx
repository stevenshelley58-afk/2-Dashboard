'use client'

import * as React from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { Card } from './card'

export interface TimeSeriesDataPoint {
  date: string // ISO date string
  value: number
  [key: string]: string | number
}

export interface TimeSeriesChartProps {
  /**
   * Chart data
   */
  data: TimeSeriesDataPoint[]
  /**
   * Chart type
   */
  type?: 'line' | 'area'
  /**
   * Data key for the value
   */
  dataKey?: string
  /**
   * Chart title
   */
  title?: string
  /**
   * Chart height in pixels
   */
  height?: number
  /**
   * Primary color (uses theme primary by default)
   */
  color?: string
  /**
   * Show grid lines
   */
  showGrid?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Value formatter for tooltip and axis
   */
  valueFormatter?: (value: number) => string
  /**
   * Date formatter
   */
  dateFormatter?: (date: string) => string
}

/**
 * Custom tooltip with minimal styling
 */
const CustomTooltip = ({
  active,
  payload,
  valueFormatter,
  dateFormatter,
}: {
  active?: boolean
  payload?: Array<{
    value?: number
    payload: { date: string; value: number }
  }>
  valueFormatter?: (value: number) => string
  dateFormatter?: (date: string) => string
}) => {
  if (!active || !payload || !payload.length) {
    return null
  }

  const data = payload[0]
  const date = data.payload.date
  const value = data.value as number

  return (
    <div className="rounded-control bg-surface px-3 py-2 shadow-sm border border-gray-200">
      <p className="text-meta-sm text-gray-500 mb-1">
        {dateFormatter ? dateFormatter(date) : format(parseISO(date), 'MMM d, yyyy')}
      </p>
      <p className="text-body font-semibold text-gray-900">
        {valueFormatter ? valueFormatter(value) : value.toLocaleString()}
      </p>
    </div>
  )
}

/**
 * Time Series Chart Component
 *
 * Displays time-series data with:
 * - Thin lines, muted grid
 * - Minimal legend
 * - Compact tooltip
 * - Responsive container
 * - WCAG compliant
 *
 * @example
 * <TimeSeriesChart
 *   data={[
 *     { date: '2024-01-01', value: 1200 },
 *     { date: '2024-01-02', value: 1350 },
 *   ]}
 *   title="Revenue (30 days)"
 *   type="area"
 *   valueFormatter={(v) => `$${v.toLocaleString()}`}
 * />
 */
export const TimeSeriesChart = React.forwardRef<
  HTMLDivElement,
  TimeSeriesChartProps
>(
  (
    {
      data,
      type = 'line',
      dataKey = 'value',
      title,
      height = 300,
      color = '#3B82F6',
      showGrid = true,
      className,
      valueFormatter,
      dateFormatter,
      ...props
    },
    ref
  ) => {
    const ChartComponent = type === 'area' ? AreaChart : LineChart

    return (
      <Card ref={ref} className={cn('', className)} {...props}>
        {title && (
          <h3 className="text-section-title text-gray-900 mb-4">{title}</h3>
        )}

        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent
            data={data}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E5E5"
                vertical={false}
              />
            )}

            <XAxis
              dataKey="date"
              tickFormatter={(date) =>
                dateFormatter
                  ? dateFormatter(date)
                  : format(parseISO(date), 'MMM d')
              }
              stroke="#A3A3A3"
              tick={{ fill: '#737373', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#E5E5E5' }}
            />

            <YAxis
              tickFormatter={(value) =>
                valueFormatter ? valueFormatter(value) : value.toLocaleString()
              }
              stroke="#A3A3A3"
              tick={{ fill: '#737373', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#E5E5E5' }}
              width={60}
            />

            <Tooltip
              content={
                <CustomTooltip
                  valueFormatter={valueFormatter}
                  dateFormatter={dateFormatter}
                />
              }
              cursor={{ stroke: '#D4D4D4', strokeWidth: 1 }}
            />

            {type === 'area' ? (
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.1}
                animationDuration={300}
              />
            ) : (
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                animationDuration={300}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </Card>
    )
  }
)

TimeSeriesChart.displayName = 'TimeSeriesChart'
