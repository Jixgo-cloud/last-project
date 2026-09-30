import { execSync } from 'child_process';
import * as fs from 'fs';

function generateMatrix() {
  console.log('--- GENERATING CRITICAL & HIGH SECURITY AUDIT MATRIX ---');

  let rawJson = '';
  try {
    rawJson = execSync('npm audit --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err: any) {
    rawJson = err.stdout ? err.stdout.toString() : '';
  }

  const auditData = JSON.parse(rawJson);
  const vulnerabilities = auditData.vulnerabilities || {};

  // Also get prod-only vulnerabilities
  let prodRawJson = '';
  try {
    prodRawJson = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err: any) {
    prodRawJson = err.stdout ? err.stdout.toString() : '';
  }
  const prodAuditData = JSON.parse(prodRawJson);
  const prodVulns = prodAuditData.vulnerabilities || {};

  const criticalAndHigh: any[] = [];

  for (const [pkgName, details] of Object.entries(vulnerabilities) as [string, any][]) {
    const sev = details.severity.toLowerCase();
    if (sev === 'critical' || sev === 'high') {
      const isProd = Boolean(prodVulns[pkgName]);
      const viaList = Array.isArray(details.via)
        ? details.via.map((v: any) => (typeof v === 'string' ? v : `${v.title} (${v.url})`))
        : [];

      criticalAndHigh.push({
        package: pkgName,
        severity: details.severity.toUpperCase(),
        isProd: isProd ? 'PRODUCTION' : 'DEV-ONLY',
        nodes: details.nodes || [],
        range: details.range,
        via: viaList,
        fixAvailable: details.fixAvailable,
      });
    }
  }

  console.log(`Found ${criticalAndHigh.length} Critical/High vulnerabilities across all dependencies:`);
  console.log(JSON.stringify(criticalAndHigh, null, 2));
}

generateMatrix();
