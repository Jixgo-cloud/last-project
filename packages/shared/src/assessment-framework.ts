/** Pinned reference, not an endorsement or a certification issued by Microsoft.
 * Topic IDs below are SmartCareer identifiers for the 11 objective groups in the
 * official study guide. Coverage does not establish content quality or coverage
 * of every detailed skill bullet. Review the source before authoring questions.
 */
export const AZ204_FRAMEWORK = {
  code: 'AZ-204',
  version: '2026-01-14',
  sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-204',
  verifiedOn: '2026-10-15',
  retiredOn: '2026-07-31',
  domains: [
    { id: 'compute', name: 'การประมวลผลบน Azure', min: 25, max: 30 },
    { id: 'storage', name: 'การจัดเก็บข้อมูลบน Azure', min: 15, max: 20 },
    { id: 'security', name: 'ความปลอดภัยบน Azure', min: 15, max: 20 },
    { id: 'monitor', name: 'ติดตามและแก้ปัญหาระบบ Azure', min: 5, max: 10 },
    { id: 'integration', name: 'เชื่อมต่อ Azure และบริการภายนอก', min: 20, max: 25 },
  ],
  topics: [
    { id: 'compute.containers', domain: 'compute', name: 'คอนเทนเนอร์บน Azure', anchor: 'implement-containerized-solutions' },
    { id: 'compute.app-service', domain: 'compute', name: 'เว็บแอปด้วย Azure App Service', anchor: 'implement-azure-app-service-web-apps' },
    { id: 'compute.functions', domain: 'compute', name: 'Azure Functions', anchor: 'implement-azure-functions' },
    { id: 'storage.cosmos', domain: 'storage', name: 'พัฒนาด้วย Azure Cosmos DB', anchor: 'develop-solutions-that-use-azure-cosmos-db' },
    { id: 'storage.blobs', domain: 'storage', name: 'พัฒนาด้วย Azure Blob Storage', anchor: 'develop-solutions-that-use-azure-blob-storage' },
    { id: 'security.identity', domain: 'security', name: 'ยืนยันตัวตนและกำหนดสิทธิ์', anchor: 'implement-user-authentication-and-authorization' },
    { id: 'security.secrets', domain: 'security', name: 'ปกป้องการตั้งค่าและข้อมูลลับ', anchor: 'implement-secure-azure-solutions' },
    { id: 'monitor.insights', domain: 'monitor', name: 'ติดตามระบบด้วย Application Insights', anchor: 'monitor-and-troubleshoot-solutions-by-using-azure-monitor-application-insights' },
    { id: 'integration.apim', domain: 'integration', name: 'Azure API Management', anchor: 'implement-azure-api-management' },
    { id: 'integration.events', domain: 'integration', name: 'ระบบรับส่งเหตุการณ์', anchor: 'develop-event-based-solutions' },
    { id: 'integration.messages', domain: 'integration', name: 'ระบบรับส่งข้อความ', anchor: 'develop-message-based-solutions' },
  ],
} as const;

export type FrameworkQuestion = {
  frameworkTopicId?: unknown;
  frameworkMappingNote?: unknown;
  points?: unknown;
};
export type FrameworkAssessment = {
  frameworkCode?: unknown;
  frameworkVersion?: unknown;
  frameworkScope?: unknown;
  questions?: FrameworkQuestion[];
};

export function getFrameworkTopic(id: unknown) {
  return AZ204_FRAMEWORK.topics.find(topic => topic.id === id);
}

