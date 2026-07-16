import { getApp } from "@react-native-firebase/app";
import { getMessaging, getToken, onMessage } from "@react-native-firebase/messaging";
import notifee, {
  AndroidImportance,
  EventType,
} from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";
import {
  saveNotification,
  ensureNotificationChannels,
  notifyHotspot,
  hasSeenServerAlert,
  markServerAlertSeen,
  normalizeSeverity,
} from "./notifications";
import { handleNotificationNavigation } from "../navigation/navigationService";

let pollTimer = null;
let syncing = false;
let foregroundUnsubscribe = null;

async function ensurePushChannel() {
  await notifee.createChannel({
    id: "push",
    name: "Push Alerts",
    importance: AndroidImportance.HIGH,
  });
}

export async function fetchAlertsFeed() {
  const authToken = await AsyncStorage.getItem("auth_token");
  if (!authToken) return { unreadCount: 0, alerts: [] };

  try {
    const res = await fetch(`${API_BASE_URL}/my_alerts.php`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const txt = await res.text();
    const json = JSON.parse(txt);

    if (!res.ok || !json?.ok) {
      console.log("fetchAlertsFeed failed:", res.status, json);
      return { unreadCount: 0, alerts: [] };
    }

    return {
      unreadCount: Number(json.unread_count || 0),
      alerts: Array.isArray(json.alerts) ? json.alerts : [],
    };
  } catch (e) {
    console.log("fetchAlertsFeed error:", e?.message || e);
    return { unreadCount: 0, alerts: [] };
  }
}

export async function getUnreadCount() {
  const feed = await fetchAlertsFeed();
  return Number(feed.unreadCount || 0);
}

export async function markAlertsRead(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return;

  const authToken = await AsyncStorage.getItem("auth_token");
  if (!authToken) return;

  try {
    const res = await fetch(`${API_BASE_URL}/my_alerts_mark_read.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ ids }),
    });

    const txt = await res.text();
    console.log("my_alerts_mark_read.php ->", res.status, txt);
  } catch (e) {
    console.log("markAlertsRead error:", e?.message || e);
  }
}

export async function syncServerNotifications() {
  if (syncing) return;
  syncing = true;

  try {
    const { alerts } = await fetchAlertsFeed();
    if (!alerts.length) return;

    for (const a of alerts) {
      const serverAlertId = String(a.id || "");
      if (!serverAlertId) continue;

      const seen = await hasSeenServerAlert(serverAlertId);
      if (seen) continue;

      const notificationType = a.type || "HOTSPOT_ALERT";

      await notifyHotspot({
        severity: normalizeSeverity(a.severity),
        title: a.title || "New Alert",
        body: a.message || "",
        data: {
          serverAlertId,
          notificationType,
          type: notificationType,
          incidentId: a.incident_id ? String(a.incident_id) : "",
          hotspotId: a.hotspot_id ? String(a.hotspot_id) : "",
          severity: normalizeSeverity(a.severity),
        },
      });

      await markServerAlertSeen(serverAlertId);
    }
  } catch (e) {
    console.log("syncServerNotifications error:", e?.message || e);
  } finally {
    syncing = false;
  }
}

export function startNotificationPolling({ intervalMs = 30000 } = {}) {
  stopNotificationPolling();
  syncServerNotifications();
  pollTimer = setInterval(() => {
    syncServerNotifications();
  }, intervalMs);
}

export function stopNotificationPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function setupNotificationNavigationHandlers() {
  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }

  foregroundUnsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      handleNotificationNavigation(detail?.notification?.data || {});
    }
  });

  const initialNotification = await notifee.getInitialNotification();
  if (initialNotification?.notification?.data) {
    setTimeout(() => {
      handleNotificationNavigation(initialNotification.notification.data);
    }, 600);
  }
}

async function saveDeviceTokenToServer(fcmToken) {
  try {
    const authToken = await AsyncStorage.getItem("auth_token");
    if (!authToken || !fcmToken) return;

    const res = await fetch(`${API_BASE_URL}/save_device_token.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: authToken,
        fcm_token: fcmToken,
        platform: "android",
      }),
    });

    const txt = await res.text();
    console.log("save_device_token.php ->", res.status, txt);
  } catch (e) {
    console.log("save_device_token error:", e?.message || e);
  }
}

export async function initPushAndroid() {
  try {
    await notifee.requestPermission();
  } catch (e) {
    console.log("notifee.requestPermission error:", e?.message || e);
  }

  try {
    await ensurePushChannel();
  } catch (e) {
    console.log("ensurePushChannel error:", e?.message || e);
  }

  try {
    await ensureNotificationChannels();
  } catch (e) {
    console.log("ensureNotificationChannels error:", e?.message || e);
  }

  try {
    await setupNotificationNavigationHandlers();
  } catch (e) {
    console.log("setupNotificationNavigationHandlers error:", e?.message || e);
  }

  let fcmToken = null;

  try {
    const app = getApp();
    const messaging = getMessaging(app);

    try {
      fcmToken = await getToken(messaging);
      console.log("FCM token acquired:", fcmToken ? "YES" : "NO");
    } catch (e) {
      console.log("getToken error:", e?.message || e);
      fcmToken = null;
    }

    if (fcmToken) {
      await saveDeviceTokenToServer(fcmToken);
    }

    onMessage(messaging, async (remoteMessage) => {
      try {
        const title = remoteMessage?.notification?.title || "New Alert";
        const body = remoteMessage?.notification?.body || "You have a notification.";
        const data = remoteMessage?.data ?? {};

        await saveNotification({
          id: String(Date.now()),
          type: data?.notificationType || "PUSH",
          severity: normalizeSeverity(data?.severity || "push"),
          title,
          body,
          createdAt: new Date().toISOString(),
          read: false,
          data,
        });

        await notifee.displayNotification({
          title,
          body,
          android: {
            channelId: "push",
            pressAction: { id: "default" },
            smallIcon: "ic_launcher",
          },
          data,
        });
      } catch (e) {
        console.log("onMessage handler error:", e?.message || e);
      }
    });
  } catch (e) {
    console.log("initPushAndroid messaging setup error:", e?.message || e);
  }

  startNotificationPolling({ intervalMs: 30000 });

  return fcmToken;
}