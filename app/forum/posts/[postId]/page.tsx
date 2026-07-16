import { ForumPostPage } from '@/components/forum/ForumPostPage';
import { notFound } from 'next/navigation';
import { isForumEnabled } from '@/lib/config/feature-flags';

export default async function ForumPostRoute({ params }: { params: Promise<{ postId: string }> }) {
  if (!isForumEnabled()) notFound();
  const { postId } = await params;
  return <ForumPostPage postId={postId} />;
}
