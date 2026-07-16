import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

export default function VerifyEmailScreen({ route, navigation }) {
  const email = route?.params?.email;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Email</Text>

      <Text style={styles.text}>
        We sent a verification link to:
      </Text>

      <Text style={styles.email}>{email}</Text>

      <Text style={styles.text}>
        Please check your inbox and click the link to continue.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => navigation.replace('Login')}
      >
        <Text style={styles.buttonText}>Back to Login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20
  },
  text: {
    textAlign: 'center',
    marginBottom: 8
  },
  email: {
    fontWeight: 'bold',
    marginBottom: 16
  },
  button: {
    marginTop: 20,
    backgroundColor: '#1D4ED8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});
