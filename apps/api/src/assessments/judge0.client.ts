import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import axios from 'axios';

export interface TestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export type JudgeResultStatus =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'
  | 'MEMORY_LIMIT'
  | 'JUDGE_UNAVAILABLE';

export interface TestCaseResultDetail {
  input?: string;
  expected?: string;
  actual?: string;
  status: JudgeResultStatus;
  passed: boolean;
  isHidden?: boolean;
  timeMs?: number;
  memoryKb?: number;
  error?: string | null;
}

export interface Judge0ExecutionReport {
  status: JudgeResultStatus;
  stdout: string;
  stderr: string | null;
  compileOutput: string | null;
  totalTestCases: number;
  passedTestCases: number;
  details: TestCaseResultDetail[];
  engine: string;
}

export interface Judge0RawReport {
  status: JudgeResultStatus;
  stdout: string;
  stderr: string | null;
  compileOutput: string | null;
  timeMs?: number;
  memoryKb?: number;
  engine: string;
}

@Injectable()
export class Judge0Client {
  private readonly logger = new Logger(Judge0Client.name);

  private getBaseUrl(): string {
    const raw =
      process.env.JUDGE0_BASE_URL ||
      process.env.JUDGE0_API_URL ||
      (process.env.JUDGE0_API_KEY || process.env.RAPIDAPI_KEY ? 'https://judge0-ce.p.rapidapi.com' : 'https://ce.judge0.com');
    return raw.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const rawApiKey = (
      process.env.JUDGE0_API_KEY ||
      process.env.RAPIDAPI_KEY ||
      ''
    )
      .trim()
      .replace(/^["']|["']$/g, '');
    const authHeader = (process.env.JUDGE0_AUTH_HEADER || 'X-RapidAPI-Key')
      .trim()
      .replace(/^["']|["']$/g, '');

    if (rawApiKey) {
      if (authHeader.toLowerCase() === 'authorization') {
        headers['Authorization'] = rawApiKey.startsWith('Bearer ')
          ? rawApiKey
          : `Bearer ${rawApiKey}`;
      } else {
        headers[authHeader] = rawApiKey;
      }
    }

    const baseUrl = this.getBaseUrl();
    if (baseUrl.includes('rapidapi.com')) {
      headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
      if (rawApiKey) {
        headers['X-RapidAPI-Key'] = rawApiKey;
      }
    }

    return headers;
  }

  /**
   * Run candidate code strictly via Judge0.
   * If Judge0 is down or fails, throws ServiceUnavailableException('JUDGE_UNAVAILABLE').
   * NEVER runs code inside the NestJS process.
   */
  async execute(
    sourceCode: string,
    testCases: TestCase[],
    options: { maskHiddenDetails?: boolean; languageId?: number } = {},
  ): Promise<Judge0ExecutionReport> {
    if (!sourceCode || sourceCode.trim().length === 0) {
      throw new BadRequestException('Source code is required');
    }

    // Production Control: 64KB code size limit
    if (sourceCode.length > 64 * 1024) {
      throw new BadRequestException('Source code exceeds 64KB size limit');
    }

    if (!testCases || testCases.length === 0) {
      throw new BadRequestException('No test cases configured for this question');
    }

    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();
    const languageId = options.languageId || 63;
    let passedCount = 0;
    const details: TestCaseResultDetail[] = [];
    let generalStderr: string | null = null;
    let generalCompileOutput: string | null = null;
    let worstStatus: JudgeResultStatus = 'ACCEPTED';

    this.logger.log(`Submitting ${testCases.length} test cases to Judge0 (lang: ${languageId}) at ${baseUrl}`);

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const harness = this.wrapSourceCode(sourceCode, tc.input, languageId);

      try {
        const response = await axios.post(
          `${baseUrl}/submissions?wait=true`,
          {
            source_code: harness,
            language_id: languageId,
            stdin: '',
            expected_output: tc.expectedOutput,
            cpu_time_limit: 3, // 3 seconds timeout
            memory_limit: 128000, // 128MB
          },
          {
            headers,
            timeout: 9000,
          },
        );

        const data = response.data;
        if (!data || !data.status) {
          throw new Error('Malformed response from Judge0 worker');
        }

        const judgeStatusId = data.status.id;
        const status = this.mapJudge0Status(judgeStatusId);

        const stdout = (data.stdout || '').trim();
        const expected = String(tc.expectedOutput || '').trim();
        const isMatch = status === 'ACCEPTED' || (status === 'WRONG_ANSWER' && this.isOutputEquivalent(stdout, expected));

        if (isMatch) {
          passedCount++;
        } else if (worstStatus === 'ACCEPTED') {
          worstStatus = status;
        }

        if (data.stderr) generalStderr = data.stderr;
        if (data.compile_output) generalCompileOutput = data.compile_output;

        const isHidden = !!tc.isHidden;
        const maskDetails = options.maskHiddenDetails && isHidden;

        details.push({
          input: maskDetails ? `[Test Case ${i + 1} (Hidden)]` : tc.input,
          expected: maskDetails ? '[Hidden]' : tc.expectedOutput,
          actual: maskDetails ? (isMatch ? '[Passed]' : '[Failed]') : stdout,
          status: isMatch ? 'ACCEPTED' : status,
          passed: isMatch,
          isHidden,
          timeMs: data.time ? Math.round(Number(data.time) * 1000) : undefined,
          memoryKb: data.memory ? Math.round(Number(data.memory)) : undefined,
          error: data.stderr || data.compile_output || (isMatch ? null : 'Wrong Answer'),
        });
      } catch (err: any) {
        this.logger.error(`Judge0 worker communication error on test ${i + 1}: ${err.message}`);
        throw new ServiceUnavailableException({
          code: 'JUDGE_UNAVAILABLE',
          message: 'Code evaluation server is currently unavailable. Please retry in a few moments.',
        });
      }
    }

    const allPassed = passedCount === testCases.length;
    const finalStatus: JudgeResultStatus = allPassed ? 'ACCEPTED' : worstStatus;

    return {
      status: finalStatus,
      stdout: `Executed ${testCases.length} test cases. ${passedCount} passed.`,
      stderr: generalStderr,
      compileOutput: generalCompileOutput,
      totalTestCases: testCases.length,
      passedTestCases: passedCount,
      details,
      engine: 'Judge0-Isolated-Container',
    };
  }

  /**
   * Run candidate code freely without fixed input/output harness (Open-Ended / Free-form mode).
   * Executes source code in isolated Judge0 sandbox and captures stdout/stderr.
   * Capped to 32 KB stdout and 5 seconds max CPU limit.
   */
  async executeRaw(
    sourceCode: string,
    languageId: number = 63,
    stdin: string = '',
    timeoutSeconds: number = 5,
  ): Promise<Judge0RawReport> {
    if (!sourceCode || sourceCode.trim().length === 0) {
      throw new BadRequestException('Source code is required');
    }

    if (sourceCode.length > 64 * 1024) {
      throw new BadRequestException('Source code exceeds 64KB size limit');
    }

    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();
    const MAX_STDOUT_BYTES = 32 * 1024; // 32 KB limit

    try {
      const response = await axios.post(
        `${baseUrl}/submissions?wait=true`,
        {
          source_code: sourceCode,
          language_id: languageId,
          stdin: stdin || '',
          cpu_time_limit: Math.min(Math.max(timeoutSeconds, 1), 5),
          memory_limit: 128000,
        },
        {
          headers,
          timeout: 9000,
        },
      );

      const data = response.data;
      if (!data || !data.status) {
        throw new Error('Malformed response from Judge0 worker');
      }

      const status = this.mapJudge0Status(data.status.id);
      let stdout = data.stdout || '';
      if (Buffer.byteLength(stdout, 'utf-8') > MAX_STDOUT_BYTES) {
        stdout = stdout.slice(0, MAX_STDOUT_BYTES) + '\n... [Output truncated: exceeded 32 KB limit]';
      }

      return {
        status,
        stdout,
        stderr: data.stderr || null,
        compileOutput: data.compile_output || null,
        timeMs: data.time ? Math.round(Number(data.time) * 1000) : undefined,
        memoryKb: data.memory ? Math.round(Number(data.memory)) : undefined,
        engine: 'Judge0-Isolated-Container',
      };
    } catch (err: any) {
      this.logger.error(`Judge0 raw execution failed: ${err.message}`);
      throw new ServiceUnavailableException({
        code: 'JUDGE_UNAVAILABLE',
        message: 'Code evaluation server is currently unavailable. Please retry in a few moments.',
      });
    }
  }

  private mapJudge0Status(statusId: number): JudgeResultStatus {
    switch (statusId) {
      case 3:
        return 'ACCEPTED';
      case 4:
        return 'WRONG_ANSWER';
      case 5:
        return 'TIME_LIMIT';
      case 6:
        return 'COMPILE_ERROR';
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12:
        return 'RUNTIME_ERROR';
      case 13:
        return 'MEMORY_LIMIT';
      default:
        return 'RUNTIME_ERROR';
    }
  }

  private isOutputEquivalent(actual: string, expected: string): boolean {
    const act = (actual || '').trim();
    const exp = (expected || '').trim();
    if (act === exp) return true;
    if (act.toLowerCase() === exp.toLowerCase()) return true;

    // Check JSON equivalence (e.g. [1, 2] vs [1,2], booleans, key-ordered objects)
    try {
      const actJson = JSON.parse(act);
      const expJson = JSON.parse(exp);
      return JSON.stringify(actJson) === JSON.stringify(expJson);
    } catch {
      // not JSON
    }

    // Number equivalence (e.g. 5.0 vs 5)
    const numAct = Number(act);
    const numExp = Number(exp);
    if (!isNaN(numAct) && !isNaN(numExp) && numAct === numExp) {
      return true;
    }

    return false;
  }

  private wrapSourceCode(sourceCode: string, testInput: string, languageId: number = 63): string {
    if (languageId === 71) {
      // Python 3.11 Harness
      return `import json
import sys

${sourceCode}

if 'solution' not in globals() or not callable(globals().get('solution')):
    print("Error: ฟังก์ชัน 'solution' ไม่ถูกกำหนด (Function 'solution' is not defined). โปรดตั้งชื่อฟังก์ชันหลักเป็น def solution(...):", file=sys.stderr)
else:
    def __parse_input(raw):
        s = (raw or '').strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return parsed
            return [parsed]
        except Exception:
            pass
        if '|' in s:
            parts = [p.strip() for p in s.split('|')]
            res = []
            for p in parts:
                try:
                    res.append(int(p))
                except ValueError:
                    try:
                        res.append(float(p))
                    except ValueError:
                        res.append(p)
            return res
        if ',' in s:
            parts = [p.strip() for p in s.split(',')]
            res = []
            for p in parts:
                try:
                    res.append(int(p))
                except ValueError:
                    try:
                        res.append(float(p))
                    except ValueError:
                        res.append(p)
            return res
        try:
            return [int(s)]
        except ValueError:
            try:
                return [float(s)]
            except ValueError:
                return [s]

    try:
        args = __parse_input(${JSON.stringify(testInput)})
        res = solution(*args)
        if isinstance(res, (dict, list)):
            print(json.dumps(res))
        elif isinstance(res, bool):
            print("true" if res else "false")
        else:
            print(res)
    except Exception as err:
        print(f"Runtime Error in solution(): {err}", file=sys.stderr)
`;
    }

    // Default: JavaScript (63) / TypeScript (74)
    return `
${sourceCode}

if (typeof solution !== 'function') {
  console.error("Error: ฟังก์ชัน 'solution' ไม่ถูกกำหนด (Function 'solution' is not defined). โปรดตั้งชื่อฟังก์ชันหลักเป็น function solution(...)");
} else {
  function __parseInput(raw) {
    var str = (raw || '').trim();
    if (!str) return [];
    try {
      var parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch(e) {}
    if (str.indexOf('|') !== -1) {
      return str.split('|').map(function(s) {
        var p = s.trim();
        return isNaN(Number(p)) ? p : Number(p);
      });
    }
    if (solution.length === 2 && str.indexOf(',') !== -1) {
      var lastIdx = str.lastIndexOf(',');
      var p1 = str.slice(0, lastIdx).trim();
      var p2 = str.slice(lastIdx + 1).trim();
      return [isNaN(Number(p1)) ? p1 : Number(p1), isNaN(Number(p2)) ? p2 : Number(p2)];
    }
    if (str.indexOf(',') !== -1) {
      return str.split(',').map(function(s) {
        var p = s.trim();
        return isNaN(Number(p)) ? p : Number(p);
      });
    }
    return [isNaN(Number(str)) ? str : Number(str)];
  }

  try {
    var __args = __parseInput(${JSON.stringify(testInput)});
    var __res = solution.apply(null, __args);
    if (typeof __res === 'object' && __res !== null) {
      console.log(JSON.stringify(__res));
    } else {
      console.log(__res);
    }
  } catch (err) {
    console.error("Runtime Error in solution(): " + err.message);
  }
}
`;
  }

}
