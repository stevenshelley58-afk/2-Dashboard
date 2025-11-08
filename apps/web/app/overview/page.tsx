'use client'

import * as React from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { KPITile } from '@/components/ui/kpi-tile'
import { Card, CardTitle } from '@/components/ui/card'
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
import { Eye } from 'lucide-react'

// Mock data for charts
const salesVsAdSpendData = [
  { date: 'Jan 1', sales: 12450, spend: 2500 },
  { date: 'Jan 2', sales: 15200, spend: 2800 },
  { date: 'Jan 3', sales: 18900, spend: 3200 },
  { date: 'Jan 4', sales: 14200, spend: 2600 },
  { date: 'Jan 5', sales: 19500, spend: 3500 },
  { date: 'Jan 6', sales: 21000, spend: 3800 },
  { date: 'Jan 7', sales: 17800, spend: 3100 },
]

const roasMerData = [
  { date: 'Jan 1', roas: 4.98, mer: 5.2 },
  { date: 'Jan 2', roas: 5.43, mer: 5.8 },
  { date: 'Jan 3', roas: 5.91, mer: 6.1 },
  { date: 'Jan 4', roas: 5.46, mer: 5.6 },
  { date: 'Jan 5', roas: 5.57, mer: 5.9 },
  { date: 'Jan 6', roas: 5.53, mer: 6.0 },
  { date: 'Jan 7', roas: 5.74, mer: 6.2 },
]

export default function OverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = React.useState('Last 7')

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

          {/* Date Picker Pills */}
          <div className="flex items-center gap-2">
            {['Today', 'Yesterday', 'Last 7', 'MTD', 'Custom'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 text-body font-medium rounded-control transition-colors ${
                  selectedPeriod === period
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface text-gray-600 hover:bg-gray-100 border border-border'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Tiles - Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPITile
            value={12450}
            label="Sales (Net)"
            delta={5.2}
            format="currency"
          />
          <KPITile
            value={312}
            label="Orders"
            delta={8.1}
            format="number"
          />
          <KPITile
            value={39.90}
            label="AOV"
            delta={-1.4}
            format="currency"
          />
          <KPITile
            value={2500}
            label="Ad Spend"
            delta={12.0}
            format="currency"
          />
        </div>

        {/* KPI Tiles - Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPITile
            value={5.6}
            label="ROAS"
            delta={3.2}
            format="number"
          />
          <KPITile
            value={4.8}
            label="MER"
            delta={2.1}
            format="number"
          />
          <KPITile
            value={12830}
            label="Sessions"
            delta={15.3}
            format="number"
          />
          <KPITile
            value={2.4}
            label="Conversion Rate"
            delta={0.3}
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
            <LineChart data={salesVsAdSpendData}>
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
            <LineChart data={roasMerData}>
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
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-gray-700 flex-1">Classic Crewneck Tee</span>
              <div className="flex items-center gap-6">
                <span className="text-body font-semibold text-gray-900">$2,450</span>
                <span className="text-meta text-gray-500 w-12 text-right">98</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-gray-700 flex-1">Vintage Denim Jacket</span>
              <div className="flex items-center gap-6">
                <span className="text-body font-semibold text-gray-900">$1,890</span>
                <span className="text-meta text-gray-500 w-12 text-right">21</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-gray-700 flex-1">Leather Ankle Boots</span>
              <div className="flex items-center gap-6">
                <span className="text-body font-semibold text-gray-900">$1,230</span>
                <span className="text-meta text-gray-500 w-12 text-right">15</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Channel Split */}
      <div className="space-y-6">
        <h2 className="text-section-title text-gray-900">Channel Split</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Meta Card */}
          <Card>
            <h3 className="text-body font-semibold text-gray-900 mb-4">
              Meta (Facebook & Instagram)
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">Spend</span>
                <span className="text-body font-semibold text-gray-900">$1,200</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">Purchases</span>
                <span className="text-body font-semibold text-gray-900">152</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">Revenue</span>
                <span className="text-body font-semibold text-gray-900">$6,800</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">ROAS</span>
                <span className="text-body font-semibold text-gray-900">5.6x</span>
              </div>
            </div>
          </Card>

          {/* Google Ads Card */}
          <Card>
            <h3 className="text-body font-semibold text-gray-900 mb-4">
              Google Ads
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">Spend</span>
                <span className="text-body font-semibold text-gray-900">$850</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">Purchases</span>
                <span className="text-body font-semibold text-gray-900">98</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">Revenue</span>
                <span className="text-body font-semibold text-gray-900">$4,120</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-meta text-gray-500">ROAS</span>
                <span className="text-body font-semibold text-gray-900">4.8x</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
