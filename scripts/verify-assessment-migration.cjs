// Uses a TEMP table and rolls the transaction back; never alters application tables.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const db = new PrismaClient();
const rollback = new Error('verified-rollback');
(async () => {
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL search_path = pg_temp');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "job_applications" (id TEXT PRIMARY KEY, "matchScoreAtApplication" DOUBLE PRECISION NOT NULL DEFAULT 0) ON COMMIT DROP');
      await tx.$executeRawUnsafe("INSERT INTO job_applications VALUES ('legacy', 85)");
      const sql = readFileSync(join(__dirname, '../prisma/migrations/202610270001_assessment_matching/migration.sql'), 'utf8');
      for (const statement of sql.replace(/--[^\r\n]*/g, '').split(';').map(s => s.trim()).filter(s => s && !/^(BEGIN|COMMIT)$/i.test(s))) await tx.$executeRawUnsafe(statement);
      await tx.$executeRawUnsafe("INSERT INTO job_applications (id) VALUES ('unknown')");
      const rows = await tx.$queryRawUnsafe('SELECT * FROM job_applications ORDER BY id');
      assert.equal(rows[0].matchScoreAtApplication, 85);
      assert.equal(rows[0].matchAssessmentSnapshot, null);
      assert.equal(rows[1].matchScoreAtApplication, null);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('PASS: legacy score preserved; unknown is null; snapshot added; all temporary changes rolled back.');
})().catch(error => { console.error('Migration verification failed:', error.code || error.name); process.exitCode = 1; }).finally(() => db.$disconnect());
