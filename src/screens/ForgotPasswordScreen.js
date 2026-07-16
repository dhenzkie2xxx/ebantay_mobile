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

export default function ForgotPasswordScreen({ navigation }) {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return emailOrUsername.trim().length >= 3 && !loading;
  }, [emailOrUsername, loading]);

  const onSubmit = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/forgot_password.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOrUsername.trim() }),
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
        Alert.alert("Request Failed", data.message || "Please try again.");
        return;
      }

      Alert.alert(
        "Check Your Email",
        data.message || "Password reset link sent. Please check your email.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.log("FORGOT PASSWORD ERROR:", err);
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
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Icon name="arrow-back" size={24} color={COLORS.yellow} />
          </Pressable>

          <Text style={styles.headerTitle}>Forgot Password</Text>
          <Text style={styles.headerSubtitle}>
            Enter your email or username to receive a reset link.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reset your password</Text>
          <Text style={styles.cardHint}>
            We will send a secure password reset link to the email connected to your account.
          </Text>

          <Text style={styles.label}>Email or Username</Text>
          <TextInput
            value={emailOrUsername}
            onChangeText={setEmailOrUsername}
            placeholder="Enter email or username"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />

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
              <Text style={styles.primaryText}>Send Reset Link</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.secondaryText}>Back to Login</Text>
          </Pressable>
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