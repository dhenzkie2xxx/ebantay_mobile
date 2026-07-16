import notifee, { AndroidImportance } from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORE_KEY = "app_notifications";
const SEEN_SERVER_ALERTS_KEY = "seen_server_alert_ids";

let channelsReady = false;

export async function ensureNotificationChannels() {
  if (channelsReady) return;

  await notifee.createChannel({
    id: "push",
    name: "Push Alerts",
    importance: AndroidImportance.HIGH,
  });

  await notifee.createChannel({
    id: "risk",
    name: "Risk Alerts",
    importance: AndroidImportance.HIGH,
  });

  channelsReady = true;
}

export function normalizeSeverity(value) {
  const v = String(value || "").toLowerCase();

  if (v === "high" || v === "red") return "red";
  if (v === "medium" || v === "orange") return "orange";
  if (v === "low" || v === "green") return "green";
  return "push";
}

export function getNotificationTypeLabel(type) {
  const t = String(type || "").toUpperCase();

  if (t === "INCIDENT_STATUS") return "INCIDENT";
  if (t === "PANIC_STATUS") return "PANIC";
  if (t === "HOTSPOT_ALERT") return "HOTSPOT";
  if (t === "ACCOUNT_STATUS") return "ACCOUNT";
  if (t === "ACCOUNT_VERIFIED") return "ACCOUNT";

  if (t === "GO_SIGNAL") return "GO SIGNAL";
  if (t === "NEAREST_UNIT_DETECTED") return "DISPATCH";
  if (t === "PROCEED_APPROVED") return "APPROVED";
  if (t === "PROCEED_DENIED") return "DENIED";
  if (t === "REQUEST_TO_PROCEED") return "REQUEST";
  if (t === "BACKUP_REQUEST") return "BACKUP";
  if (t === "ASSIGNMENT_OUTCOME") return "OUTCOME";

  return "ALERT";
}

export function getNotificationTypeIcon(type) {
  const t = String(type || "").toUpperCase();

  if (t === "INCIDENT_STATUS") return "description";
  if (t === "PANIC_STATUS") return "warning";
  if (t === "HOTSPOT_ALERT") return "place";
  if (t === "ACCOUNT_STATUS") return "manage-accounts";
  if (t === "ACCOUNT_VERIFIED") return "verified-user";

  if (t === "GO_SIGNAL") return "directions-run";
  if (t === "NEAREST_UNIT_DETECTED") return "local-police";
  if (t === "PROCEED_APPROVED") return "check-circle";
  if (t === "PROCEED_DENIED") return "cancel";
  if (t === "REQUEST_TO_PROCEED") return "send";
  if (t === "BACKUP_REQUEST") return "groups";
  if (t === "ASSIGNMENT_OUTCOME") return "assignment-turned-in";

  return "notifications";
}

export async function saveNotification(item) {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  const list = raw ? JSON.parse(raw) : [];
  const updated = [item, ...list].slice(0, 100);
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(updated));
  return updated;
}

export async function getNotifications() {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function setNotifications(list) {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(list || []));
}

export async function clearNotifications() {
  await AsyncStorage.removeItem(STORE_KEY);
}

export async function getSeenServerAlertIds() {
  const raw = await AsyncStorage.getItem(SEEN_SERVER_ALERTS_KEY);
  const list = raw ? JSON.parse(raw) : [];
  return Array.isArray(list) ? list : [];
}

export async function hasSeenServerAlert(id) {
  if (!id) return false;
  const list = await getSeenServerAlertIds();
  return list.includes(String(id));
}

export async function markServerAlertSeen(id) {
  if (!id) return;
  const list = await getSeenServerAlertIds();
  const sid = String(id);
  if (list.includes(sid)) return;
  const updated = [sid, ...list].slice(0, 500);
  await AsyncStorage.setItem(SEEN_SERVER_ALERTS_KEY, JSON.stringify(updated));
}

export async function markNotificationReadLocal(id) {
  const list = await getNotifications();
  const updated = list.map((x) =>
    String(x.id) === String(id) ? { ...x, read: true } : x
  );
  await setNotifications(updated);
  return updated;
}

export async function markAllNotificationsReadLocal() {
  const list = await getNotifications();
  const updated = list.map((x) => ({ ...x, read: true }));
  await setNotifications(updated);
  return updated;
}

export async function notifyHotspot({ severity = "green", title, body, data }) {
  await ensureNotificationChannels();

  const normalizedSeverity = normalizeSeverity(severity);

  const item = {
    id: String(Date.now()),
    type: data?.notificationType || data?.type || "HOTSPOT_ALERT",
    severity: normalizedSeverity,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    data: data ?? {},
  };

  await saveNotification(item);

  await notifee.displayNotification({
    title,
    body,
    data: data ?? {},
    android: {
      channelId: "risk",
      pressAction: { id: "default" },
      smallIcon: "ic_launcher",
      importance: AndroidImportance.HIGH,
    },
  });

  return item;
}

export async function notifyRisk({ title, body, data }) {
  return notifyHotspot({
    severity: data?.severity || "green",
    title,
    body,
    data,
  });
}