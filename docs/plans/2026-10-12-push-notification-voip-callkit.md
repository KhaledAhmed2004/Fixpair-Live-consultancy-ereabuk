# Push Notification & VoIP Video Calling (iOS & Android) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a production-grade, platform-specific notification pipeline for incoming video calls that triggers native CallKit / incoming call popups on both iOS (via Apple PushKit VoIP) and Android (via FCM High-Priority Data-only messages), along with call cancellation dismissal and schema updates.

**Architecture:** 
- **iOS:** Direct APNs connection via `@parse/node-apn` using `.p8` private key, targeting `com.fixpair.app.voip` topic with `apns-push-type: voip` to wake up killed devices and trigger native CallKit.
- **Android:** Firebase Admin SDK sending **Data-Only** FCM messages (`priority: high`, no `notification` block) so the background Dart handler can intercept and call `FlutterCallkitIncoming.showCallkitIncoming()`.
- **General Notifications:** Standard FCM with `notification` and `data` objects for chat, appointments, and general updates.

**Tech Stack:** TypeScript, Node.js, Express, Mongoose, `@parse/node-apn`, `firebase-admin`, Vitest.

---

### Task 1: Certificates, Security & Environment Configuration

**Files:**
- Move/Copy: `C:\Users\Khaled\Downloads\AuthKey_F27ZS4U272.p8` -> `certs/AuthKey_F27ZS4U272.p8`
- Modify: `.gitignore`
- Modify: `src/config/index.ts`
- Modify: `.env`

**Step 1: Update `.gitignore`**
Ensure `./certs/` and `*.p8` files are strictly ignored so Apple private credentials never leak to GitHub.

**Step 2: Copy the `.p8` key to `certs/`**
Place `AuthKey_F27ZS4U272.p8` into `./certs/AuthKey_F27ZS4U272.p8`.

**Step 3: Update `src/config/index.ts`**
Export APNs configuration:
```typescript
apns: {
  keyId: process.env.APNS_KEY_ID || 'F27ZS4U272',
  teamId: process.env.APNS_TEAM_ID || 'XH9NDHRU5Z',
  bundleId: process.env.APNS_BUNDLE_ID || 'com.fixpair.app',
  topic: process.env.APNS_VOIP_TOPIC || 'com.fixpair.app.voip',
  p8FilePath: process.env.APNS_P8_FILE_PATH || './certs/AuthKey_F27ZS4U272.p8',
  isProduction: process.env.APNS_PRODUCTION === 'true',
}
```

---

### Task 2: Database Schema & API Support for `voipToken`

**Files:**
- Modify: `src/app/modules/user/user.interface.ts`
- Modify: `src/app/modules/user/user.model.ts`
- Modify: `src/app/modules/user/user.validation.ts`
- Modify: `src/app/modules/user/user.service.ts`

**Step 1: Update User Interface and Mongoose Schema**
- Add `voipToken?: string;` to `IUser`.
- In `userSchema`, add:
  ```typescript
  voipToken: {
    type: String,
    default: null,
  },
  ```

**Step 2: Update User Validation**
- In `user.validation.ts`, update `deviceTokenZodSchema` to accept optional `voipToken`:
  ```typescript
  voipToken: z.string().optional(),
  ```

**Step 3: Update `updateDeviceToken` in `user.service.ts`**
- When action is `'add'`, save `voipToken` (if provided) alongside `deviceType` and `fcmTokens`.
- When action is `'remove'`, remove `deviceToken` and unset `voipToken` if applicable.

---

### Task 3: Notification Helper Refactoring

**Files:**
- Modify: `src/helpers/notification/notificationHelper.ts`
- Create helper / service: `src/helpers/notification/apnsHelper.ts` (or integrated in notificationHelper)

**Step 1: Initialize `@parse/node-apn` Provider**
Initialize APNs Provider singleton with the `.p8` certificate if the file exists:
```typescript
import apn from '@parse/node-apn';
// Initialize Provider with token { key, keyId, teamId }, production flag
```

**Step 2: Implement `sendIncomingCallNotification`**
- Parameters:
  - `recipient`: `{ deviceType?: string; fcmTokens?: string[]; voipToken?: string }`
  - `callData`: `{ sessionId: string; agoraToken: string; channelName: string; callerName: string; callerAvatar?: string; bookingId?: string }`
- **If `recipient.deviceType === 'ios'`:**
  - Check `recipient.voipToken`.
  - Build `apn.Notification`:
    - `pushType = 'voip'`
    - `priority = 10`
    - `expiry = 0`
    - `topic = config.apns.topic` (`com.fixpair.app.voip`)
    - Payload with `aps: { 'content-available': 1 }`, `id` (random UUID), `type: 1`, and `extra` containing Agora & session parameters.
  - Send via APNs Provider.
- **If `recipient.deviceType === 'android'`:**
  - Build FCM message:
    - **NO** `notification` object!
    - `android: { priority: 'high', ttl: 30 * 1000 }`
    - `data: { type: 'INCOMING_CALL', sessionId, token, channelName, callerName, callerAvatar, bookingId }` (all stringified).
  - Send via `admin.messaging().sendEachForMulticast` or `send`.
- **Desktop / Web clients:**
  - Send webpush notification if web tokens exist.

**Step 3: Implement `sendCallCancellationNotification`**
- When call is cancelled / missed:
  - iOS: APNs VoIP push with `type: 'CALL_CANCELLED'`, `extra: { sessionId, status: 'cancelled' }`.
  - Android: FCM Data-only push with `data: { type: 'CALL_CANCELLED', sessionId, status: 'cancelled' }`.

**Step 4: Keep `sendPushNotification` for General Notifications**
- Keep existing regular notifications for chat, bookings, etc. using standard `{ notification: { title, body }, data }`.

---

### Task 4: Connect to Video Session Lifecycle

**Files:**
- Modify: `src/app/modules/videoSession/videoSession.service.ts`

**Step 1: Update Call Initiation in `createSession`**
- Pass full recipient details (`recipient.deviceType`, `recipient.voipToken`, `recipient.fcmTokens`) to `sendIncomingCallNotification`.

**Step 2: Update Call Rejection / Cancellation / Timeout**
- When caller hangs up before session is answered, trigger `sendCallCancellationNotification` so the receiver's phone immediately stops ringing.

---

### Task 5: Verification & Compilation

**Files:**
- Test: `src/app/__tests__/incoming-call-notification.spec.ts`

**Step 1: Run TypeScript Compilation**
- Run `npm run build` to verify zero type errors.

**Step 2: Run Automated Tests**
- Run `npm test` or `npx vitest run src/app/__tests__/incoming-call-notification.spec.ts` to verify payload correctness and routing logic.
