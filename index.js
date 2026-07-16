/**
 * @format
 */
import "react-native-gesture-handler";
import { AppRegistry } from "react-native";
import App from "./App";
import { name as appName } from "./app.json";

import { getApp } from "@react-native-firebase/app";
import { getMessaging, setBackgroundMessageHandler } from "@react-native-firebase/messaging";
import notifee, { AndroidImportance } from "@notifee/react-native";
import { saveNotification } from "./src/utils/notifications";

async function ensurePushChannel() {
  await notifee.createChannel({
    id: "push",
    name: "Push Alerts",
    importance: AndroidImportance.HIGH,
  });
}

const app = getApp();
const messaging = getMessaging(app);

setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  await ensurePushChannel();

  const title = remoteMessage?.notification?.title || "New Alert";
  const body = remoteMessage?.notification?.body || "You have a notification.";
  const data = remoteMessage?.data ?? {};

  await saveNotification({
    id: String(Date.now()),
    type: "push",
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    data,
  });

  await notifee.displayNotification({
    title,
    body,
    android: { channelId: "push", pressAction: { id: "default" }, smallIcon: "ic_launcher" },
    data,
  });
});

AppRegistry.registerComponent(appName, () => App);