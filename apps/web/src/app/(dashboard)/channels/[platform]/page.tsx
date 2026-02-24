import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { ReviewQueuePage } from '@/components/queue/review-queue-page';
import { GlassBadge, PlatformIcon, platformName } from '@/components/ui';
import { MOCK_MESSAGES, MOCK_TEAM_ID, getPendingBugs } from '@/lib/mock-data';
import { notFound } from 'next/navigation';

const VALID_PLATFORMS = ['slack', 'discord', 'intercom', 'telegram', 'x'] as const;
type ValidPlatform = typeof VALID_PLATFORMS[number];

export function generateStaticParams() {
  return VALID_PLATFORMS.map((platform) => ({ platform }));
}

export async function generateMetadata({ params }: { params: { platform: string } }) {
  const platform = params.platform as ValidPlatform;

  if (!VALID_PLATFORMS.includes(platform as ValidPlatform)) {
    return { title: 'Channel Not Found — BugFlow' };
  }

  return {
    title: `${platformName(platform)} — BugFlow`,
  };
}

export default async function ChannelPage({ params }: { params: { platform: string } }) {
  const platform = params.platform as ValidPlatform;

  if (!VALID_PLATFORMS.includes(platform as ValidPlatform)) {
    notFound();
  }

  // Filter messages and bugs by platform
  const platformMessages = MOCK_MESSAGES.filter(
    (msg) => msg.channel_type === platform
  );

  const allPendingBugs = getPendingBugs();
  const platformBugs = allPendingBugs.filter(
    (bug) => bug.source_channel === platform
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <PlatformIcon platform={platform} size={20} />
        </div>
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--glass-text-primary)' }}
          >
            {platformName(platform)}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--glass-text-secondary)' }}
          >
            Activity and bug reports from {platformName(platform)}
          </p>
        </div>
      </div>

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
            {platformBugs.length > 0 && (
              <GlassBadge variant="high" pulse>
                {platformBugs.length}
              </GlassBadge>
            )}
          </div>
          {platformBugs.length > 0 ? (
            <ReviewQueuePage teamId={MOCK_TEAM_ID} initialQueue={platformBugs} />
          ) : (
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--glass-text-secondary)' }}
              >
                No pending bugs from {platformName(platform)}
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--glass-text-tertiary)' }}
              >
                All clear for now
              </p>
            </div>
          )}
        </div>

        {/* Right column: Activity feed */}
        <div className="space-y-6">
          <ActivityFeed teamId={MOCK_TEAM_ID} initialMessages={platformMessages} />

          {/* Stats card */}
          <div
            className="rounded-2xl p-5"
            style={{
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p
              className="text-sm font-semibold mb-3"
              style={{ color: 'rgba(255, 255, 255, 0.95)' }}
            >
              Channel Stats
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Total Messages
                </span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: '#0a84ff' }}
                >
                  {platformMessages.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Pending Review
                </span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: '#ff9f0a' }}
                >
                  {platformBugs.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
