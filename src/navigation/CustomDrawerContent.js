import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function CustomDrawerContent(props) {
  const [accountStatus, setAccountStatus] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user_data");
        if (!alive) return;

        if (raw) {
          const u = JSON.parse(raw);
          setAccountStatus(u.account_status || null);
        } else {
          setAccountStatus(null);
        }
      } catch {
        if (!alive) return;
        setAccountStatus(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const isVerified =
    String(accountStatus || "").toLowerCase() === "verified" ||
    String(accountStatus || "").toLowerCase() === "active" ||
    String(accountStatus || "").toLowerCase() === "approved";

  const logout = async () => {
    await AsyncStorage.multiRemove(["auth_token", "user_data"]);
    props.navigation.replace("Login");
  };

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.container}>
        <Text style={styles.title}>eBantay</Text>

        <Pressable
          style={styles.item}
          onPress={() => props.navigation.navigate("HomeDrawer")}
        >
          <Icon name="home" size={22} />
          <Text style={styles.label}>Home</Text>
        </Pressable>

        {isVerified && (
          <Pressable
            style={styles.item}
            onPress={() => props.navigation.navigate("Report")}
          >
            <Icon name="edit" size={22} />
            <Text style={styles.label}>Report Incident</Text>
          </Pressable>
        )}

        {isVerified && (
          <Pressable
            style={styles.item}
            onPress={() => props.navigation.navigate("Heatmap")}
          >
            <Icon name="map" size={22} />
            <Text style={styles.label}>Activity Map</Text>
          </Pressable>
        )}

        {isVerified && (
          <Pressable
            style={styles.item}
            onPress={() => props.navigation.navigate("Alerts")}
          >
            <Icon name="campaign" size={22} />
            <Text style={styles.label}>Community Alerts</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.item}
          onPress={() => props.navigation.navigate("Account")}
        >
          <Icon name="person" size={22} />
          <Text style={styles.label}>My Account</Text>
        </Pressable>

        <Pressable
          style={styles.item}
          onPress={() => props.navigation.navigate("Settings")}
        >
          <Icon name="settings" size={22} />
          <Text style={styles.label}>Settings</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.item} onPress={logout}>
          <Icon name="logout" size={22} color="#DC2626" />
          <Text style={[styles.label, { color: "#DC2626" }]}>Logout</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: "900", marginBottom: 30 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  label: { fontSize: 15, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 20 },
});