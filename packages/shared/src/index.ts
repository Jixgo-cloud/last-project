// User & Role Types
export enum UserRole {
  CANDIDATE = 'CANDIDATE',
  COMPANY = 'COMPANY',
  ADMIN = 'ADMIN'
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB'
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  REVIEWING = 'REVIEWING',
  INTERVIEW = 'INTERVIEW',
  TECHNICAL_TEST = 'TECHNICAL_TEST',
  OFFER = 'OFFER',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum AssessmentType {
  THEORY = 'THEORY',
  PRACTICAL_CODING = 'PRACTICAL_CODING'
}

export enum QuestionEvaluationMethod {
  AUTOMATED_TEST_CASES = 'AUTOMATED_TEST_CASES',
  OPEN_ENDED = 'OPEN_ENDED'
}

export enum AssessmentReviewStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING_HUMAN_REVIEW = 'PENDING_HUMAN_REVIEW',
  HUMAN_REVIEWED = 'HUMAN_REVIEWED',
  EVALUATION_PENDING = 'EVALUATION_PENDING',
  EVALUATION_FAILED = 'EVALUATION_FAILED'
}

export enum FeedbackVisibility {
  IMMEDIATE = 'IMMEDIATE',
  AFTER_REVIEW = 'AFTER_REVIEW',
  PRIVATE_TO_COMPANY = 'PRIVATE_TO_COMPANY'
}

export interface AiEvaluationRubricBreakdown {
  functionalCorrectness: {
    score: number; // 0-100
    weight: number; // 0.40
    feedback: string;
  };
  codeQuality: {
    score: number; // 0-100
    weight: number; // 0.25
    feedback: string;
  };
  algorithmEfficiency: {
    score: number; // 0-100
    weight: number; // 0.20
    feedback: string;
  };
  errorHandlingEdgeCases: {
    score: number; // 0-100
    weight: number; // 0.15
    feedback: string;
  };
}

export interface AiEvaluationResult {
  rubricBreakdown: AiEvaluationRubricBreakdown;
  overallScore: number; // 0-100 weighted
  summaryReview: string;
  strengths: string[];
  improvements: string[];
  detectedAntiPatterns?: string[];
  confidenceScore: number; // 0.0 - 1.0
}

export interface OverrideScoreDTO {
  humanScore: number;
  reviewReason: string;
}

export enum AttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTING = 'SUBMITTING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

export enum QuestionDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum JobSource {
  INTERNAL = 'INTERNAL',
  JSEARCH = 'JSEARCH',
  REMOTIVE = 'REMOTIVE',
  BLOGNONE = 'BLOGNONE',
  JOBTHAI = 'JOBTHAI',
  JOBSDB = 'JOBSDB'
}

export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  REMOTE = 'REMOTE'
}

export enum CourseSource {
  UDEMY = 'UDEMY',
  YOUTUBE = 'YOUTUBE'
}

export enum IngestionStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  FAILED = 'FAILED'
}

export enum SkillCategory {
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  DATABASE = 'DATABASE',
  DEVOPS = 'DEVOPS',
  TESTING = 'TESTING',
  MOBILE = 'MOBILE',
  AI_ML = 'AI_ML',
  SECURITY = 'SECURITY'
}

export enum CareerTrack {
  FULL_STACK = 'FULL_STACK',
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  DEVOPS = 'DEVOPS',
  DATA_AI = 'DATA_AI',
  MOBILE = 'MOBILE',
  TESTING = 'TESTING',
  SECURITY = 'SECURITY',
}

export const CAREER_TRACK_LABELS: Record<CareerTrack, string> = {
  [CareerTrack.FULL_STACK]: 'Full Stack Developer',
  [CareerTrack.FRONTEND]: 'Frontend Developer',
  [CareerTrack.BACKEND]: 'Backend Developer',
  [CareerTrack.DEVOPS]: 'DevOps & Cloud',
  [CareerTrack.DATA_AI]: 'Data & AI / Machine Learning',
  [CareerTrack.MOBILE]: 'Mobile Developer',
  [CareerTrack.TESTING]: 'QA & Software Tester',
  [CareerTrack.SECURITY]: 'Cybersecurity',
};

// Data Transfer Interfaces
export interface AuthUserResponse {
  id: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  candidateProfile?: {
    id: string;
    fullName: string;
    targetCareer: string | null;
    githubUsername: string | null;
  } | null;
  company?: {
    id: string;
    name: string;
    verificationStatus: VerificationStatus;
  } | null;
  token: string;
}

export interface SkillScoreSummary {
  skillId: string;
  name: string;
  category: SkillCategory;
  practicalScore: number; // 0-100 (GitHub)
  theoryScore: number;    // 0-100 (MCQ Assessment)
  codingScore: number;    // 0-100 (Judge0 Coding)
  verifiedScore: number;  // Combined
  isVerified: boolean;
}

export interface RadarChartDataPoint {
  category: SkillCategory;
  subject: string;
  score: number;
  fullMark: number;
}

export interface MatchScoreResult {
  jobId: string;
  matchScore: number; // 0-100
  requiredCoverage: number; // %
  preferredCoverage: number; // %
  careerAlignment: number; // %
  verifiedBadgesCount?: number;
  matchedSkills: Array<{
    skillId: string;
    name: string;
    userScore: number;
    requiredScore: number;
    isVerified?: boolean;
  }>;
  missingSkills: Array<{
    skillId: string;
    name: string;
    requiredScore: number;
    userScore: number;
  }>;
}

export interface SkillGapItem {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  requiredLevel: number;
  currentLevel: number;
  gap: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedCourses: Array<{
    id: string;
    title: string;
    provider: CourseSource;
    url: string;
    thumbnail: string | null;
    level: string;
  }>;
}

export interface CompanyEvaluationDTO {
  technicalScore: number; // 1-5
  problemSolvingScore: number; // 1-5
  communicationScore: number; // 1-5
  teamworkScore: number; // 1-5
  comment: string;
  skillsAssessed: string[];
}

export interface IngestionLogSummary {
  id: string;
  source: string;
  status: IngestionStatus;
  startedAt: string;
  finishedAt: string;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  errorCount: number;
  errorMessage?: string | null;
}
