'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarItem {
  /**
   * Navigation label
   */
  label: string
  /**
   * Icon component from lucide-react
   */
  icon: LucideIcon
  /**
   * Link href
   */
  href: string
  /**
   * Badge count (optional)
   */
  badge?: number
}

export interface SidebarProps {
  /**
   * Navigation items
   */
  items: SidebarItem[]
  /**
   * Collapsed state
   */
  collapsed?: boolean
  /**
   * Callback when toggle collapse
   */
  onToggleCollapse?: () => void
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Sidebar Navigation Component
 *
 * Features:
 * - 56px collapsed (icons only)
 * - 240px expanded (icon + label)
 * - Light grey background
 * - Keyboard accessible
 * - Active state indication
 *
 * @example
 * <Sidebar
 *   items={[
 *     { label: 'Home', icon: Home, href: '/' },
 *     { label: 'Settings', icon: Settings, href: '/settings' },
 *   ]}
 *   collapsed={false}
 * />
 */
export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ items, collapsed = false, onToggleCollapse, className, ...props }, ref) => {
    const pathname = usePathname()

    return (
      <aside
        ref={ref}
        className={cn(
          'hidden md:flex flex-col bg-gray-100 border-r border-border',
          'transition-all duration-200',
          collapsed ? 'w-sidebar-collapsed' : 'w-sidebar-expanded',
          className
        )}
        aria-label="Main navigation"
        {...props}
      >
        <nav className="flex-1 px-2 py-4 space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-control',
                  'text-body font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  isActive
                    ? 'bg-surface text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
                  collapsed && 'justify-center'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={cn('h-5 w-5 flex-shrink-0')}
                  aria-hidden="true"
                />

                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className="px-2 py-0.5 text-meta-sm font-semibold rounded-full bg-primary-500 text-white"
                        aria-label={`${item.badge} notifications`}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>
      </aside>
    )
  }
)

Sidebar.displayName = 'Sidebar'
