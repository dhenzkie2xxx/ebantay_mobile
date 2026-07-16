import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

import { requestNotificationPermission } from "../utils/permissions";
import {
  openBatteryOptimizationSettings,
  openBatterySaverSettings,
} from "../utils/battery";
import { checkForUpdate } from "../utils/updateChecker";

const COLORS = {
  bg: "#F4F7FF",
  blueDark: "#0B2A6F",
  red: "#DC2626",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
};

export default function SettingsScreen() {
  const onAskNotifPermission = useCallback(async () => {
    const ok = await requestNotificationPermission();
    if (ok) {
      Alert.alert(
        "Notifications enabled",
        "You will receive app notifications and status updates."
      );
    }
  }, []);

  const onCheckUpdates = useCallback(async () => {
    try {
      await checkForUpdate({ silent: false });
    } catch {
      Alert.alert("Update", "Unable to check updates right now.");
    }
  }, []);

  const SectionTitle = ({ icon, title, sub }) => (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIcon}>
        <Icon name={icon} size={18} color={COLORS.blueDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
    </View>
  );

  const RowButton = ({ icon, title, sub, onPress, danger, style }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowCard,
        pressed && { opacity: 0.9 },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: COLORS.red }]}>
          {title}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Icon name={icon} size={22} color={danger ? COLORS.red : COLORS.muted} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSub}>
              App preferences, permissions, updates, and device optimization.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <SectionTitle
            icon="notifications"
            title="Notifications"
            sub="Allow eBantay to show status updates and important app notifications."
          />

          <RowButton
            icon="open-in-new"
            title="Grant Notification Permission"
            sub="Required on Android 13+ so eBantay can display notifications."
            onPress={onAskNotifPermission}
          />
        </View>

        <View style={styles.card}>
          <SectionTitle
            icon="battery-saver"
            title="Battery Optimization"
            sub="Recommended so notifications and app services work more reliably."
          />

          <RowButton
            icon="open-in-new"
            title="Disable optimization for eBantay"
            sub='Battery optimization → All apps → eBantay → "Don’t optimize"'
            onPress={openBatteryOptimizationSettings}
          />

          <RowButton
            icon="open-in-new"
            title="Open Battery Saver settings"
            sub="Some phones manage background apps here (OEM-dependent)."
            onPress={openBatterySaverSettings}
            style={{ marginTop: 10 }}
          />

          <Text style={styles.helpText}>
            Tip: On Xiaomi, Oppo, Vivo, and Realme devices, also allow
            “Autostart” or “Background activity” for eBantay if notifications are delayed.
          </Text>
        </View>

        <View style={styles.card}>
          <SectionTitle
            icon="system-update"
            title="App Update"
            sub="Check whether a newer version of eBantay is available."
          />

          <RowButton
            icon="open-in-new"
            title="Check for Updates"
            sub="Look for the latest available app version."
            onPress={onCheckUpdates}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 28 },

  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  headerSub: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.text,
  },
  sectionSub: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontWeight: "700",
  },

  rowCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text,
  },
  rowSub: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 17,
    fontWeight: "700",
  },

  helpText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
});