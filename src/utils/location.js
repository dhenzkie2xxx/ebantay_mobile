import { Platform, PermissionsAndroid, Linking, Alert } from "react-native";
import Geolocation from "react-native-geolocation-service";

/**
 * Opens Android app settings (best effort).
 */
export async function openAppSettings() {
  try {
    if (Linking.openSettings) return await Linking.openSettings();
  } catch {}
}

/**
 * Request foreground + (optional) background location permissions.
 * - Foreground (FINE) is always required first.
 * - Background is needed for risk tracking when app is closed.
 *
 * NOTE:
 * - On Android 11+ (API 30+), background location is commonly granted via Settings screen.
 */
export async function requestLocationPermission({ background = false } = {}) {
  if (Platform.OS !== "android") return true;

  // 1) Foreground location
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: "Location Permission",
      message:
        "eBantay needs your location to send accurate alerts and show hotspots near you.",
      buttonNeutral: "Ask Me Later",
      buttonNegative: "Cancel",
      buttonPositive: "OK",
    }
  );

  if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
    return false;
  }

  // 2) Background location (optional)
  if (background) {
    // On Android 10+ background permission exists.
    // On Android 11+ user may need to enable "Allow all the time" in Settings.
    const api = Number(Platform.Version || 0);

    // Try normal request first (works on some devices/ROMs)
    const bg = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: "Background Location",
        message:
          "To receive risk alerts even when the app is closed, allow location access in the background.",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      }
    );

    if (bg !== PermissionsAndroid.RESULTS.GRANTED) {
      // If API 30+ (Android 11+), guide user to Settings
      Alert.alert(
        "Background location needed",
        api >= 30
          ? "To enable background risk alerts, go to App Settings → Permissions → Location → Allow all the time."
          : "Risk alerts may not work when the app is closed. You can enable background location in App Settings.",
        [
          { text: "Later", style: "cancel" },
          { text: "Open Settings", onPress: openAppSettings },
        ]
      );
      return false;
    }
  }

  return true;
}

export function getCurrentLocation({ highAccuracy = true, timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge: 3000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  });
}