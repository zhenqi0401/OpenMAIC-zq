import { Suspense } from 'react';
import { ForumListPage } from '@/components/forum/ForumListPage';

export default function ForumPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f5f7] dark:bg-[#12141a]" />}>
      <ForumListPage />
    </Suspense>
  );
}
