import { Alert, Linking, Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

const VERSION_URL = "https://top.gen.in/version.json";

function compareVersions(a, b) {
  // returns 1 if a>b, -1 if a<b, 0 if equal
  const pa = String(a).split(".").map(n => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export async function checkForUpdate({ silent = false } = {}) {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    const manifest = await res.json();

    const latest = manifest.latest_version;
    const apkUrl = manifest.apk_url || "https://top.gen.in/downloads/ebantay-latest.apk";
    const landingUrl = manifest.landing_url || "https://top.gen.in";
    const force = !!manifest.force_update;
    const notes = manifest.release_notes || "";

    const current = DeviceInfo.getVersion(); // versionName (e.g. 1.0.0)

    if (compareVersions(latest, current) <= 0) {
      return { needsUpdate: false, current, latest };
    }

    const message =
      `Current: ${current}\nLatest: ${latest}\n\n` +
      (notes ? `What’s new:\n${notes}\n\n` : "") +
      (Platform.OS === "android"
        ? "Tap Update to download and install the latest APK."
        : "Updates are available on the website.");

    if (!silent) {
      Alert.alert(
        force ? "Update Required" : "Update Available",
        message,
        force
          ? [
              {
                text: "Update Now",
                onPress: () => Linking.openURL(apkUrl),
              }
            ]
          : [
              { text: "Later", style: "cancel" },
              { text: "Update Now", onPress: () => Linking.openURL(apkUrl) },
              { text: "Open Website", onPress: () => Linking.openURL(landingUrl) }
            ],
        { cancelable: !force }
      );
    }

    return { needsUpdate: true, current, latest, force, apkUrl };
  } catch (e) {
    if (!silent) {
      // optional: show nothing so it doesn't annoy users on bad network
      // Alert.alert("Update check failed", "Please try again later.");
    }
    return { needsUpdate: false, error: String(e) };
  }
}
