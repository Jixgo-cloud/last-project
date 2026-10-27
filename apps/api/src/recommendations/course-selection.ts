import { mentionsSkill } from './course-skill-evidence';

type Course = { id: string; title: string; description?: string | null; url: string };

// Identity only: never rewrite the destination returned to the user.
export function courseIdentity(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.replace(/^www\./i, '');
    if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
      const video = url.hostname === 'youtu.be' ? url.pathname.slice(1) :
        url.pathname === '/watch' ? url.searchParams.get('v') :
        /^\/(shorts|embed)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
      if (video && /^[\w-]{11}$/.test(video)) return `youtube:${video}`;
    }
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_.+|ref|referrer|couponcode|fbclid|gclid|feature|si)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString().replace(/^https?:/, '').replace(/\/$/, '');
  } catch { return null; }
}

export function uniqueCourses<T extends Course>(courses: T[]): T[] {
  const seen = new Set<string>();
  return courses.filter(course => {
    const key = courseIdentity(course.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Skill-level relevance, not a claim that the course teaches a failed rubric item.
export function selectRelevantCourses<T extends Course>(courses: T[], skills: string[], limit: number): T[] {
  const evidence = (course: T) => skills.reduce((score, skill) => Math.max(score,
    mentionsSkill(course.title, skill) ? 2 : mentionsSkill(course.description || '', skill) ? 1 : 0), 0);
  return uniqueCourses(courses.filter(course => evidence(course) > 0).sort((a, b) =>
    evidence(b) - evidence(a) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))).slice(0, limit);
}
