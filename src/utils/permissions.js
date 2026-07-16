import { Platform, PermissionsAndroid, Linking, Alert } from "react-native";

/**
 * Android 13+ requires POST_NOTIFICATIONS runtime permission.
 * On Android 12 and below, it returns true.
 */
export async function requestNotificationPermission() {
  if (Platform.OS !== "android") return true;

  // Android 13 = API 33
  const api = Platform.Version;
  if (typeof api === "number" && api < 33) return true;

  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: "Notification Permission",
        message: "Allow eBantay to send risk alerts and emergency notifications.",
        buttonNegative: "Cancel",
        buttonPositive: "Allow",
      }
    );

    if (res === PermissionsAndroid.RESULTS.GRANTED) return true;

    Alert.alert(
      "Permission not granted",
      "Notifications are disabled. You can enable them in App Settings.",
      [
        { text: "Later", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings?.() },
      ]
    );
    return false;
  } catch {
    return false;
  }
}