import { StatsCards } from '@/components/dashboard/stats-cards';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { ReviewQueuePage } from '@/components/queue/review-queue-page';
import { GlassBadge } from '@/components/ui';
import type { DashboardStats } from '@/components/dashboard/stats-cards';
import { MOCK_MESSAGES, MOCK_BUGS, MOCK_TEAM_ID, getPendingBugs } from '@/lib/mock-data';

export const metadata = {
  title: 'Inbox — BugFlow',
};

export default async function InboxPage() {
  const pending = getPendingBugs();
  const approved = MOCK_BUGS.filter(b => b.status === 'approved' || b.status === 'created_in_monday');

  const stats: DashboardStats = {
    totalBugs: MOCK_BUGS.length,
    pendingReview: pending.length,
    approvedToday: approved.length,
    activeChannels: 4,
    channels: [
      { platform: 'slack', connected: true },
      { platform: 'discord', connected: true },
      { platform: 'intercom', connected: true },
      { platform: 'telegram', connected: true },
    ],
    trends: {
      totalBugsDelta: 5,
      pendingReviewDelta: -2,
      approvedTodayDelta: 3,
    },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--glass-text-primary)' }}
        >
          Inbox
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--glass-text-secondary)' }}
        >
          Incoming bug reports and activity across all channels
        </p>
      </div>

      {/* Stats row */}
      <StatsCards stats={stats} />

      {/* Main content: Review Queue + Activity Feed side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Review queue — takes 2 cols */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--glass-text-primary)' }}
            >
              Pending Review
            </h2>
            {pending.length > 0 && (
              <GlassBadge variant="high" pulse>
                {pending.length}
              </GlassBadge>
            )}
          </div>
          <ReviewQueuePage teamId={MOCK_TEAM_ID} initialQueue={pending} />
        </div>

        {/* Right column: Activity feed + Bug flow */}
        <div className="space-y-6">
          <ActivityFeed teamId={MOCK_TEAM_ID} initialMessages={MOCK_MESSAGES} />

          {/* Bug flow mini visualization */}
          <div
            className="rounded-2xl p-5 flex flex-col"
            style={{
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: 'rgba(255, 255, 255, 0.95)' }}
            >
              Pipeline
            </p>
            <p
              className="text-xs mb-4"
              style={{ color: 'rgba(255, 255, 255, 0.4)' }}
            >
              Message → Review → Approved
            </p>

            <div className="flex flex-col gap-2.5">
              {[
                { label: 'Incoming', count: MOCK_MESSAGES.length, color: '#0a84ff' },
                { label: 'Review', count: pending.length, color: '#ff9f0a' },
                { label: 'Approved', count: approved.length, color: '#30d158' },
              ].map((step, i) => (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                      {step.label}
                    </span>
                    <span
                      className="text-xs tabular-nums font-semibold"
                      style={{ color: step.color }}
                    >
                      {step.count}
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        background: step.color,
                        width: `${Math.round((step.count / Math.max(MOCK_MESSAGES.length, 1)) * 100)}%`,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                  {i < 2 && (
                    <div
                      className="flex justify-center mt-0.5"
                      style={{ color: 'rgba(255,255,255,0.15)' }}
                    >
                      <span className="text-xs">↓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
