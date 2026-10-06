import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { execSync } from 'child_process';
import { SkillCategory } from '@smartcareer/shared';

export interface ExtractedSkill {
  name: string;
  category: SkillCategory;
  isRequired: boolean;
  minimumScore: number;
}

export interface DetailedJobInfo {
  title?: string;
  description?: string;
  requirements?: string;
  company?: string;
  logoUrl?: string;
  benefits?: string;
  salaryMin?: number;
  salaryMax?: number;
}

@Injectable()
export class GeminiExtractorService {
  private readonly logger = new Logger(GeminiExtractorService.name);

  // =========================================================================
  // 1. EXTRACT REAL JOB DETAILS FROM PLATFORM PAGES
  // =========================================================================

  /**
   * Scrapes full job description, qualifications, and real company details
   * from original job listing URLs (e.g. JobThai, JobsDB, Blognone).
   */
  async fetchDeepJobDetails(source: string, url: string, fallback: Partial<DetailedJobInfo> = {}): Promise<DetailedJobInfo> {
    if (!url) {
      return {
        description: fallback.description || '',
        requirements: fallback.requirements || '',
        company: fallback.company,
        logoUrl: fallback.logoUrl,
        benefits: fallback.benefits,
      };
    }

    try {
      if (source === 'JOBTHAI' && url.includes('jobthai.com')) {
        const details = this.scrapeJobThaiDeepDetail(url);
        if (details) return { ...fallback, ...details };
      } else if (source === 'BLOGNONE' && url.includes('blognone.com')) {
        const details = this.scrapeBlognoneDeepDetail(url);
        if (details) return { ...fallback, ...details };
      }
    } catch (err: any) {
      this.logger.warn(`[Deep Detail] Could not scrape full details for ${url}: ${err.message}`);
    }

    return {
      description: fallback.description || '',
      requirements: fallback.requirements || '',
      company: fallback.company,
      logoUrl: fallback.logoUrl,
      benefits: fallback.benefits,
    };
  }

