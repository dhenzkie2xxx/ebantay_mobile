import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";

import Icon from "react-native-vector-icons/MaterialIcons";
import { API_BASE_URL } from "../config/api";

export default function ResetPasswordScreen({ route, navigation }) {
  const token = route?.params?.token || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const canSubmit = useMemo(() => {
    return (
      token &&
      password.length >= 6 &&
      confirmPassword.length >= 6 &&
      password === confirmPassword &&
      !loading
    );
  }, [token, password, confirmPassword, loading]);

  const onSubmit = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/reset_password.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        console.log("NON-JSON RESPONSE:", text);
        Alert.alert("Server Error", "Server returned an invalid response.");
        return;
      }

      if (!res.ok || !data.ok) {
        Alert.alert("Reset Failed", data.message || "Please try again.");
        return;
      }

      Alert.alert(
        "Password Reset",
        data.message || "Password reset successful. Please login.",
        [{ text: "OK", onPress: () => navigation.replace("Login") }]
      );
    } catch (err) {
      console.log("RESET PASSWORD ERROR:", err);
      Alert.alert("Network Error", err?.message || "Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.replace("Login")}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Icon name="arrow-back" size={24} color={COLORS.yellow} />
          </Pressable>

          <Text style={styles.headerTitle}>Reset Password</Text>
          <Text style={styles.headerSubtitle}>
            Create a new password for your eBantay account.
          </Text>
        </View>

        <View style={styles.card}>
          {!token ? (
            <>
              <Text style={styles.cardTitle}>Invalid reset link</Text>
              <Text style={styles.cardHint}>
                The password reset token is missing. Please request a new reset link.
              </Text>

              <Pressable
                onPress={() => navigation.replace("ForgotPassword")}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryText}>Request New Link</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Enter new password</Text>
              <Text style={styles.cardHint}>
                Your password must be at least 6 characters.
              </Text>

              <Text style={styles.label}>New Password</Text>
              <View style={styles.fieldWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showPass}
                  style={[styles.input, styles.inputNoMargin, styles.withRightAction]}
                  autoCapitalize="none"
                  editable={!loading}
                  returnKeyType="next"
                />

                <Pressable
                  onPress={() => setShowPass((v) => !v)}
                  style={({ pressed }) => [
                    styles.rightAction,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.rightActionText}>
                    {showPass ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.fieldWrap}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showConfirm}
                  style={[
                    styles.input,
                    styles.inputNoMargin,
                    styles.withRightAction,
                    passwordMismatch && styles.inputError,
                  ]}
                  autoCapitalize="none"
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />

                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  style={({ pressed }) => [
                    styles.rightAction,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.rightActionText}>
                    {showConfirm ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>

              {passwordMismatch ? (
                <Text style={styles.errorText}>Passwords do not match.</Text>
              ) : null}

              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  !canSubmit && styles.primaryBtnDisabled,
                  pressed && canSubmit && { transform: [{ scale: 0.99 }] },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>Reset Password</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => navigation.replace("Login")}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.secondaryText}>Back to Login</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const COLORS = {
  bg: "#F4F7FF",
  blue: "#1D4ED8",
  blueDark: "#0B2A6F",
  red: "#DC2626",
  yellow: "#FFFF00",
  text: "#0F172A",
  muted: "#64748B",
  placeholder: "#94A3B8",
  border: "#E2E8F0",
  card: "#FFFFFF",
  error: "#DC2626",
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 64,
    paddingBottom: 42,
    paddingHorizontal: 20,
    backgroundColor: COLORS.blueDark,
  },
  backBtn: {
    position: "absolute",
    left: 16,
    top: 40,
  },
  headerTitle: {
    textAlign: "center",
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSubtitle: {
    textAlign: "center",
    color: "rgba(255,255,255,0.82)",
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: -18,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  cardHint: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 19,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 14,
  },
  inputNoMargin: {
    marginBottom: 0,
  },
  fieldWrap: {
    position: "relative",
    justifyContent: "center",
    marginBottom: 14,
  },
  withRightAction: {
    paddingRight: 72,
  },
  rightAction: {
    position: "absolute",
    right: 12,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  rightActionText: {
    color: COLORS.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  inputError: {
    borderColor: "rgba(220,38,38,0.65)",
  },
  errorText: {
    marginTop: -6,
    marginBottom: 12,
    color: COLORS.error,
    fontWeight: "800",
  },
  primaryBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 2,
  },
  primaryBtnDisabled: {
    backgroundColor: "#94A3B8",
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryText: {
    color: COLORS.blueDark,
    fontSize: 14,
    fontWeight: "900",
  },
});