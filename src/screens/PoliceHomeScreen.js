import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

import { requestLocationPermission, getCurrentLocation } from "../utils/location";
import { updatePoliceLocation, getPoliceAssignments } from "../utils/policeField";

const COLORS = {
  bg: "#F4F7FF",
  blueDark: "#0B2A6F",
  blue: "#1D4ED8",
  red: "#DC2626",
  green: "#16A34A",
  orange: "#F97316",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
};

function AuthStatusBadge({ status }) {
  const s = String(status || "detected").toLowerCase();

  const label =
    s === "go_signal_sent"
      ? "Assigned"
      : s === "approved_to_proceed"
      ? "Assigned"
      : s === "requested_to_proceed"
      ? "Waiting Assignment"
      : s === "detected"
      ? "Detected"
      : s;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export default function PoliceHomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [userName, setUserName] = useState("Police on Field");
  const [dutyStatus, setDutyStatus] = useState("offline");
  const [assignments, setAssignments] = useState([]);

  const loadUser = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("user_data");
      if (raw) {
        const u = JSON.parse(raw);
        const full = `${u.firstname || ""} ${u.lastname || ""}`.trim();
        setUserName(full || u.username || "Police on Field");
        setDutyStatus(u.duty_status || "offline");
      }
    } catch {}
  }, []);

  const loadAssignments = useCallback(async () => {
    try {
      const data = await getPoliceAssignments(navigation);

      if (!data?.ok) {
        throw new Error(data?.message || "Unable to load assignments.");
      }

      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
    } catch (e) {
      Alert.alert("Assignments", e?.message || "Unable to load assignments.");
    }
  }, [navigation]);

  const updateLocationAndStatus = useCallback(
    async (nextStatus = "available") => {
      try {
        setSyncing(true);

        const ok = await requestLocationPermission();
        if (!ok) {
          Alert.alert("Location Permission", "Please enable location permission.");
          return;
        }

        const loc = await getCurrentLocation();

        const data = await updatePoliceLocation(navigation, {
          lat: loc.lat,
          lng: loc.lng,
          accuracy_m: loc.accuracy,
          duty_status: nextStatus,
        });

        if (!data?.ok) {
          throw new Error(data?.message || "Failed to update location.");
        }

        setDutyStatus(nextStatus);

        const raw = await AsyncStorage.getItem("user_data");
        if (raw) {
          const u = JSON.parse(raw);
          await AsyncStorage.setItem(
            "user_data",
            JSON.stringify({
              ...u,
              duty_status: nextStatus,
              last_seen_at: new Date().toISOString(),
            })
          );
        }

        await loadAssignments();
      } catch (e) {
        Alert.alert("Location Update", e?.message || "Unable to update status.");
      } finally {
        setSyncing(false);
      }
    },
    [navigation, loadAssignments]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await loadUser();
    await loadAssignments();
    setLoading(false);
  }, [loadUser, loadAssignments]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

   useEffect(() => {
     if (dutyStatus === "offline") return;

     const timer = setInterval(() => {
       updateLocationAndStatus(dutyStatus);
     }, 30000);

     return () => clearInterval(timer);
   }, [dutyStatus, updateLocationAndStatus]);

  const activeAssignments = assignments.filter((a) =>
    ["detected", "requested_to_proceed", "go_signal_sent", "approved_to_proceed"].includes(
      String(a.authorization_status || "").toLowerCase()
    )
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Police on Field</Text>
            <Text style={styles.subtitle}>{userName}</Text>
          </View>

          <Pressable
            style={styles.refreshBtn}
            onPress={refreshAll}
            disabled={loading || syncing}
          >
            <Icon name="refresh" size={20} color={COLORS.blueDark} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Duty Status</Text>
          <Text style={styles.muted}>
            Update your status so the station can detect the nearest available unit.
          </Text>

          <View style={styles.statusPill}>
            <Icon name="radio-button-checked" size={18} color={COLORS.green} />
            <Text style={styles.statusText}>{String(dutyStatus || "offline").toUpperCase()}</Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionBtn, styles.greenBtn]}
              disabled={syncing}
              onPress={() => updateLocationAndStatus("available")}
            >
              {syncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="check-circle" size={20} color="#fff" />
                  <Text style={styles.actionText}>Go Available</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.actionBtn, styles.grayBtn]}
              disabled={syncing}
              onPress={() => updateLocationAndStatus("offline")}
            >
              <Icon name="power-settings-new" size={20} color="#fff" />
              <Text style={styles.actionText}>Offline</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Assignments</Text>
            <Text style={styles.countText}>{activeAssignments.length}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.blueDark} style={{ marginTop: 16 }} />
          ) : activeAssignments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="assignment" size={34} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No active assignments</Text>
              <Text style={styles.muted}>Detected reports and assigned reports will appear here.</Text>
            </View>
          ) : (
            activeAssignments.map((item) => {
              const report = item.report || {};
              const isIncident = item.source_type === "incident";

              return (
                <Pressable
                  key={item.assignment_id}
                  style={styles.assignmentCard}
                  onPress={() =>
                    navigation.navigate("PoliceAssignmentDetails", {
                      assignment: item,
                    })
                  }
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignmentTitle}>
                        {isIncident
                          ? report.title || report.incident_type || "Incident Report"
                          : `Panic Request (${report.level || "alert"})`}
                      </Text>

                      <Text style={styles.assignmentSub}>
                        {report.barangay || "No barangay"},{" "}
                        {report.city_municipality || "No city"}
                      </Text>
                    </View>

                    <AuthStatusBadge status={item.authorization_status} />
                  </View>

                  <View style={styles.assignmentFooter}>
                    <Text style={styles.footerText}>
                      {item.source_type?.toUpperCase()} #{item.source_id}
                    </Text>

                    {item.detected_distance_m != null ? (
                      <Text style={styles.footerText}>
                        {Number(item.detected_distance_m).toLocaleString()} m away
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: COLORS.blueDark,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: "#DBEAFE",
    marginTop: 3,
    fontWeight: "700",
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  muted: {
    color: COLORS.muted,
    marginTop: 4,
    lineHeight: 20,
  },
  statusPill: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statusText: {
    color: "#166534",
    fontWeight: "900",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  greenBtn: {
    backgroundColor: COLORS.green,
  },
  grayBtn: {
    backgroundColor: "#475569",
  },
  actionText: {
    color: "#fff",
    fontWeight: "900",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  countText: {
    fontWeight: "900",
    color: COLORS.blueDark,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 26,
  },
  emptyTitle: {
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 8,
  },
  assignmentCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    backgroundColor: "#FAFCFF",
  },
  assignmentTitle: {
    fontWeight: "900",
    color: COLORS.text,
  },
  assignmentSub: {
    color: COLORS.muted,
    marginTop: 3,
  },
  assignmentFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: COLORS.blueDark,
    fontSize: 11,
    fontWeight: "900",
  },
});