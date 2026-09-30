import * as fs from 'fs';
import * as path from 'path';

function runManifestVerification() {
  console.log('--- STARTING DOCKER & DEPLOYMENT MANIFEST VERIFICATION ---');

  const rootDir = process.cwd();
  let errors: string[] = [];

  // 1. Verify Dockerfile.api
  const dockerfileApi = path.join(rootDir, 'Dockerfile.api');
  if (!fs.existsSync(dockerfileApi)) {
    errors.push('Dockerfile.api missing');
  } else {
    const content = fs.readFileSync(dockerfileApi, 'utf8');
    if (!content.includes('FROM node:22-alpine AS builder')) errors.push('Dockerfile.api missing builder stage');
    if (!content.includes('FROM node:22-alpine AS runner')) errors.push('Dockerfile.api missing runner stage');
    if (!content.includes('npx prisma generate')) errors.push('Dockerfile.api missing prisma generate');
    if (!content.includes('node apps/api/dist/main.js') && !content.includes('["node", "apps/api/dist/main.js"]')) {
      errors.push('Dockerfile.api CMD target incorrect');
    }
    console.log('✅ Dockerfile.api: Multi-stage structure and entrypoint validated.');
  }

  // 2. Verify Dockerfile.web
  const dockerfileWeb = path.join(rootDir, 'Dockerfile.web');
  if (!fs.existsSync(dockerfileWeb)) {
    errors.push('Dockerfile.web missing');
  } else {
    const content = fs.readFileSync(dockerfileWeb, 'utf8');
    if (!content.includes('FROM node:22-alpine AS builder')) errors.push('Dockerfile.web missing builder stage');
    if (!content.includes('FROM node:22-alpine AS runner')) errors.push('Dockerfile.web missing runner stage');
    if (!content.includes('apps/web/.next')) errors.push('Dockerfile.web missing .next directory copy');
    console.log('✅ Dockerfile.web: Multi-stage structure and artifacts validated.');
  }

  // 3. Verify docker-compose.prod.yml
  const composePath = path.join(rootDir, 'docker-compose.prod.yml');
  if (!fs.existsSync(composePath)) {
    errors.push('docker-compose.prod.yml missing');
  } else {
    const content = fs.readFileSync(composePath, 'utf8');
    const requiredServices = ['postgres:', 'api:', 'web:', 'caddy:'];
    for (const s of requiredServices) {
      if (!content.includes(s)) errors.push(`docker-compose.prod.yml missing service: ${s}`);
    }
    if (!content.includes('condition: service_healthy')) {
      errors.push('docker-compose.prod.yml missing healthcheck condition on postgres');
    }
    if (!content.includes('NEXT_PUBLIC_SHOW_DEMO_LOGIN: "false"')) {
      errors.push('docker-compose.prod.yml must hardcode NEXT_PUBLIC_SHOW_DEMO_LOGIN: "false"');
    }
    console.log('✅ docker-compose.prod.yml: Services (postgres, api, web, caddy) and healthcheck conditions validated.');
  }

  // 4. Verify Caddyfile
  const caddyPath = path.join(rootDir, 'Caddyfile');
  if (!fs.existsSync(caddyPath)) {
    errors.push('Caddyfile missing');
  } else {
    const content = fs.readFileSync(caddyPath, 'utf8');
    if (!content.includes('web:3000')) errors.push('Caddyfile missing proxy target web:3000');
    if (!content.includes('api:4000')) errors.push('Caddyfile missing proxy target api:4000');
    console.log('✅ Caddyfile: Reverse proxy endpoints web:3000 and api:4000 validated.');
  }

  // 5. Verify .env.production.example
  const envExamplePath = path.join(rootDir, '.env.production.example');
  if (!fs.existsSync(envExamplePath)) {
    errors.push('.env.production.example missing');
  } else {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    const requiredVars = [
      'POSTGRES_DB',
      'POSTGRES_PASSWORD',
      'DATABASE_URL',
      'JWT_SECRET',
      'FRONTEND_URL',
      'ALLOWED_ORIGINS',
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_SHOW_DEMO_LOGIN'
    ];
    for (const v of requiredVars) {
      if (!content.includes(v)) errors.push(`.env.production.example missing variable: ${v}`);
    }
    console.log('✅ .env.production.example: Required production variables validated.');
  }

  if (errors.length > 0) {
    console.error('❌ Manifest validation failed with errors:', errors);
    process.exit(1);
  }

  console.log('--- ALL MANIFESTS VALIDATED SUCCESSFULLY (100% PASS) ---');
}

runManifestVerification();
