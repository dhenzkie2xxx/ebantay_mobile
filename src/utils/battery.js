import { Platform, Linking, Alert } from "react-native";

/**
 * Opens Battery Optimization exclusions screen:
 * User picks: "All apps" -> eBantay -> "Don't optimize"
 */
export async function openBatteryOptimizationSettings() {
  if (Platform.OS !== "android") {
    Alert.alert("Not supported", "Battery optimization settings are available on Android only.");
    return;
  }

  try {
    await Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
  } catch (e) {
    Alert.alert(
      "Open Settings",
      "Could not open the battery optimization screen automatically. We'll open App Settings instead.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open App Settings", onPress: () => Linking.openSettings?.() },
      ]
    );
  }
}

/** Some phones place controls under Battery Saver */
export async function openBatterySaverSettings() {
  if (Platform.OS !== "android") return;

  try {
    await Linking.sendIntent("android.settings.BATTERY_SAVER_SETTINGS");
  } catch {
    await Linking.openSettings?.();
  }
}