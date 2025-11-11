'use client'

import * as React from 'react'
import { subDays, format } from 'date-fns'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { KPITile } from '@/components/ui/kpi-tile'
import { Card, CardTitle } from '@/components/ui/card'
import { DatePickerHeader, DateRange } from '@/components/ui/date-picker-header'
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics'
import { useActiveShop } from '@/hooks/use-active-shop'
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

export default function Home() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  })

  const { shopId, currency, isLoading: isResolvingShop, error: shopError } = useActiveShop()
  const resolvedCurrency = currency ?? 'AUD'

  const { metrics, chartData, topProducts, channelSplit, isLoading, error } =
    useDashboardMetrics(shopId, dateRange, resolvedCurrency)

  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date | null>(null)

  React.useEffect(() => {
    if (
      !isLoading &&
      (metrics || chartData.length > 0 || topProducts.length > 0 || channelSplit.length > 0)
    ) {
      setLastRefreshedAt(new Date())
    }
  }, [isLoading, metrics, chartData, topProducts, channelSplit])

  if (isResolvingShop) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!shopId || shopError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-body text-red-600 mb-2">Unable to load shop data</p>
            <p className="text-meta text-gray-500">
              {shopError?.message ?? 'Run a sync to populate orders and try again.'}
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const showInitialLoader =
    isLoading &&
    !metrics &&
    chartData.length === 0 &&
    topProducts.length === 0 &&
    channelSplit.length === 0

  return (
    <DashboardLayout>
      {showInitialLoader ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          <div className="mb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h1 className="text-page-title text-gray-900">Overview</h1>
                <p className="text-meta text-gray-500 mt-1">
                  Track team progress here. You almost reach a goal!
                </p>
                {lastRefreshedAt && (
                  <p className="text-meta text-gray-400 mt-1">
                    Last refreshed {lastRefreshedAt.toLocaleString()}
                  </p>
                )}
                {error && (
                  <p className="text-meta text-red-600 mt-2">
                    Failed to refresh dashboard data: {error.message}
                  </p>
                )}
              </div>

              <DatePickerHeader value={dateRange} onChange={setDateRange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <KPITile
                value={metrics ? metrics.total_revenue : null}
                label="Sales (Net)"
                delta={metrics?.revenue_delta ?? null}
                format="currency"
                currency={resolvedCurrency}
                isLoading={isLoading && !metrics}
              />
              <KPITile
                value={metrics ? metrics.total_orders : null}
                label="Orders"
                delta={metrics?.orders_delta ?? null}
                format="number"
                isLoading={isLoading && !metrics}
              />
              <KPITile
                value={metrics?.avg_order_value ?? null}
                label="AOV"
                delta={metrics?.aov_delta ?? null}
                format="currency"
                currency={resolvedCurrency}
                isLoading={isLoading && !metrics}
              />
              <KPITile
                value={metrics ? metrics.total_ad_spend : null}
                label="Ad Spend"
                delta={metrics?.ad_spend_delta ?? null}
                format="currency"
                currency={resolvedCurrency}
                isLoading={isLoading && !metrics}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPITile
                value={metrics?.avg_roas ?? null}
                label="ROAS"
                delta={metrics?.roas_delta ?? null}
                format="number"
                isLoading={isLoading && !metrics}
              />
              <KPITile
                value={metrics?.avg_mer ?? null}
                label="MER"
                delta={metrics?.mer_delta ?? null}
                format="number"
                isLoading={isLoading && !metrics}
              />
              <KPITile
                value={metrics ? metrics.total_sessions : null}
                label="Sessions"
                delta={metrics?.sessions_delta ?? null}
                format="number"
                isLoading={isLoading && !metrics}
              />
              <KPITile
                value={metrics?.avg_conversion_rate ?? null}
                label="Conversion Rate"
                delta={metrics?.conversion_rate_delta ?? null}
                format="percent"
                isLoading={isLoading && !metrics}
              />
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <Card>
              <div className="mb-4">
                <CardTitle>Sales vs Ad Spend</CardTitle>
              </div>
              {isLoading && chartData.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartData.map((d) => ({
                      date: format(new Date(d.date), 'MMM d'),
                      sales: d.revenue,
                      spend: d.ad_spend,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#A3A3A3"
                      tick={{ fill: '#737373', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E5E5' }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#A3A3A3"
                      tick={{ fill: '#737373', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E5E5' }}
                      tickFormatter={(value) => `${resolvedCurrency} ${Number(value).toLocaleString()}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#A3A3A3"
                      tick={{ fill: '#737373', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E5E5' }}
                      tickFormatter={(value) => `${resolvedCurrency} ${Number(value).toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E5E5',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sales"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                      name="Sales"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="spend"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
                      name="Spend"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center text-meta text-gray-500">
                  No sales or ad spend data for the selected range.
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-4">
                <CardTitle>ROAS + MER</CardTitle>
              </div>
              {isLoading && chartData.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartData.map((d) => ({
                      date: format(new Date(d.date), 'MMM d'),
                      roas: d.roas,
                      mer: d.mer,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#A3A3A3"
                      tick={{ fill: '#737373', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E5E5' }}
                    />
                    <YAxis
                      stroke="#A3A3A3"
                      tick={{ fill: '#737373', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E5E5' }}
                      tickFormatter={(value) => `${Number(value).toFixed(1)}x`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E5E5',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="roas"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      dot={false}
                      name="ROAS"
                    />
                    <Line
                      type="monotone"
                      dataKey="mer"
                      stroke="#EC4899"
                      strokeWidth={2}
                      dot={false}
                      name="MER"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center text-meta text-gray-500">
                  No ROAS or MER data for the selected range.
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
            <Card>
              <div className="mb-6">
                <CardTitle>Top Products by Revenue</CardTitle>
              </div>
              {isLoading && topProducts.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product) => (
                    <div key={product.product_id} className="flex items-center justify-between py-2">
                      <span className="text-body text-gray-700 flex-1 truncate pr-4">
                        {product.product_name || 'Unnamed product'}
                      </span>
                      <div className="flex items-center gap-6">
                        <span className="text-body font-semibold text-gray-900">
                          {resolvedCurrency} {product.revenue.toFixed(0)}
                        </span>
                        <span className="text-meta text-gray-500 w-12 text-right">
                          {product.quantity_sold}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-meta text-gray-500 text-center py-4">
                  No product sales recorded for the selected period.
                </p>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <h2 className="text-section-title text-gray-900">Channel Split</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isLoading && channelSplit.length === 0 ? (
                <div className="col-span-2 flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : channelSplit.length > 0 ? (
                channelSplit.map((channel) => (
                  <Card key={channel.platform}>
                    <h3 className="text-body font-semibold text-gray-900 mb-4">
                      {channel.platform === 'META'
                        ? 'Meta (Facebook & Instagram)'
                        : channel.platform === 'GOOGLE'
                        ? 'Google Ads'
                        : channel.platform}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-meta text-gray-500">Spend</span>
                        <span className="text-body font-semibold text-gray-900">
                          {resolvedCurrency} {channel.spend.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-meta text-gray-500">Purchases</span>
                        <span className="text-body font-semibold text-gray-900">
                          {channel.conversions}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-meta text-gray-500">Revenue</span>
                        <span className="text-body font-semibold text-gray-900">
                          {resolvedCurrency} {channel.revenue.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-meta text-gray-500">ROAS</span>
                        <span className="text-body font-semibold text-gray-900">
                          {channel.roas ? `${channel.roas.toFixed(1)}x` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-meta text-gray-500 col-span-2 text-center py-8">
                  No marketing channel performance data for the selected period.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
                  <div className="flex items-center gap-6">
                    <span className="text-body font-semibold text-gray-900">
                      ${product.revenue.toFixed(0)}
                    </span>
                    <span className="text-meta text-gray-500 w-12 text-right">
                      {product.quantity_sold}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-meta text-gray-500 text-center py-4">No product data available</p>
            )}
          </div>
        </Card>
      </div>

      {/* Channel Split */}
      <div className="space-y-6">
        <h2 className="text-section-title text-gray-900">Channel Split</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {channelSplit.length > 0 ? (
            channelSplit.map((channel) => (
              <Card key={channel.platform}>
                <h3 className="text-body font-semibold text-gray-900 mb-4">
                  {channel.platform === 'META' ? 'Meta (Facebook & Instagram)' :
                   channel.platform === 'GOOGLE' ? 'Google Ads' :
                   channel.platform}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-meta text-gray-500">Spend</span>
                    <span className="text-body font-semibold text-gray-900">
                      ${channel.spend.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-meta text-gray-500">Purchases</span>
                    <span className="text-body font-semibold text-gray-900">
                      {channel.conversions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-meta text-gray-500">Revenue</span>
                    <span className="text-body font-semibold text-gray-900">
                      ${channel.revenue.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-meta text-gray-500">ROAS</span>
                    <span className="text-body font-semibold text-gray-900">
                      {channel.roas ? `${channel.roas.toFixed(1)}x` : 'N/A'}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-meta text-gray-500 col-span-2 text-center py-8">
              No channel data available
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
