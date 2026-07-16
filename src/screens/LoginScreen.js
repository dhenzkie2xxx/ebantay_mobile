import { initPushAndroid } from "../utils/push";
import { API_BASE_URL } from '../config/api';
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const logo = require('../assets/logowhite.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen({ navigation, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return username.trim().length >= 3 && password.length >= 4 && !loading;
  }, [username, password, loading]);

 const onLogin = async () => {
   if (!canSubmit) return;

   try {
     setLoading(true);

     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 90000);

     let res;
     try {
       res = await fetch(`${API_BASE_URL}/login.php`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ username: username.trim(), password }),
         signal: controller.signal,
       });
     } finally {
       clearTimeout(timeout);
     }

     const text = await res.text();
     let data;
     try {
       data = JSON.parse(text);
     } catch {
       console.log("NON-JSON RESPONSE:", text);
       Alert.alert("Server Error", "Server returned an invalid response.");
       return;
     }

     if (res.status === 403 && data.needs_verification) {
       Alert.alert("Verify Email", data.message || "Please verify your email.", [
         { text: "OK", onPress: () => navigation.replace("VerifyEmail", { email: data.email }) },
       ]);
       return;
     }

     if (!res.ok || !data.ok) {
       Alert.alert("Login Failed", data.message || "Invalid credentials");
       return;
     }

     // ✅ Success
     await AsyncStorage.setItem("auth_token", data.token);
     await AsyncStorage.setItem("user_data", JSON.stringify(data.user));

     onLoginSuccess?.(navigation);

     setTimeout(() => {
       initPushAndroid().catch((e) =>
         console.log("Deferred push init error:", e?.message || e)
       );
     }, 800);

   } catch (err) {
     console.log("LOGIN ERROR:", err);
     if (err.name === "AbortError") {
       Alert.alert("Timeout", "Server took too long to respond. Try again.");
     } else {
       Alert.alert("Network Error", err?.message || "Unable to connect to server.");
     }
   } finally {
     setLoading(false);
   }
 };

  // Responsive logo size for a wide logo
  const logoWidth = Math.min(SCREEN_WIDTH * 0.72, 320);
  const logoHeight = Math.max(logoWidth * 0.28, 70); // wide aspect

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={logo}
            style={[styles.logo, { width: logoWidth, height: logoHeight }]}
            resizeMode="contain"
          />
          <Text style={styles.headerSubtitle}>Community Safety Reporting Application</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <Text style={styles.cardHint}>Use your username and password to continue.</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your username"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            returnKeyType="next"
            editable={!loading}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry={!showPass}
              style={[styles.input, styles.passwordInput]}
              returnKeyType="done"
              onSubmitEditing={onLogin}
              editable={!loading}
            />

            <Pressable
              onPress={() => setShowPass((v) => !v)}
              style={({ pressed }) => [
                styles.showBtn,
                pressed && { opacity: 0.75 }
              ]}
            >
              <Text style={styles.showText}>{showPass ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={onLogin}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.loginBtn,
              !canSubmit && styles.loginBtnDisabled,
              pressed && canSubmit && { transform: [{ scale: 0.99 }] }
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginText}>Login</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.secondaryText}>Create an account</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          By continuing, you agree to follow community reporting guidelines.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const COLORS = {
  bg: '#F4F7FF',
  blue: '#1D4ED8',
  blueDark: '#0B2A6F',
  red: '#DC2626',
  yellow: '#FFFF00',
  text: '#0F172A',
  muted: '#64748B',
  placeholder: '#94A3B8',
  border: '#E2E8F0',
  card: '#FFFFFF'
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1
  },

  header: {
    paddingTop: 70,
    paddingBottom: 55,
    paddingHorizontal: 20,
    backgroundColor: COLORS.blueDark
  },

  logo: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 2
  },

  headerSubtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.82)',
    marginTop: 0,
    fontSize: 13
  },

  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: -18, // lift over header
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800'
  },
  cardHint: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 16
  },

  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 14
  },

  passwordRow: {
    position: 'relative',
    justifyContent: 'center'
  },
  passwordInput: {
    paddingRight: 72
  },
  showBtn: {
    position: 'absolute',
    right: 12,
    top: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF'
  },
  showText: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 12
  },

  linkBtn: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 12
  },
  linkText: {
    color: COLORS.blue,
    fontWeight: '700'
  },

  loginBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2
  },
  loginBtnDisabled: {
    backgroundColor: '#94A3B8'
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800'
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border
  },
  dividerText: {
    marginHorizontal: 10,
    color: COLORS.muted,
    fontWeight: '700',
    fontSize: 12
  },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center'
  },
  secondaryText: {
    color: COLORS.blueDark,
    fontSize: 15,
    fontWeight: '800'
  },

  footer: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12,
    paddingHorizontal: 22,
    paddingVertical: 18
  }
});
