const fs = require('fs');
const lines = fs.readFileSync('src/app/__tests__/billing-engine.spec.ts', 'utf8').split('\n');

function getBlock(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

const baseHeader = `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BillingService } from '../../modules/payment/billing.service';
import { StripeService } from '../../modules/payment/stripe.service';
import { Consultation } from '../../modules/consultation/consultation.model';
import { User } from '../../modules/user/user.model';
import { VideoSession } from '../../modules/videoSession/videoSession.model';
import { BillingTransaction, Transaction } from '../../modules/payment/payment.model';
import { createBillingFixtures } from './_shared/billing.fixtures';
import { logService } from './_shared/billing.helpers';

vi.mock('../../modules/payment/stripe.service', () => ({ StripeService: { authorizePayment: vi.fn(), createCharge: vi.fn(), voidAuthorization: vi.fn() } }));
vi.mock('../../modules/consultation/consultation.model', () => ({ Consultation: { findById: vi.fn(), findByIdAndUpdate: vi.fn(), find: vi.fn() } }));
vi.mock('../../modules/user/user.model', () => ({ User: { findById: vi.fn() } }));
vi.mock('../../modules/videoSession/videoSession.model', () => ({ VideoSession: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } }));
vi.mock('../../modules/payment/payment.model', () => {
  const ledgerMap = new Map();
  return {
    Transaction: { create: vi.fn().mockImplementation(() => Promise.resolve({ status: 'processing', save: vi.fn() })), find: vi.fn().mockResolvedValue([]) },
    BillingTransaction: {
      create: vi.fn().mockImplementation((doc) => {
        const d = { ...doc, status: doc.status || 'processing', save: vi.fn() };
        ledgerMap.set(\`\${doc.consultationId}_\${doc.billingMinute}_\${doc.type}\`, d);
        return Promise.resolve(d);
      }),
      findOne: vi.fn().mockImplementation((query) => Promise.resolve(ledgerMap.get(\`\${query.consultationId}_\${query.billingMinute}_\${query.type}\`) || null)),
      find: vi.fn().mockImplementation((query) => {
        return Promise.resolve(Array.from(ledgerMap.values()).filter((doc) => {
          if (query.consultationId && doc.consultationId.toString() !== query.consultationId.toString()) return false;
          if (query.type && doc.type !== query.type) return false;
          if (query.status && doc.status !== query.status) return false;
          return true;
        }));
      }),
      _clearLedger: () => ledgerMap.clear(),
    },
  };
});
vi.mock('../../../helpers/socketHelper', () => ({ socketHelper: { emitToUser: vi.fn(), broadcastToAdmins: vi.fn() } }));
vi.mock('../../modules/notification/notification.service', () => ({ NotificationService: { sendNotification: vi.fn() } }));

`;

const setupBlock = `
  let mockConsultation: any;
  let mockUser: any;
  let mockConsultant: any;
  let mockVideoSession: any;
  let currentConsultationId: string;

  beforeEach(() => {
    const fixtures = createBillingFixtures(Consultation, VideoSession, User, StripeService, Transaction, BillingTransaction);
    currentConsultationId = fixtures.currentConsultationId;
    mockUser = fixtures.mockUser;
    mockConsultant = fixtures.mockConsultant;
    mockConsultation = fixtures.mockConsultation;
    mockVideoSession = fixtures.mockVideoSession;
  });

  afterEach(async () => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    await BillingService.stopBilling(currentConsultationId);
  });
`;

function makeFile(name, blocks) {
  const content = baseHeader + `describe('${name}', () => {\n` + setupBlock + '\n' + blocks.join('\n\n') + '\n});\n';
  fs.writeFileSync(`src/app/__tests__/billing/${name}.spec.ts`, content);
}

makeFile('billing.financial-flows', [
  getBlock(196, 327), // Financial Flows tests
  getBlock(771, 801) // Financial Invariants tests
]);

makeFile('billing.concurrency', [
  getBlock(331, 438), // Concurrency tests
  getBlock(845, 895) // Two-Server Race & Test 17
]);

makeFile('billing.recovery-mechanics', [
  getBlock(442, 619) // Recovery Mechanics tests
]);

makeFile('billing.ledger-integrity', [
  getBlock(647, 767) // Ledger Integrity tests
]);

makeFile('billing.failure-cascades', [
  getBlock(623, 643), // D2 Constraints
  getBlock(805, 841) // Payment Failure Cascade tests
]);

console.log('Files generated correctly!');
