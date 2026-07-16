import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import {
  getNotifications,
  clearNotifications,
  markAllNotificationsReadLocal,
  markNotificationReadLocal,
  getNotificationTypeLabel,
  getNotificationTypeIcon,
} from "../utils/notifications";
import { fetchAlertsFeed, markAlertsRead, syncServerNotifications } from "../utils/push";
import { handleNotificationNavigation } from "../navigation/navigationService";

const COLORS = {
  bg: "#F4F7FF",
  blueDark: "#0B2A6F",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
  red: "#DC2626",
  orange: "#EA580C",
  green: "#16A34A",
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

export default function NotificationScreen() {
  const [list, setList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [serverUnread, setServerUnread] = useState(0);

  const load = useCallback(async () => {
    await syncServerNotifications();

    const [localList, feed] = await Promise.all([
      getNotifications(),
      fetchAlertsFeed(),
    ]);

    setList(Array.isArray(localList) ? localList : []);
    setServerUnread(Number(feed.unreadCount || 0));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markAllRead = useCallback(async () => {
    const current = await getNotifications();
    const unreadServerIds = current
      .filter((x) => !x.read && x?.data?.serverAlertId)
      .map((x) => Number(x.data.serverAlertId))
      .filter((v) => v > 0);

    await markAllNotificationsReadLocal();

    if (unreadServerIds.length) {
      await markAlertsRead(unreadServerIds);
    }

    await load();
  }, [load]);

  const onClear = useCallback(async () => {
    Alert.alert("Clear notifications", "Remove all notifications on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearNotifications();
          await load();
        },
      },
    ]);
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>
            {list.length} local • {serverUnread} unread
          </Text>
        </View>

        <Pressable onPress={markAllRead} style={styles.actionBtn}>
          <Icon name="done-all" size={18} color={COLORS.blueDark} />
          <Text style={styles.actionText}>Read</Text>
        </Pressable>

        <Pressable onPress={onClear} style={styles.actionBtn}>
          <Icon name="delete" size={18} color={COLORS.red} />
          <Text style={[styles.actionText, { color: COLORS.red }]}>Clear</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 26 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {list.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="notifications-none" size={32} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>
              Hotspot alerts, incident updates, and panic status updates will appear here.
            </Text>
          </View>
        ) : (
          list.map((n) => {
            const severity = String(n.severity || n.data?.severity || "").toLowerCase();
            const unread = !n.read;
            const notificationType = n.data?.notificationType || n.data?.type || n.type || "HOTSPOT_ALERT";

            const isRed = severity === "red";
            const isOrange = severity === "orange";
            const isGreen = severity === "green";

            const badgeStyle = isRed
              ? styles.badgeRed
              : isOrange
              ? styles.badgeOrange
              : isGreen
              ? styles.badgeGreen
              : styles.badgePush;

            const badgeTextColor = isRed
              ? "#7F1D1D"
              : isOrange
              ? "#9A3412"
              : isGreen
              ? "#166534"
              : COLORS.blueDark;

            const label = getNotificationTypeLabel(notificationType);
            const icon = getNotificationTypeIcon(notificationType);

            return (
              <Pressable
                key={n.id}
                onPress={async () => {
                  const payload = {
                    ...(n.data || {}),
                    localNotificationId: n.id,
                  };

                  await markNotificationReadLocal(n.id);

                  if (n?.data?.serverAlertId) {
                    await markAlertsRead([Number(n.data.serverAlertId)]);
                  }

                  setList((prev) =>
                    prev.map((x) =>
                      String(x.id) === String(n.id)
                        ? { ...x, read: true }
                        : x
                    )
                  );

                  await handleNotificationNavigation(payload);
                }}
                style={({ pressed }) => [
                  styles.card,
                  unread && styles.cardUnread,
                  pressed && { opacity: 0.92 }
                ]}
              >
                <View style={styles.row}>
                  <View style={[styles.badge, badgeStyle]}>
                    <Icon name={icon} size={16} color={badgeTextColor} />
                    <Text style={[styles.badgeText, { color: badgeTextColor }]}>
                      {label}
                    </Text>
                  </View>

                  {unread ? <View style={styles.dot} /> : null}
                </View>

                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>

                <View style={styles.footerRow}>
                  <Text style={styles.time}>{formatTime(n.createdAt)}</Text>

                  {n.data?.incidentId ? (
                    <View style={styles.metaChip}>
                      <Icon name="description" size={14} color={COLORS.muted} />
                      <Text style={styles.metaText}>Incident #{n.data.incidentId}</Text>
                    </View>
                  ) : n.data?.hotspotId ? (
                    <View style={styles.metaChip}>
                      <Icon name="place" size={14} color={COLORS.muted} />
                      <Text style={styles.metaText}>Hotspot #{n.data.hotspotId}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  headerCard: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  headerSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: COLORS.muted },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  actionText: { fontSize: 12, fontWeight: "900", color: COLORS.blueDark },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
  },
  emptyTitle: { marginTop: 8, fontWeight: "900", color: COLORS.text },
  emptySub: { marginTop: 4, color: COLORS.muted, fontWeight: "700", textAlign: "center" },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: "rgba(11,42,111,0.35)",
    backgroundColor: "rgba(11,42,111,0.03)",
  },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeRed: { backgroundColor: "rgba(220,38,38,.08)", borderColor: "rgba(220,38,38,.18)" },
  badgeOrange: { backgroundColor: "rgba(234,88,12,.08)", borderColor: "rgba(234,88,12,.18)" },
  badgeGreen: { backgroundColor: "rgba(22,163,74,.08)", borderColor: "rgba(22,163,74,.18)" },
  badgePush: { backgroundColor: "rgba(29,78,216,.08)", borderColor: "rgba(29,78,216,.18)" },
  badgeText: { fontSize: 12, fontWeight: "900" },

  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: COLORS.red },

  title: { marginTop: 10, fontSize: 14, fontWeight: "900", color: COLORS.text },
  body: { marginTop: 6, fontSize: 12, fontWeight: "700", color: COLORS.muted, lineHeight: 16 },

  footerRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontSize: 11, fontWeight: "800", color: COLORS.muted },

  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  metaText: { fontSize: 11, fontWeight: "900", color: COLORS.muted },
});