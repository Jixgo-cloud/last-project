import { Injectable, Logger, ForbiddenException, ConflictException, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { SkillCategory } from '@smartcareer/shared';

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
    scoreWeight: number;
  }>;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  // Comprehensive mapping from package names & keywords to standardized skill names
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

    // Commit only after the complete remote snapshot has been fetched successfully.
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
    // 2. Process and save repositories & evidences
    for (const repo of repos) {
      const dbRepo = await tx.gitHubRepository.upsert({
        where: {
          candidateId_fullName: {
            candidateId: profile.id,
            fullName: repo.fullName,
          },
        },
        update: {
          repoName: repo.repoName,
          description: repo.description,
          url: repo.url,
          language: repo.language,
          stargazersCount: repo.stars,
          forksCount: repo.forks,
          topics: repo.topics,
          languagesBreakdown: repo.languages,
        },
        create: {
          candidateId: profile.id,
          repoName: repo.repoName,
          fullName: repo.fullName,
          description: repo.description,
          url: repo.url,
          language: repo.language,
          stargazersCount: repo.stars,
          forksCount: repo.forks,
          topics: repo.topics,
          languagesBreakdown: repo.languages,
        },
      });

      // Map detected skills
      for (const detected of repo.detectedSkills) {
        // Ensure skill exists in master table
        const skill = await tx.skill.upsert({
          where: { name: detected.skillName },
          update: {},
          create: {
            name: detected.skillName,
            slug: detected.skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category: detected.category,
          },
        });

        // Upsert candidate skill with practical score calculation
        const candidateSkill = await tx.candidateSkill.upsert({
          where: {
            candidateId_skillId: {
              candidateId: profile.id,
              skillId: skill.id,
            },
          },
          update: {
            practicalScore: Math.min(95, Math.max(50, 60 + repo.stars * 5 + detected.scoreWeight)),
          },
          create: {
            candidateId: profile.id,
            skillId: skill.id,
            practicalScore: Math.min(95, Math.max(50, 60 + repo.stars * 5 + detected.scoreWeight)),
          },
        });

        // Calculate verified score
        const verifiedScore = Math.round(
          candidateSkill.practicalScore * 0.5 +
            candidateSkill.theoryScore * 0.2 +
            candidateSkill.codingScore * 0.3,
        );

        await tx.candidateSkill.update({
          where: { id: candidateSkill.id },
          data: {
            verifiedScore,
            isVerified: verifiedScore >= 60,
          },
        });

        // Avoid duplicate evidence accumulation on re-sync
        await tx.gitHubEvidence.deleteMany({
          where: {
            candidateSkillId: candidateSkill.id,
            repositoryId: dbRepo.id,
          },
        });

        // Create Evidence
        await tx.gitHubEvidence.create({
          data: {
            candidateSkillId: candidateSkill.id,
            repositoryId: dbRepo.id,
            dependencyMatches: [detected.dependency],
            commitCount: 0,
            linesOfCode: 0,
            scoreContribution: detected.scoreWeight,
          },
        });
      }
    }

      // Remove stale practical contributions while preserving quiz/code history.
      const skills = await tx.candidateSkill.findMany({ where: { candidateId: profile.id }, include: { evidences: true } });
      for (const skill of skills) {
        if (skill.evidences.length === 0) {
          const verifiedScore = Math.round(skill.theoryScore * 0.2 + skill.codingScore * 0.3);
          await tx.candidateSkill.update({ where: { id: skill.id }, data: { practicalScore: 0, verifiedScore, isVerified: verifiedScore >= 60 } });
        }
      }
    }, { timeout: 60000 });

    return this.prisma.candidateProfile.findUnique({
      where: { id: profile.id },
      include: {
        skills: { include: { skill: true, evidences: { include: { repository: true } } } },
        githubRepos: true,
      },
    });
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
            scoreWeight: 25,
          });
        }
      }
    } catch (error: any) {
      throw error; // A partial snapshot must not replace existing evidence.
    }

    // Every GitHub repo intrinsically proves Git version control competence
    if (repo.size > 0 && !detectedSkills.some((ds) => ds.skillName === 'Git')) {
      detectedSkills.push({
        skillName: 'Git',
        category: SkillCategory.DEVOPS,
        dependency: 'git',
        scoreWeight: 20,
      });
    }

    // 2. Fetch real package.json dependencies from raw.githubusercontent.com
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
                scoreWeight: 20,
              });
            }
          }
        }
      }
    } catch (error: any) {
      if (error.response?.status !== 404) throw error;
    }

    // 3. Inspect topics or repo name for frameworks
    const keywords = [...(repo.topics || []), repo.name.toLowerCase(), (repo.description || '').toLowerCase()];
    for (const [key, mapping] of Object.entries(this.dependencyMapping)) {
      if (keywords.some((k) => k.includes(key))) {
        if (!detectedSkills.some((ds) => ds.skillName === mapping.skill)) {
          detectedSkills.push({
            skillName: mapping.skill,
            category: mapping.category,
            dependency: key,
            scoreWeight: 20,
          });
        }
      }
    }

    // If any testing framework is detected, also credit Automated Testing
    const hasTesting = detectedSkills.some((ds) =>
      ['Jest', 'Cypress', 'Playwright', 'Selenium'].includes(ds.skillName),
    );
    if (hasTesting && !detectedSkills.some((ds) => ds.skillName === 'Automated Testing')) {
      detectedSkills.push({
        skillName: 'Automated Testing',
        category: SkillCategory.TESTING,
        dependency: 'automated-test-suite',
        scoreWeight: 20,
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

    // Aggregate skill frequencies & weights
    const skillCountMap = new Map<string, { count: number; category: SkillCategory; totalWeight: number }>();
    for (const repo of repos) {
      for (const ds of repo.detectedSkills) {
        const existing = skillCountMap.get(ds.skillName) || { count: 0, category: ds.category, totalWeight: 0 };
        existing.count += 1;
        existing.totalWeight += ds.scoreWeight;
        skillCountMap.set(ds.skillName, existing);
      }
    }

    // Calculate Competency Distribution across 5 core categories
    const categories = [
      SkillCategory.FRONTEND,
      SkillCategory.BACKEND,
      SkillCategory.DATABASE,
      SkillCategory.DEVOPS,
      SkillCategory.TESTING,
    ];

    const radar = categories.map((cat) => {
      const skillsInCat = Array.from(skillCountMap.entries()).filter(
        ([_, data]) => data.category === cat,
      );

      if (skillsInCat.length === 0) {
        return {
          category: cat,
          subject: cat,
          score: 0,
          fullMark: 100,
        };
      }

      const totalScore = skillsInCat.reduce((acc, [_, d]) => acc + d.totalWeight + d.count * 12, 0);
      const avgScore = Math.min(95, Math.max(45, Math.round(50 + totalScore / (skillsInCat.length * 1.5))));

      return {
        category: cat,
        subject: cat,
        score: avgScore,
        fullMark: 100,
      };
    });

    // Top Competency percentage chips
    const topSkillChips = radar
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((r) => ({
        name: r.category.charAt(0) + r.category.slice(1).toLowerCase(),
        percentage: `${r.score}%`,
      }));

    // Detect roles matching
    const detectedSkillNames = new Set(
      Array.from(skillCountMap.keys()).map((k) => k.toLowerCase()),
    );
    const checkFit = (reqs: string[]) => {
      const matchCount = reqs.filter((r) => detectedSkillNames.has(r.toLowerCase())).length;
      if (matchCount >= 3) return 'Strong';
      if (matchCount >= 2) return 'Good fit';
      return 'Possible';
    };

    const recommendedRoles = [
      {
        role: 'Full-Stack Developer',
        skills: ['React', 'Node.js', 'TypeScript', 'Next.js'],
        fitLevel: checkFit(['React', 'Node.js', 'TypeScript', 'Next.js']) as 'Strong' | 'Good fit' | 'Possible',
      },
      {
        role: 'Frontend Developer',
        skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
        fitLevel: checkFit(['React', 'TypeScript', 'Next.js', 'Tailwind CSS']) as 'Strong' | 'Good fit' | 'Possible',
      },
      {
        role: 'Backend Developer',
        skills: ['Node.js', 'Prisma'],
        fitLevel: checkFit(['Node.js', 'Prisma', 'PostgreSQL']) as 'Strong' | 'Good fit' | 'Possible',
      },
      {
        role: 'Mobile Developer',
        skills: ['React'],
        fitLevel: checkFit(['React Native', 'Flutter', 'React']) as 'Strong' | 'Good fit' | 'Possible',
      },
    ];

    // Top repositories (up to 4)
    const topRepositories = repos.slice(0, 4).map((r) => ({
      name: r.repoName,
      fullName: r.fullName,
      url: r.url,
      language: r.language,
      tags: [
        ...(r.language ? [r.language] : []),
        ...(r.topics || []).slice(0, 2),
      ].slice(0, 3),
      stars: r.stars,
    }));

    return {
      profile: profileData,
      topSkillChips,
      radar,
      recommendedRoles,
      topRepositories,
    };
  }
}
