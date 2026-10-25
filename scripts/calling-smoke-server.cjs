// Isolated local integration harness. Never connects to the configured database.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

async function main() {
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DATABASE_URL = db.getUri();
  process.env.NODE_ENV = 'test';
  const app = require('../dist/app').default;
  const { NotificationHelper } = require('../dist/helpers/notification/notificationHelper');
  for (const key of ['sendIncomingCallNotification', 'sendCallCancellationNotification', 'sendPushNotification']) {
    NotificationHelper[key] = async () => ({ responses: [] });
  }
  const { StripeService } = require('../dist/app/modules/payment/stripe.service');
  StripeService.authorizePayment = async (...args) => ({ id: `pi_smoke_auth_${args.at(-1)}` });
  StripeService.createCharge = async (...args) => ({ id: `pi_smoke_charge_${args.at(-1)}` });
  StripeService.voidAuthorization = async () => ({});
  const { TranscriptionService } = require('../dist/app/modules/transcription/transcription.service');
  TranscriptionService.startTranscription = async () => ({});
  TranscriptionService.stopTranscription = async () => ({});
  require('../dist/app/modules/report/report.service').ReportService.generateOrGetAiSummary = async () => ({});
  await mongoose.connect(db.getUri());
  const { User } = require('../dist/app/modules/user/user.model');
  const { VideoSession } = require('../dist/app/modules/videoSession/videoSession.model');
  const { Consultation } = require('../dist/app/modules/consultation/consultation.model');
  const { BillingTransaction, Transaction } = require('../dist/app/modules/payment/payment.model');
  await Promise.all([User.init(), VideoSession.init(), BillingTransaction.init(), Transaction.init()]);
  await mongoose.model('ConsultancyType').create({ _id: '60d5ecb8b392d7211054a321', name: 'advisor', status: 'active' });
  const consultant = await User.create({ name: 'Smoke Consultant', email: 'consultant@smoke.test', password: 'SmokePassword123!', role: 'CONSULTANT', status: 'active', verified: true, activeStatus: true, consultancyType: '60d5ecb8b392d7211054a321', perMinuteRate: 2 });
  const user = await User.create({ name: 'Smoke Caller', email: 'caller@smoke.test', password: 'SmokePassword123!', role: 'USER', status: 'active', verified: true });
  const jwt = require('jsonwebtoken');
  const secret = require('../dist/config').default.jwt.jwt_secret;
  const tokenFor = u => jwt.sign({ id: u.id, role: u.role, email: u.email }, secret, { expiresIn: '1h' });
  const users = { consultantId: consultant.id, consultantEmail: consultant.email, consultantToken: tokenFor(consultant), normalUserId: user.id, normalUserEmail: user.email, normalUserToken: tokenFor(user) };
  await User.findByIdAndUpdate(users.normalUserId, {
    stripeCustomerId: 'cus_smoke_only',
    paymentMethods: [{ provider: 'stripe', methodId: 'pm_smoke_only', isDefault: true }],
  });
  await User.findByIdAndUpdate(users.consultantId, { perMinuteRate: 2 });
  const { socketHelper } = require('../dist/helpers/socketHelper');
  const server = http.createServer((req, res) => {
    if (req.url === '/__smoke/fixtures') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...users, appId: require('../dist/config').default.agora.appId }));
    } else if (req.url.startsWith('/__smoke/state')) {
      Promise.all([VideoSession.find().lean(), Consultation.find().lean(), BillingTransaction.find().lean()])
        .then(([sessions, consultations, ledger]) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ sessions, consultations, ledger }));
        }).catch(() => { res.statusCode = 500; res.end(); });
    } else app(req, res);
  });
  const io = new Server(server, { cors: { origin: ['http://localhost:3000'], credentials: true } });
  global.io = io;
  socketHelper.socket(io);
  server.listen(5101, '127.0.0.1', () => console.log('SMOKE_READY http://127.0.0.1:5101 (ephemeral DB, simulated payment/push/STT)'));
  async function shutdown() {
    io.close(); server.close(); await mongoose.disconnect(); await db.stop(); process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch(error => { console.error(error); process.exit(1); });
