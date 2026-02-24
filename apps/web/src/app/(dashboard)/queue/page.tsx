import { ReviewQueuePage } from '@/components/queue/review-queue-page';
import { GlassBadge } from '@/components/ui';
import { getPendingBugs, MOCK_TEAM_ID } from '@/lib/mock-data';

export const metadata = {
  title: 'Review Queue — BugFlow',
};

export default async function QueuePage() {
  const queue = getPendingBugs();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'rgba(255, 255, 255, 0.95)' }}
          >
            Review Queue
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'rgba(255, 255, 255, 0.45)' }}
          >
            Approve, reject, or merge incoming bug reports
          </p>
        </div>
        {queue.length > 0 && (
          <GlassBadge variant="high" pulse>
            {queue.length} pending
          </GlassBadge>
        )}
      </div>

      <ReviewQueuePage teamId={MOCK_TEAM_ID} initialQueue={queue} />
    </div>
  );
}
