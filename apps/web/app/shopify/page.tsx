'use client'

import * as React from 'react'
import { subDays, format } from 'date-fns'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { DatePickerHeader, type DateRange } from '@/components/ui/date-picker-header'
import { KPITile } from '@/components/ui/kpi-tile'
import { Card, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { TimeSeriesChart } from '@/components/ui/time-series-chart'
import { useActiveShop } from '@/hooks/use-active-shop'
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics'
import { useShopifyOrders } from '@/hooks/use-shopify-orders'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Loader2 } from 'lucide-react'

const DEFAULT_RANGE: DateRange = {
  from: subDays(new Date(), 29),
  to: new Date(),
}

export default function ShopifyDashboardPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>(DEFAULT_RANGE)

  const {
    shopId,
    currency,
    isLoading: isResolvingShop,
    error: shopError,
    refresh: refreshShop,
  } = useActiveShop()

  const {
    metrics,
    chartData,
    topProducts,
    channelSplit,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useDashboardMetrics(shopId, dateRange, currency ?? 'AUD')

  const {
    orders,
    rangeOrderCount,
    rangeTotalRevenue,
    isLoading: isLoadingOrders,
    error: ordersError,
  } = useShopifyOrders(shopId, dateRange, { limit: 50 })

  const isLoading = isResolvingShop || isLoadingMetrics || isLoadingOrders

  const revenueSeries = React.useMemo(
    () =>
      chartData.map((point) => ({
        date: point.date,
        value: point.revenue ?? 0,
      })),
    [chartData]
  )

  const ordersSeries = React.useMemo(
    () =>
      chartData.map((point) => ({
        date: point.date,
        orders: point.orders ?? 0,
        sessions: point.sessions ?? 0,
      })),
    [chartData]
  )

  const orderCount = metrics?.total_orders ?? rangeOrderCount
  const totalRevenue = metrics?.total_revenue ?? rangeTotalRevenue
  const averageOrderValue =
    metrics?.avg_order_value ?? (orderCount > 0 ? totalRevenue / orderCount : 0)

  if (isLoading && !metrics && orders.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (shopError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md space-y-2">
            <p className="text-body text-red-600 font-semibold">Unable to resolve Shopify shop</p>
            <p className="text-meta text-gray-500">
              {shopError.message ||
                'We could not detect any Shopify data. Run a sync and try refreshing the page.'}
            </p>
            <button
              onClick={() => refreshShop()}
              className="inline-flex items-center justify-center px-4 py-2 rounded-control bg-primary-500 text-white hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const activeCurrency = currency ?? 'AUD'

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-page-title text-gray-900">Shopify Performance</h1>
            <p className="text-meta text-gray-500 mt-1">
              Detailed revenue, orders, and product analytics sourced directly from Shopify.
            </p>
          </div>

          <DatePickerHeader value={dateRange} onChange={setDateRange} />
        </div>

        {(metricsError || ordersError) && (
          <div className="mt-4 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {metricsError && <p>Failed to load aggregated metrics: {metricsError.message}</p>}
            {ordersError && <p>Failed to load orders: {ordersError.message}</p>}
          </div>
        )}
      </div>

      {/* KPI Overview */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPITile
            value={totalRevenue}
            label="Total Sales"
            delta={metrics?.revenue_delta ?? null}
            format="currency"
            currency={activeCurrency}
          />
          <KPITile
            value={orderCount}
            label="Total Orders"
            delta={metrics?.orders_delta ?? null}
            format="number"
          />
          <KPITile
            value={averageOrderValue}
            label="Average Order Value"
            delta={metrics?.aov_delta ?? null}
            format="currency"
            currency={activeCurrency}
          />
          <KPITile
            value={metrics?.avg_conversion_rate ?? 0}
            label="Conversion Rate"
            delta={metrics?.conversion_rate_delta ?? null}
            format="percent"
          />
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <TimeSeriesChart
          data={revenueSeries}
          title="Revenue Over Time"
          type="area"
          valueFormatter={(val) => formatCurrency(val, activeCurrency)}
        />

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Orders & Sessions</CardTitle>
            <p className="text-meta text-gray-500">
              Showing trends for the selected date range.
            </p>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ordersSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#A3A3A3"
                tick={{ fill: '#737373', fontSize: 12 }}
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
                tickLine={false}
                axisLine={{ stroke: '#E5E5E5' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#A3A3A3"
                tick={{ fill: '#737373', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#E5E5E5' }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#A3A3A3"
                tick={{ fill: '#737373', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#E5E5E5' }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '12px' }} iconType="circle" />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sessions"
                name="Sessions"
                stroke="#0EA5E9"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* Secondary Insights */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Top Products by Revenue</CardTitle>
            <p className="text-meta text-gray-500">Based on Shopify order line items.</p>
          </div>
          <div className="space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product) => (
                <div
                  key={product.product_id}
                  className="flex items-center justify-between rounded-control border border-border px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-body font-medium text-gray-900">
                      {product.product_name || product.product_id}
                    </span>
                    <span className="text-meta text-gray-500">
                      {product.quantity_sold} units sold
                    </span>
                  </div>
                  <span className="text-body font-semibold text-gray-900">
                    {formatCurrency(product.revenue, activeCurrency)}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-card border border-dashed border-border p-6 text-center">
                <p className="text-body text-gray-500">No product data available for this range.</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Channel Performance</CardTitle>
            <p className="text-meta text-gray-500">Marketing efficiency by platform.</p>
          </div>
          <div className="space-y-3">
            {channelSplit.length > 0 ? (
              channelSplit.map((channel) => (
                <div
                  key={channel.platform}
                  className="flex items-center justify-between rounded-control border border-border px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-body font-medium text-gray-900">{channel.platform}</span>
                    <span className="text-meta text-gray-500">
                      {channel.conversions} conversions
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-meta text-gray-500 uppercase tracking-wide mb-1">Spend</p>
                      <p className="text-body font-semibold text-gray-900">
                        {formatCurrency(channel.spend, activeCurrency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-meta text-gray-500 uppercase tracking-wide mb-1">
                        Revenue
                      </p>
                      <p className="text-body font-semibold text-gray-900">
                        {formatCurrency(channel.revenue, activeCurrency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-meta text-gray-500 uppercase tracking-wide mb-1">ROAS</p>
                      <p className="text-body font-semibold text-gray-900">
                        {channel.roas ? `${channel.roas.toFixed(2)}x` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-card border border-dashed border-border p-6 text-center">
                <p className="text-body text-gray-500">No marketing data available for this range.</p>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Orders Table */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-section-title text-gray-900">Recent Orders</h2>
            <p className="text-meta text-gray-500">
              {orderCount} orders · {formatCurrency(totalRevenue, activeCurrency)} total sales
            </p>
          </div>
        </div>

        <DataTable
          data={orders}
          isLoading={isLoadingOrders}
          emptyMessage="No orders found for this date range."
          columns={[
            {
              header: 'Order',
              accessor: (order) => order.order_number || `#${order.id.slice(0, 8)}`,
            },
            {
              header: 'Date',
              accessor: (order) => format(new Date(order.created_at), 'MMM d, yyyy'),
            },
            {
              header: 'Total',
              accessor: (order) =>
                formatCurrency(order.total_price ?? 0, order.currency ?? activeCurrency),
            },
          ]}
          getRowKey={(order) => order.id}
        />
      </section>
    </DashboardLayout>
  )
}

