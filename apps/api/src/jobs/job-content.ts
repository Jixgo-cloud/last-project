// These exact strings were previously inserted by ingestion, not supplied by employers.
const legacyRequirements = 'Proficiency with modern web tech stack, Git, team collaboration, and problem-solving.';
const legacyBenefits = 'Flexible working arrangements, competitive compensation, learning budget, and medical insurance.';

export function honestJobContent(job: { source: string; requirements?: string | null; benefits?: string | null }) {
  if (job.source === 'INTERNAL') return { requirements: job.requirements, benefits: job.benefits };
  return {
    requirements: job.requirements === legacyRequirements ? null : job.requirements,
    benefits: job.benefits === legacyBenefits ? null : job.benefits,
  };
}
