// Run only against calling-smoke-server.cjs (ephemeral DB, fake providers).
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const base = 'http://127.0.0.1:5101';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const users = await (await fetch(`${base}/__smoke/fixtures`)).json();
  async function api(path, token, body, method = 'POST') {
    const res = await fetch(`${base}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const payload = await res.json();
    if (!res.ok) throw Error(`${path}: ${res.status} ${payload.message}`);
    return payload.data;
  }
  const state = async () => (await fetch(`${base}/__smoke/state`)).json();
  const socket = io(base, { transports: ['websocket'], auth: { token: users.consultantToken } });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  try {
    const login = await api('/auth/login', '', { email: users.normalUserEmail, password: 'SmokePassword123!' });
    assert.ok(login.accessToken);
    let incoming;
    socket.once('incoming-call', event => { incoming = event; });
    const booking = await api('/consultation/book', users.normalUserToken, { consultantId: users.consultantId, bookingType: 'instant' });
    const id = booking.session._id;
    const consultationId = booking.consultation._id;
    await delay(100);
    assert.equal(incoming.sessionId, id);
    console.log('PASS real login, booking and incoming-call socket');
    await api('/video-session/join', users.normalUserToken, { sessionId: id });
    await api('/video-session/create', users.consultantToken, { consultationId });
    let snapshot = await state();
    assert.deepEqual(snapshot.sessions.find(s => s._id === id).joinedParticipants, [users.normalUserId]);
    assert.equal(snapshot.ledger.filter(l => l.consultationId === consultationId && l.type === 'charge').length, 0);
    console.log('PASS repeated create preserves caller; no early charge');
    const join = await api('/video-session/join', users.consultantToken, { sessionId: consultationId });
    assert.equal(join.status, 'ongoing');
    assert.equal(join.uid, 2001);
    await api('/video-session/join', users.normalUserToken, { sessionId: id });
    snapshot = await state();
    assert.equal(snapshot.ledger.filter(l => l.consultationId === consultationId && l.type === 'charge' && l.status === 'succeeded').length, 1);
    console.log('PASS both joins, consultation-ID fallback and single initial charge');
    await Promise.all([
      api('/video-session/end', users.normalUserToken, { sessionId: id }),
      api('/video-session/end', users.consultantToken, { sessionId: id }),
    ]);
    snapshot = await state();
    assert.equal(snapshot.sessions.find(s => s._id === id).status, 'ended');
    assert.equal(snapshot.consultations.find(c => c._id === consultationId).paymentStatus, 'paid');
    console.log('PASS concurrent hangup');
    for (const action of ['CANCEL', 'REJECT']) {
      const next = await api('/consultation/book', users.normalUserToken, { consultantId: users.consultantId, bookingType: 'instant' });
      await api('/video-session/action', action === 'REJECT' ? users.consultantToken : users.normalUserToken, { sessionId: next.session._id, action });
      snapshot = await state();
      assert.equal(snapshot.sessions.find(s => s._id === next.session._id).status, 'ended');
      assert.equal(snapshot.ledger.filter(l => l.consultationId === next.consultation._id && l.type === 'charge').length, 0);
      console.log(`PASS ${action} before connection without charge`);
    }
  } finally { socket.disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
