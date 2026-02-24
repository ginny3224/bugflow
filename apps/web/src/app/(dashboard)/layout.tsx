import { Sidebar } from '@/components/dashboard/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dev mode: use mock user/team data (auth disabled)
  const user = { email: 'dev@bugflow.app', id: 'dev-user' };
  const team = { name: 'Phenom', slug: 'phenom' };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar user={user} team={team} />

      <main
        className="flex-1 min-h-screen overflow-auto"
        style={{ marginLeft: '260px' }}
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
