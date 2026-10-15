const { AZ204_FRAMEWORK: catalog } = require('@smartcareer/shared');
function fixture() {
  // 30 / 20 / 20 / 10 / 20 points, independently chosen to sum to 100.
  const points = [10, 10, 10, 10, 10, 10, 10, 10, 8, 6, 6];
  return {
    title: 'QA AZ-204 reference coverage', type: 'PRACTICAL_CODING', timeLimitMinutes: 60, passingScore: 70,
    frameworkCode: 'AZ-204', frameworkVersion: '2026-01-14', frameworkScope: 'FULL_BLUEPRINT',
    questions: catalog.topics.map((topic, i) => ({
      id: `q-${i}`, title: `QA ${topic.name}`, prompt: 'QA fixture for framework persistence and validation only.',
      points: points[i], evaluationMethod: 'OPEN_ENDED', frameworkTopicId: topic.id,
      frameworkMappingNote: 'QA fixture: author connects the task requirements to the selected Azure objective.',
    })),
  };
}

module.exports = { fixture };
