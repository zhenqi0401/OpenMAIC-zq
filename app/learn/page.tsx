import { Suspense } from 'react';
import { LearnerPage } from '@/components/home/LearnerPage';

export default function LearnPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-page" aria-busy="true" />}>
      <LearnerPage />
    </Suspense>
  );
}
