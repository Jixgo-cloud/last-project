import { candidateFeedback } from './candidate-feedback';
import { codingAttemptTotals } from './coding-attempt-totals';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Judge0Client, TestCase } from './judge0.client';
import { AiEvaluatorService } from './ai-evaluator.service';
import {
  ApplicationStatus,
  AssessmentType,
  AttemptStatus,
  getAssessmentValidationError,
  QuestionEvaluationMethod,
  AssessmentReviewStatus,
  CandidateEarnedBadge,
  getAttemptPercentage,
} from '@smartcareer/shared';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);
  private readonly runCodeRateLimit = new Map<string, number>();
  private readonly integrityEventRateLimit = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private judge0: Judge0Client,
    private aiEvaluator: AiEvaluatorService,
  ) {}

  async findAll() {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        isActive: true,
        companyId: null, // Public platform assessments
      },
      include: {
        skill: true,
        questions: { include: { choices: true } },
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return assessments.filter(assessment => !getAssessmentValidationError(assessment)).map(({ questions, ...assessment }) => assessment);
  }

  async findOne(id: string, candidateUserId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        skill: true,
        company: { select: { id: true, name: true, logoUrl: true } },
        questions: {
          include: {
            choices: {
              select: { id: true, text: true, order: true }, // Anti-cheat: hide isCorrect
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    const canStartAttempt = await this.assertCandidateAccess(assessment, candidateUserId, true);

    // STRICT ZERO-LEAKAGE: Mask hidden test cases completely and omit solutionCode
    const sanitizedQuestions = assessment.questions.map((q) => {
      const { solutionCode, ...restQ } = q;
      let sanitizedTestCases: any = restQ.testCases;
      if (Array.isArray(restQ.testCases)) {
        sanitizedTestCases = (restQ.testCases as any[]).map((tc, idx) => {
          if (tc.isHidden) {
            return {
              id: tc.id || `hidden-${idx}`,
              isHidden: true,
              // Strictly omit input and expectedOutput
            };
          }
          return {
            id: tc.id || `visible-${idx}`,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: false,
          };
        });
      }

      return {
        ...restQ,
        testCases: sanitizedTestCases,
      };
    });

    return {
      ...assessment,
      canStartAttempt,
      questions: canStartAttempt ? sanitizedQuestions : [],
    };
  }

  async getCandidateAttempts(candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) return [];

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: { candidateId: candidate.id },
      include: {
        assessment: {
          select: {
            id: true,
            companyId: true,
            feedbackVisibility: true,
            title: true,
            slug: true,
            type: true,
            passingScore: true,
            timeLimitMinutes: true,
            skill: { select: { id: true, name: true, category: true } },
            company: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
    return attempts.map(attempt => candidateFeedback(attempt));
  }

  /**
   * Start a new attempt with Version Snapshotting
   */
  async startAttempt(assessmentId: string, candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: { include: { choices: true } } },
    });
    if (!assessment || !assessment.isActive) {
      throw new NotFoundException('Assessment not available');
    }
    await this.assertCandidateAccess(assessment, candidateUserId);
    const validationError = getAssessmentValidationError({
      title: assessment.title,
      type: assessment.type,
      timeLimitMinutes: assessment.timeLimitMinutes,
      passingScore: assessment.passingScore,
      questions: assessment.questions,
    });
    if (validationError) {
      throw new BadRequestException(`แบบทดสอบนี้ยังไม่พร้อมให้เริ่มทำ: ${validationError}`);
    }

    // Security & Integrity: Check if an attempt is already IN_PROGRESS for this candidate
    const existingAttempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        assessmentId,
        candidateId: candidate.id,
        status: AttemptStatus.IN_PROGRESS,
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            type: true,
            timeLimitMinutes: true,
            passingScore: true,
          },
        },
        answers: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (existingAttempt) {
      const now = new Date();
      const elapsedSeconds = Math.round((now.getTime() - existingAttempt.startedAt.getTime()) / 1000);
      const maxAllowedSeconds = existingAttempt.assessment.timeLimitMinutes * 60 + 30; // 30s grace buffer

      if (elapsedSeconds > maxAllowedSeconds) {
        // Expired in background: mark it EXPIRED
        await this.prisma.assessmentAttempt.update({
          where: { id: existingAttempt.id },
          data: {
            status: AttemptStatus.EXPIRED,
            completedAt: now,
            passed: false,
            score: 0,
            percentage: 0,
          },
        });
      } else {
        // Active attempt exists: resume with original timer and draft!
        return existingAttempt;
      }
    }

    // Version Snapshotting
    const snapshot = {
      version: assessment.version,
      assessmentVersion: assessment.version,
      timeLimitMinutes: assessment.timeLimitMinutes,
      passingScore: assessment.passingScore,
      totalPossiblePoints: assessment.questions.reduce((sum, q) => sum + q.points, 0),
      questions: assessment.questions.map((q) => ({
        id: q.id,
        title: q.title,
        difficulty: q.difficulty,
        points: q.points,
        version: q.version,
      })),
      startedAtISO: new Date().toISOString(),
    };

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        assessmentId,
        candidateId: candidate.id,
        status: AttemptStatus.IN_PROGRESS,
        assessmentVersion: assessment.version,
        snapshot,
        integrityEvents: [],
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            type: true,
            timeLimitMinutes: true,
            passingScore: true,
          },
        },
      },
    });

    return attempt;
  }

  /**
   * Autosave candidate's draft code periodically
   */
  async saveDraftCode(
    attemptId: string,
    candidateUserId: string,
    draftCode: Record<string, string> | {
      codes: Record<string, string>;
      selectedChoices: Record<string, string>;
    },
  ) {
    const attempt = await this.validateAttemptOwnership(attemptId, candidateUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot save draft for non-active attempt');
    }

    return this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { draftCode },
    });
  }

  /**
   * Log a browser-reported page visibility event.
   */
  async logIntegrityEvent(
    attemptId: string,
    candidateUserId: string,
    event: { type: string; timestamp?: string; details?: any },
  ) {
    const attempt = await this.validateAttemptOwnership(attemptId, candidateUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('บันทึกเหตุการณ์ได้เฉพาะระหว่างทำแบบทดสอบ');
    }
    if (!event || !['TAB_BLUR', 'TAB_FOCUS'].includes(event.type)) {
      throw new BadRequestException('ประเภทเหตุการณ์ไม่ถูกต้อง');
    }

    const now = Date.now();
    const previousBlurAt = this.integrityEventRateLimit.get(attemptId) || 0;
    if (event.type === 'TAB_BLUR' && now - previousBlurAt < 750) {
      throw new HttpException('Please wait before recording another page-hidden event.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (event.type === 'TAB_BLUR') this.integrityEventRateLimit.set(attemptId, now);

    return this.prisma.$transaction(async (tx) => {
      // Serialize appends so simultaneous hide/focus events cannot overwrite each other.
      await tx.$queryRaw`SELECT "id" FROM "assessment_attempts" WHERE "id" = ${attemptId} FOR UPDATE`;
      const current = await tx.assessmentAttempt.findUnique({
        where: { id: attemptId },
        select: { integrityEvents: true },
      });
      if (!current) throw new NotFoundException('Assessment attempt not found');

      const existingEvents: any[] = Array.isArray(current.integrityEvents)
        ? (current.integrityEvents as any[])
        : [];
      return tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          integrityEvents: [
            ...existingEvents,
            { type: event.type, timestamp: new Date().toISOString() },
          ],
        },
      });
    });
  }

  /**
   * Run code against VISIBLE test cases only (Run Code button)
   * With 3s Rate Limit and Strict Judge0 execution
   */
  async testRunCode(
    assessmentId: string,
    attemptId: string,
    questionId: string,
    candidateUserId: string,
    sourceCode: string,
  ) {
    const attempt = await this.validateAttemptOwnership(attemptId, candidateUserId);
    if (attempt.assessmentId !== assessmentId) {
      throw new ForbiddenException('This question does not belong to the active assessment');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('แบบทดสอบนี้ไม่ได้อยู่ในสถานะที่ทำต่อได้');
    }
    if (attempt.assessment.type !== AssessmentType.PRACTICAL_CODING) {
      throw new BadRequestException('การรันโค้ดใช้ได้เฉพาะแบบทดสอบเขียนโค้ด');
    }
    if (Date.now() - attempt.startedAt.getTime() > attempt.assessment.timeLimitMinutes * 60_000 + 30_000) {
      throw new BadRequestException('หมดเวลาทำแบบทดสอบแล้ว');
    }
    if (typeof sourceCode !== 'string' || !sourceCode.trim() || sourceCode.length > 100_000) {
      throw new BadRequestException('กรุณากรอกโค้ดไม่เกิน 100,000 ตัวอักษร');
    }

    const question = attempt.assessment.questions.find((item) => item.id === questionId);
    if (!question) throw new ForbiddenException('This question is not part of the active attempt');

    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    // Production Control: Rate Limit (1 run per 3 seconds per candidate)
    const now = Date.now();
    const lastRun = this.runCodeRateLimit.get(candidate.id) || 0;
    if (now - lastRun < 3000) {
      const waitSeconds = Math.ceil((3000 - (now - lastRun)) / 1000);
      throw new HttpException(
        `Rate limit exceeded. Please wait ${waitSeconds}s before running tests again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.runCodeRateLimit.set(candidate.id, now);

    // Production Control: Automatic Language Detection (Python 3.11 = 71, JS = 63)
    const langId = this.detectLanguageId(sourceCode, question.starterCode);

    // Dual-Mode: If OPEN_ENDED, execute raw code in isolated Judge0 sandbox
    if (question.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED) {
      const rawReport = await this.judge0.executeRaw(sourceCode, langId);
      return {
        status: rawReport.status,
        stdout: rawReport.stdout,
        stderr: rawReport.stderr,
        compileOutput: rawReport.compileOutput,
        timeMs: rawReport.timeMs,
        memoryKb: rawReport.memoryKb,
        engine: rawReport.engine,
        totalTestCases: 0,
        passedTestCases: 0,
        details: [],
        isOpenEnded: true,
      };
    }

    const allTestCases: TestCase[] = (question.testCases as any) || [];
    // Filter strictly to visible test cases
    const visibleTestCases = allTestCases.filter((tc) => !tc.isHidden);
    const testCasesToRun = visibleTestCases.length > 0 ? visibleTestCases : allTestCases.slice(0, 2);

    // Run via Judge0 only
    return this.judge0.execute(sourceCode, testCasesToRun, { maskHiddenDetails: false, languageId: langId });
  }

  /**
   * Automatically detects language ID for Judge0 based on source code and question starter code.
   * 71 = Python 3.11, 63 = JavaScript (Node.js)
   */
  private detectLanguageId(sourceCode?: string, starterCode?: string): number {
    const combined = `${starterCode || ''}\n${sourceCode || ''}`;
    if (
      combined.includes('def solution') ||
      combined.includes('def ') ||
      combined.includes('import sys') ||
      combined.includes('import math') ||
      combined.includes('# เขียนฟังก์ชันแก้ปัญหา') ||
      combined.includes('# เขียนโค้ดแก้ปัญหา') ||
      combined.includes('# Write your solution')
    ) {
      return 71; // Python 3.11
    }
    return 63; // JavaScript (Node.js)
  }

  /**
   * Final Submit Theory Attempt with State Machine & Transaction
   */
  async submitTheoryAttempt(
    attemptId: string,
    candidateUserId: string,
    answers: Array<{ questionId: string; selectedChoiceId: string }>,
  ) {
    const attempt = await this.validateAttemptOwnership(attemptId, candidateUserId);

    // State machine check: Must be IN_PROGRESS
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Attempt cannot be submitted. Current status: ${attempt.status}`,
      );
    }

    // Transition state to SUBMITTING to lock against concurrent submissions
    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status: AttemptStatus.SUBMITTING },
    });

    const now = new Date();
    const elapsedSeconds = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
    const maxAllowedSeconds = attempt.assessment.timeLimitMinutes * 60 + 30; // 30s buffer
    const isExpired = elapsedSeconds > maxAllowedSeconds;
    const timeSpentSeconds = Math.min(elapsedSeconds, attempt.assessment.timeLimitMinutes * 60);

    let totalPoints = 0;
    let earnedPoints = 0;

    for (const q of attempt.assessment.questions) {
      totalPoints += q.points;
      const candidateAns = answers.find((a) => a.questionId === q.id);
      const correctChoice = q.choices.find((c) => c.isCorrect);

      const isCorrect = !isExpired && !!(
        candidateAns &&
        correctChoice &&
        candidateAns.selectedChoiceId === correctChoice.id
      );
      const points = isCorrect ? q.points : 0;
      earnedPoints += points;
    }

    const percentage = isExpired ? 0 : totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = !isExpired && percentage >= attempt.assessment.passingScore;
    const finalStatus = isExpired ? AttemptStatus.EXPIRED : AttemptStatus.COMPLETED;

    // Prisma Transaction: Atomically commit answers, attempt, and skill score
    return this.prisma.$transaction(async (tx) => {
      // 1. Save answers
      for (const q of attempt.assessment.questions) {
        const candidateAns = answers.find((a) => a.questionId === q.id);
        const correctChoice = q.choices.find((c) => c.isCorrect);
        const isCorrect = !isExpired && !!(
          candidateAns &&
          correctChoice &&
          candidateAns.selectedChoiceId === correctChoice.id
        );
        const points = isCorrect ? q.points : 0;

        await tx.assessmentAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: q.id,
            selectedChoiceId: candidateAns?.selectedChoiceId || null,
            isCorrect,
            pointsEarned: points,
          },
        });
      }

      // 2. Complete Attempt
      const updatedAttempt = await tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: finalStatus,
          score: earnedPoints,
          maxScore: totalPoints,
          percentage,
          passed,
          timeSpentSeconds,
          completedAt: now,
        },
      });

      // 3. Update CandidateSkill with LATEST score (only for platform tests or skill-bound tests)
      if (attempt.assessment.skillId && !isExpired) {
        await this.updateCandidateSkillScoreInTx(
          tx,
          attempt.candidateId,
          attempt.assessment.skillId,
          'theoryScore',
          percentage,
        );
      }

      return updatedAttempt;
    });
  }

  /**
   * Final Submit Coding Solution with State Machine & Transaction
   * Supports Dual-Mode:
   * 1. OPEN_ENDED: Raw Judge0 execution + Gemini AI 4-dimension Rubric + Company Tech Lead Review
   * 2. AUTOMATED_TEST_CASES: Strict Judge0 test cases evaluation + Platform Verified Skill update
   */
  async submitCodingSolution(
    attemptId: string,
    questionId: string,
    candidateUserId: string,
    sourceCode: string,
  ) {
    const attempt = await this.validateAttemptOwnership(attemptId, candidateUserId);

    // State machine check: Must be IN_PROGRESS
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Attempt cannot be submitted. Current status: ${attempt.status}`,
      );
    }

    const question = attempt.assessment.questions.find((q) => q.id === questionId);
    if (!question) throw new NotFoundException('Question does not belong to this assessment');

    // Transition state to SUBMITTING to lock against concurrent submits
    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status: AttemptStatus.SUBMITTING },
    });

    const now = new Date();
    const elapsedSeconds = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
    const maxAllowedSeconds = attempt.assessment.timeLimitMinutes * 60 + 30; // 30s buffer
    const isExpired = elapsedSeconds > maxAllowedSeconds;
    const timeSpentSeconds = Math.min(elapsedSeconds, attempt.assessment.timeLimitMinutes * 60);

    // =========================================================================
    // BRANCH 1: OPEN-ENDED EVALUATION (Free-form / Plain text prompt)
    // =========================================================================
    const langId = this.detectLanguageId(sourceCode, question.starterCode);

    if (question.evaluationMethod === QuestionEvaluationMethod.OPEN_ENDED) {
      let rawReport;
      try {
        rawReport = await this.judge0.executeRaw(sourceCode, langId);
      } catch (err: any) {
        this.logger.warn(`Judge0 raw execution failed for open-ended attempt: ${err.message}`);
        rawReport = {
          status: 'RUNTIME_ERROR' as any,
          stdout: '',
          stderr: err.message,
          compileOutput: null,
          engine: 'Judge0-Isolated-Container',
        };
      }

      let aiEvaluation;
      let aiFailed = false;
      let aiErrorMessage: string | null = null;

      try {
        aiEvaluation = await this.aiEvaluator.evaluate({
          questionTitle: question.title,
          questionPrompt: question.prompt,
          sourceCode,
          sandboxExecution: rawReport,
          rubricOverrides: question.rubric as any,
        });
      } catch (err: any) {
        this.logger.error(`AI Evaluation failed for attempt ${attemptId}: ${err.message}`);
        aiFailed = true;
        aiErrorMessage = err.message || 'AI service unavailable';
      }

      const isCompanyAssessment = attempt.assessment.companyId !== null;

      // Handle AI Outage: Graceful fallback to EVALUATION_PENDING with null score (no 0% fail!)
      if (aiFailed || !aiEvaluation) {
        return this.prisma.$transaction(async (tx) => {
        const existingAnswer = await tx.assessmentAnswer.findFirst({
          where: { attemptId, questionId },
        });

        if (existingAnswer) {
          await tx.assessmentAnswer.update({
            where: { id: existingAnswer.id },
            data: {
              submittedCode: sourceCode,
              executionResult: { ...rawReport, evaluationPending: true } as any,
              isCorrect: false,
              pointsEarned: 0,
            },
          });
        } else {
          await tx.assessmentAnswer.create({
            data: {
              attemptId,
              questionId,
              submittedCode: sourceCode,
              executionResult: { ...rawReport, evaluationPending: true } as any,
              isCorrect: false,
              pointsEarned: 0,
            },
          });
        }

        const allAnswers = await tx.assessmentAnswer.findMany({ where: { attemptId } });
        const isAllQuestionsAnswered = attempt.assessment.questions.every((q) =>
          allAnswers.some((a) => a.questionId === q.id),
        );
        const isAttemptFinished = isExpired || isAllQuestionsAnswered;
        const currentAttemptStatus = isExpired
          ? AttemptStatus.EXPIRED
          : isAttemptFinished
          ? AttemptStatus.COMPLETED
          : AttemptStatus.IN_PROGRESS;

        await tx.assessmentAttempt.update({
          where: { id: attemptId },
          data: {
            status: currentAttemptStatus,
            reviewStatus: AssessmentReviewStatus.EVALUATION_PENDING,
            score: null,
            percentage: null,
            passed: null,
            aiScore: null,
            humanScore: null,
            finalScore: null,
            sourceCode,
            evaluationSnapshot: {
              pendingReason: 'AI_SERVICE_UNAVAILABLE',
              error: aiErrorMessage,
            },
            timeSpentSeconds,
            completedAt: isAttemptFinished ? now : null,
          },
        });

        return {
          attemptId,
          questionId,
          status: currentAttemptStatus,
          isFinished: isAttemptFinished,
          totalQuestions: attempt.assessment.questions.length,
          answeredQuestions: allAnswers.length,
          reviewStatus: AssessmentReviewStatus.EVALUATION_PENDING,
          score: null,
          percentage: null,
          passed: null,
          aiScore: null,
          finalScore: null,
          sourceCode,
          message:
            'ส่งคำตอบเรียบร้อยแล้ว — ระบบกำลังรอการประเมินผลเชิงลึก (Evaluation Pending)',
        };
      });
    }

    // AI evaluation succeeded
    const overallScore = aiEvaluation.result.overallScore;
    const pointsEarned =
      isExpired ? 0 : Math.round((overallScore / 100) * question.points * 10) / 10;

    return this.prisma.$transaction(async (tx) => {
      const existingAnswer = await tx.assessmentAnswer.findFirst({
        where: { attemptId, questionId },
      });

      if (existingAnswer) {
        await tx.assessmentAnswer.update({
          where: { id: existingAnswer.id },
          data: {
            submittedCode: sourceCode,
            executionResult: { ...rawReport, evaluationPending: false } as any,
            isCorrect: overallScore >= attempt.assessment.passingScore,
            pointsEarned,
          },
        });
      } else {
        await tx.assessmentAnswer.create({
          data: {
            attemptId,
            questionId,
            submittedCode: sourceCode,
            executionResult: { ...rawReport, evaluationPending: false } as any,
            isCorrect: overallScore >= attempt.assessment.passingScore,
            pointsEarned,
          },
        });
      }

      const allAnswers = await tx.assessmentAnswer.findMany({ where: { attemptId } });
      const isAllQuestionsAnswered = attempt.assessment.questions.every((q) =>
        allAnswers.some((a) => a.questionId === q.id),
      );
      const isAttemptFinished = isExpired || isAllQuestionsAnswered;
      const currentAttemptStatus = isExpired
        ? AttemptStatus.EXPIRED
        : isAttemptFinished
        ? AttemptStatus.COMPLETED
        : AttemptStatus.IN_PROGRESS;

      const totals = codingAttemptTotals(attempt.assessment, allAnswers, isExpired,
        attempt.reviewStatus, question.evaluationMethod);

      await tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          status: currentAttemptStatus,
          ...totals,
          humanScore: null,
          sourceCode,
          evaluationSnapshot: aiEvaluation.result as any,
          evaluatorModel: aiEvaluation.model,
          evaluatorProvider: aiEvaluation.provider,
          promptVersion: aiEvaluation.promptVersion,
          timeSpentSeconds,
          completedAt: isAttemptFinished ? now : null,
        },
      });

      return {
        attemptId,
        questionId,
        status: currentAttemptStatus,
        isFinished: isAttemptFinished,
        totalQuestions: attempt.assessment.questions.length,
        answeredQuestions: allAnswers.length,
        ...totals,
        totalPointsEarned: totals.score,
        evaluation: aiEvaluation.result,
        timeSpentSeconds,
        isCompanyAssessment,
      };
    });
  }

  // =========================================================================
  // BRANCH 2: AUTOMATED TEST CASES (Algorithmic / Strict Judge0)
  // =========================================================================
  const testCases: TestCase[] = (question.testCases as any) || [];

  let executionReport;
  try {
    executionReport = await this.judge0.execute(sourceCode, testCases, {
      maskHiddenDetails: true,
      languageId: langId,
    });
  } catch (err: any) {
    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status: AttemptStatus.SYSTEM_ERROR },
    });
    throw err;
  }

  const isCorrect = !isExpired && executionReport.passedTestCases === executionReport.totalTestCases;
  const pointsEarned =
    isExpired || executionReport.totalTestCases === 0
      ? 0
      : Math.round(
          (executionReport.passedTestCases / executionReport.totalTestCases) * question.points * 10,
        ) / 10;

  return this.prisma.$transaction(async (tx) => {
    const existingAnswer = await tx.assessmentAnswer.findFirst({
      where: { attemptId, questionId },
    });

    if (existingAnswer) {
      await tx.assessmentAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          submittedCode: sourceCode,
          executionResult: executionReport as any,
          isCorrect,
          pointsEarned,
        },
      });
    } else {
      await tx.assessmentAnswer.create({
        data: {
          attemptId,
          questionId,
          submittedCode: sourceCode,
          executionResult: executionReport as any,
          isCorrect,
          pointsEarned,
        },
      });
    }

    const allAnswers = await tx.assessmentAnswer.findMany({
      where: { attemptId },
    });
    const totals = codingAttemptTotals(attempt.assessment, allAnswers, isExpired,
      attempt.reviewStatus, question.evaluationMethod);

    // Check whether ALL questions have answers
    const isAllQuestionsAnswered = attempt.assessment.questions.every((q) =>
      allAnswers.some((a) => a.questionId === q.id),
    );
    const isAttemptFinished = isExpired || isAllQuestionsAnswered;
    const currentAttemptStatus = isExpired
      ? AttemptStatus.EXPIRED
      : isAttemptFinished
      ? AttemptStatus.COMPLETED
      : AttemptStatus.IN_PROGRESS;

    await tx.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: currentAttemptStatus,
        ...totals,
        sourceCode,
        timeSpentSeconds,
        completedAt: isAttemptFinished ? now : null,
      },
    });

    // Platform Verified Skill update: STRICTLY for Platform assessments with AUTOMATED_TEST_CASES
    if (
      isAttemptFinished &&
      attempt.assessment.skillId &&
      attempt.assessment.companyId === null &&
      !isExpired && totals.percentage !== null
    ) {
      await this.updateCandidateSkillScoreInTx(
        tx,
        attempt.candidateId,
        attempt.assessment.skillId,
        'codingScore',
        totals.percentage,
      );
    }

    return {
      attemptId,
      questionId,
      execution: executionReport,
      isCorrect,
      ...totals,
      // Retain the original per-question response's percentage alias.
      score: totals.percentage,
      totalPointsEarned: totals.score,
      pointsEarned,
      maxPoints: question.points,
      timeSpentSeconds,
      status: currentAttemptStatus,
      isFinished: isAttemptFinished,
      totalQuestions: attempt.assessment.questions.length,
      answeredQuestions: allAnswers.length,
    };
  });
}

  /**
   * Finalize an attempt explicitly (e.g. candidate clicks Submit All / Finish Exam)
   */
  async finalizeAttempt(attemptId: string, candidateUserId: string) {
    const attempt = await this.validateAttemptOwnership(attemptId, candidateUserId);
    if (attempt.status === AttemptStatus.COMPLETED || attempt.status === AttemptStatus.EXPIRED) {
      return attempt;
    }

    const now = new Date();
    const elapsedSeconds = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
    const maxAllowedSeconds = attempt.assessment.timeLimitMinutes * 60 + 30; // 30s grace buffer
    const isExpired = elapsedSeconds > maxAllowedSeconds;
    const timeSpentSeconds = Math.min(elapsedSeconds, attempt.assessment.timeLimitMinutes * 60);

    return this.prisma.$transaction(async (tx) => {
      const allAnswers = await tx.assessmentAnswer.findMany({ where: { attemptId } });
      const totals = codingAttemptTotals(attempt.assessment, allAnswers, isExpired, attempt.reviewStatus);
      const currentAttemptStatus = isExpired ? AttemptStatus.EXPIRED : AttemptStatus.COMPLETED;

      const updated = await tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          status: currentAttemptStatus,
          ...totals,
          timeSpentSeconds,
          completedAt: now,
        },
        include: {
          assessment: {
            include: { skill: true, company: true },
          },
          answers: true,
        },
      });

      if (!isExpired && totals.percentage !== null && attempt.assessment.skillId && attempt.assessment.companyId === null) {
        await this.updateCandidateSkillScoreInTx(
          tx,
          attempt.candidateId,
          attempt.assessment.skillId,
          'codingScore',
          totals.percentage,
        );
      }

      return updated;
    });
  }

  /**
   * Tech Lead Human Review & Score Override
   * Sets humanScore, finalScore, reviewStatus = HUMAN_REVIEWED, and logs audit trail.
   */
  async overrideAttemptScore(
    attemptId: string,
    reviewerUserId: string,
    humanScore: number,
    reviewReason: string,
  ) {
    if (humanScore < 0 || humanScore > 100) {
      throw new BadRequestException('Score must be between 0 and 100');
    }
    if (!reviewReason || reviewReason.trim().length === 0) {
      throw new BadRequestException('Review reason is required for audit trail');
    }

    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            company: {
              include: { members: true },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Assessment attempt not found');
    }

    // Authorization & Multi-tenancy check
    const user = await this.prisma.user.findUnique({
      where: { id: reviewerUserId },
      include: { companyMembers: true },
    });

    if (!user) throw new ForbiddenException('User not found');

    const isAdmin = user.role === 'ADMIN';
    const isCompanyMember =
      attempt.assessment.companyId &&
      user.companyMembers.some((m) => m.companyId === attempt.assessment.companyId);

    if (!isAdmin && !isCompanyMember) {
      throw new ForbiddenException(
        'You are not authorized to review attempts for this assessment (Multi-tenancy isolation)',
      );
    }

    const passingScore = attempt.assessment.passingScore;
    const passed = humanScore >= passingScore;
    const now = new Date();

    return this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        humanScore,
        finalScore: humanScore,
        percentage: humanScore,
        passed,
        reviewStatus: AssessmentReviewStatus.HUMAN_REVIEWED,
        reviewedById: reviewerUserId,
        reviewedAt: now,
        reviewReason: reviewReason.trim(),
      },
      include: {
        candidate: { select: { id: true, fullName: true, avatarUrl: true } },
        assessment: { select: { id: true, title: true, passingScore: true, companyId: true } },
      },
    });
  }

  /**
   * Get detailed attempt info for Company Tech Lead Review
   */
  async getAttemptReviewDetails(attemptId: string, userId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            targetCareer: true,
            githubUsername: true,
          },
        },
        assessment: {
          include: {
            company: {
              include: { members: true },
            },
            questions: { include: { choices: { orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'asc' } },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { companyMembers: true },
    });

    if (!user) throw new ForbiddenException('User not found');

    const isAdmin = user.role === 'ADMIN';
    const isCompanyMember =
      attempt.assessment.companyId &&
      user.companyMembers.some((m) => m.companyId === attempt.assessment.companyId);

    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });
    const isOwnerCandidate = candidateProfile && attempt.candidateId === candidateProfile.id;

    if (!isAdmin && !isCompanyMember && !isOwnerCandidate) {
      throw new ForbiddenException('Access denied');
    }

    if (isOwnerCandidate && !isAdmin && !isCompanyMember) return candidateFeedback(attempt);

    return {
      ...attempt,
      integritySummary: this.getIntegritySummary(attempt.integrityEvents),
    };
  }

  async discloseCandidateResponse(result: any, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, include: { assessment: true } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return candidateFeedback({ ...result, reviewStatus: attempt.reviewStatus }, attempt.assessment);
  }

  getIntegritySummary(integrityEvents: any): {
    tabSwitchCount: number;
    riskLevel: 'NORMAL' | 'REVIEW';
    events: any[];
  } {
    const events: any[] = Array.isArray(integrityEvents) ? integrityEvents : [];
    const tabSwitchCount = events.filter(
      (e) => e.type === 'TAB_BLUR' || e.eventType === 'TAB_BLUR',
    ).length;

    // These events originate in the candidate's browser and cannot prove misconduct.
    const riskLevel: 'NORMAL' | 'REVIEW' = tabSwitchCount > 0 ? 'REVIEW' : 'NORMAL';

    return { tabSwitchCount, riskLevel, events };
  }

  private async validateAttemptOwnership(attemptId: string, candidateUserId: string) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        candidate: true,
        assessment: {
          include: {
            skill: true,
            questions: { include: { choices: true } },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException('Assessment attempt not found');

    if (attempt.candidateId !== candidate.id) {
      throw new ForbiddenException('You are not authorized to access this assessment attempt');
    }

    return attempt;
  }

  private async assertCandidateAccess(
    assessment: { id: string; companyId: string | null; isActive?: boolean },
    candidateUserId: string,
    allowFinishedResult = false,
  ): Promise<boolean> {
    if (!assessment.companyId && assessment.isActive !== false) return true;

    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId: candidateUserId },
      select: { id: true },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const application = assessment.companyId && assessment.isActive !== false ? await this.prisma.jobApplication.findFirst({
      where: {
        candidateId: candidate.id,
        status: { notIn: [ApplicationStatus.CANCELLED, ApplicationStatus.REJECTED] },
        OR: [
          { assignedAssessmentId: assessment.id },
          { job: { companyId: assessment.companyId, customAssessmentId: assessment.id } },
        ],
      },
      select: { id: true },
    }) : null;

    if (application) return true;

    // A closed application cannot start another exam, but its owner retains
    // access to a finished result. Do not use drafts or another user's attempt.
    if (allowFinishedResult) {
      const finished = await this.prisma.assessmentAttempt.findFirst({
        where: {
          candidateId: candidate.id,
          assessmentId: assessment.id,
          status: { in: [AttemptStatus.COMPLETED, AttemptStatus.EXPIRED] },
        },
        select: { id: true },
      });
      if (finished) return false;
    }

    if (assessment.isActive === false) throw new NotFoundException('Assessment not available');
    throw new ForbiddenException('แบบทดสอบนี้เปิดให้เฉพาะผู้สมัครที่บริษัทมอบหมายเท่านั้น');
  }

  private async updateCandidateSkillScoreInTx(
    tx: any,
    candidateId: string,
    skillId: string,
    field: 'theoryScore' | 'codingScore',
    score: number,
  ) {
    const existing = await tx.candidateSkill.findUnique({
      where: {
        candidateId_skillId: { candidateId, skillId },
      },
    });

    const bestScore = Math.max(existing?.[field] || 0, score);

    const candidateSkill = await tx.candidateSkill.upsert({
      where: {
        candidateId_skillId: { candidateId, skillId },
      },
      update: {
        [field]: bestScore, // Best Score Retention!
      },
      create: {
        candidateId,
        skillId,
        [field]: score,
      },
    });

    const verifiedScore = Math.round(
      candidateSkill.practicalScore * 0.5 +
        candidateSkill.theoryScore * 0.2 +
        candidateSkill.codingScore * 0.3,
    );

    const isPassing = bestScore >= 60 || verifiedScore >= 60;
    await tx.candidateSkill.update({
      where: { id: candidateSkill.id },
      data: {
        verifiedScore: Math.max(verifiedScore, bestScore),
        isVerified: isPassing || candidateSkill.isVerified,
        verifiedAt: isPassing ? new Date() : candidateSkill.verifiedAt,
      },
    });
  }

  async getCandidateBadges(userId: string): Promise<CandidateEarnedBadge[]> {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });
    if (!candidate) return [];

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: {
        candidateId: candidate.id,
        passed: true,
      },
      include: {
        assessment: {
          include: {
            skill: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Deduplicate by assessmentId (keep highest scoring / latest passed attempt)
    const badgeMap = new Map<string, CandidateEarnedBadge>();

    for (const att of attempts) {
      if (candidateFeedback(att).feedbackHidden || getAttemptPercentage(att) === null) continue;
      if (!badgeMap.has(att.assessmentId)) {
        const isCoding = (att.assessment.type as string) === 'PRACTICAL_CODING';
        const typeTitle = isCoding ? 'Code Challenge' : 'Theory Quiz';
        const badgeName = `${att.assessment.title} • ${typeTitle} Certified`;
        badgeMap.set(att.assessmentId, {
          attemptId: att.id,
          assessmentId: att.assessmentId,
          title: att.assessment.title,
          badgeName,
          type: att.assessment.type as any,
          skillName: att.assessment.skill?.name || null,
          skillCategory: (att.assessment.skill?.category as any) || null,
          score: getAttemptPercentage(att)!,
          passedAt: att.completedAt || att.startedAt || new Date(),
          timeSpentSeconds: att.timeSpentSeconds,
        });
      }
    }

    return Array.from(badgeMap.values());
  }
}
