import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestLocationPermission, getCurrentLocation } from "../utils/location";
import { API_BASE_URL } from "../config/api";

const PROFILE_KEY = "account_profile_draft_v1";

const COLORS = {
  bg: "#F4F7FF",
  blueDark: "#0B2A6F",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
};

export default function AddressPinScreen({ navigation, route }) {
  const mapRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState(null); // {lat,lng}
  const [pin, setPin] = useState(null); // {lat,lng}
  const [didCenterOnce, setDidCenterOnce] = useState(false);

  const [geoLoading, setGeoLoading] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState({
    addressText: "",
    barangay: "",
    city_municipality: "",
    province: "",
    region: "",
  });

  const initialRegion = useMemo(() => {
    if (pin?.lat && pin?.lng) {
      return {
        latitude: pin.lat,
        longitude: pin.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    if (userLoc?.lat && userLoc?.lng) {
      return {
        latitude: userLoc.lat,
        longitude: userLoc.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return {
      latitude: 8.061,
      longitude: 123.75,
      latitudeDelta: 0.35,
      longitudeDelta: 0.35,
    };
  }, [pin, userLoc]);

  const loadExistingPin = useCallback(async () => {
    try {
      const passedPin = route?.params?.currentPin;
      if (
        passedPin &&
        Number.isFinite(Number(passedPin.lat)) &&
        Number.isFinite(Number(passedPin.lng))
      ) {
        return { lat: Number(passedPin.lat), lng: Number(passedPin.lng) };
      }

      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      const p = saved?.addressPin;
      if (p?.lat && p?.lng) return { lat: Number(p.lat), lng: Number(p.lng) };
      return null;
    } catch {
      return null;
    }
  }, [route?.params?.currentPin]);

  const reverseGeocodePin = useCallback(async (lat, lng) => {
    try {
      setGeoLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/reverse_geocode.php?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok || !data.address) {
        throw new Error(data?.message || "Unable to resolve address.");
      }

      const a = data.address || {};

      const next = {
        addressText:
          a.display_name ||
          a.place_of_incident ||
          "",
        barangay: a.barangay || "",
        city_municipality: a.city_municipality || "",
        province: a.province || "",
        region: a.region || "",
      };

      setResolvedAddress(next);
      return next;
    } catch (e) {
      setResolvedAddress({
        addressText: "",
        barangay: "",
        city_municipality: "",
        province: "",
        region: "",
      });
      return null;
    } finally {
      setGeoLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const savedPin = await loadExistingPin();
      if (savedPin) {
        setPin(savedPin);
        await reverseGeocodePin(savedPin.lat, savedPin.lng);
      }

      const ok = await requestLocationPermission();
      if (ok) {
        const l = await getCurrentLocation();
        const me = { lat: l.lat, lng: l.lng };
        setUserLoc(me);

        if (!savedPin) {
          setPin(me);
          await reverseGeocodePin(me.lat, me.lng);
        }
      }
    } catch {
      // silent to keep current UX simple
    } finally {
      setLoading(false);
    }
  }, [loadExistingPin, reverseGeocodePin]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (didCenterOnce) return;
    const target = pin ?? userLoc;
    if (!target?.lat || !target?.lng) return;

    setDidCenterOnce(true);
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: target.lat,
          longitude: target.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        450
      );
    }, 120);
  }, [pin, userLoc, didCenterOnce]);

  const onTapMap = useCallback(async (e) => {
    const c = e?.nativeEvent?.coordinate;
    if (!c) return;

    const nextPin = { lat: c.latitude, lng: c.longitude };
    setPin(nextPin);
    await reverseGeocodePin(nextPin.lat, nextPin.lng);
  }, [reverseGeocodePin]);

  const centerToUser = useCallback(() => {
    if (!userLoc?.lat || !userLoc?.lng) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userLoc.lat,
        longitude: userLoc.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      450
    );
  }, [userLoc]);

  const useMyLocationAsPin = useCallback(async () => {
    if (!userLoc?.lat || !userLoc?.lng) return;

    const nextPin = { lat: userLoc.lat, lng: userLoc.lng };
    setPin(nextPin);

    mapRef.current?.animateToRegion(
      {
        latitude: userLoc.lat,
        longitude: userLoc.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      450
    );

    await reverseGeocodePin(nextPin.lat, nextPin.lng);
  }, [userLoc, reverseGeocodePin]);

  const savePin = useCallback(async () => {
    if (!pin?.lat || !pin?.lng) {
      Alert.alert("Pin required", "Please tap on the map to set your address pin.");
      return;
    }

    let resolved = resolvedAddress;

    if (!resolved?.city_municipality || !resolved?.province) {
      const fresh = await reverseGeocodePin(pin.lat, pin.lng);
      if (fresh) resolved = fresh;
    }

    if (!resolved?.city_municipality || !resolved?.province) {
      Alert.alert(
        "Address Incomplete",
        "Unable to resolve city/municipality and province from the selected pin. Please try another nearby location."
      );
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      const draft = raw ? JSON.parse(raw) : {};

      const next = {
        ...draft,
        addressPin: { lat: pin.lat, lng: pin.lng },
        addressText: resolved.addressText || draft.addressText || "",
        barangay: resolved.barangay || draft.barangay || "",
        city_municipality: resolved.city_municipality || draft.city_municipality || "",
        province: resolved.province || draft.province || "",
        region: resolved.region || draft.region || "",
      };

      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));

      navigation.navigate({
        name: "Account",
        params: {
          selectedPin: { lat: pin.lat, lng: pin.lng },
          addressText: next.addressText,
          barangay: next.barangay,
          city_municipality: next.city_municipality,
          province: next.province,
          region: next.region,
        },
        merge: true,
      });

    } catch {
      Alert.alert("Error", "Unable to save pin. Please try again.");
    }
  }, [pin, resolvedAddress, navigation, reverseGeocodePin]);

  return (
    <View style={styles.root}>
      <View style={styles.mapCard}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onPress={onTapMap}
        >
          {pin ? (
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              title="Address Pin"
              description="Tap map or drag this pin"
              draggable
              onDragEnd={async (e) => {
                const c = e?.nativeEvent?.coordinate;
                if (!c) return;
                const nextPin = { lat: c.latitude, lng: c.longitude };
                setPin(nextPin);
                await reverseGeocodePin(nextPin.lat, nextPin.lng);
              }}
            />
          ) : null}
        </MapView>

        <View style={styles.topOverlay}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Icon name="arrow-back" size={22} color={COLORS.blueDark} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Pinpoint Address</Text>
            <Text style={styles.sub}>Tap the map to set your address location.</Text>
          </View>

          <Pressable onPress={centerToUser} style={styles.iconBtn}>
            <Icon name="my-location" size={22} color={COLORS.blueDark} />
          </Pressable>
        </View>

        <View style={styles.bottomOverlay}>
          <Pressable
            onPress={useMyLocationAsPin}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
          >
            <Icon name="place" size={18} color={COLORS.blueDark} />
            <Text style={styles.secondaryText}>Use my location</Text>
          </Pressable>

          <View style={styles.pinInfo}>
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator />
                <Text style={styles.pinText}>Loading…</Text>
              </View>
            ) : geoLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator />
                <Text style={styles.pinText}>Resolving address…</Text>
              </View>
            ) : pin ? (
              <>
                <Text style={styles.pinText}>
                  Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                </Text>
                {!!resolvedAddress.city_municipality || !!resolvedAddress.province ? (
                  <Text style={styles.pinSubText} numberOfLines={2}>
                    {resolvedAddress.barangay ? `${resolvedAddress.barangay}, ` : ""}
                    {resolvedAddress.city_municipality ? `${resolvedAddress.city_municipality}, ` : ""}
                    {resolvedAddress.province || ""}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.pinText}>Tap the map to set a pin</Text>
            )}
          </View>

          <Pressable
            onPress={savePin}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
          >
            <Icon name="check-circle" size={18} color="#fff" />
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  mapCard: { flex: 1, backgroundColor: COLORS.card },

  topOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  sub: { marginTop: 2, fontSize: 11, fontWeight: "800", color: COLORS.muted },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  bottomOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  secondaryBtn: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryText: { color: COLORS.blueDark, fontWeight: "900", fontSize: 12 },

  pinInfo: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.92)",
  },
  pinText: { fontSize: 12, fontWeight: "900", color: COLORS.text },
  pinSubText: { marginTop: 4, fontSize: 11, fontWeight: "700", color: COLORS.muted },

  saveBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 12 },
});