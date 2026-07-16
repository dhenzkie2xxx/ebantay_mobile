import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { launchImageLibrary } from "react-native-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL } from "../config/api";
import { authFetch, clearSession } from "../utils/auth";

const COLORS = {
  bg: "#F4F7FF",
  blueDark: "#0B2A6F",
  blue: "#1D4ED8",
  red: "#DC2626",
  orange: "#F97316",
  green: "#16A34A",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function percent(done, total) {
  return total ? clamp(Math.round((done / total) * 100), 0, 100) : 0;
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function prettyStatus(status) {
  const s = normalizeStatus(status);
  if (s === "verified" || s === "active") return "Verified";
  if (s === "pending") return "Pending Review";
  if (s === "rejected") return "Rejected";
  if (s === "resubmission_required") return "Resubmission Required";
  if (s === "incomplete") return "Incomplete";
  if (s === "disabled") return "Suspended";
  return "Pending";
}

function prettyFlagStatus(status) {
  const s = String(status || "none").trim().toLowerCase();
  if (s === "flagged") return "Flagged";
  if (s === "suspended") return "Suspended";
  return "Normal";
}

function isValidPhilippineMobile(value) {
  return /^09\d{9}$/.test(String(value || "").trim());
}

function calculateAge(birthDate) {
  if (!birthDate) return "";

  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }

  return age >= 0 ? String(age) : "";
}

function hasSavedProfileData(profile) {
  return (
    isValidPhilippineMobile(profile.mobileNumber) &&
    String(profile.addressText || "").trim().length > 0 &&
    !!profile.addressPin?.lat &&
    !!profile.addressPin?.lng &&
    String(profile.cityMunicipality || "").trim().length > 0 &&
    String(profile.province || "").trim().length > 0
  );
}

export default function AccountScreen({ navigation, route }) {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState({
    firstname: "",
    lastname: "",
    email: "",
    mobileNumber: "",
    addressText: "",
    barangay: "",
    cityMunicipality: "",
    province: "",
    region: "",
    sexGender: "",
    birthDate: "",
    age: "",
    civilStatus: "",
    occupation: "",
    addressPin: null,
  });

  const [profileSaved, setProfileSaved] = useState(false);
  const [addressAutoFilled, setAddressAutoFilled] = useState(false);
  const [manualAddressEdit, setManualAddressEdit] = useState(false);
  const [mobileLocked, setMobileLocked] = useState(false);

  const [accountStatus, setAccountStatus] = useState("pending");
  const [rejectedReason, setRejectedReason] = useState("");
  const [verificationRequest, setVerificationRequest] = useState(null);
  const [requirements, setRequirements] = useState([]);

  // new account safety states
  const [flagStatus, setFlagStatus] = useState("none");
  const [falseReportCount, setFalseReportCount] = useState(0);
  const [falseAlarmCount, setFalseAlarmCount] = useState(0);
  const [flagReason, setFlagReason] = useState("");
  const [flaggedAt, setFlaggedAt] = useState(null);
  const [suspendedAt, setSuspendedAt] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState("");

  const accountLocked = ["verified", "active", "disabled"].includes(accountStatus);
  const isFlagged = flagStatus === "flagged";
  const isSuspended = accountStatus === "disabled" || flagStatus === "suspended";

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);

      const res = await authFetch(
        navigation,
        `${API_BASE_URL}/account_completion_get.php`,
        { method: "GET" }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data?.message || "Failed to load account completion data");
      }

      const user = data.user || {};
      const p = data.profile || {};
      const reqs = Array.isArray(data.requirements) ? data.requirements : [];

      const nextProfile = {
        firstname: user.firstname || "",
        lastname: user.lastname || "",
        email: user.email || "",
        mobileNumber: p.mobile_number || "",
        addressText: p.address_text || "",
        barangay: p.barangay || "",
        cityMunicipality: p.city_municipality || "",
        province: p.province || "",
        region: p.region || "",
        sexGender: p.sex_gender || "",
        birthDate: p.birth_date || "",
        age: p.age != null ? String(p.age) : calculateAge(p.birth_date || ""),
        civilStatus: p.civil_status || "",
        occupation: p.occupation || "",
        addressPin:
          p.address_lat != null && p.address_lng != null
            ? {
                lat: Number(p.address_lat),
                lng: Number(p.address_lng),
              }
            : null,
      };

      setProfile(nextProfile);
      setProfileSaved(hasSavedProfileData(nextProfile));

      const hasAddressParts =
        !!String(nextProfile.barangay || "").trim() ||
        !!String(nextProfile.cityMunicipality || "").trim() ||
        !!String(nextProfile.province || "").trim() ||
        !!String(nextProfile.region || "").trim();

      setAddressAutoFilled(hasAddressParts && !!nextProfile.addressPin);
      setManualAddressEdit(false);

      const nextStatus = normalizeStatus(user.account_status || "pending");
      setAccountStatus(nextStatus);
      setRejectedReason(user.rejected_reason || "");
      setVerificationRequest(data.verification_request || null);
      setRequirements(reqs);

      // account safety / flagging fields
      setFlagStatus(String(user.account_flag_status || "none").toLowerCase());
      setFalseReportCount(Number(user.false_report_count || 0));
      setFalseAlarmCount(Number(user.false_alarm_count || 0));
      setFlagReason(user.flagged_reason || "");
      setFlaggedAt(user.flagged_at || null);
      setSuspendedAt(user.suspended_at || null);
      setSuspensionReason(user.suspension_reason || "");

      setMobileLocked(
        !!String(nextProfile.mobileNumber || "").trim() ||
          ["verified", "active", "disabled"].includes(nextStatus)
      );
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("session")) {
        await clearSession(navigation);
        return;
      }
      Alert.alert("Account", msg || "Unable to load account details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useFocusEffect(
    useCallback(() => {
      const selectedPin = route?.params?.selectedPin;
      if (
        selectedPin &&
        Number.isFinite(Number(selectedPin.lat)) &&
        Number.isFinite(Number(selectedPin.lng))
      ) {
        setProfile((prev) => ({
          ...prev,
          addressPin: {
            lat: Number(selectedPin.lat),
            lng: Number(selectedPin.lng),
          },
          addressText: route?.params?.addressText || prev.addressText,
          barangay: route?.params?.barangay || prev.barangay,
          cityMunicipality: route?.params?.city_municipality || prev.cityMunicipality,
          province: route?.params?.province || prev.province,
          region: route?.params?.region || prev.region,
        }));

        setProfileSaved(false);
        setAddressAutoFilled(true);
        setManualAddressEdit(false);

        navigation.setParams({
          selectedPin: undefined,
          addressText: undefined,
          barangay: undefined,
          city_municipality: undefined,
          province: undefined,
          region: undefined,
        });
      }
    }, [navigation, route?.params])
  );

  const completion = useMemo(() => {
    const checks = [];

    checks.push(isValidPhilippineMobile(profile.mobileNumber));
    checks.push(String(profile.addressText || "").trim().length > 0);
    checks.push(!!profile.addressPin?.lat && !!profile.addressPin?.lng);
    checks.push(String(profile.cityMunicipality || "").trim().length > 0);
    checks.push(String(profile.province || "").trim().length > 0);
    checks.push(String(profile.sexGender || "").trim().length > 0);
    checks.push(String(profile.birthDate || "").trim().length > 0);
    checks.push(String(profile.age || "").trim().length > 0);
    checks.push(String(profile.civilStatus || "").trim().length > 0);
    checks.push(String(profile.occupation || "").trim().length > 0);

    const requiredReqs = (requirements || []).filter((r) => !!r.is_required);
    requiredReqs.forEach((r) => {
      checks.push(!!r.submission);
    });

    const done = checks.filter(Boolean).length;
    const total = checks.length;

    return {
      done,
      total,
      pct: percent(done, total),
      complete: done === total,
    };
  }, [profile, requirements]);

  const saveProfile = useCallback(async () => {
    try {
      if (accountLocked) {
        Alert.alert("Locked", "Your verified account information can no longer be changed.");
        return;
      }

      if (isSuspended) {
        Alert.alert(
          "Account Suspended",
          suspensionReason || "Your account is suspended. Please contact the station admin."
        );
        return;
      }

      if (!isValidPhilippineMobile(profile.mobileNumber)) {
        Alert.alert(
          "Invalid Mobile Number",
          "Please enter a valid Philippine mobile number in this format: 09XXXXXXXXX"
        );
        return;
      }

      setSavingProfile(true);

      const payload = {
        mobile_number: profile.mobileNumber,
        address_text: profile.addressText,
        address_lat: profile.addressPin?.lat ?? null,
        address_lng: profile.addressPin?.lng ?? null,
        barangay: profile.barangay,
        city_municipality: profile.cityMunicipality,
        province: profile.province,
        region: profile.region,
        sex_gender: profile.sexGender,
        birth_date: profile.birthDate,
        age: profile.age,
        civil_status: profile.civilStatus,
        occupation: profile.occupation,
      };

      const res = await authFetch(
        navigation,
        `${API_BASE_URL}/account_profile_save.php`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data?.message || "Failed to save account profile");
      }

      if (data?.user?.account_status) {
        setAccountStatus(normalizeStatus(data.user.account_status));
      }

      setProfileSaved(true);
      setMobileLocked(true);

      Alert.alert(
        "Profile Saved",
        "Account information saved successfully. You can now upload your required documents."
      );

      await loadAccount();
    } catch (e) {
      setProfileSaved(false);
      Alert.alert("Save Failed", e?.message || "Unable to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }, [navigation, profile, loadAccount, accountLocked, isSuspended, suspensionReason]);

  const pickAndUploadRequirement = useCallback(
    async (requirement) => {
      try {
        if (accountLocked) {
          Alert.alert(
            "Locked",
            "Your verified account documents can no longer be changed."
          );
          return;
        }

        if (isSuspended) {
          Alert.alert(
            "Account Suspended",
            suspensionReason || "Your account is suspended. Please contact the station admin."
          );
          return;
        }

        const existingSubmission = requirement?.submission || null;
        const existingStatus = String(existingSubmission?.status || "").toLowerCase();
        if (existingStatus === "approved") {
          Alert.alert(
            "Document Locked",
            "This document has already been approved and can no longer be replaced."
          );
          return;
        }

        if (!profileSaved) {
          Alert.alert(
            "Save Profile First",
            "Please save your account information first before uploading documents."
          );
          return;
        }

        const result = await launchImageLibrary({
          mediaType: "mixed",
          selectionLimit: 1,
          quality: 0.85,
        });

        if (result.didCancel) return;

        const asset = result.assets?.[0];
        if (!asset?.uri) {
          Alert.alert("Upload", "No file selected.");
          return;
        }

        const form = new FormData();
        form.append("requirement_id", String(requirement.id));
        form.append("document", {
          uri: asset.uri,
          type: asset.type || "image/jpeg",
          name: asset.fileName || `document_${requirement.id}.jpg`,
        });

        const res = await authFetch(
          navigation,
          `${API_BASE_URL}/account_upload_document.php`,
          {
            method: "POST",
            body: form,
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          throw new Error(data?.message || "Failed to upload document");
        }

        Alert.alert("Uploaded", `${requirement.name} uploaded successfully.`);
        await loadAccount();
      } catch (e) {
        Alert.alert("Upload Failed", e?.message || "Unable to upload document.");
      }
    },
    [navigation, loadAccount, profileSaved, accountLocked, isSuspended, suspensionReason]
  );

  const submitForVerification = useCallback(async () => {
    try {
      if (accountLocked) {
        Alert.alert("Already Verified", "Your account is already verified.");
        return;
      }

      if (isSuspended) {
        Alert.alert(
          "Account Suspended",
          suspensionReason || "Your account is suspended. Please contact the station admin."
        );
        return;
      }

      if (isFlagged) {
        Alert.alert(
          "Account Flagged",
          flagReason ||
            "Your account is currently flagged due to repeated false reports or false panic requests."
        );
        return;
      }

      if (!completion.complete) {
        Alert.alert(
          "Incomplete",
          "Please complete your profile and upload all required documents before submitting."
        );
        return;
      }

      setSubmitting(true);

      const res = await authFetch(
        navigation,
        `${API_BASE_URL}/account_completion_submit.php`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const missing = Array.isArray(data?.missing_requirements)
          ? data.missing_requirements.map((x) => `• ${x.name}`).join("\n")
          : "";

        throw new Error(
          data?.message
            ? missing
              ? `${data.message}\n\n${missing}`
              : data.message
            : "Failed to submit account completion"
        );
      }

      setAccountStatus("pending");
      setVerificationRequest(data.verification_request || null);

      Alert.alert(
        "Submitted",
        "Your account has been submitted for verification. Please wait for admin review."
      );

      await loadAccount();
    } catch (e) {
      Alert.alert("Submit Failed", e?.message || "Unable to submit verification.");
    } finally {
      setSubmitting(false);
    }
  }, [
    navigation,
    completion.complete,
    loadAccount,
    accountLocked,
    isFlagged,
    isSuspended,
    flagReason,
    suspensionReason,
  ]);

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await loadAccount();
    } catch {
      setRefreshing(false);
    }
  };

  const statusChipStyle =
    accountStatus === "verified" || accountStatus === "active"
      ? styles.safeChip
      : accountStatus === "pending"
      ? styles.pendingChip
      : accountStatus === "rejected" || accountStatus === "resubmission_required" || accountStatus === "disabled"
      ? styles.riskChip
      : styles.incompleteChip;

  const statusTextStyle =
    accountStatus === "verified" || accountStatus === "active"
      ? styles.safeText
      : accountStatus === "pending"
      ? styles.pendingText
      : accountStatus === "rejected" || accountStatus === "resubmission_required" || accountStatus === "disabled"
      ? styles.riskText
      : styles.incompleteText;

  const statusIcon =
    accountStatus === "verified" || accountStatus === "active"
      ? "check-circle"
      : accountStatus === "pending"
      ? "hourglass-top"
      : accountStatus === "rejected"
      ? "cancel"
      : accountStatus === "resubmission_required"
      ? "assignment-late"
      : accountStatus === "disabled"
      ? "block"
      : "warning";

  const flagChipStyle =
    flagStatus === "flagged" || flagStatus === "suspended"
      ? styles.riskChip
      : styles.safeChip;

  const flagTextStyle =
    flagStatus === "flagged" || flagStatus === "suspended"
      ? styles.riskText
      : styles.safeText;

  const flagIcon =
    flagStatus === "flagged"
      ? "warning"
      : flagStatus === "suspended"
      ? "block"
      : "verified-user";

  const addressFieldsLocked = accountLocked || (addressAutoFilled && !manualAddressEdit);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.blueDark} />
        <Text style={styles.loadingText}>Loading account setup…</Text>
      </View>
    );
  }

  const canSubmitNow =
    completion.complete &&
    !submitting &&
    !savingProfile &&
    !["pending", "verified", "active", "disabled"].includes(accountStatus) &&
    !isFlagged &&
    !isSuspended;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>My Account</Text>
            <Text style={styles.headerSub}>
              Complete and verify your information to unlock reporting and panic features.
            </Text>
          </View>

          <View style={styles.progressPill}>
            <Text style={styles.progressText}>{completion.pct}%</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Verification Status</Text>
            <Pressable
              onPress={refreshData}
              style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={COLORS.blueDark} />
              ) : (
                <>
                  <Icon name="refresh" size={16} color={COLORS.blueDark} />
                  <Text style={styles.smallBtnText}>Refresh</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={[styles.statusChip, statusChipStyle]}>
            <Icon name={statusIcon} size={16} color="#0F172A" />
            <Text style={[styles.statusText, statusTextStyle]}>
              {prettyStatus(accountStatus).toUpperCase()}
            </Text>
          </View>

          {verificationRequest?.submitted_at ? (
            <Text style={styles.hint}>
              Submitted: {verificationRequest.submitted_at}
            </Text>
          ) : null}

          {rejectedReason ? (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksTitle}>Admin Remarks</Text>
              <Text style={styles.remarksText}>{rejectedReason}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Safety Status</Text>

          <View style={[styles.statusChip, flagChipStyle, { marginTop: 10 }]}>
            <Icon name={flagIcon} size={16} color="#0F172A" />
            <Text style={[styles.statusText, flagTextStyle]}>
              {prettyFlagStatus(flagStatus).toUpperCase()}
            </Text>
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.hint}>False Reports: {falseReportCount}</Text>
            <Text style={styles.hint}>False Panic Requests: {falseAlarmCount}</Text>
          </View>

          {flaggedAt ? (
            <Text style={styles.hint}>Flagged At: {flaggedAt}</Text>
          ) : null}

          {suspendedAt ? (
            <Text style={styles.hint}>Suspended At: {suspendedAt}</Text>
          ) : null}

          {flagReason ? (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksTitle}>Flag Reason</Text>
              <Text style={styles.remarksText}>{flagReason}</Text>
            </View>
          ) : null}

          {suspensionReason ? (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksTitle}>Suspension Reason</Text>
              <Text style={styles.remarksText}>{suspensionReason}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, accountLocked && styles.cardDisabled]}>
          <Text style={styles.cardTitle}>Part 1: Account Information</Text>

          <View style={styles.progressBarOuter}>
            <View style={[styles.progressBarInner, { width: `${completion.pct}%` }]} />
          </View>

          <Text style={styles.hint}>
            Start by pinpointing your address first, then review or edit the fields below before saving.
          </Text>

          <View style={styles.pinHeroBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinHeroTitle}>Pinpoint Your Address</Text>
              <Text style={styles.pinHeroSub}>
                This helps auto-fill your barangay, city/municipality, province, and region.
              </Text>

              <Text style={styles.pinHeroMeta}>
                {profile.addressPin
                  ? `Lat ${profile.addressPin.lat.toFixed(5)}, Lng ${profile.addressPin.lng.toFixed(5)}`
                  : "No address pin selected yet"}
              </Text>
            </View>

            <Pressable
              disabled={accountLocked || isSuspended}
              onPress={() =>
                navigation.navigate("AddressPin", {
                  currentPin: profile.addressPin,
                })
              }
              style={({ pressed }) => [
                styles.pinHeroBtn,
                pressed && { opacity: 0.9 },
                (accountLocked || isSuspended) && { opacity: 0.6 },
              ]}
            >
              <Icon name="place" size={18} color="#fff" />
              <Text style={styles.pinHeroBtnText}>
                {profile.addressPin ? "Update Pin" : "Set Pinpoint Address"}
              </Text>
            </Pressable>
          </View>

          <InfoInput
            label="First Name"
            value={profile.firstname}
            onChangeText={(t) => setProfile((p) => ({ ...p, firstname: t }))}
            placeholder="First name"
            editable={false}
          />

          <InfoInput
            label="Last Name"
            value={profile.lastname}
            onChangeText={(t) => setProfile((p) => ({ ...p, lastname: t }))}
            placeholder="Last name"
            editable={false}
          />

          <InfoInput
            label="Email"
            value={profile.email}
            onChangeText={(t) => setProfile((p) => ({ ...p, email: t }))}
            placeholder="Email"
            editable={false}
            keyboardType="email-address"
          />

          <InfoInput
            label="Mobile Number"
            value={profile.mobileNumber}
            onChangeText={(t) => {
              setProfileSaved(false);
              const digitsOnly = String(t || "").replace(/[^\d]/g, "").slice(0, 11);
              setProfile((p) => ({ ...p, mobileNumber: digitsOnly }));
            }}
            placeholder="09XXXXXXXXX"
            keyboardType="phone-pad"
            editable={!mobileLocked && !accountLocked && !isSuspended}
          />

          {mobileLocked ? (
            <Text style={styles.hint}>
              Your mobile number is already locked and can no longer be changed.
            </Text>
          ) : null}

          <RadioGroupInput
            label="Sex / Gender"
            value={profile.sexGender}
            options={["Male", "Female"]}
            disabled={accountLocked || isSuspended}
            onChange={(v) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, sexGender: v }));
            }}
          />

          <InfoInput
            label="Birth Date"
            value={profile.birthDate}
            onChangeText={(t) => {
              const age = calculateAge(t);

              setProfileSaved(false);

              setProfile((p) => ({
                ...p,
                birthDate: t,
                age,
              }));
            }}
            placeholder="YYYY-MM-DD"
            editable={!accountLocked && !isSuspended}
            keyboardType={Platform.OS === "android" ? "numeric" : "numbers-and-punctuation"}
          />

          <InfoInput
            label="Age"
            value={profile.age}
            onChangeText={() => {}}
            placeholder="Auto-computed"
            editable={false}
          />

          <RadioGroupInput
            label="Civil Status"
            value={profile.civilStatus}
            options={["Single", "Married", "Widowed", "Separated"]}
            disabled={accountLocked || isSuspended}
            onChange={(v) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, civilStatus: v }));
            }}
          />

          <InfoInput
            label="Occupation"
            value={profile.occupation}
            onChangeText={(t) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, occupation: t }));
            }}
            placeholder="Occupation"
            editable={!accountLocked && !isSuspended}
          />

          <InfoInput
            label="Address / Landmark"
            value={profile.addressText}
            onChangeText={(t) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, addressText: t }));
            }}
            placeholder="House no., street, landmark"
            editable={!accountLocked && !isSuspended}
          />

          <View style={styles.addressHeaderRow}>
            <Text style={styles.addressHeaderTitle}>Auto-filled Address Details</Text>

            {addressAutoFilled && !accountLocked && !isSuspended ? (
              <Pressable
                onPress={() => {
                  setManualAddressEdit((prev) => !prev);
                  setProfileSaved(false);
                }}
                style={({ pressed }) => [styles.editToggleBtn, pressed && { opacity: 0.9 }]}
              >
                <Icon
                  name={manualAddressEdit ? "lock" : "edit"}
                  size={16}
                  color={COLORS.blueDark}
                />
                <Text style={styles.editToggleText}>
                  {manualAddressEdit ? "Lock fields" : "Edit manually"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {addressAutoFilled && !manualAddressEdit && !accountLocked && !isSuspended ? (
            <View style={styles.inlineNoticeLocked}>
              <Icon name="check-circle" size={16} color={COLORS.green} />
              <Text style={styles.inlineNoticeLockedText}>
                These address fields were auto-filled from your pin. Tap “Edit manually” only if something is incorrect.
              </Text>
            </View>
          ) : null}

          <InfoInput
            label="Barangay"
            value={profile.barangay}
            onChangeText={(t) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, barangay: t }));
            }}
            placeholder="Barangay"
            editable={!addressFieldsLocked && !isSuspended}
          />

          <InfoInput
            label="City / Municipality"
            value={profile.cityMunicipality}
            onChangeText={(t) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, cityMunicipality: t }));
            }}
            placeholder="City / Municipality"
            editable={!addressFieldsLocked && !isSuspended}
          />

          <InfoInput
            label="Province"
            value={profile.province}
            onChangeText={(t) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, province: t }));
            }}
            placeholder="Province"
            editable={!addressFieldsLocked && !isSuspended}
          />

          <InfoInput
            label="Region"
            value={profile.region}
            onChangeText={(t) => {
              setProfileSaved(false);
              setProfile((p) => ({ ...p, region: t }));
            }}
            placeholder="Region"
            editable={!addressFieldsLocked && !isSuspended}
          />

          <View
            style={[
              styles.inlineNotice,
              profileSaved ? styles.inlineNoticeSuccess : styles.inlineNoticeInfo,
            ]}
          >
            <Icon
              name={profileSaved ? "check-circle" : "info"}
              size={16}
              color={profileSaved ? COLORS.green : COLORS.blueDark}
            />
            <Text
              style={[
                styles.inlineNoticeText,
                { color: profileSaved ? COLORS.green : COLORS.blueDark },
              ]}
            >
              {profileSaved
                ? "Profile saved. You can now upload your required documents."
                : "After checking your information, tap Save Account Information below."}
            </Text>
          </View>

          <Pressable
            onPress={saveProfile}
            disabled={savingProfile || accountLocked || isSuspended}
            style={({ pressed }) => [
              styles.saveProfileBtn,
              pressed && { opacity: 0.92 },
              (savingProfile || accountLocked || isSuspended) && { opacity: 0.7 },
            ]}
          >
            {savingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="save" size={18} color="#fff" />
                <Text style={styles.saveProfileText}>Save Account Information</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, (!profileSaved || accountLocked) && styles.cardDisabled]}>
          <Text style={styles.cardTitle}>Part 2: Required Documents Upload</Text>
          <Text style={styles.hint}>
            These required documents are based on your saved city/municipality and province.
          </Text>

          {!profileSaved ? (
            <View style={styles.lockedBox}>
              <Icon name="lock" size={18} color={COLORS.muted} />
              <Text style={styles.lockedText}>
                Save your account information first to enable document upload.
              </Text>
            </View>
          ) : accountLocked ? (
            <View style={styles.lockedBox}>
              <Icon name="lock" size={18} color={COLORS.muted} />
              <Text style={styles.lockedText}>
                Your verified account documents are now locked and can no longer be changed.
              </Text>
            </View>
          ) : isSuspended ? (
            <View style={styles.lockedBox}>
              <Icon name="block" size={18} color={COLORS.red} />
              <Text style={styles.lockedText}>
                {suspensionReason || "Your account is suspended. Document upload is disabled."}
              </Text>
            </View>
          ) : (requirements || []).length === 0 ? (
            <Text style={styles.emptyText}>No requirements found yet.</Text>
          ) : (
            requirements.map((req) => {
              const submission = req.submission;
              const submissionStatus = String(submission?.status || "").toLowerCase();
              const docLocked = submissionStatus === "approved";

              const subChipStyle =
                submissionStatus === "approved"
                  ? styles.safeChip
                  : submissionStatus === "rejected"
                  ? styles.riskChip
                  : submissionStatus === "submitted"
                  ? styles.pendingChip
                  : styles.incompleteChip;

              const subTextStyle =
                submissionStatus === "approved"
                  ? styles.safeText
                  : submissionStatus === "rejected"
                  ? styles.riskText
                  : submissionStatus === "submitted"
                  ? styles.pendingText
                  : styles.incompleteText;

              return (
                <View key={req.id} style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>
                      {req.name}
                      {req.is_required ? " *" : ""}
                    </Text>

                    <Text style={styles.rowSub} numberOfLines={2}>
                      {submission
                        ? `${submission.file_name || "Uploaded file"}`
                        : "No file uploaded"}
                    </Text>

                    <View
                      style={[
                        styles.statusChip,
                        subChipStyle,
                        { marginTop: 8, alignSelf: "flex-start" },
                      ]}
                    >
                      <Text style={[styles.statusText, subTextStyle]}>
                        {submission
                          ? String(submission.status || "submitted").toUpperCase()
                          : "NOT UPLOADED"}
                      </Text>
                    </View>

                    {submission?.remarks ? (
                      <Text style={[styles.rowSub, { marginTop: 6 }]}>
                        Remarks: {submission.remarks}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    disabled={docLocked || isSuspended}
                    onPress={() => pickAndUploadRequirement(req)}
                    style={({ pressed }) => [
                      styles.pillBtn,
                      pressed && { opacity: 0.85 },
                      (docLocked || isSuspended) && { opacity: 0.55 },
                    ]}
                  >
                    <Icon
                      name={docLocked ? "lock" : "upload-file"}
                      size={18}
                      color={COLORS.blueDark}
                    />
                    <Text style={styles.pillText}>
                      {docLocked ? "Locked" : submission ? "Replace" : "Upload"}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <Pressable
          onPress={submitForVerification}
          disabled={!canSubmitNow}
          style={({ pressed }) => [
            styles.submitBtn,
            !canSubmitNow && styles.submitBtnDisabled,
            pressed && canSubmitNow && { opacity: 0.92 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="verified-user" size={20} color="#fff" />
              <Text style={styles.submitText}>
                {accountStatus === "pending"
                  ? "Already Submitted"
                  : accountStatus === "verified" || accountStatus === "active"
                  ? "Already Verified"
                  : isSuspended
                  ? "Account Suspended"
                  : isFlagged
                  ? "Account Flagged"
                  : "Submit for Verification"}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.legal}>
          After admin verification, you can proceed to report incidents and use panic requests.
        </Text>

        <View style={{ height: 10 }} />
      </ScrollView>
    </View>
  );
}

function InfoInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(100,116,139,.75)"
        style={[styles.input, !editable && styles.inputDisabled]}
        keyboardType={keyboardType}
        editable={editable}
      />
    </View>
  );
}

function RadioGroupInput({ label, value, options, onChange, disabled = false }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>

      <View style={styles.radioWrap}>
        {options.map((opt) => {
          const active = value === opt;

          return (
            <Pressable
              key={opt}
              disabled={disabled}
              onPress={() => onChange(opt)}
              style={[
                styles.radioOption,
                active && styles.radioOptionActive,
                disabled && { opacity: 0.6 },
              ]}
            >
              <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>

              <Text style={[styles.radioText, active && styles.radioTextActive]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 26 },

  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.muted,
    fontWeight: "700",
  },

  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  headerSub: { marginTop: 4, fontSize: 12, fontWeight: "700", color: COLORS.muted },

  progressPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(29,78,216,.08)",
    borderWidth: 1,
    borderColor: "rgba(29,78,216,.18)",
  },
  progressText: { fontWeight: "900", color: COLORS.blueDark, fontSize: 12 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardDisabled: {
    opacity: 0.75,
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  cardTitle: { fontSize: 13, fontWeight: "900", color: COLORS.text },

  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  smallBtnText: { fontSize: 12, fontWeight: "900", color: COLORS.blueDark },

  progressBarOuter: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(100,116,139,.18)",
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarInner: { height: 10, borderRadius: 999, backgroundColor: COLORS.blueDark },

  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },

  safeChip: {
    backgroundColor: "rgba(22,163,74,.10)",
    borderColor: "rgba(22,163,74,.18)",
  },
  pendingChip: {
    backgroundColor: "rgba(249,115,22,.10)",
    borderColor: "rgba(249,115,22,.18)",
  },
  riskChip: {
    backgroundColor: "rgba(220,38,38,.08)",
    borderColor: "rgba(220,38,38,.18)",
  },
  incompleteChip: {
    backgroundColor: "rgba(29,78,216,.08)",
    borderColor: "rgba(29,78,216,.18)",
  },

  statusText: { fontWeight: "900", fontSize: 12 },
  safeText: { color: COLORS.green },
  pendingText: { color: COLORS.orange },
  riskText: { color: "#7F1D1D" },
  incompleteText: { color: COLORS.blueDark },

  hint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
    lineHeight: 16,
  },

  remarksBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,.18)",
    backgroundColor: "rgba(220,38,38,.05)",
    padding: 12,
  },
  remarksTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.red,
    marginBottom: 6,
  },
  remarksText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 18,
  },

  pinHeroBox: {
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D9E7FF",
  },
  pinHeroTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.blueDark,
  },
  pinHeroSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontWeight: "700",
  },
  pinHeroMeta: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  pinHeroBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },
  pinHeroBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  addressHeaderRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  addressHeaderTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.muted,
  },
  editToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  editToggleText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.blueDark,
  },

  inputWrap: { marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: "900", color: COLORS.muted, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    color: COLORS.text,
    fontWeight: "800",
  },
  inputDisabled: {
    backgroundColor: "#F8FAFC",
    color: "#64748B",
  },

  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.95)",
    marginBottom: 10,
  },
  rowLabel: { fontSize: 13, fontWeight: "900", color: COLORS.text },
  rowSub: { marginTop: 4, fontSize: 12, fontWeight: "700", color: COLORS.muted },

  pillBtn: {
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
  pillText: { fontSize: 12, fontWeight: "900", color: COLORS.blueDark },

  emptyText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "700",
  },

  lockedBox: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
  },
  lockedText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 18,
  },

  inlineNotice: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  inlineNoticeInfo: {
    backgroundColor: "rgba(29,78,216,.06)",
    borderColor: "rgba(29,78,216,.14)",
  },
  inlineNoticeSuccess: {
    backgroundColor: "rgba(22,163,74,.06)",
    borderColor: "rgba(22,163,74,.14)",
  },
  inlineNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },

  inlineNoticeLocked: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(22,163,74,.06)",
    borderColor: "rgba(22,163,74,.14)",
  },
  inlineNoticeLockedText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    color: COLORS.green,
  },

  saveProfileBtn: {
    marginTop: 14,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  saveProfileText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  submitBtn: {
    marginTop: 4,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  submitBtnDisabled: {
    backgroundColor: "#94A3B8",
  },
  submitText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  legal: {
    marginTop: 10,
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 15,
    textAlign: "center",
  },
  radioWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },

  radioOptionActive: {
    borderColor: COLORS.blueDark,
    backgroundColor: "rgba(29,78,216,.08)",
  },

  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center",
  },

  radioCircleActive: {
    borderColor: COLORS.blueDark,
  },

  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.blueDark,
  },

  radioText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.muted,
  },

  radioTextActive: {
    color: COLORS.blueDark,
  },
});