export const metadata = {
  title: 'Digests — BugFlow',
};

export default async function DigestsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'rgba(255, 255, 255, 0.95)' }}
        >
          Weekly Digests
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'rgba(255, 255, 255, 0.45)' }}
        >
          AI-generated weekly summaries of your bug activity
        </p>
      </div>

      <div
        className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          📋
        </div>
        <div className="text-center">
          <p
            className="text-base font-medium"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            No digests yet
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Weekly digests will appear here once your first week of data is collected
          </p>
        </div>
      </div>
    </div>
  );
}