/** Each question has ONE primary objective; its points are counted once only. */
export function getFrameworkCoverage(input: FrameworkAssessment) {
  if (input.frameworkCode !== AZ204_FRAMEWORK.code || input.frameworkVersion !== AZ204_FRAMEWORK.version) return null;
  const questions = input.questions ?? [];
  const validPoints = (q: FrameworkQuestion) => typeof q.points === 'number' && Number.isInteger(q.points) && q.points > 0 && q.points <= 10000 ? q.points : 0;
  const totalPoints = questions.reduce((sum, q) => sum + validPoints(q), 0);
  const mapped = questions.filter(q => getFrameworkTopic(q.frameworkTopicId) && validPoints(q) > 0);
  const covered = new Set(mapped.map(q => q.frameworkTopicId));
  const missingTopics = AZ204_FRAMEWORK.topics.filter(topic => !covered.has(topic.id));
  const domains = AZ204_FRAMEWORK.domains.map(domain => {
    const points = mapped.filter(q => getFrameworkTopic(q.frameworkTopicId)?.domain === domain.id)
      .reduce((sum, q) => sum + validPoints(q), 0);
    const percentage = totalPoints > 0 ? points / totalPoints * 100 : 0;
    return { ...domain, points, percentage, withinRange: totalPoints > 0 && percentage >= domain.min - 1e-9 && percentage <= domain.max + 1e-9 };
  });
  const unmappedQuestions = questions.flatMap((q, index) => getFrameworkTopic(q.frameworkTopicId) ? [] : [index + 1]);
  const missingMappingNotes = questions.flatMap((q, index) =>
    typeof q.frameworkMappingNote === 'string' && q.frameworkMappingNote.trim().length >= 20 ? [] : [index + 1]);
  return {
    code: AZ204_FRAMEWORK.code, version: AZ204_FRAMEWORK.version,
    sourceUrl: AZ204_FRAMEWORK.sourceUrl, retiredOn: AZ204_FRAMEWORK.retiredOn,
    scope: typeof input.frameworkScope === 'string' ? input.frameworkScope : null, coverageBasis: 'PRIMARY_OBJECTIVE_GROUPS_AND_QUESTION_POINTS',
    totalTopics: AZ204_FRAMEWORK.topics.length, coveredTopics: covered.size,
    topicCoveragePercentage: covered.size / AZ204_FRAMEWORK.topics.length * 100,
    totalPoints, domains, missingTopics, unmappedQuestions, missingMappingNotes,
    meetsBlueprint: totalPoints > 0 && missingTopics.length === 0 && unmappedQuestions.length === 0 &&
      missingMappingNotes.length === 0 && questions.every(q => validPoints(q) > 0) && domains.every(d => d.withinRange),
  };
}

export function getFrameworkValidationError(input: FrameworkAssessment): string | null {
  const questions = input.questions ?? [];
  if (!input.frameworkCode) {
    if (input.frameworkVersion || input.frameworkScope || questions.some(q => q.frameworkTopicId || q.frameworkMappingNote)) {
      return 'กรุณาเลือกกรอบอ้างอิงก่อนเชื่อมหัวข้อกับโจทย์';
    }
    return null;
  }
  const coverage = getFrameworkCoverage(input);
  if (!coverage) return 'กรอบอ้างอิงหรือฉบับที่เลือกไม่รองรับ';
  if (!['TOPIC_PRACTICE', 'FULL_BLUEPRINT'].includes(String(input.frameworkScope))) return 'กรุณาเลือกขอบเขตการอ้างอิง AZ-204';
  if (coverage.unmappedQuestions.length) return `กรุณาเลือกหัวข้อ AZ-204 ที่ถูกต้องให้ข้อที่ ${coverage.unmappedQuestions.join(', ')}`;
  if (coverage.missingMappingNotes.length) return `กรุณาอธิบายความเชื่อมโยงกับหัวข้อมาตรฐานอย่างน้อย 20 ตัวอักษรในข้อที่ ${coverage.missingMappingNotes.join(', ')}`;
  if (questions.some(q => typeof q.frameworkMappingNote !== 'string' || q.frameworkMappingNote.length > 2000)) return 'คำอธิบายความเชื่อมโยงต้องไม่เกิน 2,000 ตัวอักษร';
  if (input.frameworkScope === 'FULL_BLUEPRINT' && !coverage.meetsBlueprint) {
    return 'ชุดครอบคลุมทั้งกรอบต้องมีครบ 11 หัวข้อ และสัดส่วนคะแนนทั้ง 5 หมวดอยู่ในช่วงที่อ้างอิง กรุณาตรวจรายงานความครอบคลุม หรือเลือกฝึกเฉพาะหัวข้อ';
  }
  return null;
}

/** Merge partial updates explicitly: null clears a reference; undefined preserves it. */
export function frameworkMetadata(data: FrameworkAssessment, existing: FrameworkAssessment = {}) {
  return {
    frameworkCode: data.frameworkCode !== undefined ? data.frameworkCode as string | null : existing.frameworkCode as string | null ?? null,
    frameworkVersion: data.frameworkVersion !== undefined ? data.frameworkVersion as string | null : existing.frameworkVersion as string | null ?? null,
    frameworkScope: data.frameworkScope !== undefined ? data.frameworkScope as string | null : existing.frameworkScope as string | null ?? null,
  };
}

export function frameworkReferenceChanged(existing: FrameworkAssessment, next: FrameworkAssessment) {
  return JSON.stringify(frameworkMetadata(existing)) !== JSON.stringify(frameworkMetadata(next, existing));
}
