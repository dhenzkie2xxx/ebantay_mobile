import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

import { API_BASE_URL } from "../config/api";
import { authFetch } from "../utils/auth";

const COLORS = {
  bg: "#F4F7FF",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  blueDark: "#0B2A6F",
  blue: "#1D4ED8",
  red: "#DC2626",
  orange: "#F59E0B",
  green: "#16A34A",
};

function priorityPack(priority) {
  const p = String(priority || "normal").toLowerCase();

  if (p === "urgent") {
    return {
      label: "Urgent",
      icon: "warning",
      color: COLORS.red,
      bg: "#FEE2E2",
      border: "#FCA5A5",
      text: "#7F1D1D",
    };
  }

  if (p === "important") {
    return {
      label: "Important",
      icon: "campaign",
      color: COLORS.orange,
      bg: "#FEF3C7",
      border: "#FCD34D",
      text: "#92400E",
    };
  }

  return {
    label: "Advisory",
    icon: "campaign",
    color: COLORS.blue,
    bg: "#DBEAFE",
    border: "#93C5FD",
    text: COLORS.blueDark,
  };
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function CommunityAlertScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [announcements, setAnnouncements] = useState([]);
  const [scope, setScope] = useState({
    region: null,
    province: null,
    city_municipality: null,
  });

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await authFetch(
        navigation,
        `${API_BASE_URL}/community_announcements_feed.php`,
        {
          method: "GET",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Unable to load community announcements.");
      }

      setAnnouncements(
        Array.isArray(data.announcements) ? data.announcements : []
      );

      setScope({
        region: data?.scope?.region || null,
        province: data?.scope?.province || null,
        city_municipality: data?.scope?.city_municipality || null,
      });
    } catch (err) {
      Alert.alert(
        "Community Alerts",
        err?.message || "Unable to load community announcements."
      );
      setAnnouncements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnnouncements();
  }, [loadAnnouncements]);

  const stats = useMemo(() => {
    return {
      total: announcements.length,
      urgent: announcements.filter(
        (x) => String(x.priority || "").toLowerCase() === "urgent"
      ).length,
      important: announcements.filter(
        (x) => String(x.priority || "").toLowerCase() === "important"
      ).length,
    };
  }, [announcements]);

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Community Alerts</Text>
          <Text style={styles.subtitle}>
            Announcements from your local police station.
          </Text>

          {!!scope.city_municipality || !!scope.province ? (
            <Text style={styles.scopeText}>
              Scope: {scope.city_municipality ? `${scope.city_municipality}, ` : ""}
              {scope.province || ""}
            </Text>
          ) : null}
        </View>

        <Pressable onPress={loadAnnouncements} style={styles.refreshBtn}>
          <Icon name="refresh" size={20} color={COLORS.blueDark} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.blueDark} />
          <Text style={styles.loadingText}>Loading community alerts...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.urgent}</Text>
              <Text style={styles.statLabel}>Urgent</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.important}</Text>
              <Text style={styles.statLabel}>Important</Text>
            </View>
          </View>

          {announcements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="campaign" size={38} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.emptySub}>
                Active advisories from your city/municipality police station will appear here.
              </Text>
            </View>
          ) : (
            announcements.map((item) => {
              const pack = priorityPack(item.priority);

              return (
                <View
                  key={String(item.id)}
                  style={[
                    styles.card,
                    {
                      borderColor: pack.border,
                    },
                  ]}
                >
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.iconBadge,
                        {
                          backgroundColor: pack.bg,
                          borderColor: pack.border,
                        },
                      ]}
                    >
                      <Icon name={pack.icon} size={20} color={pack.color} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{item.title}</Text>
                      <Text style={styles.alertMeta}>
                        {item.city_municipality || "Local Station"} •{" "}
                        {formatDate(item.created_at)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.alertText}>{item.message}</Text>

                  <View
                    style={[
                      styles.priorityChip,
                      {
                        backgroundColor: pack.bg,
                        borderColor: pack.border,
                      },
                    ]}
                  >
                    <Text style={[styles.priorityText, { color: pack.text }]}>
                      {pack.label}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  headerCard: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "700",
  },
  scopeText: {
    marginTop: 5,
    color: COLORS.blueDark,
    fontSize: 12,
    fontWeight: "800",
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: COLORS.muted,
    fontWeight: "700",
  },
  scroll: {
    padding: 16,
    paddingBottom: 28,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    alignItems: "center",
  },
  statValue: {
    color: COLORS.blueDark,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 10,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  emptySub: {
    marginTop: 5,
    color: COLORS.muted,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 19,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: {
    fontWeight: "900",
    fontSize: 15,
    color: COLORS.text,
  },
  alertMeta: {
    marginTop: 3,
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  alertText: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
    lineHeight: 20,
    fontWeight: "700",
  },
  priorityChip: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "900",
  },
});