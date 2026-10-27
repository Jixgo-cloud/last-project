import { skillAttemptSelect } from '../assessments/skill-attempt-select';
import { Injectable, Logger, ForbiddenException, ConflictException, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { SkillCategory, candidateSkillViews } from '@smartcareer/shared';

interface RepoAnalysisResult {
  repoName: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  topics: string[];
  languages: Record<string, number>;
  detectedSkills: Array<{
    skillName: string;
    category: SkillCategory;
    dependency: string;
    evidenceType: "LANGUAGE" | "DEPENDENCY";
  }>;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  // Package-name hints mapped to skills; dependencies do not prove proficiency.
  private readonly dependencyMapping: Record<string, { skill: string; category: SkillCategory }> = {
    // Frontend & UI
    react: { skill: 'React', category: SkillCategory.FRONTEND },
    'react-dom': { skill: 'React', category: SkillCategory.FRONTEND },
    next: { skill: 'Next.js', category: SkillCategory.FRONTEND },
    vue: { skill: 'Vue.js', category: SkillCategory.FRONTEND },
    nuxt: { skill: 'Vue.js', category: SkillCategory.FRONTEND },
    angular: { skill: 'Angular', category: SkillCategory.FRONTEND },
    '@angular/core': { skill: 'Angular', category: SkillCategory.FRONTEND },
    tailwindcss: { skill: 'Tailwind CSS', category: SkillCategory.FRONTEND },
    bootstrap: { skill: 'Bootstrap', category: SkillCategory.FRONTEND },
    redux: { skill: 'Redux', category: SkillCategory.FRONTEND },
    '@reduxjs/toolkit': { skill: 'Redux', category: SkillCategory.FRONTEND },
    rxjs: { skill: 'RxJS', category: SkillCategory.FRONTEND },
    typescript: { skill: 'TypeScript', category: SkillCategory.FRONTEND },
    figma: { skill: 'Figma', category: SkillCategory.FRONTEND },

    // Backend & APIs
    express: { skill: 'Node.js', category: SkillCategory.BACKEND },
    fastify: { skill: 'Node.js', category: SkillCategory.BACKEND },
    '@nestjs/core': { skill: 'NestJS', category: SkillCategory.BACKEND },
    nestjs: { skill: 'NestJS', category: SkillCategory.BACKEND },
    axios: { skill: 'REST APIs', category: SkillCategory.BACKEND },
    'node-fetch': { skill: 'REST APIs', category: SkillCategory.BACKEND },
    graphql: { skill: 'GraphQL', category: SkillCategory.BACKEND },
    apollo: { skill: 'GraphQL', category: SkillCategory.BACKEND },
    django: { skill: 'Django', category: SkillCategory.BACKEND },
    fastapi: { skill: 'FastAPI', category: SkillCategory.BACKEND },
    flask: { skill: 'Python', category: SkillCategory.BACKEND },
    'spring-boot': { skill: 'Spring Boot', category: SkillCategory.BACKEND },
    spring: { skill: 'Spring Boot', category: SkillCategory.BACKEND },

    // Databases
    prisma: { skill: 'Prisma', category: SkillCategory.DATABASE },
    '@prisma/client': { skill: 'Prisma', category: SkillCategory.DATABASE },
    typeorm: { skill: 'SQL', category: SkillCategory.DATABASE },
    sequelize: { skill: 'SQL', category: SkillCategory.DATABASE },
    pg: { skill: 'PostgreSQL', category: SkillCategory.DATABASE },
    postgresql: { skill: 'PostgreSQL', category: SkillCategory.DATABASE },
    mysql: { skill: 'MySQL', category: SkillCategory.DATABASE },
    mysql2: { skill: 'MySQL', category: SkillCategory.DATABASE },
    mongodb: { skill: 'MongoDB', category: SkillCategory.DATABASE },
    mongoose: { skill: 'MongoDB', category: SkillCategory.DATABASE },
    redis: { skill: 'Redis', category: SkillCategory.DATABASE },
    ioredis: { skill: 'Redis', category: SkillCategory.DATABASE },
    sqlite: { skill: 'SQL', category: SkillCategory.DATABASE },

    // DevOps & Infrastructure
    docker: { skill: 'Docker', category: SkillCategory.DEVOPS },
    k8s: { skill: 'Kubernetes', category: SkillCategory.DEVOPS },
    kubernetes: { skill: 'Kubernetes', category: SkillCategory.DEVOPS },
    'aws-sdk': { skill: 'AWS', category: SkillCategory.DEVOPS },
    '@aws-sdk': { skill: 'AWS', category: SkillCategory.DEVOPS },
    git: { skill: 'Git', category: SkillCategory.DEVOPS },
    actions: { skill: 'CI/CD', category: SkillCategory.DEVOPS },
    workflow: { skill: 'CI/CD', category: SkillCategory.DEVOPS },
    openshift: { skill: 'OpenShift', category: SkillCategory.DEVOPS },
    tomcat: { skill: 'Tomcat', category: SkillCategory.DEVOPS },
    linux: { skill: 'Linux', category: SkillCategory.DEVOPS },

    // Testing
    jest: { skill: 'Jest', category: SkillCategory.TESTING },
    cypress: { skill: 'Cypress', category: SkillCategory.TESTING },
    playwright: { skill: 'Playwright', category: SkillCategory.TESTING },
    '@playwright/test': { skill: 'Playwright', category: SkillCategory.TESTING },
    postman: { skill: 'Postman', category: SkillCategory.TESTING },
    newman: { skill: 'Postman', category: SkillCategory.TESTING },
    selenium: { skill: 'Selenium', category: SkillCategory.TESTING },

    // Mobile
    'react-native': { skill: 'React Native', category: SkillCategory.MOBILE },
    flutter: { skill: 'Flutter', category: SkillCategory.MOBILE },
  };

  constructor(private prisma: PrismaService) {}

  async syncCandidateGithub(userId: string, username?: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Candidate profile not found');

    let targetUsername = profile.githubUsername;

    if (profile.githubUsername) {
      // Username is permanently locked!
      if (username) {
        const cleanRequested = username.trim().replace(/^@/, '').toLowerCase();
        if (cleanRequested !== profile.githubUsername.toLowerCase()) {
          throw new ForbiddenException(
            `You can only sync your verified GitHub account: @${profile.githubUsername}. Linked accounts are permanently locked.`,
          );
        }
      }
      targetUsername = profile.githubUsername;
    } else {
      // First time binding username
      if (!username || !username.trim()) {
        throw new BadRequestException('GitHub username is required for initial sync.');
      }
      const cleanUsername = username.trim().replace(/^@/, '');
      if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(cleanUsername) || cleanUsername.includes('--')) throw new BadRequestException('ชื่อบัญชี GitHub ไม่ถูกต้อง');

      // Check uniqueness: 1 Account per 1 GitHub!
      const existingUser = await this.prisma.candidateProfile.findUnique({
        where: { githubUsername: cleanUsername },
      });
      if (existingUser && existingUser.id !== profile.id) {
        throw new ConflictException(
          `The GitHub account @${cleanUsername} is already linked to another SmartCareer user.`,
        );
      }

      targetUsername = cleanUsername;
    }

    this.logger.log(`Syncing GitHub profile for verified user: ${targetUsername}`);

    // 1. Fetch repositories
    const repos = await this.fetchUserRepositories(targetUsername);

    // Deduplicate repository context; never infer proficiency.
    const detectedByName = new Map<string, { category: SkillCategory }>();
    for (const repo of repos) {
      for (const detected of repo.detectedSkills) {
        detectedByName.set(detected.skillName, {
          category: detected.category,
        });
      }
    }

    // Commit the complete snapshot atomically. Each skill is updated once, not once per repository.
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!profile.githubUsername) {
          await tx.candidateProfile.update({ where: { id: profile.id }, data: {
            githubUsername: targetUsername, githubConnectedAt: new Date(),
          } });
        }
        await tx.gitHubEvidence.deleteMany({ where: { candidateSkill: { candidateId: profile.id } } });
        await tx.gitHubRepository.deleteMany({ where: {
          candidateId: profile.id, fullName: { notIn: repos.map((repo) => repo.fullName) },
        } });
        const repositoryIds = new Map<string, string>();
        for (const repo of repos) {
          const data = {
            repoName: repo.repoName, description: repo.description, url: repo.url,
            language: repo.language, stargazersCount: repo.stars, forksCount: repo.forks,
            topics: repo.topics, languagesBreakdown: repo.languages,
          };
          const saved = await tx.gitHubRepository.upsert({
            where: { candidateId_fullName: { candidateId: profile.id, fullName: repo.fullName } },
            update: data, create: { ...data, candidateId: profile.id, fullName: repo.fullName },
          });
          repositoryIds.set(repo.fullName, saved.id);
        }
        if (detectedByName.size) {
          await tx.skill.createMany({ skipDuplicates: true, data: [...detectedByName].map(([name, detected]) => ({
            name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), category: detected.category,
          })) });
        }
        const masterSkills = await tx.skill.findMany({ where: { name: { in: [...detectedByName.keys()] } } });
        const candidateSkillIds = new Map<string, string>();
        for (const skill of masterSkills) {
          const data = {};
          const saved = await tx.candidateSkill.upsert({
            where: { candidateId_skillId: { candidateId: profile.id, skillId: skill.id } },
            update: data, create: { ...data, candidateId: profile.id, skillId: skill.id },
          });
          candidateSkillIds.set(skill.name, saved.id);
        }
        const evidence = repos.flatMap(repo => repo.detectedSkills.map(detected => ({
          repositoryId: repositoryIds.get(repo.fullName)!,
          candidateSkillId: candidateSkillIds.get(detected.skillName)!,
          dependencyMatches: [detected.dependency], commitCount: 0, linesOfCode: 0,
          scoreContribution: 0,
        })));
        if (evidence.length) await tx.gitHubEvidence.createMany({ data: evidence });
      }, { timeout: 60000 });
    } catch (error) {
      this.logger.error('GitHub snapshot transaction failed', error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('บันทึกข้อมูล GitHub ไม่สำเร็จ กรุณาลองใหม่ ข้อมูลเดิมยังคงอยู่');
    }

    const synced = await this.prisma.candidateProfile.findUnique({
      where: { id: profile.id },
      include: {
        skills: { include: { skill: true, evidences: { include: { repository: true } } } },
        githubRepos: true,
        assessmentAttempts: { select: skillAttemptSelect },
      },
    });
    return { ...synced, skills: candidateSkillViews(synced?.skills, synced?.assessmentAttempts), assessmentAttempts: undefined };
  }

  private async fetchUserRepositories(username: string): Promise<RepoAnalysisResult[]> {
    const headers: Record<string, string> = { 'User-Agent': 'SmartCareer-App' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    try {
      const repositories: any[] = [];
      for (let page = 1; ; page++) {
        const response = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos`, {
          headers, timeout: 10000, params: { sort: 'updated', per_page: 100, page },
        });
        if (!Array.isArray(response.data)) throw new Error('Invalid GitHub response');
        repositories.push(...response.data);
        if (response.data.length < 100) break;
      }
      const analyzed: RepoAnalysisResult[] = [];
      // Bound concurrency so a large account does not exhaust the provider rate limit.
      for (let index = 0; index < repositories.length; index += 4) {
        analyzed.push(...await Promise.all(repositories.slice(index, index + 4).map(repo => this.analyzeRepoData(repo, headers))));
      }
      return analyzed;
    } catch (error: any) {
      if (error.response?.status === 404) throw new NotFoundException('ไม่พบบัญชี GitHub นี้');
      throw new ServiceUnavailableException('ดึงข้อมูล GitHub ไม่สำเร็จ กรุณาลองใหม่ ข้อมูลเดิมยังคงอยู่');
    }
  }

  private async analyzeRepoData(repo: any, headers: Record<string, string>): Promise<RepoAnalysisResult> {
    const detectedSkills: RepoAnalysisResult['detectedSkills'] = [];
    const language = repo.language ?? '';

    // 1. Fetch real language breakdown from GitHub API
    let realLanguages: Record<string, number> = {};
    const languageCategoryMap: Record<string, { skill: string; category: SkillCategory }> = {
      TypeScript: { skill: 'TypeScript', category: SkillCategory.FRONTEND },
      JavaScript: { skill: 'JavaScript', category: SkillCategory.FRONTEND },
      HTML: { skill: 'HTML5', category: SkillCategory.FRONTEND },
      CSS: { skill: 'CSS3', category: SkillCategory.FRONTEND },
      SCSS: { skill: 'CSS3', category: SkillCategory.FRONTEND },
      Sass: { skill: 'CSS3', category: SkillCategory.FRONTEND },
      Less: { skill: 'CSS3', category: SkillCategory.FRONTEND },
      Python: { skill: 'Python', category: SkillCategory.BACKEND },
      Java: { skill: 'Java', category: SkillCategory.BACKEND },
      Go: { skill: 'Go', category: SkillCategory.BACKEND },
      'C#': { skill: 'C#', category: SkillCategory.BACKEND },
      PHP: { skill: 'PHP', category: SkillCategory.BACKEND },
      Shell: { skill: 'Linux', category: SkillCategory.DEVOPS },
      Bash: { skill: 'Linux', category: SkillCategory.DEVOPS },
      Dart: { skill: 'Flutter', category: SkillCategory.MOBILE },
      Dockerfile: { skill: 'Docker', category: SkillCategory.DEVOPS },
    };

    try {
      const langRes = await axios.get(repo.languages_url, { headers, timeout: 3000 });
      realLanguages = langRes.data || {};
      for (const [langName] of Object.entries(realLanguages)) {
        const mapped = languageCategoryMap[langName];
        if (mapped && !detectedSkills.some((ds) => ds.skillName === mapped.skill)) {
          detectedSkills.push({
            skillName: mapped.skill,
            category: mapped.category,
            dependency: langName.toLowerCase(),
            evidenceType: "LANGUAGE",
          });
        }
      }
    } catch (error: any) {
      throw error; // A partial snapshot must not replace existing evidence.
    }

    // 2. Read package.json dependency hints; presence does not prove use or proficiency.
    try {
      const defaultBranch = repo.default_branch || 'main';
      const rawPkgUrl = `https://raw.githubusercontent.com/${repo.full_name}/${defaultBranch}/package.json`;
      const pkgRes = await axios.get(rawPkgUrl, { timeout: 3000 });
      if (pkgRes.data && typeof pkgRes.data === 'object') {
        const allDeps = {
          ...(pkgRes.data.dependencies || {}),
          ...(pkgRes.data.devDependencies || {}),
        };
        for (const [depName] of Object.entries(allDeps)) {
          for (const [key, mapping] of Object.entries(this.dependencyMapping)) {
            if (depName.toLowerCase().includes(key)) {
              detectedSkills.push({
                skillName: mapping.skill,
                category: mapping.category,
                dependency: depName,
                evidenceType: "DEPENDENCY",
              });
            }
          }
        }
      }
    } catch (error: any) {
      if (error.response?.status !== 404) throw error;
    }

    // Repository name, description, topics and size are not skill evidence.
    // A detected testing dependency also hints at Automated Testing, not proficiency.
    const hasTesting = detectedSkills.some((ds) =>
      ['Jest', 'Cypress', 'Playwright', 'Selenium'].includes(ds.skillName),
    );
    if (hasTesting && !detectedSkills.some((ds) => ds.skillName === 'Automated Testing')) {
      detectedSkills.push({
        skillName: 'Automated Testing',
        category: SkillCategory.TESTING,
        dependency: 'automated-test-suite',
        evidenceType: "DEPENDENCY",
      });
    }

    return {
      repoName: repo.name,
      fullName: repo.full_name || `${repo.owner?.login || 'user'}/${repo.name}`,
      description: repo.description ?? '',
      url: repo.html_url || `https://github.com/${repo.full_name}`,
      language,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count || 0,
      topics: repo.topics ?? [],
      languages: realLanguages,
      detectedSkills,
    };
  }

  async publicAnalyze(username: string) {
    const cleanUsername = (username || '').trim().replace(/^@/, '');
    if (!cleanUsername) {
      throw new BadRequestException('GitHub username is required');
    }

    let profileData = {
      username: cleanUsername,
      name: cleanUsername,
      avatarUrl: `https://github.com/${cleanUsername}.png`,
      htmlUrl: `https://github.com/${cleanUsername}`,
      publicRepos: 0,
      followers: 0,
      following: 0,
      isLive: false,
    };

    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'SmartCareer-App',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      const userRes = await axios.get(`https://api.github.com/users/${cleanUsername}`, {
        headers,
        timeout: 5000,
      });
      if (userRes.data) {
        profileData = {
          username: userRes.data.login || cleanUsername,
          name: userRes.data.name || cleanUsername,
          avatarUrl: userRes.data.avatar_url || `https://github.com/${cleanUsername}.png`,
          htmlUrl: userRes.data.html_url || `https://github.com/${cleanUsername}`,
          publicRepos: userRes.data.public_repos ?? 0,
          followers: userRes.data.followers ?? 0,
          following: userRes.data.following ?? 0,
          isLive: true,
        };
      }
    } catch (err: any) {
      if (err.response?.status === 404) throw new NotFoundException('ไม่พบบัญชี GitHub นี้');
      throw new ServiceUnavailableException('ดึงข้อมูล GitHub ไม่สำเร็จ กรุณาลองใหม่');
    }

    // Fetch user repos (analyzed with detectedSkills)
    const repos = await this.fetchUserRepositories(cleanUsername);

    if (profileData.publicRepos === 0) {
      profileData.publicRepos = repos.length;
    }

    // Repository context only. Public analysis cannot know assessed proficiency or career fit.
    const detectedSkills = [...new Set(repos.flatMap(repo => repo.detectedSkills.map(s => s.skillName)))];

    // Top repositories (up to 4)
    const topRepositories = repos.slice(0, 4).map((r) => ({
      name: r.repoName,
      fullName: r.fullName,
      url: r.url,
      language: r.language,
      languages: r.languages,
      languageComposition: Object.entries(r.languages).map(([language, bytes]) => ({
        language, bytes, repositoryCodePercentage: Object.values(r.languages).reduce((a, b) => a + b, 0) > 0
          ? bytes / Object.values(r.languages).reduce((a, b) => a + b, 0) * 100 : null,
      })),
      tags: [
        ...(r.language ? [r.language] : []),
        ...(r.topics || []).slice(0, 2),
      ].slice(0, 3),
      stars: r.stars,
    }));

    return {
      profile: profileData,
      detectedSkills,
      assessmentStatus: "NOT_ASSESSED",
      topSkillChips: [],
      radar: [],
      recommendedRoles: [],
      topRepositories,
    };
  }
}
