import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

export default function AlertsScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community Alerts</Text>
      <Text style={styles.subtitle}>Alerts from admins will appear here.</Text>

      <Pressable style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 18 },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#2563eb' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
