'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

export interface Column<T> {
  /**
   * Column header label
   */
  header: string
  /**
   * Accessor function to get cell value
   */
  accessor: (row: T) => React.ReactNode
  /**
   * Optional custom cell rendering
   */
  cell?: (value: React.ReactNode, row: T) => React.ReactNode
  /**
   * Column width (desktop only)
   */
  width?: string
}

export interface DataTableProps<T> {
  /**
   * Table data
   */
  data: T[]
  /**
   * Column definitions (max 3 for desktop)
   */
  columns: Column<T>[]
  /**
   * Get unique key for each row
   */
  getRowKey: (row: T, index: number) => string
  /**
   * Loading state
   */
  isLoading?: boolean
  /**
   * Empty state message
   */
  emptyMessage?: string
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Responsive Data Table Component
 *
 * Features:
 * - Desktop: Traditional table (max 3 columns)
 * - Mobile: Stacked cards with key metrics
 * - WCAG compliant
 * - Loading states
 *
 * @example
 * <DataTable
 *   data={orders}
 *   columns={[
 *     { header: 'Order', accessor: (o) => o.id },
 *     { header: 'Customer', accessor: (o) => o.customer },
 *     { header: 'Amount', accessor: (o) => formatCurrency(o.amount) },
 *   ]}
 *   getRowKey={(o) => o.id}
 * />
 */
export function DataTable<T>({
  data,
  columns,
  getRowKey,
  isLoading = false,
  emptyMessage = 'No data available',
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="h-20 animate-pulse bg-gray-100" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <p className="text-body text-gray-500">{emptyMessage}</p>
      </Card>
    )
  }

  return (
    <>
      {/* Desktop Table (hidden on mobile) */}
      <div className={cn('hidden md:block overflow-x-auto', className)}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    'text-left py-3 px-4',
                    'text-meta font-semibold text-gray-700',
                    'first:pl-0 last:pr-0'
                  )}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={getRowKey(row, rowIdx)}
                className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors"
              >
                {columns.map((col, colIdx) => {
                  const value = col.accessor(row)
                  return (
                    <td
                      key={colIdx}
                      className={cn(
                        'py-3 px-4 text-body text-gray-900',
                        'first:pl-0 last:pr-0'
                      )}
                    >
                      {col.cell ? col.cell(value, row) : value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (hidden on desktop) */}
      <div className={cn('md:hidden space-y-3', className)}>
        {data.map((row, rowIdx) => (
          <Card key={getRowKey(row, rowIdx)} className="space-y-2">
            {columns.map((col, colIdx) => {
              const value = col.accessor(row)
              return (
                <div key={colIdx} className="flex justify-between items-start">
                  <span className="text-meta text-gray-500 font-medium">
                    {col.header}
                  </span>
                  <span className="text-body text-gray-900 font-medium text-right">
                    {col.cell ? col.cell(value, row) : value}
                  </span>
                </div>
              )
            })}
          </Card>
        ))}
      </div>
    </>
  )
}
