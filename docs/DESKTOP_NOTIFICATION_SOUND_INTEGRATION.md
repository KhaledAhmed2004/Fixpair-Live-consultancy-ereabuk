# Desktop Notifications, Incoming Call Alerts & Sound Integration Guide

This guide describes how to integrate desktop system notifications, real-time incoming call popups, and audio alerts on the Web/Desktop frontend (like Facebook Messenger, WhatsApp Web, or Instagram).

---

## 1. Architecture Overview

```
                        +----------------------------+
                        |       Fixpair Backend      |
                        +--------------+-------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
        Socket.io Event                         Firebase Cloud Messaging
  (Tab is open or focused)                      (Tab closed / background)
                   |                                       |
                   v                                       v
    Frontend Socket Listeners                  Browser Service Worker
  - Play Ringtone / Notification Sound       - OS Desktop Notification Banner
  - Open Incoming Call Modal / Ringing UI    - Click to focus / open call link
  - Native HTML5 Notification
```

---

## 2. Registering Web Push Device Token (FCM)

To enable desktop notifications when the browser tab is closed or running in the background, the Frontend/Client requests a token using the Firebase **VAPID Key (Web Push Certificate)** and sends it to the backend.

### A. Frontend: Get FCM Token using VAPID Key

```javascript
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  // your firebase web config
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Your Firebase Web Push Certificate (VAPID Key):
const VAPID_KEY = "BOCrNH1eoAoSr4U4tsXK-fpIiPDNOeEYYLwbMRIwddDLiK5EW5iFO3Qo-rn6dkAneWzZ_zP3smZeFLDqkzv5D-k";

export async function registerWebPushToken(userJwtToken) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (currentToken) {
      // Send token to backend
      await fetch("https://your-backend-domain.com/api/v1/user/device-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userJwtToken}`,
        },
        body: JSON.stringify({
          deviceToken: currentToken,
          deviceType: "web",
          action: "add",
        }),
      });
    }
  } catch (error) {
    console.error("Failed to register Web Push token:", error);
  }
}
```

### B. Backend API Endpoint Reference

- **Endpoint**: `POST /api/v1/user/device-token`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
```json
{
  "deviceToken": "fcm_browser_registration_token_here",
  "deviceType": "web",
  "action": "add"
}
```

---

## 3. Real-Time Socket Events

Ensure your web client connects to Socket.io with the authenticated user's JWT token:

```javascript
import { io } from "socket.io-client";

const socket = io("https://your-backend-domain.com", {
  auth: {
    token: "Bearer " + userJwtToken,
  },
});
```

### Key Events to Listen:

| Event Name | Description | Recommended Client Action |
| :--- | :--- | :--- |
| `incoming-call` | Received when a user or consultant initiates a video/callback call. | 1. Start playing looping ringtone.<br>2. Show incoming call modal with caller details.<br>3. Trigger desktop system notification if tab is in background. |
| `call-cancelled` | Caller hung up before answering. | Stop ringtone, dismiss incoming call modal. |
| `call-rejected` | Recipient rejected the call. | Stop ringing, show "Call Declined" toast. |
| `call-ended` | Call ended by either participant. | Stop all audio, close video room, show summary. |
| `notification` | General in-app notification (e.g., "New Callback Request", "Consultation Accepted"). | 1. Play a short chime audio sound.<br>2. Show toast / update notification badge.<br>3. Show desktop system notification. |

---

## 4. Playing Sound on Desktop (Autoplay Policy Safe)

Modern desktop browsers (Chrome, Firefox, Safari, Edge) block audio from playing automatically without prior user interaction.

### Sound Manager Pattern:

```javascript
class AudioManager {
  constructor() {
    this.ringtone = new Audio('/sounds/incoming-call.mp3');
    this.ringtone.loop = true;
    
    this.chime = new Audio('/sounds/notification-chime.mp3');
    this.isUnlocked = false;

    // Unlock audio context on the first user click anywhere in the app
    const unlock = () => {
      this.ringtone.play().then(() => {
        this.ringtone.pause();
        this.ringtone.currentTime = 0;
        this.isUnlocked = true;
        window.removeEventListener('click', unlock);
      }).catch(() => {});
    };
    window.addEventListener('click', unlock);
  }

  playRingtone() {
    this.ringtone.currentTime = 0;
    this.ringtone.play().catch(err => console.warn('Ringtone autoplay prevented:', err));
  }

  stopRingtone() {
    this.ringtone.pause();
    this.ringtone.currentTime = 0;
  }

  playNotificationChime() {
    this.chime.currentTime = 0;
    this.chime.play().catch(err => console.warn('Chime autoplay prevented:', err));
  }
}

export const audioManager = new AudioManager();
```

---

## 5. Desktop System Notifications (Browser Notification API)

Request permission upon user login:

```javascript
export async function requestDesktopNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notifications.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}
```

Show notification when tab is unfocused or backgrounded:

```javascript
export function showDesktopNotification(title, options = {}) {
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      icon: options.icon || "/favicon.ico",
      body: options.body || "",
      requireInteraction: options.requireInteraction || false,
      tag: options.tag || "notification",
    });

    notification.onclick = () => {
      window.focus();
      if (options.url) {
        window.location.href = options.url;
      }
      notification.close();
    };
  }
}
```

---

## 6. Putting It All Together in Frontend

```javascript
// 1. Listen for incoming calls (both Instant and Callback sessions)
socket.on("incoming-call", (data) => {
  // data: { sessionId, callerName, callerAvatar, channelName, token, bookingId, ... }
  
  // A. Start Ringtone
  audioManager.playRingtone();

  // B. Show Desktop Notification if tab is hidden
  if (document.hidden) {
    showDesktopNotification(`Incoming Call from ${data.callerName}`, {
      body: "Click to answer the call",
      icon: data.callerAvatar || "/favicon.ico",
      requireInteraction: true,
      tag: data.sessionId,
      url: `/consultation/session/${data.sessionId}`,
    });
  }

  // C. Open In-App Call Dialog
  openIncomingCallModal(data);
});

// 2. Stop ringtone when caller cancels or hangs up
socket.on("call-cancelled", () => {
  audioManager.stopRingtone();
  closeIncomingCallModal();
});

// 3. Listen for general notifications (e.g. New Callback Request)
socket.on("notification", (data) => {
  // data: { title, message, type, relatedBooking, ... }
  
  // A. Play notification chime
  audioManager.playNotificationChime();

  // B. Show Desktop Notification if tab is hidden
  if (document.hidden) {
    showDesktopNotification(data.title, {
      body: data.message,
      icon: "/favicon.ico",
    });
  }

  // C. Show In-App Notification Toast
  showToast(data.title, data.message);
});
```
