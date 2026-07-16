import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
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
  blue: "#2563EB",
  red: "#DC2626",
  orange: "#F97316",
  green: "#16A34A",
};

function statusStyle(status) {
  const s = String(status || "").toUpperCase();

  if (s === "VERIFIED" || s === "RESOLVED") {
    return {
      bg: "#DCFCE7",
      border: "#86EFAC",
      text: "#166534",
      icon: "check-circle",
    };
  }

  if (s === "FALSE_REPORT" || s === "FALSE_ALARM") {
    return {
      bg: "#FEE2E2",
      border: "#FCA5A5",
      text: "#7F1D1D",
      icon: "report-off",
    };
  }

  if (s === "ACK" || s === "ACKNOWLEDGED") {
    return {
      bg: "#DBEAFE",
      border: "#93C5FD",
      text: "#0B2A6F",
      icon: "verified",
    };
  }

  return {
    bg: "#FFEDD5",
    border: "#FDBA74",
    text: "#9A3412",
    icon: "hourglass-empty",
  };
}

function cleanStatus(status) {
  const s = String(status || "PENDING").toUpperCase();

  if (s === "ACK") return "ACKNOWLEDGED";
  if (s === "NEW") return "NEW";
  if (s === "FALSE_REPORT") return "FALSE REPORT";
  if (s === "FALSE_ALARM") return "FALSE ALARM";

  return s.replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function MyActivityScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState({
    reports: 0,
    panic_requests: 0,
    total: 0,
  });

  const load = useCallback(async () => {
    try {
      const res = await authFetch(navigation, `${API_BASE_URL}/my_activity.php`, {
        method: "GET",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Unable to load your activity.");
      }

      setActivities(Array.isArray(data.activities) ? data.activities : []);
      setSummary({
        reports: Number(data?.summary?.reports || 0),
        panic_requests: Number(data?.summary?.panic_requests || 0),
        total: Number(data?.summary?.total || 0),
      });
    } catch (err) {
      Alert.alert("My Activity", err?.message || "Failed to load your activity.");
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const stats = useMemo(() => {
    return {
      pending: activities.filter((x) =>
        ["PENDING", "NEW"].includes(String(x.status || "").toUpperCase())
      ).length,
      completed: activities.filter((x) =>
        ["VERIFIED", "RESOLVED"].includes(String(x.status || "").toUpperCase())
      ).length,
      falseItems: activities.filter((x) =>
        ["FALSE_REPORT", "FALSE_ALARM"].includes(String(x.status || "").toUpperCase())
      ).length,
    };
  }, [activities]);

  return (
    <View style={styles.root}>
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Activity</Text>
          <Text style={styles.headerSub}>
            Track your submitted reports and panic requests.
          </Text>
        </View>

        <Pressable onPress={load} style={styles.refreshBtn}>
          <Icon name="refresh" size={20} color={COLORS.blueDark} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.blueDark} />
          <Text style={styles.loadingText}>Loading your activity...</Text>
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
              <Text style={styles.statValue}>{summary.reports}</Text>
              <Text style={styles.statLabel}>Reports</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.panic_requests}</Text>
              <Text style={styles.statLabel}>Panic</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          <View style={styles.filterStats}>
            <View style={styles.miniChip}>
              <Text style={styles.miniChipText}>Pending: {stats.pending}</Text>
            </View>
            <View style={styles.miniChipGreen}>
              <Text style={styles.miniChipGreenText}>Completed: {stats.completed}</Text>
            </View>
            <View style={styles.miniChipRed}>
              <Text style={styles.miniChipRedText}>False: {stats.falseItems}</Text>
            </View>
          </View>

          {activities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="assignment" size={36} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptySub}>
                Your submitted incident reports and panic requests will appear here.
              </Text>
            </View>
          ) : (
            activities.map((item) => {
              const pack = statusStyle(item.status);
              const isPanic = item.type === "panic";

              return (
                <View key={`${item.type}_${item.id}`} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.typeIcon, isPanic ? styles.panicIcon : styles.reportIcon]}>
                      <Icon
                        name={isPanic ? "priority-high" : "description"}
                        size={20}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {isPanic ? "Panic Request" : item.title || "Incident Report"}
                      </Text>
                      <Text style={styles.cardSub}>
                        {isPanic
                          ? `Level: ${item.level || "alert"}`
                          : `Category: ${item.category || "Incident"}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Reference</Text>
                    <Text style={styles.metaValue}>{item.reference || `#${item.id}`}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Submitted</Text>
                    <Text style={styles.metaValue}>{formatDate(item.created_at)}</Text>
                  </View>

                  {item.updated_at ? (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Last Updated</Text>
                      <Text style={styles.metaValue}>{formatDate(item.updated_at)}</Text>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: pack.bg, borderColor: pack.border },
                    ]}
                  >
                    <Icon name={pack.icon} size={16} color={pack.text} />
                    <Text style={[styles.statusText, { color: pack.text }]}>
                      {cleanStatus(item.status)}
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
  root: {
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  headerSub: {
    marginTop: 3,
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
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
    marginBottom: 12,
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
  filterStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  miniChip: {
    backgroundColor: "#FFEDD5",
    borderColor: "#FDBA74",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  miniChipText: {
    color: "#9A3412",
    fontWeight: "900",
    fontSize: 12,
  },
  miniChipGreen: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  miniChipGreenText: {
    color: "#166534",
    fontWeight: "900",
    fontSize: 12,
  },
  miniChipRed: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  miniChipRedText: {
    color: "#7F1D1D",
    fontWeight: "900",
    fontSize: 12,
  },
  emptyCard: {
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 8,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  panicIcon: {
    backgroundColor: COLORS.red,
  },
  reportIcon: {
    backgroundColor: COLORS.blue,
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  cardSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 5,
  },
  metaLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  metaValue: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
  statusBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  statusText: {
    fontWeight: "900",
    fontSize: 12,
  },
});