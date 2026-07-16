import React, { useCallback } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
} from "@react-navigation/drawer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/MaterialIcons";
import { View, Image, StyleSheet, Text, Alert } from "react-native";
import { API_BASE_URL } from "../config/api";

import LoginScreen from "../screens/LoginScreen";
import HomeDrawer from "../screens/HomeScreen";
import ReportScreen from "../screens/ReportScreen";
import MyActivityScreen from "../screens/MyActivityScreen";
import CommunityAlertScreen from "../screens/CommunityAlertScreen";
import RegisterScreen from "../screens/RegisterScreen";
import VerifyEmailScreen from "../screens/VerifyEmailScreen";
import SettingsScreen from "../screens/SettingsScreen";
import NotificationsScreen from "../screens/NotificationScreen";
import HeatmapScreen from "../screens/HeatmapScreen";
import AccountScreen from "../screens/AccountScreen";
import AddressPinScreen from "../screens/AddressPinScreen";
import NotificationBell from "../components/NotificationBell";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";

import PoliceHomeScreen from "../screens/PoliceHomeScreen";
import PoliceAssignmentDetailsScreen from "../screens/PoliceAssignmentDetailsScreen";

const logo = require("../assets/logowhite.png");

const RootStack = createNativeStackNavigator();
const AuthStackNav = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

async function clearSessionStorage() {
  try {
    await AsyncStorage.multiRemove(["auth_token", "user_data"]);
  } catch {}
}

