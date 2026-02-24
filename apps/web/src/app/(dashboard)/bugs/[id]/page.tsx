import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BugDetailPage } from '@/components/bugs/bug-detail-page';
import { getBugById, getLinkedMessages, getDuplicateMatch } from '@/lib/mock-data';

interface BugDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BugDetailPageProps) {
  const { id } = await params;
  const bug = getBugById(id);
  return {
    title: bug ? `${bug.title} — BugFlow` : 'Bug Detail — BugFlow',
  };
}

export default async function BugDetailRoute({ params }: BugDetailPageProps) {
  const { id } = await params;
  const bug = getBugById(id);

  if (!bug) notFound();

  const linkedMessages = getLinkedMessages(id);
  const duplicateMatch = getDuplicateMatch(bug);

  return (
    <div className="space-y-6">
      <Link
        href="/bugs"
        className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        <ChevronLeft size={15} />
        Back to Bugs
      </Link>

      <BugDetailPage
        bug={bug}
        linkedMessages={linkedMessages}
        duplicateMatch={duplicateMatch}
      />
    </div>
  );
}
