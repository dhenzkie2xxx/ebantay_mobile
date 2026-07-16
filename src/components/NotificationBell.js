import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { getUnreadCount } from "../utils/push";

export default function NotificationBell({ onPress, color = "#fff" }) {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const c = await getUnreadCount();
      setCount(Number(c || 0));
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, 10000);
    return () => clearInterval(timer);
  }, [loadCount]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      android_ripple={{ color: "rgba(255,255,255,0.18)", borderless: true }}
      style={({ pressed }) => [
        styles.wrap,
        pressed && { opacity: 0.65 },
      ]}
    >
      <Icon name="notifications" size={24} color={color} />

      {count > 0 && (
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    minWidth: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
});