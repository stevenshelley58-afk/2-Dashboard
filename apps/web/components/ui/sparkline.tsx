'use client'

import * as React from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

export interface SparklineProps {
  /**
   * Chart data - simple array of numbers
   */
  data: number[]
  /**
   * Line color
   */
  color?: string
  /**
   * Height in pixels
   */
  height?: number
  /**
   * Width (defaults to 100%)
   */
  width?: string | number
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Sparkline Component
 *
 * Minimal inline chart for showing trends:
 * - No axes or grid
 * - Thin line
 * - Very compact
 * - Use in tight spaces (mobile tiles, table cells)
 *
 * @example
 * <Sparkline data={[10, 12, 8, 15, 20, 18]} color="#3B82F6" height={32} />
 */
export const Sparkline = React.forwardRef<HTMLDivElement, SparklineProps>(
  (
    {
      data,
      color = '#3B82F6',
      height = 40,
      width = '100%',
      className,
      ...props
    },
    ref
  ) => {
    // Transform simple number array to recharts format
    const chartData = data.map((value, index) => ({ index, value }))

    return (
      <div
        ref={ref}
        className={cn('inline-block', className)}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
        {...props}
      >
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }
)

Sparkline.displayName = 'Sparkline'
