import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestLocationPermission, getCurrentLocation } from "../utils/location";
import { API_BASE_URL } from "../config/api";
import { authFetch, clearSession } from "../utils/auth";
import HeatmapMap from "../components/HeatmapMap";

const COLORS = {
  bg: "#F4F7FF",
  blue: "#1D4ED8",
  blueDark: "#0B2A6F",
  red: "#DC2626",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
};

function getBlockedAccountMessage(status) {
  const s = String(status || "").toLowerCase();

  if (s === "pending") return "Complete account verification first.";
  if (s === "incomplete") return "Complete account verification first.";
  if (s === "resubmission_required") return "Complete account verification first.";
  if (s === "rejected") return "Complete account verification first.";

  return "Complete account verification first.";
}

export default function HomeScreen({ navigation }) {
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState("");
  const [accountStatus, setAccountStatus] = useState(null);
  const [role, setRole] = useState(null);

  const [filterGroups, setFilterGroups] = useState([
    { key: "All", label: "All" },
    { key: "Panic", label: "Panic" },
  ]);
  const [category, setCategory] = useState("All");

  const [, setMapExpanded] = useState(false);
  const [, setPointsCount] = useState(0);
  const [, setNearestMeters] = useState(null);
  const [, setIsRisk] = useState(false);
  const [hotspotColor, setHotspotColor] = useState("none");
  const [, setHotspotName] = useState(null);

  const [scopeProvince, setScopeProvince] = useState(null);
  const [scopeCityMunicipality, setScopeCityMunicipality] = useState(null);

  const [nearestStation, setNearestStation] = useState(null);
  const [nearestStationLoading, setNearestStationLoading] = useState(false);

  const isPoliceOnField = role === "police_on_field";

  const isVerified =
    String(accountStatus || "").toLowerCase() === "verified" ||
    String(accountStatus || "").toLowerCase() === "active" ||
    String(accountStatus || "").toLowerCase() === "approved";

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const loadLocalUser = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("user_data");
      if (raw) {
        const u = JSON.parse(raw);
        const full = `${u.firstname || ""} ${u.lastname || ""}`.trim();

        setRole(u.role || null);
        setUserName(
          full ||
            u.username ||
            (u.role === "police_on_field" ? "Police on Field" : "Citizen User")
        );
        setAccountStatus(u.account_status || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadLocalUser();
  }, [loadLocalUser]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/crime_type_groups.php`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok || !Array.isArray(data.groups)) return;

        setFilterGroups(
          data.groups.map((g) => ({
            key: g.key,
            label: g.label,
          }))
        );
      } catch {}
    })();
  }, []);

  const showBlockedMessage = useCallback(() => {
    Alert.alert(
      "Verification Required",
      getBlockedAccountMessage(accountStatus),
      [
        {
          text: "Go to Account",
          onPress: () => navigation.navigate("Account"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }, [accountStatus, navigation]);

  const fetchNearestStation = useCallback(async (loc) => {
    if (!loc?.lat || !loc?.lng) {
      setNearestStation(null);
      return;
    }

    try {
      setNearestStationLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/get_nearest_station.php?lat=${encodeURIComponent(
          loc.lat
        )}&lng=${encodeURIComponent(loc.lng)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setNearestStation(null);
        return;
      }

      setNearestStation(data.station || null);

      if (data?.scope?.province) setScopeProvince(data.scope.province);
      if (data?.scope?.city_municipality) {
        setScopeCityMunicipality(data.scope.city_municipality);
      }
    } catch {
      setNearestStation(null);
    } finally {
      setNearestStationLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const ok = await requestLocationPermission();
      if (!ok) {
        Alert.alert("Location Permission", "Please enable location permission.");
        setUserLocation(null);
        return;
      }

      const loc = await getCurrentLocation();
      const nextLoc = {
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
      };

      setUserLocation(nextLoc);
      await fetchNearestStation(nextLoc);
    } catch {
      setUserLocation(null);
      Alert.alert("Location Error", "Unable to get your current location.");
    }
  }, [fetchNearestStation]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
      loadLocalUser();
    }, [refreshAll, loadLocalUser])
  );

  const onHeatmapDataChange = useCallback((payload) => {
    setPointsCount(Number(payload?.count ?? 0));
    setNearestMeters(
      payload?.nearestMeters == null ? null : Number(payload.nearestMeters)
    );
    setIsRisk(!!payload?.isRisk);
    setHotspotColor(String(payload?.hotspotColor || "none"));
    setHotspotName(payload?.hotspotName || null);

    if (payload?.province) setScopeProvince(payload.province);
    if (payload?.cityMunicipality) {
      setScopeCityMunicipality(payload.cityMunicipality);
    }
  }, []);

  const sendPanic = async ({ level }) => {
    try {
      if (isPoliceOnField) return;

      setSending(true);

      const ok = await requestLocationPermission();
      if (!ok) {
        Alert.alert("Location Permission", "Please enable location permission first.");
        return;
      }

      const loc = await getCurrentLocation();
      const nextLoc = {
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
      };
      setUserLocation(nextLoc);

      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        await clearSession(navigation);
        return;
      }

      const res = await authFetch(navigation, `${API_BASE_URL}/panic.php`, {
        method: "POST",
        body: JSON.stringify({
          token,
          level,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          device_time: new Date().toISOString(),
        }),
      });

      if (res.status === 401 || res.status === 403) {
        const data = await res.json().catch(() => ({}));

        if (res.status === 403 && data?.account_status) {
          showBlockedMessage();
          return;
        }

        await AsyncStorage.multiRemove(["auth_token", "user_data"]);
        navigation.getParent()?.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data?.message || "Failed to send panic");
      }

      if (data?.assigned_station) setNearestStation(data.assigned_station);
      if (data?.scope?.province) setScopeProvince(data.scope.province);
      if (data?.scope?.city_municipality) {
        setScopeCityMunicipality(data.scope.city_municipality);
      }

      Alert.alert(
        level === "urgent" ? "🚨 Emergency Panic Sent" : "⚠️ Alert Sent",
        level === "urgent"
          ? `Urgent help requested.\nLocation:\n${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
          : `Alert sent to the nearest station in your province.\nLocation:\n${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
      );
    } catch (e) {
      const msg = String(e?.message || "");
      Alert.alert("Panic Failed", msg || "Try again.");
    } finally {
      setSending(false);
    }
  };

  const onPanicPress = () => {
    if (isPoliceOnField) return;

    if (!isVerified) {
      showBlockedMessage();
      return;
    }

    const now = Date.now();
    const delta = now - lastTapRef.current;
    const DOUBLE_TAP_MS = 320;

    if (sending) return;

    if (delta < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      sendPanic({ level: "urgent" });
      return;
    }

    lastTapRef.current = now;
    tapTimerRef.current = setTimeout(() => {
      sendPanic({ level: "alert" });
      lastTapRef.current = 0;
    }, DOUBLE_TAP_MS);
  };

  const riskLabel = "MAP";
  const riskIcon = "map";
  const riskChipStyle = styles.safeChip;
  const riskTextStyle = styles.safeText;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSmall}>
              {isPoliceOnField ? "Police on Field Map" : "Welcome"}
            </Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {userName || (isPoliceOnField ? "Police on Field" : "Citizen User")}
            </Text>
            {!!scopeCityMunicipality || !!scopeProvince ? (
              <Text style={styles.scopeText}>
                Scope: {scopeCityMunicipality ? `${scopeCityMunicipality}, ` : ""}
                {scopeProvince || ""}
              </Text>
            ) : null}
          </View>

          <View style={[styles.statusChip, riskChipStyle]}>
            <Icon
              name={riskIcon}
              size={16}
              color={
                hotspotColor === "red"
                  ? "#7F1D1D"
                  : hotspotColor === "green"
                  ? "#166534"
                  : "#0B2A6F"
              }
            />
            <Text style={[styles.statusText, riskTextStyle]}>{riskLabel}</Text>
          </View>
        </View>

        {!isPoliceOnField && !isVerified ? (
          <View style={styles.verificationNotice}>
            <Icon name="lock" size={18} color={COLORS.blueDark} />
            <Text style={styles.verificationNoticeText}>
              Complete account verification first.
            </Text>
          </View>
        ) : null}

        {isPoliceOnField ? (
          <View style={styles.policeNotice}>
            <Icon name="local-police" size={18} color={COLORS.blueDark} />
            <Text style={styles.policeNoticeText}>
              You are viewing the monitoring map with heatmaps, hotspots, pending nearby reports,
              and assigned reports or panic requests. Use the Police on Field page for assignment,
              backup request, and verification actions.
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Stations</Text>
            <Text style={styles.statValue}>{nearestStation ? "1" : "0"}</Text>
            <Text style={styles.statSub}>Nearby police station</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>
              {nearestStationLoading
                ? "…"
                : nearestStation?.distance_m == null
                ? "N/A"
                : `${Math.round(nearestStation.distance_m)}m`}
            </Text>
            <Text style={styles.statSub}>Nearest police station</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Filter</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {filterGroups.find((g) => g.key === category)?.label || category}
            </Text>
            <Text style={styles.statSub}>Map mode</Text>
          </View>
        </View>

        <View style={styles.stationCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.stationTitle}>Nearest Police Station</Text>
            {nearestStationLoading ? <ActivityIndicator size="small" /> : null}
          </View>

          {nearestStation ? (
            <>
              <Text style={styles.stationName}>{nearestStation.station_name}</Text>
              <Text style={styles.stationMeta}>
                {nearestStation.station_type || "Police Station"}
                {nearestStation.distance_m != null ? ` • ${nearestStation.distance_m}m away` : ""}
              </Text>
              {!!nearestStation.full_address ? (
                <Text style={styles.stationAddress}>{nearestStation.full_address}</Text>
              ) : null}
              {!!nearestStation.contact_mobile ? (
                <Text style={styles.stationContact}>Mobile: {nearestStation.contact_mobile}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.stationEmpty}>
              No approved active station found yet for your current province.
            </Text>
          )}
        </View>

        <View style={styles.mapWrap}>
          <View style={styles.mapTopRow}>
            <View style={styles.mapChip}>
              <Icon name="my-location" size={16} color={COLORS.blue} />
              <Text style={styles.mapChipText}>
                {userLocation
                  ? `Lat ${userLocation.lat.toFixed(4)}, Lng ${userLocation.lng.toFixed(4)}`
                  : "Locating…"}
              </Text>
            </View>

            <Pressable
              onPress={refreshAll}
              style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}
            >
              <Icon name="refresh" size={18} color={COLORS.blueDark} />
              <Text style={styles.smallBtnText}>GPS</Text>
            </Pressable>
          </View>

          <View style={styles.mapCanvas}>
            <HeatmapMap
              height={320}
              userLocation={userLocation}
              nearestStation={nearestStation}
              showNearestStation={true}
              initialRegion={
                userLocation
                  ? {
                      latitude: userLocation.lat,
                      longitude: userLocation.lng,
                      latitudeDelta: 0.03,
                      longitudeDelta: 0.03,
                    }
                  : undefined
              }
              category={category}
              showCategoryFilter={false}
              categories={filterGroups.map((g) => g.key)}
              onExpandChange={setMapExpanded}
              days={30}
              useBbox={false}
              riskRadiusMeters={250}
              onDataChange={onHeatmapDataChange}
              showLegend={isPoliceOnField}
            />
          </View>
        </View>

        {!isPoliceOnField ? (
          <>
            <Pressable
              onPress={() => {
                if (!isVerified) return showBlockedMessage();
                navigation.navigate("Report");
              }}
              style={({ pressed }) => [
                styles.reportBtn,
                !isVerified && styles.disabledActionBtn,
                pressed && isVerified && { opacity: 0.9 },
              ]}
            >
              <Icon name="edit" size={20} color="#fff" />
              <Text style={styles.reportText}>
                {isVerified ? "Report Incident" : "Locked (Verification Required)"}
              </Text>
            </Pressable>

            <View style={styles.panicWrap}>
              <Text style={styles.panicHint}>
                Panic Button: <Text style={{ fontWeight: "900" }}>1 tap</Text> = alert •{" "}
                <Text style={{ fontWeight: "900" }}>2 taps</Text> = emergency
              </Text>

              <Pressable
                onPress={onPanicPress}
                disabled={sending}
                style={({ pressed }) => [
                  styles.panicBtn,
                  !isVerified && styles.disabledActionBtn,
                  pressed && isVerified && { opacity: 0.9 },
                  sending && { opacity: 0.7 },
                ]}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.panicText}>
                    {isVerified ? "Panic" : "Locked (Verification Required)"}
                  </Text>
                )}
              </Pressable>

              <Text style={styles.panicSub}>
                {isVerified
                  ? "Sends your current GPS location to the nearest station admin and the nearest available police on field when available."
                  : "Complete account verification first."}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 26 },

  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  headerSmall: { fontSize: 11, color: COLORS.muted, fontWeight: "800" },
  headerName: { fontSize: 16, color: COLORS.text, fontWeight: "900", marginTop: 2 },
  scopeText: { marginTop: 4, fontSize: 12, color: COLORS.blueDark, fontWeight: "800" },

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
    backgroundColor: "rgba(29,78,216,0.08)",
    borderColor: "rgba(29,78,216,0.18)",
  },
  statusText: { fontWeight: "900", fontSize: 12 },
  safeText: { color: COLORS.blueDark },

  verificationNotice: {
    marginBottom: 12,
    backgroundColor: "#EEF4FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verificationNoticeText: {
    flex: 1,
    color: COLORS.blueDark,
    fontSize: 12,
    fontWeight: "800",
  },

  policeNotice: {
    marginBottom: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  policeNoticeText: {
    flex: 1,
    color: COLORS.blueDark,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  statLabel: { fontSize: 11, color: COLORS.muted, fontWeight: "800" },
  statValue: { fontSize: 18, color: COLORS.text, fontWeight: "900", marginTop: 2 },
  statSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  stationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stationTitle: { fontSize: 14, color: COLORS.text, fontWeight: "900" },
  stationName: { fontSize: 16, color: COLORS.blueDark, fontWeight: "900", marginTop: 8 },
  stationMeta: { fontSize: 12, color: COLORS.muted, marginTop: 4, fontWeight: "700" },
  stationAddress: { fontSize: 12, color: COLORS.text, marginTop: 6, lineHeight: 18 },
  stationContact: { fontSize: 12, color: COLORS.blueDark, marginTop: 6, fontWeight: "800" },
  stationEmpty: { fontSize: 12, color: COLORS.muted, marginTop: 8 },

  mapWrap: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 12,
  },
  mapTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  mapChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(29,78,216,0.08)",
    borderColor: "rgba(29,78,216,0.18)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    flex: 1,
  },
  mapChipText: {
    color: COLORS.blueDark,
    fontSize: 12,
    fontWeight: "800",
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  smallBtnText: {
    color: COLORS.blueDark,
    fontSize: 12,
    fontWeight: "900",
  },
  mapCanvas: {
    overflow: "hidden",
    borderRadius: 18,
  },

  reportBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  disabledActionBtn: {
    backgroundColor: "#94A3B8",
  },
  reportText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },

  panicWrap: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    alignItems: "center",
  },
  panicHint: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 12,
    textAlign: "center",
  },
  panicBtn: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  panicText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  panicSub: {
    marginTop: 12,
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});