  /**
   * JobThai deep scraper: Extracts Google Schema.org JobPosting JSON-LD
   * embedded inside Next.js App Router RSC stream.
   */
  private scrapeJobThaiDeepDetail(url: string): Partial<DetailedJobInfo> | null {
    try {
      const html = execSync(
        `curl.exe -s -L "${url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"`,
        { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' },
      );

      // 1. Look for Schema.org JobPosting in Next.js RSC stream or script
      const idx = html.indexOf('JobPosting');
      if (idx !== -1) {
        const start = html.lastIndexOf('{\\"@context\\"', idx);
        if (start !== -1) {
          let sub = html.slice(start, start + 4000);
          sub = sub.replace(/\\"/g, '"');
          sub = sub.replace(/[\u0000-\u001F]+/g, (c) => (c === '\n' ? '\\n' : c === '\r' ? '' : ' '));

          let depth = 0;
          let endIdx = -1;
          for (let i = 0; i < sub.length; i++) {
            if (sub[i] === '{') depth++;
            else if (sub[i] === '}') {
              depth--;
              if (depth === 0) {
                endIdx = i;
                break;
              }
            }
          }

          if (endIdx !== -1) {
            try {
              const jp = JSON.parse(sub.slice(0, endIdx + 1));
              return {
                title: jp.title,
                description: jp.description ? jp.description.replace(/\\n/g, '\n').trim() : undefined,
                requirements: jp.qualifications ? jp.qualifications.replace(/\\n/g, '\n').trim() : undefined,
                company: jp.hiringOrganization?.name || undefined,
                logoUrl: jp.hiringOrganization?.logo || undefined,
                benefits: jp.jobBenefits || undefined,
              };
            } catch (err: any) {
              this.logger.debug(`RSC JSON parse error: ${err.message}`);
            }
          }
        }
      }

      // 2. Direct DOM Cheerio fallback
      const $ = cheerio.load(html);
      const ldJsonText = $('script[type="application/ld+json"]').text();
      if (ldJsonText) {
        try {
          const ld = JSON.parse(ldJsonText);
          if (ld['@type'] === 'JobPosting') {
            return {
              description: ld.description,
              requirements: ld.qualifications,
              company: ld.hiringOrganization?.name,
              logoUrl: ld.hiringOrganization?.logo,
              benefits: ld.jobBenefits,
            };
          }
        } catch (e) {}
      }

      const descriptions: string[] = [];
      $('.render-html-editor').each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 30) descriptions.push(t);
      });

      if (descriptions.length > 0) {
        return {
          description: descriptions[0],
          requirements: descriptions.length > 1 ? descriptions[1] : undefined,
        };
      }
    } catch (err: any) {
      this.logger.debug(`JobThai deep extract failed: ${err.message}`);
    }
    return null;
  }

  /**
   * Blognone deep scraper
   */
  private scrapeBlognoneDeepDetail(url: string): Partial<DetailedJobInfo> | null {
    try {
      const html = execSync(
        `curl.exe -s -L "${url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`,
        { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' },
      );
      const $ = cheerio.load(html);
      const desc = $('article, .job-description, .content').text().trim();
      if (desc && desc.length > 50) {
        return {
          description: desc.slice(0, 1500),
          requirements: desc.slice(0, 1000),
        };
      }
    } catch (e) {}
    return null;
  }

  // =========================================================================
  // 2. GEMINI 1.5 FLASH AI SKILL EXTRACTION
  // =========================================================================

  /**
   * Analyzes job content using Gemini 1.5 Flash.
   * If GEMINI_API_KEY is not available, gracefully falls back to Rule-Based Extractor.
   */
  async extractSkills(
    title: string,
    description: string,
    requirements?: string,
  ): Promise<ExtractedSkill[]> {
    const ruleSkills = this.fallbackRuleBasedExtractor(title, description, requirements);
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (apiKey) {
      try {
        const suggestedSkills = await this.callGeminiFlash(apiKey, title, description, requirements);
        const text = `${title} ${description || ''} ${requirements || ''}`;
        const explicitNames = new Set(ruleSkills.map((skill) => skill.name.toLowerCase()));
        const aiSkills = suggestedSkills.filter((skill) => {
          const name = skill.name.trim();
          if (!name) return false;
          if (explicitNames.has(name.toLowerCase())) return true;
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text);
        });
        if (aiSkills && aiSkills.length > 0) {
          this.logger.log(`[Gemini 1.5 Flash] Successfully extracted ${aiSkills.length} skills for '${title}'`);
          return aiSkills;
        }
      } catch (err: any) {
        this.logger.warn(`[Gemini 1.5 Flash] Extraction failed (${err.message}). Falling back to Smart Rule-Based Engine.`);
      }
    } else {
      this.logger.debug(`[Skill Extractor] No GEMINI_API_KEY configured. Using Smart Rule-Based Engine.`);
    }

    return ruleSkills;
  }

  /**
   * Native REST call to Google Gemini 1.5 Flash with JSON Schema response enforcement.
   */
  private async callGeminiFlash(
    apiKey: string,
    title: string,
    description: string,
    requirements?: string,
  ): Promise<ExtractedSkill[]> {
    const candidateModels = [
      'gemma-4-26b-a4b-it',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];

    const prompt = `You are an expert AI Tech Recruiter and Technical Lead.
Analyze the following tech job opening:
- Job Title: ${title}
- Job Description: ${description}
- Qualifications & Requirements: ${requirements || 'N/A'}

Task:
Extract ALL technical skills, tools, programming languages, frameworks, libraries, protocols (e.g. REST APIs), databases, and platforms mentioned in this job posting.
Use only technologies explicitly named in the supplied text. Never infer a technology from the job title, employer, or a typical stack. Return [] when no technologies are named.
Do NOT skip any technologies even if they appear briefly, in benefits, or inside list items.
Include items such as: CSS/CSS3, HTML5, JavaScript, TypeScript, React, Angular, Vue, Redux, RxJS, REST APIs, Node.js, Spring Boot, Java, Python, Go, Docker, Kubernetes, Linux, Git, OpenShift, CI/CD, Postman, etc.

For each skill:
- "name": Canonical official skill name (e.g. "React", "REST APIs", "CSS3", "HTML5", "Angular", "JavaScript", "Redux", "Postman", "Spring Boot", "Git", "Linux", "OpenShift", "CI/CD").
- "category": Must be exactly one of: "FRONTEND", "BACKEND", "DATABASE", "DEVOPS", "TESTING", "MOBILE", "AI_ML", "SECURITY".
- "isRequired": boolean (true if mandatory / essential / core requirement; false if optional / nice-to-have / bonus / a plus).
- "minimumScore": number (expected minimum proficiency score between 50 and 85).

Return ONLY a valid JSON array of objects.`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    let lastError: any = null;
    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await axios.post(endpoint, body, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 12000,
        });

        const candidateText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) continue;

        // Clean any potential markdown fences
        const cleanText = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const rawSkills = JSON.parse(cleanText);
        if (!Array.isArray(rawSkills)) continue;

        return rawSkills
          .filter((s) => s && s.name && typeof s.name === 'string')
          .map((s) => ({
            name: s.name.trim(),
            category: this.normalizeCategory(s.category),
            isRequired: Boolean(s.isRequired),
            minimumScore: Math.min(95, Math.max(50, Number(s.minimumScore) || 70)),
          }));
      } catch (err: any) {
        lastError = err;
        // Continue to try next candidate model
      }
    }

    throw lastError || new Error('All candidate Gemini models failed');
  }

  private normalizeCategory(cat: string): SkillCategory {
    const upper = String(cat || '').toUpperCase();
    if (Object.values(SkillCategory).includes(upper as SkillCategory)) {
      return upper as SkillCategory;
    }
    if (/TEST|QA|QUALITY/i.test(upper)) return SkillCategory.TESTING;
    if (/FRONT|UI|UX|WEB|STYLE|DESIGN/i.test(upper)) return SkillCategory.FRONTEND;
    if (/DATA|SQL|DB/i.test(upper)) return SkillCategory.DATABASE;
    if (/CLOUD|OPS|DOCKER|K8S|INFRA|SERVER|SYS/i.test(upper)) return SkillCategory.DEVOPS;
    if (/MOBILE|IOS|ANDROID/i.test(upper)) return SkillCategory.MOBILE;
    if (/AI|ML|LEARNING/i.test(upper)) return SkillCategory.AI_ML;
    if (/SEC|CYBER/i.test(upper)) return SkillCategory.SECURITY;
    return SkillCategory.BACKEND;
  }

  // =========================================================================
  // 3. ROBUST FALLBACK RULE-BASED EXTRACTOR
  // =========================================================================
  private fallbackRuleBasedExtractor(
    title: string,
    description: string,
    requirements?: string,
  ): ExtractedSkill[] {
    const text = `${title} ${description || ''} ${requirements || ''}`.toLowerCase();
    const skillsMap = new Map<string, ExtractedSkill>();

    const rules: Array<{ name: string; category: SkillCategory; regex: RegExp; isReq?: boolean; minScore?: number }> = [
      // Frontend
      { name: 'React', category: SkillCategory.FRONTEND, regex: /\b(react|react\.js|reactjs)\b/i },
      { name: 'Next.js', category: SkillCategory.FRONTEND, regex: /\b(next|next\.js|nextjs)\b/i },
      { name: 'JavaScript', category: SkillCategory.FRONTEND, regex: /\b(javascript|js|es6|es5|jsx)\b/i },
      { name: 'TypeScript', category: SkillCategory.FRONTEND, regex: /\b(typescript|ts)\b/i },
      { name: 'HTML5', category: SkillCategory.FRONTEND, regex: /\b(html|html5)\b/i },
      { name: 'CSS3', category: SkillCategory.FRONTEND, regex: /\b(css|css3|css libraries)\b/i },
      { name: 'Tailwind CSS', category: SkillCategory.FRONTEND, regex: /\b(tailwind|tailwindcss)\b/i },
      { name: 'Bootstrap', category: SkillCategory.FRONTEND, regex: /\b(bootstrap)\b/i },
      { name: 'Angular', category: SkillCategory.FRONTEND, regex: /\b(angular|angular 2|angular 2\.0)\b/i },
      { name: 'Vue.js', category: SkillCategory.FRONTEND, regex: /\b(vue|vue\.js|vuejs|nuxt)\b/i },
      { name: 'Redux', category: SkillCategory.FRONTEND, regex: /\b(redux|flux)\b/i },
      { name: 'RxJS', category: SkillCategory.FRONTEND, regex: /\b(rxjs)\b/i },
      { name: 'Adobe XD', category: SkillCategory.FRONTEND, regex: /\b(adobe xd)\b/i },
      { name: 'Figma', category: SkillCategory.FRONTEND, regex: /\b(figma)\b/i },

      // Backend & APIs
      { name: 'Node.js', category: SkillCategory.BACKEND, regex: /\b(node|node\.js|nodejs)\b/i },
      { name: 'NestJS', category: SkillCategory.BACKEND, regex: /\b(nest|nestjs)\b/i },
      { name: 'REST APIs', category: SkillCategory.BACKEND, regex: /\b(rest api|rest apis|restful|restful api|restful apis)\b/i },
      { name: 'GraphQL', category: SkillCategory.BACKEND, regex: /\b(graphql)\b/i },
      { name: 'Python', category: SkillCategory.BACKEND, regex: /\b(python|django|fastapi|flask)\b/i },
      { name: 'Java', category: SkillCategory.BACKEND, regex: /\b(java)\b/i },
      { name: 'Spring Boot', category: SkillCategory.BACKEND, regex: /\b(spring boot|spring technologies|spring framework)\b/i },
      { name: 'Go', category: SkillCategory.BACKEND, regex: /\b(golang|\bgo\b)\b/i },
      { name: 'C#', category: SkillCategory.BACKEND, regex: /\b(c#|\.net|dotnet|asp\.net)\b/i },
      { name: 'PHP', category: SkillCategory.BACKEND, regex: /\b(php|laravel)\b/i },

      // Database
      { name: 'PostgreSQL', category: SkillCategory.DATABASE, regex: /\b(postgres|postgresql)\b/i },
      { name: 'MySQL', category: SkillCategory.DATABASE, regex: /\b(mysql)\b/i },
      { name: 'MongoDB', category: SkillCategory.DATABASE, regex: /\b(mongo|mongodb)\b/i },
      { name: 'Redis', category: SkillCategory.DATABASE, regex: /\b(redis|cache)\b/i },
      { name: 'SQL', category: SkillCategory.DATABASE, regex: /\b(sql|database|rdbms)\b/i },

      // DevOps & Infrastructure
      { name: 'Docker', category: SkillCategory.DEVOPS, regex: /\b(docker|container|containers)\b/i },
      { name: 'Kubernetes', category: SkillCategory.DEVOPS, regex: /\b(kubernetes|k8s)\b/i },
      { name: 'AWS', category: SkillCategory.DEVOPS, regex: /\b(aws|amazon web services)\b/i },
      { name: 'Git', category: SkillCategory.DEVOPS, regex: /\b(git|github|gitlab)\b/i },
      { name: 'CI/CD', category: SkillCategory.DEVOPS, regex: /\b(ci\/cd|continuous integration|continuous development)\b/i },
      { name: 'Linux', category: SkillCategory.DEVOPS, regex: /\b(linux)\b/i },
      { name: 'OpenShift', category: SkillCategory.DEVOPS, regex: /\b(openshift|redhat openshift)\b/i },
      { name: 'Tomcat', category: SkillCategory.DEVOPS, regex: /\b(tomcat)\b/i },

      // Testing & QA
      { name: 'Postman', category: SkillCategory.TESTING, regex: /\b(postman|api test|api testing)\b/i },
      { name: 'Selenium', category: SkillCategory.TESTING, regex: /\b(selenium)\b/i },
      { name: 'Playwright', category: SkillCategory.TESTING, regex: /\b(playwright)\b/i },
      { name: 'Cypress', category: SkillCategory.TESTING, regex: /\b(cypress)\b/i },
      { name: 'Jest', category: SkillCategory.TESTING, regex: /\b(jest|unit test)\b/i },
      { name: 'Automated Testing', category: SkillCategory.TESTING, regex: /\b(automation test|automated test|automation testing)\b/i },
      { name: 'Manual Testing', category: SkillCategory.TESTING, regex: /\b(manual test|manual testing)\b/i },

      // Mobile
      { name: 'Flutter', category: SkillCategory.MOBILE, regex: /\b(flutter)\b/i },
      { name: 'React Native', category: SkillCategory.MOBILE, regex: /\b(react native)\b/i },
    ];

    for (const r of rules) {
      if (r.regex.test(text)) {
        skillsMap.set(r.name, {
          name: r.name,
          category: r.category,
          isRequired: r.isReq !== undefined ? r.isReq : true,
          minimumScore: r.minScore || 70,
        });
      }
    }

    return Array.from(skillsMap.values());
  }
}
