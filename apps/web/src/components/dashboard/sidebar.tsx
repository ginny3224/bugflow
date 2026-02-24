'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Inbox,
  Bug,
  TrendingUp,
  FileText,
  Plug,
  Users,
  LogOut,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import { GlassAvatar, GlassButton } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/lib/theme-context';

interface SidebarProps {
  user: { email: string; id: string };
  team: { name: string; slug: string };
}

const navItems = [
  { label: 'Inbox', icon: Inbox, href: '/' },
  { label: 'Bugs', icon: Bug, href: '/bugs' },
  { label: 'Trends', icon: TrendingUp, href: '/trends' },
  { label: 'Digests', icon: FileText, href: '/digests' },
  { label: 'Integrations', icon: Plug, href: '/settings/integrations' },
  { label: 'Team', icon: Users, href: '/settings/team' },
];

export function Sidebar({ user, team }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const displayName = user.email.split('@')[0] ?? user.email;

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-40 sidebar-glass"
      style={{
        width: '260px',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        background: theme === 'light'
          ? 'rgba(255, 255, 255, 0.75)'
          : 'rgba(255, 255, 255, 0.03)',
        borderRight: theme === 'light'
          ? '1px solid rgba(0, 0, 0, 0.08)'
          : '1px solid rgba(255, 255, 255, 0.07)',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 py-5"
        style={{
          borderBottom: theme === 'light'
            ? '1px solid rgba(0, 0, 0, 0.06)'
            : '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{
            background: 'rgba(10, 132, 255, 0.2)',
            border: '1px solid rgba(10, 132, 255, 0.4)',
          }}
        >
          <Zap size={16} style={{ color: '#0a84ff' }} />
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--glass-text-primary)' }}
          >
            BugFlow
          </p>
          <p
            className="text-xs truncate"
            style={{ color: 'var(--glass-text-secondary)' }}
          >
            {team.name}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className="block">
              <motion.div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl select-none"
                style={{
                  background: active
                    ? 'rgba(10, 132, 255, 0.15)'
                    : 'transparent',
                  border: active
                    ? '1px solid rgba(10, 132, 255, 0.3)'
                    : '1px solid transparent',
                  color: active
                    ? '#0a84ff'
                    : theme === 'light'
                    ? 'rgba(0, 0, 0, 0.55)'
                    : 'rgba(255, 255, 255, 0.55)',
                }}
                whileHover={
                  !active
                    ? {
                        background: theme === 'light'
                          ? 'rgba(0, 0, 0, 0.04)'
                          : 'rgba(255, 255, 255, 0.05)',
                        borderColor: theme === 'light'
                          ? 'rgba(0, 0, 0, 0.06)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: theme === 'light'
                          ? 'rgba(0, 0, 0, 0.85)'
                          : 'rgba(255, 255, 255, 0.85)',
                      }
                    : undefined
                }
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                <span
                  className="text-sm font-medium"
                  style={{
                    color: active
                      ? '#0a84ff'
                      : 'inherit',
                  }}
                >
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: '#0a84ff' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        className="px-3 py-4"
        style={{
          borderTop: theme === 'light'
            ? '1px solid rgba(0, 0, 0, 0.06)'
            : '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="flex items-center gap-3 px-2 mb-3">
          <GlassAvatar name={displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--glass-text-primary)' }}
            >
              {displayName}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: 'var(--glass-text-secondary)' }}
            >
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="flex-1 justify-start gap-2.5"
          >
            <LogOut size={14} />
            Sign out
          </GlassButton>
          <motion.button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
            style={{
              background: theme === 'light'
                ? 'rgba(255, 159, 10, 0.15)'
                : 'rgba(255, 255, 255, 0.06)',
              border: theme === 'light'
                ? '1px solid rgba(255, 159, 10, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.1)',
            }}
            whileHover={{
              background: theme === 'light'
                ? 'rgba(255, 159, 10, 0.25)'
                : 'rgba(255, 255, 255, 0.12)',
            }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.15 }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
            ) : (
              <Moon size={14} style={{ color: '#ff9f0a' }} />
            )}
          </motion.button>
        </div>
      </div>
    </aside>
  );
}
