'use client'

import * as React from 'react'
import { subDays, format } from 'date-fns'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { KPITile } from '@/components/ui/kpi-tile'
import { Card, CardTitle } from '@/components/ui/card'
import { DatePickerHeader, DateRange } from '@/components/ui/date-picker-header'
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics'
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
import { Eye, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  // Date range state - default to Last 7 days
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  })
  const [shopId, setShopId] = React.useState<string | null>(null)
  const [shopIdError, setShopIdError] = React.useState<string | null>(null)

  // Resolve shop ID automatically from latest order
  React.useEffect(() => {
    let isCancelled = false

    const resolveShopId = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('shop_id')
          .not('shop_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (isCancelled) return

        if (error) {
          setShopIdError(error.message || 'Failed to resolve shop ID')
          return
        }

        if (!data?.shop_id) {
          setShopIdError('No shop data found. Run a sync to populate orders.')
          return
        }

        setShopId(data.shop_id)
        setShopIdError(null)
      } catch (err) {
        if (isCancelled) return
        const message = err instanceof Error ? err.message : 'Unexpected error resolving shop ID'
        setShopIdError(message)
      }
    }

    resolveShopId()

    return () => {
      isCancelled = true
    }
  }, [])

  // Fetch real data from Supabase
  const { metrics, chartData, topProducts, channelSplit, isLoading, error } =
    useDashboardMetrics(shopId, dateRange)

  if (!shopId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          {shopIdError ? (
            <div className="text-center">
              <p className="text-body text-red-600 mb-2">Unable to load shop data</p>
              <p className="text-meta text-gray-500">{shopIdError}</p>
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          )}
        </div>
      </DashboardLayout>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </DashboardLayout>
    )
  }

  // Show error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-body text-red-600 mb-2">Error loading dashboard</p>
            <p className="text-meta text-gray-500">{error.message}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-page-title text-gray-900">Overview</h1>
            <p className="text-meta text-gray-500 mt-1">
              Track team progress here. You almost reach a goal!
            </p>
          </div>

          {/* Date Picker */}
          <DatePickerHeader value={dateRange} onChange={setDateRange} />
        </div>

        {/* KPI Tiles - Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPITile
            value={metrics?.total_revenue || 0}
            label="Sales (Net)"
            delta={metrics?.revenue_delta || 0}
            format="currency"
          />
          <KPITile
            value={metrics?.total_orders || 0}
            label="Orders"
            delta={metrics?.orders_delta || 0}
            format="number"
          />
          <KPITile
            value={metrics?.avg_order_value || 0}
            label="AOV"
            delta={metrics?.aov_delta || 0}
            format="currency"
          />
          <KPITile
            value={metrics?.total_ad_spend || 0}
            label="Ad Spend"
            delta={metrics?.ad_spend_delta || 0}
            format="currency"
          />
        </div>

        {/* KPI Tiles - Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPITile
            value={metrics?.avg_roas || 0}
            label="ROAS"
            delta={metrics?.roas_delta || 0}
            format="number"
          />
          <KPITile
            value={metrics?.avg_mer || 0}
            label="MER"
            delta={metrics?.mer_delta || 0}
            format="number"
          />
          <KPITile
            value={metrics?.total_sessions || 0}
            label="Sessions"
            delta={metrics?.sessions_delta || 0}
            format="number"
          />
          <KPITile
            value={metrics?.avg_conversion_rate || 0}
            label="Conversion Rate"
            delta={metrics?.conversion_rate_delta || 0}
            format="percent"
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="space-y-6 mb-8">
        {/* Sales vs Ad Spend */}
        <Card>
          <div className="mb-4">
            <CardTitle>Sales vs Ad Spend</CardTitle>
          </div>
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
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#A3A3A3"
                tick={{ fill: '#737373', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#E5E5E5' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
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
        </Card>

        {/* ROAS + MER */}
        <Card>
          <div className="mb-4">
            <CardTitle>ROAS + MER</CardTitle>
          </div>
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
                tickFormatter={(value) => `${value.toFixed(1)}x`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
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
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card className="mb-8">
        <div className="mb-6">
          <CardTitle>Conversion Funnel</CardTitle>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary-500" />
              <span className="text-body text-gray-700">Sessions</span>
            </div>
            <span className="text-body font-semibold text-gray-900">12,830</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5" />
              <span className="text-body text-gray-700">Add to Cart</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-meta-sm text-red-600 font-medium">9.44%</span>
              <span className="text-body font-semibold text-gray-900">1,211</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5" />
              <span className="text-body text-gray-700">Checkout</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-meta-sm text-red-600 font-medium">49.3%</span>
              <span className="text-body font-semibold text-gray-900">489</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5" />
              <span className="text-body text-gray-700">Purchase</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-meta-sm text-red-600 font-medium">63.8%</span>
              <span className="text-body font-semibold text-gray-900">312</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Pages */}
        <Card>
          <div className="mb-6">
            <CardTitle>Top Pages by Sessions</CardTitle>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-gray-700">/homepage</span>
              <span className="text-body font-semibold text-gray-900">8,120</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-gray-700">/products/new-arrivals</span>
              <span className="text-body font-semibold text-gray-900">2,543</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-gray-700">/collections/summer-sale</span>
              <span className="text-body font-semibold text-gray-900">987</span>
            </div>
          </div>
        </Card>

        {/* Top Products */}
        <Card>
          <div className="mb-6">
            <CardTitle>Top Products by Revenue</CardTitle>
          </div>
          <div className="space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product) => (
                <div key={product.product_id} className="flex items-center justify-between py-2">
                  <span className="text-body text-gray-700 flex-1">
                    {product.product_name}
                  </span>
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
