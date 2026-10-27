-- Bring the existing SkillCategory enum in line with the committed schema.
-- Additive only: existing labels and all rows remain unchanged.
ALTER TYPE "SkillCategory" ADD VALUE IF NOT EXISTS 'SALES';
ALTER TYPE "SkillCategory" ADD VALUE IF NOT EXISTS 'COORDINATION';
ALTER TYPE "SkillCategory" ADD VALUE IF NOT EXISTS 'WRITING';
