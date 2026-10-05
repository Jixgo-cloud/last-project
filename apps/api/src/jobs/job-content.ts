// These exact strings were previously inserted by ingestion, not supplied by employers.
const legacyRequirements = 'Proficiency with modern web tech stack, Git, team collaboration, and problem-solving.';
const legacyBenefits = 'Flexible working arrangements, competitive compensation, learning budget, and medical insurance.';

export function honestJobContent(job: { source: string; requirements?: string | null; benefits?: string | null; salaryMin?: number | null; salaryMax?: number | null }) {
  if (job.source === 'INTERNAL') return { requirements: job.requirements, benefits: job.benefits };
  return {
    requirements: job.requirements === legacyRequirements ? null : job.requirements,
    benefits: job.benefits === legacyBenefits ? null : job.benefits,
    ...((job.source === 'REMOTIVE' && job.salaryMin === 70000 && job.salaryMax === 140000)
      || (job.source === 'JOBSDB' && job.salaryMin === 70000 && job.salaryMax === 135000)
      || (job.source === 'JOBTHAI' && job.salaryMin === 55000 && job.salaryMax === 100000)
      ? { salaryMin: null, salaryMax: null } : {}),
  };
}
