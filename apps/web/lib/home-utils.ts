export const COURSE_ART_PRESETS = [
  { artBg: '#fbf6f4', artType: 'udemy-1' },
  { artBg: 'linear-gradient(115deg,#fff 0%,#f4f5ff 53%,#dfe5fb 100%)', artType: 'youtube-angular22' },
  { artBg: '#111827', artType: 'youtube-ahsan' },
  { artBg: '#0c67a9', artType: 'udemy-essentials' },
  { artBg: '#111827', artType: 'youtube-fcc' },
  { artBg: '#d0c4a3', artType: 'udemy-practicals' },
];

export function formatJobItem(j: any) {
  const skillNames = (j.skills || []).map((s: any) => s.skill?.name || s.name).filter(Boolean);
  return {
    id: j.id,
    title: j.title,
    companyName: j.company?.name || j.companyName || 'SmartCareer Partner',
    source: j.source ? `Source: ${j.source}` : 'Source: SmartCareer',
    location: j.location || 'กรุงเทพมหานคร',
    workMode: j.isRemote ? 'Remote' : 'Hybrid',
    salary: j.salaryMin && j.salaryMax
      ? `฿${j.salaryMin.toLocaleString()} – ฿${j.salaryMax.toLocaleString()} per month`
      : '฿35,000 – ฿45,000 per month',
    skills: skillNames.slice(0, 3),
    moreSkillsCount: Math.max(0, skillNames.length - 3),
  };
}

export function formatCourseItem(c: any, index: number) {
  const skillNames = (c.skills || []).map((s: any) => s.skill?.name || s.name).filter(Boolean);
  const style = COURSE_ART_PRESETS[index % COURSE_ART_PRESETS.length];
  return {
    id: c.id,
    title: c.title,
    category: skillNames[0] || 'Technical Skill',
    provider: c.provider || (c.url?.includes('youtube') ? 'YOUTUBE' : 'UDEMY'),
    price: c.provider === 'YOUTUBE' ? 'Free' : 'Unknown',
    isFree: c.provider === 'YOUTUBE',
    instructor: c.source || (c.provider === 'YOUTUBE' ? 'YouTube Creator' : 'Udemy'),
    infoText: c.rating ? `★ ${c.rating}` : '★ 0 (0 reviews)',
    duration: c.duration ? `◷ ${c.duration}` : '◷ Unknown',
    level: c.level || 'Beginner',
    skills: skillNames.length > 0 ? skillNames.slice(0, 3) : ['Development'],
    url: c.url,
    thumbnailUrl: c.thumbnailUrl || null,
    artBg: style.artBg,
    artType: style.artType,
  };
}
