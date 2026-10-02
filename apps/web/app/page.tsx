import HomePageClient from '@/components/home/HomePageClient';
import { formatJobItem, formatCourseItem } from '@/lib/home-utils';

export const revalidate = 60; // Next.js ISR: Revalidate page data at most every 60 seconds

async function getInitialData() {
  const apiUrl =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://smartcareerapi-production.up.railway.app/api'
      : 'http://localhost:4000/api');

  let initialJobs: any[] = [];
  let initialCourses: any[] = [];

  try {
    const res = await fetch(`${apiUrl}/jobs?limit=6`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.jobs)) {
        initialJobs = data.jobs.map(formatJobItem);
      }
    }
  } catch (err) {
    console.error('Server-side fetch jobs error:', err);
  }

  try {
    const res = await fetch(`${apiUrl}/recommendations/courses`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        initialCourses = data.slice(0, 6).map(formatCourseItem);
      }
    }
  } catch (err) {
    console.error('Server-side fetch courses error:', err);
  }

  return { initialJobs, initialCourses };
}

export default async function HomePage() {
  const { initialJobs, initialCourses } = await getInitialData();

  return (
    <HomePageClient
      initialJobs={initialJobs}
      initialCourses={initialCourses}
    />
  );
}
