import { BugListPage } from '@/components/bugs/bug-list-page';
import { getAllBugs, MOCK_TEAM_ID } from '@/lib/mock-data';

export const metadata = {
  title: 'Bugs — BugFlow',
};

export default async function BugsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'rgba(255, 255, 255, 0.95)' }}
        >
          Bugs
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'rgba(255, 255, 255, 0.45)' }}
        >
          All bug reports across your connected channels
        </p>
      </div>

      <BugListPage teamId={MOCK_TEAM_ID} initialBugs={getAllBugs()} />
    </div>
  );
}
