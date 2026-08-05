'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Slide } from '@openmaic/dsl';
import { LearnerHome } from '@/components/home/LearnerHome';
import type { SessionIdentity } from '@/lib/auth/types';
import {
  loadHomeCourses,
  type HomeCourse,
  type HomeCourseCategory,
} from '@/lib/home/enterprise-course-list';
import { logoutCurrentSession } from '@/lib/auth/logout-client';
import {
  deleteStageData,
  renameStage,
  revokeThumbnailSlideMediaUrls,
} from '@/lib/utils/stage-storage';

export function LearnerPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [courses, setCourses] = useState<HomeCourse[]>([]);
  const [categories, setCategories] = useState<HomeCourseCategory[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const thumbnailsRef = useRef<Record<string, Slide>>({});

  const replaceThumbnails = useCallback((next: Record<string, Slide>) => {
    const previous = thumbnailsRef.current;
    thumbnailsRef.current = next;
    setThumbnails(next);
    window.setTimeout(() => revokeThumbnailSlideMediaUrls(previous), 0);
  }, []);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // /learn is always a learner catalogue, including for administrators.
      const result = await loadHomeCourses(undefined, false);
      setCourses(result.courses);
      setCategories(result.categories);
      replaceThumbnails(result.thumbnails);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程加载失败');
    } finally {
      setLoading(false);
    }
  }, [replaceThumbnails]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/session')
      .then((response) => response.json())
      .then((session: { authenticated?: boolean; identity?: SessionIdentity }) => {
        if (cancelled) return;
        if (!session.authenticated || !session.identity) {
          window.location.assign('/login');
          return;
        }
        setIdentity(session.identity);
        void loadCourses();
      })
      .catch(() => {
        if (!cancelled) window.location.assign('/login');
      });
    return () => {
      cancelled = true;
      revokeThumbnailSlideMediaUrls(thumbnailsRef.current);
      thumbnailsRef.current = {};
    };
  }, [loadCourses]);

  if (!identity) {
    return <main className="min-h-[100dvh] bg-[#f4f5f7]" aria-busy="true" />;
  }

  return (
    <LearnerHome
      identity={identity}
      courses={courses}
      categories={categories}
      thumbnails={thumbnails}
      loading={loading}
      error={error}
      onRetry={loadCourses}
      onOpenCourse={(id) => router.push(`/classroom/${id}?mode=learn`)}
      onRenameCourse={async (id, name) => {
        await renameStage(id, name);
        setCourses((current) =>
          current.map((course) => (course.id === id ? { ...course, name } : course)),
        );
      }}
      onDeleteCourse={async (id) => {
        await deleteStageData(id);
        await loadCourses();
      }}
      onLogout={async () => {
        await logoutCurrentSession();
        window.location.assign('/login');
      }}
      enableCategoryDeepLink
    />
  );
}
