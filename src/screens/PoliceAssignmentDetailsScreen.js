import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  Linking,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

import {
  requestToProceed,
  updateAssignmentOutcome,
  requestBackup,
} from "../utils/policeField";

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

function canProceed(status) {
  return ["go_signal_sent", "approved_to_proceed"].includes(
    String(status || "").toLowerCase()
  );
}

function getAuthLabel(status) {
  const s = String(status || "").toLowerCase();

  if (s === "go_signal_sent") return "Assigned";
  if (s === "approved_to_proceed") return "Assigned";
  if (s === "requested_to_proceed") return "Waiting Assignment";
  if (s === "detected") return "Detected";

  return s || "Detected";
}

function getBackupLabel(response) {
  const s = String(response || "pending").toLowerCase();

  if (s === "approved") return "Approved";
  if (s === "denied") return "Denied";

  return "Pending";
}

export default function PoliceAssignmentDetailsScreen({ navigation, route }) {
  const assignment = route?.params?.assignment || {};
  const report = assignment.report || {};

  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");

  const isIncident = assignment.source_type === "incident";
  const authorized = canProceed(assignment.authorization_status);

  const canRequestBackup =
    authorized &&
    !assignment?.backup_requested &&
    assignment?.authorization_status !== "detected";

  const title = useMemo(() => {
    if (isIncident) {
      return report.title || report.incident_type || "Incident Report";
    }

    return `Panic Request (${report.level || "alert"})`;
  }, [isIncident, report]);

  const lat = report.lat;
  const lng = report.lng;

  const openMap = () => {
    if (!lat || !lng) {
      Alert.alert("Location", "No location available.");
      return;
    }

    Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
  };

  const handleRequestProceed = async () => {
    try {
      setLoading(true);

      const data = await requestToProceed(navigation, {
        source_type: assignment.source_type,
        source_id: assignment.source_id,
        notes: notes || "Requesting assignment confirmation.",
      });

      if (!data?.ok) {
        throw new Error(data?.message || "Failed to request confirmation.");
      }

      Alert.alert("Request Sent", "Station Admin has been notified.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Request Failed", e?.message || "Unable to request confirmation.");
    } finally {
      setLoading(false);
    }
  };

  const handleOutcome = async (outcome) => {
    if (!authorized) {
      Alert.alert("Not Assigned", "Please wait for Station Admin assignment first.");
      return;
    }

    const label =
      outcome === "VERIFIED"
        ? "mark this as VERIFIED"
        : outcome === "FALSE_REPORT"
        ? "mark this as FALSE REPORT"
        : "mark this as RESOLVED";

    Alert.alert("Confirm Outcome", `Are you sure you want to ${label}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            setLoading(true);

            const data = await updateAssignmentOutcome(navigation, {
              assignment_id: assignment.assignment_id,
              outcome,
              notes: notes || "",
            });

            if (!data?.ok) {
              throw new Error(data?.message || "Failed to update outcome.");
            }

            Alert.alert("Updated", "Assignment outcome was updated.", [
              { text: "OK", onPress: () => navigation.goBack() },
            ]);
          } catch (e) {
            Alert.alert("Update Failed", e?.message || "Unable to update outcome.");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleBackup = async () => {
    if (!authorized) {
      Alert.alert("Not Assigned", "Please wait for Station Admin assignment first.");
      return;
    }

    if (assignment?.backup_requested) {
      Alert.alert("Backup Request", "Backup has already been requested for this assignment.");
      return;
    }

    try {
      setLoading(true);

      const data = await requestBackup(navigation, {
        assignment_id: assignment.assignment_id,
        reason: notes || "Backup requested by Police on Field.",
      });

      if (!data?.ok) {
        throw new Error(data?.message || "Failed to request backup.");
      }

      Alert.alert("Backup Requested", "Station Admin has been notified.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Backup Failed", e?.message || "Unable to request backup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {String(assignment.source_type || "").toUpperCase()} #{assignment.source_id}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Assignment Status</Text>

          <View
            style={[
              styles.statusBox,
              authorized ? styles.statusGreen : styles.statusOrange,
            ]}
          >
            <Icon
              name={authorized ? "assignment-turned-in" : "hourglass-empty"}
              size={22}
              color={authorized ? COLORS.green : COLORS.orange}
            />
            <Text
              style={[
                styles.statusText,
                { color: authorized ? COLORS.green : COLORS.orange },
              ]}
            >
              {authorized
                ? "Assigned - You may proceed"
                : assignment.authorization_status === "requested_to_proceed"
                ? "Waiting for Station Admin Assignment"
                : `${getAuthLabel(assignment.authorization_status)} - Assignment Required`}
            </Text>
          </View>

          {!authorized && assignment.authorization_status !== "requested_to_proceed" ? (
            <Pressable
              style={[styles.mainBtn, styles.blueBtn]}
              onPress={handleRequestProceed}
              disabled={loading}
            >
              <Icon name="send" size={20} color="#fff" />
              <Text style={styles.mainBtnText}>Request Assignment to Proceed</Text>
            </Pressable>
          ) : null}
        </View>

        {assignment?.backup_requested ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Backup Request</Text>

            <View
              style={[
                styles.backupBox,
                assignment.backup_admin_response === "approved"
                  ? styles.backupApproved
                  : assignment.backup_admin_response === "denied"
                  ? styles.backupDenied
                  : styles.backupPending,
              ]}
            >
              <Text style={styles.backupStatus}>
                Status: {getBackupLabel(assignment.backup_admin_response)}
              </Text>

              <Text style={styles.backupText}>
                Requested At: {assignment.backup_requested_at || "—"}
              </Text>

              {assignment.backup_reason ? (
                <Text style={styles.backupText}>
                  Reason: {assignment.backup_reason}
                </Text>
              ) : null}

              {assignment.backup_response_notes ? (
                <Text style={styles.backupFeedback}>
                  Admin Feedback: {assignment.backup_response_notes}
                </Text>
              ) : null}

              {assignment.backup_responded_at ? (
                <Text style={styles.backupText}>
                  Responded At: {assignment.backup_responded_at}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Report Details</Text>

          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>
            {report.barangay || "No barangay"}, {report.city_municipality || "No city"},{" "}
            {report.province || "No province"}
          </Text>

          {isIncident ? (
            <>
              <Text style={styles.label}>Incident Type</Text>
              <Text style={styles.value}>{report.incident_type || "—"}</Text>

              <Text style={styles.label}>Narrative</Text>
              <Text style={styles.value}>{report.narrative || "No narrative provided."}</Text>

              <Text style={styles.label}>Verification</Text>
              <Text style={styles.value}>{report.verification_status || "PENDING"}</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Panic Level</Text>
              <Text style={styles.value}>{report.level || "alert"}</Text>

              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{report.status || "new"}</Text>
            </>
          )}

          <Pressable style={[styles.mainBtn, styles.outlineBtn]} onPress={openMap}>
            <Icon name="map" size={20} color={COLORS.blueDark} />
            <Text style={styles.outlineText}>Open Location in Map</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add remarks, verification notes, or backup reason..."
            placeholderTextColor={COLORS.muted}
            multiline
            style={styles.notesInput}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.blueDark} style={{ marginVertical: 12 }} />
          ) : null}

          <Pressable
            style={[
              styles.mainBtn,
              canRequestBackup ? styles.orangeBtn : styles.disabledBtn,
            ]}
            onPress={handleBackup}
            disabled={loading || !canRequestBackup}
          >
            <Icon name="groups" size={20} color="#fff" />
            <Text style={styles.mainBtnText}>
              {assignment?.backup_requested ? "Backup Already Requested" : "Request Backup"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.mainBtn, authorized ? styles.greenBtn : styles.disabledBtn]}
            onPress={() => handleOutcome(isIncident ? "VERIFIED" : "RESOLVED")}
            disabled={loading || !authorized}
          >
            <Icon name="check-circle" size={20} color="#fff" />
            <Text style={styles.mainBtnText}>
              {isIncident ? "Mark as VERIFIED" : "Mark as RESOLVED"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.mainBtn, authorized ? styles.redBtn : styles.disabledBtn]}
            onPress={() => handleOutcome("FALSE_REPORT")}
            disabled={loading || !authorized}
          >
            <Icon name="report-off" size={20} color="#fff" />
            <Text style={styles.mainBtnText}>
              {isIncident ? "Mark as FALSE REPORT" : "Mark as FALSE ALARM"}
            </Text>
          </Pressable>
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
    paddingBottom: 30,
  },
  headerCard: {
    backgroundColor: COLORS.blueDark,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    color: "#DBEAFE",
    marginTop: 5,
    fontWeight: "700",
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
    marginBottom: 10,
  },
  statusBox: {
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  statusGreen: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  statusOrange: {
    backgroundColor: "#FFEDD5",
    borderColor: "#FDBA74",
  },
  statusText: {
    fontWeight: "900",
    flex: 1,
  },
  backupBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  backupPending: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
  },
  backupApproved: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  backupDenied: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  backupText: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 5,
    fontWeight: "700",
  },
  backupStatus: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.text,
  },
  backupFeedback: {
    fontSize: 13,
    marginTop: 6,
    color: COLORS.blue,
    fontWeight: "800",
    lineHeight: 20,
  },
  label: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 10,
  },
  value: {
    color: COLORS.text,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 21,
  },
  notesInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    textAlignVertical: "top",
    color: COLORS.text,
    backgroundColor: "#FAFCFF",
  },
  mainBtn: {
    marginTop: 10,
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  blueBtn: {
    backgroundColor: COLORS.blue,
  },
  greenBtn: {
    backgroundColor: COLORS.green,
  },
  redBtn: {
    backgroundColor: COLORS.red,
  },
  orangeBtn: {
    backgroundColor: COLORS.orange,
  },
  disabledBtn: {
    backgroundColor: "#94A3B8",
  },
  outlineBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mainBtnText: {
    color: "#fff",
    fontWeight: "900",
  },
  outlineText: {
    color: COLORS.blueDark,
    fontWeight: "900",
  },
});