async function validateToken(token) {
  const res = await fetch(`${API_BASE_URL}/me.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (res.status === 401 || res.status === 403) return { ok: false };

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) return { ok: false };

  return { ok: true, user: data.user };
}

async function hardLogout(navigation, message) {
  await clearSessionStorage();
  if (message) Alert.alert("Session", message);

  navigation.reset({
    index: 0,
    routes: [{ name: "Auth" }],
  });
}

function CustomDrawerContent(props) {
  const { navigation } = props;

  const [accountStatus, setAccountStatus] = React.useState(null);
  const [role, setRole] = React.useState(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user_data");
        if (!alive) return;

        if (raw) {
          const u = JSON.parse(raw);
          setAccountStatus(u.account_status || null);
          setRole(u.role || null);
        } else {
          setAccountStatus(null);
          setRole(null);
        }
      } catch {
        if (!alive) return;
        setAccountStatus(null);
        setRole(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const isPoliceOnField = role === "police_on_field";

  const isVerified =
    String(accountStatus || "").toLowerCase() === "verified" ||
    String(accountStatus || "").toLowerCase() === "active" ||
    String(accountStatus || "").toLowerCase() === "approved";

  const onLogout = useCallback(async () => {
    const rootNav = navigation.getParent() ?? navigation;
    await hardLogout(rootNav, "Logged out successfully.");
  }, [navigation]);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.drawerHeader}>
        <Image source={logo} style={styles.drawerLogo} resizeMode="contain" />
        <Text style={styles.drawerSubtitle}>
          {isPoliceOnField ? "Police on Field Response" : "Community Safety Reporting"}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <DrawerItem
          label={isPoliceOnField ? "Home / Map" : "Home"}
          labelStyle={styles.drawerLabel}
          icon={({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          )}
          onPress={() => navigation.navigate("HomeDrawer")}
        />

        {isPoliceOnField && (
          <DrawerItem
            label="Police on Field"
            labelStyle={styles.drawerLabel}
            icon={({ color, size }) => (
              <Icon name="local-police" size={size} color={color} />
            )}
            onPress={() => navigation.navigate("PoliceHome")}
          />
        )}

        {!isPoliceOnField && isVerified && (
          <DrawerItem
            label="Report Incident"
            labelStyle={styles.drawerLabel}
            icon={({ color, size }) => (
              <Icon name="edit" size={size} color={color} />
            )}
            onPress={() => navigation.navigate("Report")}
          />
        )}

        {!isPoliceOnField && isVerified && (
          <DrawerItem
            label="My Activity"
            labelStyle={styles.drawerLabel}
            icon={({ color, size }) => (
              <Icon name="assignment" size={size} color={color} />
            )}
            onPress={() => navigation.navigate("MyActivity")}
          />
        )}

        {!isPoliceOnField && isVerified && (
          <DrawerItem
            label="Activity Map"
            labelStyle={styles.drawerLabel}
            icon={({ color, size }) => (
              <Icon name="map" size={size} color={color} />
            )}
            onPress={() => navigation.navigate("Heatmap")}
          />
        )}

        {!isPoliceOnField && isVerified && (
          <DrawerItem
            label="Community Alerts"
            labelStyle={styles.drawerLabel}
            icon={({ color, size }) => (
              <Icon name="campaign" size={size} color={color} />
            )}
            onPress={() => navigation.navigate("Alerts")}
          />
        )}

        {!isPoliceOnField && (
          <DrawerItem
            label="Account"
            labelStyle={styles.drawerLabel}
            icon={({ color, size }) => (
              <Icon name="manage-accounts" size={size} color={color} />
            )}
            onPress={() => navigation.navigate("Account")}
          />
        )}

        <DrawerItem
          label="Settings"
          labelStyle={styles.drawerLabel}
          icon={({ color, size }) => (
            <Icon name="settings" size={size} color={color} />
          )}
          onPress={() => navigation.navigate("Settings")}
        />
      </View>

      <View style={styles.drawerFooter}>
        <DrawerItem
          label="Logout"
          labelStyle={[styles.drawerLabel, { color: "#DC2626" }]}
          icon={({ size }) => (
            <Icon name="logout" size={size} color="#DC2626" />
          )}
          onPress={onLogout}
        />
      </View>
    </DrawerContentScrollView>
  );
}

function HeaderRight({ navigation }) {
  return (
    <NotificationBell
      color="#fff"
      onPress={() => navigation.navigate("Notifications")}
    />
  );
}

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: "#0B2A6F",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "900",
        },
        headerRight: () => <HeaderRight navigation={navigation} />,
      })}
    >
      <Drawer.Screen
        name="HomeDrawer"
        component={HomeDrawer}
        options={{
          title: "Home / Map",
          drawerIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="PoliceHome"
        component={PoliceHomeScreen}
        options={{
          title: "Police on Field",
          drawerIcon: ({ color, size }) => (
            <Icon name="local-police" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="PoliceAssignmentDetails"
        component={PoliceAssignmentDetailsScreen}
        options={{
          title: "Assignment Details",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="Report"
        component={ReportScreen}
        options={{
          title: "Report Incident",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="MyActivity"
        component={MyActivityScreen}
        options={{
          title: "My Activity",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="Alerts"
        component={CommunityAlertScreen}
        options={{
          title: "Community Alerts",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="Heatmap"
        component={HeatmapScreen}
        options={{
          title: "Activity Map",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />

      <Drawer.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: "Account",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: "Notifications",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="AddressPin"
        component={AddressPinScreen}
        options={{
          title: "Pinpoint Address",
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer.Navigator>
  );
}

function AuthStack({ onLoginSuccess }) {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login">
        {(props) => (
          <LoginScreen
            {...props}
            onLoginSuccess={onLoginSuccess}
          />
        )}
      </AuthStackNav.Screen>

      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
      <AuthStackNav.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStackNav.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStackNav.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStackNav.Navigator>
  );
}

function AuthGate({ navigation }) {
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");

        if (!token) {
          if (!cancelled) {
            navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
          }
          return;
        }

        const v = await validateToken(token);
        if (!v.ok) {
          await clearSessionStorage();
          if (!cancelled) {
            navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
          }
          return;
        }

        await AsyncStorage.setItem("user_data", JSON.stringify(v.user));

        if (!cancelled) {
          navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        }
      } catch {
        await clearSessionStorage();
        if (!cancelled) {
          navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return null;
}

export default function RootNavigator() {
  const onLoginSuccess = useCallback(async (navigation) => {
    const token = await AsyncStorage.getItem("auth_token");

    if (!token) {
      navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
      return;
    }

    const v = await validateToken(token);
    if (!v.ok) {
      await clearSessionStorage();
      navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
      return;
    }

    await AsyncStorage.setItem("user_data", JSON.stringify(v.user));

    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  }, []);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="AuthGate" component={AuthGate} />

      <RootStack.Screen name="Auth">
        {(props) => (
          <AuthStack
            {...props}
            onLoginSuccess={onLoginSuccess}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Main" component={MainDrawer} />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 18,
    paddingTop: 22,
    backgroundColor: "#0B2A6F",
  },
  drawerLogo: {
    width: "100%",
    height: 44,
  },
  drawerSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
    textAlign: "center",
  },
  drawerLabel: {
    fontWeight: "800",
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.9)",
    paddingBottom: 8,
  },
});