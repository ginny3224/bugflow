import { IntegrationsPage } from '@/components/integrations/integrations-page';
import { MOCK_INTEGRATIONS, MOCK_TEAM_ID } from '@/lib/mock-data';

export const metadata = {
  title: 'Integrations — BugFlow',
};

export default async function IntegrationsRoute() {
  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'rgba(255, 255, 255, 0.95)' }}
        >
          Integrations
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'rgba(255, 255, 255, 0.45)' }}
        >
          Connect your channels to start collecting bug reports
        </p>
      </div>

      <IntegrationsPage
        teamId={MOCK_TEAM_ID}
        initialIntegrations={MOCK_INTEGRATIONS}
      />
    </div>
  );
}
