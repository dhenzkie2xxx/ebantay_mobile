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

import { API_BASE_URL } from '../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

const logo = require('../assets/logowhite.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const [Email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [Lastname, setLastName] = useState('');
  const [Firstname, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const canSubmit = useMemo(() => {
    const okLastName = Lastname.trim().length >= 3;
    const okFirstName = Firstname.trim().length >= 3;
    const okUsername = username.trim().length >= 4;
    const okPass = password.length >= 6;
    const okConfirm = confirmPassword.length >= 6 && password === confirmPassword;
    return okLastName && okFirstName && okUsername && okPass && okConfirm && !loading;
  }, [Lastname, Firstname, username, password, confirmPassword, loading]);

  const isValidEmailFormat = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return regex.test(value);
  };

  const onRegister = async () => {
    if (!canSubmit) return;

    if (emailError) {
      return;
    }

    if (!Firstname || !Lastname || !username || !password || !Email) {
          Alert.alert('Incomplete', 'Please fill out all fields');
          return;
    }

    try {
      setLoading(true);

       const res = await fetch(`${API_BASE_URL}/register.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                Lastname,
                Firstname,
                Email,
                username,
                password
              })
       });

       const data = await res.json();
       console.log("REGISTER RESPONSE:", data);

          if (!res.ok || !data.ok) {
               Alert.alert('Registration Failed', data.message || 'Try again');
               return;
             }

          Alert.alert('Success', 'Account created successfully', [
                { text: 'OK', onPress: () => navigation.replace('Login') }
          ]);

    } catch (err) {
      Alert.alert('Error', 'Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const logoWidth = Math.min(SCREEN_WIDTH * 0.72, 320);
  const logoHeight = Math.max(logoWidth * 0.28, 70);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          {/* Phone support icon (no color change for emoji; change to vector icon if needed) */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              {
                position: 'absolute',
                left: 16,
                top: 40
              },
              pressed && { opacity: 0.7 }
            ]}
          >
            <Icon
              name="arrow-back"
              size={24}
              color={COLORS.yellow}
            />
          </Pressable>

          <Image
            source={logo}
            style={[styles.logo, { width: logoWidth, height: logoHeight }]}
            resizeMode="contain"
          />

          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join eBantay to submit and track reports</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registration</Text>
          <Text style={styles.cardHint}>Please fill in your details below.</Text>

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            value={Lastname}
            onChangeText={setLastName}
            placeholder="e.g., Dela Cruz"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>First Name</Text>
          <TextInput
             value={Firstname}
             onChangeText={setFirstName}
             placeholder="e.g., Juan"
             placeholderTextColor={COLORS.placeholder}
             style={styles.input}
             autoCapitalize="words"
             returnKeyType="next"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
            placeholder="Choose a username"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.fieldWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry={!showPass}
              style={[styles.input, styles.inputNoMargin, styles.withRightAction]}
              autoCapitalize="none"
              returnKeyType="next"
            />
            <Pressable
              onPress={() => setShowPass((v) => !v)}
              style={({ pressed }) => [styles.rightAction, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.rightActionText}>{showPass ? 'Hide' : 'Show'}</Text>
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
                passwordMismatch && styles.inputError
              ]}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={onRegister}
            />
            <Pressable
              onPress={() => setShowConfirm((v) => !v)}
              style={({ pressed }) => [styles.rightAction, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.rightActionText}>{showConfirm ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {passwordMismatch ? (
            <Text style={styles.errorText}>Passwords do not match.</Text>
          ) : null}

          <Text style={styles.label}>Email</Text>
               <TextInput
                 style={[
                   styles.input,
                   emailError ? styles.inputError : null
                 ]}
                 placeholder="Email Address"
                 value={Email}
                 onChangeText={(value) => {
                   setEmail(value);
                   if (value.length === 0) {
                     setEmailError('');
                   } else if (!isValidEmailFormat(value)) {
                     setEmailError('Enter a valid email address');
                   } else {
                     setEmailError('');
                   }
                 }}
                 keyboardType="email-address"
                 autoCapitalize="none"
               />

                {emailError ? (
                  <Text style={styles.errorText}>{emailError}</Text>
                ) : null}

          <Pressable
            onPress={onRegister}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canSubmit && styles.primaryBtnDisabled,
              pressed && canSubmit && { transform: [{ scale: 0.99 }] }
            ]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create Account</Text>}
          </Pressable>

          <Pressable
            onPress={() => navigation.replace('Login')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.secondaryText}>Already have an account? Login</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Your information will be used to identify reports and improve community safety.
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
  card: '#FFFFFF',
  error: '#DC2626'
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },

  header: {
    paddingTop: 30,
    paddingBottom: 22,
    paddingHorizontal: 20,
    backgroundColor: COLORS.blueDark
  },

  supportWrap: {
    alignSelf: 'center',
    marginBottom: 10
  },

  logo: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 10
  },
  headerTitle: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2
  },
  headerSubtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
    fontSize: 13
  },

  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: -18,
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
    fontWeight: '900'
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
    fontWeight: '800',
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
  inputNoMargin: { marginBottom: 0 },

  fieldWrap: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 14
  },
  withRightAction: {
    paddingRight: 72
  },
  rightAction: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  rightActionText: {
    color: COLORS.blue,
    fontWeight: '900',
    fontSize: 12
  },

  inputError: {
    borderColor: 'rgba(220,38,38,0.65)'
  },
  errorText: {
    marginTop: 8,
    marginBottom: 6,
    color: COLORS.error,
    fontWeight: '800'
  },

  primaryBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2
  },
  primaryBtnDisabled: {
    backgroundColor: '#94A3B8'
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900'
  },

  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF1F2',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center'
  },
  secondaryText: {
    color: COLORS.red,
    fontSize: 14,
    fontWeight: '900'
  },

  footer: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12,
    paddingHorizontal: 22,
    paddingVertical: 18
  }
});
