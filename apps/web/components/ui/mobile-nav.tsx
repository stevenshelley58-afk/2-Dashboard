'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MobileNavItem {
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
}

export interface MobileNavProps {
  /**
   * Navigation items
   */
  items: MobileNavItem[]
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Mobile Navigation Component
 *
 * Bottom tab bar for mobile devices:
 * - Fixed to bottom on mobile
 * - Icon + label
 * - Active state indication
 * - Safe area padding
 *
 * @example
 * <MobileNav
 *   items={[
 *     { label: 'Home', icon: Home, href: '/' },
 *     { label: 'Shopify', icon: ShoppingBag, href: '/shopify' },
 *     { label: 'Meta', icon: Facebook, href: '/meta' },
 *     { label: 'Klaviyo', icon: Mail, href: '/klaviyo' },
 *     { label: 'Settings', icon: Settings, href: '/settings' },
 *   ]}
 * />
 */
export const MobileNav = React.forwardRef<HTMLElement, MobileNavProps>(
  ({ items, className, ...props }, ref) => {
    const pathname = usePathname()

    return (
      <nav
        ref={ref}
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-50',
          'bg-surface border-t border-border',
          'pb-safe',
          className
        )}
        aria-label="Mobile navigation"
        {...props}
      >
        <div className="flex items-center justify-around px-2 h-16">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 gap-1',
                  'min-w-0 py-2 px-1',
                  'transition-colors rounded-control',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  isActive ? 'text-primary-600' : 'text-gray-500'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={cn('h-6 w-6 flex-shrink-0')}
                  aria-hidden="true"
                />
                <span className="text-meta-sm font-medium truncate w-full text-center">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }
)

MobileNav.displayName = 'MobileNav'
