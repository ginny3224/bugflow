import { TrendsPage } from '@/components/trends/trends-page';
import type { TrendsData } from '@/components/trends/trends-page';
import { MOCK_ALERTS, MOCK_TEAM_ID } from '@/lib/mock-data';

export const metadata = {
  title: 'Trends — BugFlow',
};

function getTrendsData(): TrendsData {
  const dailyCounts = [];
  // Generate realistic-looking data with a spike in recent days
  const pattern = [2, 1, 3, 2, 4, 2, 1, 3, 2, 1, 2, 3, 1, 2, 4, 3, 2, 1, 3, 2, 4, 3, 5, 4, 6, 8, 7, 9, 6, 5];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCounts.push({
      date: d.toISOString().slice(0, 10),
      count: pattern[29 - i],
    });
  }

  return {
    dailyCounts,
    categoryBreakdown: [
      { category: 'UI', count: 18 },
      { category: 'API', count: 14 },
      { category: 'Performance', count: 8 },
      { category: 'Auth', count: 6 },
      { category: 'Data', count: 5 },
      { category: 'Other', count: 2 },
    ],
    channelBreakdown: [
      { channel: 'slack', count: 24 },
      { channel: 'discord', count: 16 },
      { channel: 'intercom', count: 9 },
      { channel: 'telegram', count: 4 },
    ],
  };
}

export default async function TrendsRoute() {
  const trendsData = getTrendsData();

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'rgba(255, 255, 255, 0.95)' }}
        >
          Trends
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'rgba(255, 255, 255, 0.45)' }}
        >
          Bug volume analytics and spike detection
        </p>
      </div>

      <TrendsPage
        teamId={MOCK_TEAM_ID}
        data={trendsData}
        initialAlerts={MOCK_ALERTS}
      />
    </div>
  );
}
