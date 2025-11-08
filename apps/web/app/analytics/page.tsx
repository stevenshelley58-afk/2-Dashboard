'use client'

import * as React from 'react'
import {
  KPITile,
  TimeSeriesChart,
  DataTable,
  Separator,
  AnalyticsHeader,
  DateFilterProvider,
  useDateFilter,
} from '@/components'
import { cn, formatCurrency } from '@/lib/utils'
import { format, eachDayOfInterval, isWithinInterval } from 'date-fns'

// Sample data generator
const generateSampleData = (from: Date, to: Date) => {
  const days = eachDayOfInterval({ start: from, end: to })

  return days.map((date, index) => {
    const seasonal = Math.sin(index / 5) * 1500
    const baseline = 12000 + index * 120
    const noise = Math.cos(index / 3) * 400

    return {
      date: format(date, 'yyyy-MM-dd'),
      value: Math.round(baseline + seasonal + noise),
    }
  })
}

interface Order {
  id: string
  customer: string
  amount: number
  date: string
  status: 'completed' | 'pending' | 'cancelled'
}

const sampleOrders: Order[] = [
  {
    id: '#001',
    customer: 'John Doe',
    amount: 129.99,
    date: '2025-11-08',
    status: 'completed',
  },
  {
    id: '#002',
    customer: 'Jane Smith',
    amount: 249.5,
    date: '2025-11-07',
    status: 'completed',
  },
  {
    id: '#003',
    customer: 'Bob Johnson',
    amount: 89.99,
    date: '2025-11-06',
    status: 'pending',
  },
  {
    id: '#004',
    customer: 'Alice Williams',
    amount: 345.0,
    date: '2025-11-05',
    status: 'completed',
  },
  {
    id: '#005',
    customer: 'Charlie Brown',
    amount: 156.25,
    date: '2025-11-04',
    status: 'cancelled',
  },
]

/**
 * Analytics Dashboard Content
 *
 * Separated into a component to use the useDateFilter hook
 */
function AnalyticsDashboardContent() {
  const { dateRange, comparisonEnabled, comparisonRange } = useDateFilter()

  // Filter data based on date range
  const chartData = React.useMemo(
    () => generateSampleData(dateRange.from, dateRange.to),
    [dateRange]
  )

  const comparisonChartData = React.useMemo(
    () =>
      comparisonEnabled && comparisonRange
        ? generateSampleData(comparisonRange.from, comparisonRange.to)
        : [],
    [comparisonEnabled, comparisonRange]
  )

  // Filter orders based on date range
  const filteredOrders = React.useMemo(() => {
    return sampleOrders.filter((order) => {
      const orderDate = new Date(order.date)
      return isWithinInterval(orderDate, { start: dateRange.from, end: dateRange.to })
    })
  }, [dateRange])

  // Calculate metrics from filtered data
  const totalRevenue = React.useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.value, 0)
  }, [chartData])

  const totalOrders = filteredOrders.length
  const avgOrderValue = totalRevenue / (totalOrders || 1)
  const conversionRate = 4.45 // Mock data

  return (
    <div className="space-y-section-lg">
      {/* Analytics Header with Date Picker */}
      <AnalyticsHeader title="Analytics" showRefreshTime />

      <Separator />

      {/* KPI Tiles Grid */}
      <section>
        <h2 className="text-section-title text-gray-900 mb-4">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPITile
            value={totalRevenue}
            label="Total Revenue"
            delta={12.5}
            format="currency"
          />
          <KPITile
            value={totalOrders}
            label="Total Orders"
            delta={8.2}
            format="number"
          />
          <KPITile
            value={avgOrderValue}
            label="Avg Order Value"
            delta={-3.1}
            format="currency"
          />
          <KPITile
            value={conversionRate}
            label="Conversion Rate"
            delta={0.8}
            format="percent"
          />
        </div>
      </section>

      {/* Charts Section */}
      <section>
        <h2 className="text-section-title text-gray-900 mb-4">
          Revenue Trend
          {comparisonEnabled && (
            <span className="text-meta text-gray-500 font-normal ml-2">
              (vs comparison period)
            </span>
          )}
        </h2>

        <TimeSeriesChart
          data={chartData}
          type="area"
          title={`Revenue (${format(dateRange.from, 'MMM d')} - ${format(
            dateRange.to,
            'MMM d, yyyy'
          )})`}
          valueFormatter={(v) => formatCurrency(v)}
          height={320}
        />

        {comparisonEnabled && comparisonRange && (
          <div className="mt-4">
            <TimeSeriesChart
              data={comparisonChartData}
              type="line"
              title={`Comparison: ${format(comparisonRange.from, 'MMM d')} - ${format(
                comparisonRange.to,
                'MMM d, yyyy'
              )}`}
              valueFormatter={(v) => formatCurrency(v)}
              height={200}
              color="#9CA3AF"
            />
          </div>
        )}
      </section>

      {/* Recent Orders Table */}
      <section>
        <h2 className="text-section-title text-gray-900 mb-4">
          Recent Orders
          <span className="text-meta text-gray-500 font-normal ml-2">
            ({filteredOrders.length} orders)
          </span>
        </h2>

        <DataTable
          data={filteredOrders}
          columns={[
            { header: 'Order ID', accessor: (o) => o.id },
            { header: 'Customer', accessor: (o) => o.customer },
            {
              header: 'Amount',
              accessor: (o) => formatCurrency(o.amount),
            },
            {
              header: 'Status',
              accessor: (o) => (
                <span
                  className={cn(
                    'px-2 py-1 rounded-full text-meta-sm font-medium',
                    o.status === 'completed' &&
                      'bg-green-100 text-green-700',
                    o.status === 'pending' &&
                      'bg-yellow-100 text-yellow-700',
                    o.status === 'cancelled' && 'bg-red-100 text-red-700'
                  )}
                >
                  {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                </span>
              ),
            },
          ]}
          getRowKey={(order) => order.id}
          emptyMessage="No orders in selected date range"
        />
      </section>

      {/* Info Box */}
      <section>
        <div className="p-6 bg-primary-50 border border-primary-200 rounded-card">
          <h3 className="text-body font-semibold text-primary-900 mb-2">
            Date Filtering Applied
          </h3>
          <p className="text-meta text-primary-700">
            All metrics, charts, and tables on this page are filtered by the
            selected date range:{' '}
            <strong>
              {format(dateRange.from, 'MMM d, yyyy')} -{' '}
              {format(dateRange.to, 'MMM d, yyyy')}
            </strong>
          </p>
          {comparisonEnabled && comparisonRange && (
            <p className="text-meta text-primary-700 mt-2">
              Comparison period:{' '}
              <strong>
                {format(comparisonRange.from, 'MMM d, yyyy')} -{' '}
                {format(comparisonRange.to, 'MMM d, yyyy')}
              </strong>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

/**
 * Analytics Page
 *
 * Demonstrates the complete date filtering system:
 * - DateFilterProvider wraps the entire page
 * - AnalyticsHeader displays the date range picker
 * - All components (KPITile, TimeSeriesChart, DataTable) use filtered data
 * - Comparison mode shows previous period
 *
 * Access at: /analytics
 */
export default function AnalyticsPage() {
  return (
    <DateFilterProvider>
      <div className="min-h-screen bg-background">
        <div className="max-w-content mx-auto p-6 md:p-8">
          <AnalyticsDashboardContent />
        </div>
      </div>
    </DateFilterProvider>
  )
}

// Import cn utility
