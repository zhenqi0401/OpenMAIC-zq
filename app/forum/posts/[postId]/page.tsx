import { ForumPostPage } from '@/components/forum/ForumPostPage';

export default async function ForumPostRoute({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <ForumPostPage postId={postId} />;
}
