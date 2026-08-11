import { Suspense } from 'react';
import { Spin } from 'antd';
import { LearnerPage } from '@/components/home/LearnerPage';

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] bg-page" aria-busy="true">
          <Spin fullscreen tip="正在加载学习中心" />
        </main>
      }
    >
      <LearnerPage />
    </Suspense>
  );
}
