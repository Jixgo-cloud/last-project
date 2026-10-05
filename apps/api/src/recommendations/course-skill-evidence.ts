const aliases: Record<string, string[]> = {
  react: ['reactjs', 'react.js'], 'node.js': ['nodejs'], 'next.js': ['nextjs'],
  'tailwind css': ['tailwind'], postgresql: ['postgres'],
};

export function mentionsSkill(text: string, name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return [normalized, ...(aliases[normalized] || [])].some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu').test(text);
  });
}

export function courseWithSupportedSkills<T extends {title: string; description?: string | null; skills: any[]}>(course: T): T {
  const text = `${course.title} ${course.description || ''}`;
  return {...course, skills: course.skills.filter((link) =>
    link.relevanceScore !== 0.9 || mentionsSkill(text, link.skill.name))};
}
