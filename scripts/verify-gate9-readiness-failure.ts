import axios from 'axios';
import { HealthController } from '../apps/api/dist/health/health.controller.js';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:4000/api';

async function verifyGate9() {
  console.log('===============================================================');
  console.log('🛡️ GATE 9: HEALTH & READINESS PROBE 200/503 RIGOROUS VERIFICATION');
  console.log('===============================================================\n');

  // 1. Healthy Live Probe Test (HTTP 200 OK)
  console.log('--- Test 1: Live Normal Operation (Database Connected) ---');
  try {
    const resLive = await axios.get(`${API_BASE_URL}/health`, { validateStatus: () => true });
    console.log(`   - HTTP Status: ${resLive.status} (Expected: 200)`);
    console.log(`   - Body:`, resLive.data);
    if (resLive.status === 200 && resLive.data.database === 'connected') {
      console.log('   - Result: ✅ PASS (200 OK Healthy)');
    } else {
      throw new Error(`Expected 200 OK but received ${resLive.status}`);
    }
  } catch (err: any) {
    console.error(`   - Failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Unhealthy Simulation Test (Database Disconnected / Unavailable -> HTTP 503)
  console.log('\n--- Test 2: Simulated Database Failure (Database Disconnected) ---');
  
  // We instantiate a mock PrismaService where $queryRaw throws an error (simulating network partition or DB crash)
  const disconnectedPrisma = {
    $queryRaw: async () => {
      throw new Error('Connection lost: Can not connect to database server on 127.0.0.1:5432');
    },
  } as any;

  const healthController = new HealthController(disconnectedPrisma);

  let capturedStatus = 0;
  let capturedBody: any = null;

  const mockResponse: any = {
    status: (code: number) => {
      capturedStatus = code;
      return {
        json: (data: any) => {
          capturedBody = data;
          return data;
        },
      };
    },
  };

  await healthController.getHealth(mockResponse);

  console.log(`   - HTTP Status: ${capturedStatus} (Expected: 503 Service Unavailable)`);
  console.log(`   - Body:`, capturedBody);

  const pass503 =
    capturedStatus === 503 &&
    capturedBody.status === 'error' &&
    capturedBody.database === 'disconnected';

  console.log(`   - Result: ${pass503 ? '✅ PASS (503 Service Unavailable correctly returned)' : '❌ FAIL'}`);

  if (!pass503) {
    throw new Error('Health controller did not return 503 on database failure!');
  }

  console.log('\n===============================================================');
  console.log('🎉 GATE 9 FULL PASS: Both 200 (Connected) and 503 (Disconnected) verified.');
  console.log('===============================================================');
}

verifyGate9().catch(console.error);
