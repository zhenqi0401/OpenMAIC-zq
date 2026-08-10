import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ForumListPage } from '@/components/forum/ForumListPage';
import { isForumEnabled } from '@/lib/config/feature-flags';

export default function ForumPage() {
  if (!isForumEnabled()) notFound();
  return (
    <Suspense fallback={<div className="min-h-screen bg-page dark:bg-page" />}>
      <ForumListPage />
    </Suspense>
  );
}
