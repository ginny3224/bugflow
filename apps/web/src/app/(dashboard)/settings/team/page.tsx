import { TeamSettingsPage } from '@/components/settings/team-settings-page';

export const metadata = {
  title: 'Team Settings — BugFlow',
};

export interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  email?: string;
}

export interface TeamSettings {
  id: string;
  name: string;
  slug: string;
  confidence_threshold: number;
  spike_threshold: number;
  digest_day: number;
  digest_hour: number;
}

const mockTeam: TeamSettings = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Phenom',
  slug: 'phenom',
  confidence_threshold: 0.7,
  spike_threshold: 5,
  digest_day: 1,
  digest_hour: 9,
};

const mockMembers: TeamMember[] = [
  {
    id: '1',
    user_id: 'dev-user',
    role: 'owner',
    created_at: new Date().toISOString(),
    email: 'dev@bugflow.app',
  },
];

export default async function TeamSettingsRoute() {
  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'rgba(255, 255, 255, 0.95)' }}
        >
          Team Settings
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'rgba(255, 255, 255, 0.45)' }}
        >
          Manage your team members, roles, and configuration
        </p>
      </div>

      <TeamSettingsPage
        team={mockTeam}
        members={mockMembers}
        currentUserId="dev-user"
        currentUserRole="owner"
      />
    </div>
  );
}
