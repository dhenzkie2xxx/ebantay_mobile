import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";
import { requestLocationPermission, getCurrentLocation } from "../utils/location";

const COLORS = {
  blueDark: "#0B2A6F",
  blue: "#2563EB",
  teal: "#0F766E",
  green: "#16A34A",
  orange: "#F97316",
  red: "#DC2626",
  greenBg: "#DCFCE7",
  greenText: "#166534",
  redBg: "#FEE2E2",
  redText: "#7F1D1D",
  blueBg: "#DBEAFE",
  blueText: "#0B2A6F",
  slateBg: "#F1F5F9",
  slateText: "#475569",
  white: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  subtext: "#475569",
};

function getReportMarkerStyle(status) {
  switch (String(status || "").toUpperCase()) {
    case "VERIFIED":
      return styles.myReportMarkerVerified;
    case "DUPLICATE":
      return styles.myReportMarkerDuplicate;
    case "FALSE_REPORT":
      return styles.myReportMarkerFalse;
    case "PENDING":
    default:
      return styles.myReportMarkerPending;
  }
}

function getPanicMarkerStyle(level) {
  return String(level || "alert").toLowerCase() === "urgent"
    ? styles.panicMarkerUrgent
    : styles.panicMarkerAlert;
}

export default function HeatmapScreen() {
  const mapRef = useRef(null);
  const fullMapRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [locLoading, setLocLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [userLoc, setUserLoc] = useState(null);
  const [scopeProvince, setScopeProvince] = useState(null);
  const [scopeCityMunicipality, setScopeCityMunicipality] = useState(null);

  const [nearestStation, setNearestStation] = useState(null);
  const [nearestStationLoading, setNearestStationLoading] = useState(false);
  const [allStations, setAllStations] = useState([]);
  const [mapType, setMapType] = useState("standard");

  const [myMarkers, setMyMarkers] = useState([]);

  const [filters, setFilters] = useState({
    reports: true,
    panic: true,
    station: true,
  });

  const stationVisible =
    filters.station &&
    nearestStation &&
    Number.isFinite(Number(nearestStation.lat)) &&
    Number.isFinite(Number(nearestStation.lng));

  const requestScope = useMemo(() => {
    return {
      province: scopeProvince || null,
      city_municipality: scopeCityMunicipality || null,
    };
  }, [scopeProvince, scopeCityMunicipality]);

  const reportMarkers = useMemo(() => {
    return (myMarkers || []).filter((m) => m.marker_type === "my_report");
  }, [myMarkers]);

  const panicMarkers = useMemo(() => {
    return (myMarkers || []).filter((m) => m.marker_type === "my_panic");
  }, [myMarkers]);

  const visibleReportsCount = filters.reports ? reportMarkers.length : 0;
  const visiblePanicCount = filters.panic ? panicMarkers.length : 0;
  const visibleStationCount = filters.station ? allStations.length || (stationVisible ? 1 : 0) : 0;

  const initialRegion = useMemo(() => {
    if (userLoc) {
      return {
        latitude: userLoc.lat,
        longitude: userLoc.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
    }

    return {
      latitude: 8.061,
      longitude: 123.75,
      latitudeDelta: 0.35,
      longitudeDelta: 0.35,
    };
  }, [userLoc]);

  const openRouteToNearestStation = useCallback(() => {
    if (!nearestStation?.lat || !nearestStation?.lng) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${nearestStation.lat},${nearestStation.lng}&travelmode=driving`;
    Linking.openURL(url);
  }, [nearestStation]);

  const refreshLocation = useCallback(async () => {
    setLocLoading(true);
    try {
      const ok = await requestLocationPermission();
      if (!ok) {
        setUserLoc(null);
        return;
      }

      const l = await getCurrentLocation();
      setUserLoc({
        lat: l.lat,
        lng: l.lng,
        accuracy: l.accuracy,
      });
    } catch {
      setUserLoc(null);
    } finally {
      setLocLoading(false);
    }
  }, []);

  const fetchNearestStation = useCallback(async () => {
    if (!userLoc?.lat || !userLoc?.lng) {
      setNearestStation(null);
      setAllStations([]);
      return;
    }

    try {
      setNearestStationLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/get_nearest_station.php?lat=${encodeURIComponent(userLoc.lat)}&lng=${encodeURIComponent(userLoc.lng)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setNearestStation(null);
        setAllStations([]);
        return;
      }

      if (data.station) {
        setNearestStation({
          ...data.station,
          lat: parseFloat(data.station.lat),
          lng: parseFloat(data.station.lng),
        });
      } else {
        setNearestStation(null);
      }

      setAllStations(
        Array.isArray(data.stations)
          ? data.stations
              .map((s) => ({
                ...s,
                lat: Number(s.lat),
                lng: Number(s.lng),
              }))
              .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          : []
      );

      setScopeProvince((prev) => data?.scope?.province || prev || null);
      setScopeCityMunicipality((prev) => data?.scope?.city_municipality || prev || null);
    } catch {
      setNearestStation(null);
      setAllStations([]);
    } finally {
      setNearestStationLoading(false);
    }
  }, [userLoc]);

  const fetchMyMarkers = useCallback(async () => {
    if (!userLoc?.lat || !userLoc?.lng) {
      setMyMarkers([]);
      setScopeProvince(null);
      setScopeCityMunicipality(null);
      return;
    }

    try {
      const token = await AsyncStorage.getItem("auth_token");
      const headers = {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const qs = new URLSearchParams();
      qs.set("days", "30");
      qs.set("group", "0");
      qs.set("lat", String(userLoc.lat));
      qs.set("lng", String(userLoc.lng));

      if (requestScope.province) qs.set("province", requestScope.province);
      if (requestScope.city_municipality) {
        qs.set("city_municipality", requestScope.city_municipality);
      }

      const res = await fetch(`${API_BASE_URL}/incidents_points.php?${qs.toString()}`, {
        method: "GET",
        headers,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data?.message || "Failed to load map markers");
      }

      const cleanedMyMarkers = Array.isArray(data.my_markers)
        ? data.my_markers
            .map((m) => ({
              ...m,
              lat: typeof m.lat === "string" ? parseFloat(m.lat) : m.lat,
              lng: typeof m.lng === "string" ? parseFloat(m.lng) : m.lng,
            }))
            .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        : [];

      setMyMarkers(cleanedMyMarkers);

      const provinceFromScope = data?.scope?.province || requestScope.province || null;
      const cityFromScope =
        data?.scope?.city_municipality || requestScope.city_municipality || null;

      setScopeProvince(provinceFromScope);
      setScopeCityMunicipality(cityFromScope);
    } catch {
      setMyMarkers([]);
      setScopeProvince(null);
      setScopeCityMunicipality(null);
    }
  }, [userLoc, requestScope]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      await refreshLocation();
      setLoading(false);
    })();
  }, [refreshLocation]);

  useEffect(() => {
    if (!userLoc?.lat || !userLoc?.lng) return;

    setLoading(true);
    (async () => {
      await Promise.all([fetchNearestStation(), fetchMyMarkers()]);
      setLoading(false);
    })();
  }, [userLoc, fetchNearestStation, fetchMyMarkers]);

  const fitToVisible = useCallback(
    (refOverride = null, nextFilters = null) => {
      const ref = refOverride || mapRef;
      const activeFilters = nextFilters || filters;
      const pts = [];

      if (activeFilters.reports) {
        for (const m of reportMarkers) {
          pts.push({
            latitude: Number(m.lat),
            longitude: Number(m.lng),
          });
        }
      }

      if (activeFilters.panic) {
        for (const m of panicMarkers) {
          pts.push({
            latitude: Number(m.lat),
            longitude: Number(m.lng),
          });
        }
      }

      if (activeFilters.station) {
        const stationList = allStations.length ? allStations : nearestStation ? [nearestStation] : [];

        for (const s of stationList) {
          if (Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))) {
            pts.push({
              latitude: Number(s.lat),
              longitude: Number(s.lng),
            });
          }
        }
      }

      if (userLoc?.lat && userLoc?.lng) {
        pts.push({
          latitude: userLoc.lat,
          longitude: userLoc.lng,
        });
      }

      if (pts.length >= 2 && ref.current?.fitToCoordinates) {
        ref.current.fitToCoordinates(pts, {
          edgePadding: { top: 90, right: 70, bottom: 90, left: 70 },
          animated: true,
        });
        return;
      }

      if (pts.length === 1 && ref.current?.animateToRegion) {
        ref.current.animateToRegion(
          {
            latitude: pts[0].latitude,
            longitude: pts[0].longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          350
        );
      }
    },
    [filters, reportMarkers, panicMarkers, nearestStation, allStations, userLoc]
  );

  const toggleFilter = useCallback(
    (key) => {
      setFilters((prev) => {
        const next = {
          ...prev,
          [key]: !prev[key],
        };

        setTimeout(() => {
          if (key === "station" && !prev.station && nearestStation) {
            mapRef.current?.animateToRegion(
              {
                latitude: Number(nearestStation.lat),
                longitude: Number(nearestStation.lng),
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              },
              400
            );
          }

          fitToVisible(null, next);
        }, 220);

        return next;
      });
    },
    [fitToVisible, nearestStation]
  );

  const renderMyReportMarkers = () => {
    if (!filters.reports) return null;

    return reportMarkers.map((m) => (
      <Marker
        key={`report_${m.id}`}
        coordinate={{
          latitude: Number(m.lat),
          longitude: Number(m.lng),
        }}
        title="My Report"
        description={`${m.category || "Incident"} • ${m.verification_status || "PENDING"}`}
      >
        <View style={[styles.markerWrap, getReportMarkerStyle(m.verification_status)]}>
          <Icon name="description" size={18} color="#fff" />
        </View>
      </Marker>
    ));
  };

  const renderMyPanicMarkers = () => {
    if (!filters.panic) return null;

    return panicMarkers.map((m) => (
      <Marker
        key={`panic_${m.id}`}
        coordinate={{
          latitude: Number(m.lat),
          longitude: Number(m.lng),
        }}
        title="My Panic Request"
        description={`${m.level || "alert"} panic • ${m.status || "new"}`}
      >
        <View style={[styles.markerWrap, getPanicMarkerStyle(m.level)]}>
          <Icon name="priority-high" size={18} color="#fff" />
        </View>
      </Marker>
    ));
  };

  const renderAllStationMarkers = () => {
    if (!filters.station) return null;

    const stationList = allStations.length ? allStations : nearestStation ? [nearestStation] : [];

    return stationList.map((s) => {
      const isNearest = nearestStation && String(nearestStation.id) === String(s.id);

      return (
        <Marker
          key={`station_${s.id}`}
          coordinate={{
            latitude: Number(s.lat),
            longitude: Number(s.lng),
          }}
          title={s.station_name || "Police Station"}
          description={isNearest ? "Nearest police station" : s.station_type || "Police Station"}
        >
          <View style={[styles.stationMarkerWrap, isNearest && styles.nearestStationMarkerWrap]}>
            <Icon name="local-police" size={20} color="#fff" />
          </View>
        </Marker>
      );
    });
  };

  const MapCard = ({ height = 380, full = false }) => (
    <View style={[styles.mapCard, full ? styles.mapCardFull : { height }]}>
      <MapView
        ref={full ? fullMapRef : mapRef}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        zoomControlEnabled={true}
        rotateEnabled={false}
        onMapReady={() => {
          setTimeout(() => fitToVisible(full ? fullMapRef : mapRef), 250);
        }}
      >
        {renderMyReportMarkers()}
        {renderMyPanicMarkers()}
        {renderAllStationMarkers()}
      </MapView>

      <View style={styles.mapOverlayTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mapTitle}>My Activity Map</Text>
          <Text style={styles.mapSub}>
            Reports, panic requests, and police stations
          </Text>

          {!!scopeCityMunicipality || !!scopeProvince ? (
            <Text style={styles.scopeText}>
              Scope: {scopeCityMunicipality ? `${scopeCityMunicipality}, ` : ""}
              {scopeProvince || ""}
            </Text>
          ) : null}

          {!!nearestStation?.station_name ? (
            <Text style={styles.scopeText}>
              Nearest: {nearestStation.station_name}
              {nearestStation.distance_m != null ? ` • ${nearestStation.distance_m}m` : ""}
            </Text>
          ) : null}
        </View>

        <View style={[styles.statusChip, styles.safeChip]}>
          <Icon name="map" size={16} color={COLORS.blueDark} />
          <Text style={[styles.statusText, styles.safeText]}>
            {mapType === "satellite" ? "SAT" : "MAP"}
          </Text>
        </View>
      </View>

      <View style={styles.mapOverlayBottom}>
        <Pressable
          onPress={() => {
            const ref = full ? fullMapRef : mapRef;
            if (!userLoc?.lat || !userLoc?.lng) return;
            ref.current?.animateToRegion(
              {
                latitude: userLoc.lat,
                longitude: userLoc.lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              },
              400
            );
          }}
          style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.85 }]}
        >
          <Icon name="my-location" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={() => fitToVisible(full ? fullMapRef : mapRef)}
          style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.85 }]}
        >
          <Icon name="center-focus-strong" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={() => setMapType((m) => (m === "standard" ? "satellite" : "standard"))}
          style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.85 }]}
        >
          <Icon name="satellite" size={18} color="#fff" />
        </Pressable>

        {!full ? (
          <Pressable
            onPress={() => setExpanded(true)}
            style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.85 }]}
          >
            <Icon name="open-in-full" size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setExpanded(false)}
            style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.85 }]}
          >
            <Icon name="close-fullscreen" size={18} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.blueDark} />
        <Text style={styles.loadingText}>Loading map…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>My Activity Map</Text>
            <Text style={styles.headerSub}>
              View your submitted reports, panic requests, and police stations.
            </Text>

            {!!scopeCityMunicipality || !!scopeProvince ? (
              <Text style={styles.scopeText}>
                Current scope: {scopeCityMunicipality ? `${scopeCityMunicipality}, ` : ""}
                {scopeProvince || ""}
              </Text>
            ) : null}
          </View>

          <View style={[styles.statusChip, styles.safeChip]}>
            <Icon name="map" size={16} color={COLORS.blueDark} />
            <Text style={[styles.statusText, styles.safeText]}>
              {mapType === "satellite" ? "SAT" : "MAP"}
            </Text>
          </View>
        </View>

        <View style={styles.topActions}>
          <Pressable
            onPress={refreshLocation}
            style={({ pressed }) => [styles.topActionBtn, pressed && { opacity: 0.85 }]}
          >
            <Icon name="refresh" size={18} color="#fff" />
            <Text style={styles.topActionText}>
              {locLoading ? "Refreshing..." : "Refresh Location"}
            </Text>
          </Pressable>

          <Pressable
            onPress={openRouteToNearestStation}
            disabled={!nearestStation}
            style={({ pressed }) => [
              styles.topActionBtn,
              styles.routeBtn,
              !nearestStation && { opacity: 0.5 },
              pressed && nearestStation && { opacity: 0.85 },
            ]}
          >
            <Icon name="directions" size={18} color="#fff" />
            <Text style={styles.topActionText}>Route to Station</Text>
          </Pressable>
        </View>

        <MapCard height={390} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Map Filters</Text>
          <Text style={styles.sectionSub}>
            Toggle the items you want to show. The nearest station is highlighted in blue.
          </Text>

          <View style={styles.filterWrap}>
            <Pressable
              onPress={() => toggleFilter("reports")}
              style={[
                styles.filterChip,
                filters.reports && styles.filterChipActive,
              ]}
            >
              <Icon
                name="description"
                size={16}
                color={filters.reports ? "#fff" : COLORS.slateText}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filters.reports && styles.filterChipTextActive,
                ]}
              >
                My Reports
              </Text>
            </Pressable>

            <Pressable
              onPress={() => toggleFilter("panic")}
              style={[
                styles.filterChip,
                filters.panic && styles.filterChipActive,
              ]}
            >
              <Icon
                name="priority-high"
                size={16}
                color={filters.panic ? "#fff" : COLORS.slateText}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filters.panic && styles.filterChipTextActive,
                ]}
              >
                Panic Requests
              </Text>
            </Pressable>

            <Pressable
              onPress={() => toggleFilter("station")}
              style={[
                styles.filterChip,
                filters.station && styles.filterChipActive,
              ]}
            >
              <Icon
                name="local-police"
                size={16}
                color={filters.station ? "#fff" : COLORS.slateText}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filters.station && styles.filterChipTextActive,
                ]}
              >
                Police Stations
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>My Reports</Text>
            <Text style={styles.infoValue}>{visibleReportsCount}</Text>
            <Text style={styles.infoSub}>Visible report markers</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Panic Requests</Text>
            <Text style={styles.infoValue}>{visiblePanicCount}</Text>
            <Text style={styles.infoSub}>Visible panic markers</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Police Stations</Text>
            <Text style={styles.infoValue}>{visibleStationCount}</Text>
            <Text style={styles.infoSub}>Visible station markers</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>
              {nearestStationLoading
                ? "…"
                : nearestStation?.distance_m != null
                ? `${nearestStation.distance_m}m`
                : "—"}
            </Text>
            <Text style={styles.infoSub}>
              {nearestStation?.station_name || "No station found"}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Expanded Activity Map</Text>
            <Pressable onPress={() => setExpanded(false)} style={styles.closeBtn}>
              <Icon name="close" size={22} color={COLORS.text} />
            </Pressable>
          </View>

          <View style={{ flex: 1, padding: 12 }}>
            <MapCard full />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    padding: 14,
    paddingBottom: 24,
    gap: 14,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.subtext,
    fontWeight: "700",
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  headerSub: {
    marginTop: 4,
    color: COLORS.subtext,
    fontSize: 13,
    lineHeight: 18,
  },
  scopeText: {
    marginTop: 6,
    color: COLORS.blueDark,
    fontWeight: "700",
    fontSize: 12,
  },
  topActions: {
    marginTop: -2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  topActionBtn: {
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  routeBtn: {
    backgroundColor: COLORS.teal,
  },
  topActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  mapCard: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
  },
  mapCardFull: {
    flex: 1,
  },
  mapOverlayTop: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  mapOverlayBottom: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  mapTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.92)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mapSub: {
    marginTop: 8,
    color: COLORS.subtext,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.92)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ctrlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
  },
  markerWrap: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  stationMarkerWrap: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.teal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  nearestStationMarkerWrap: {
    backgroundColor: COLORS.blueDark,
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  panicMarkerUrgent: {
    backgroundColor: "#DC2626",
  },
  panicMarkerAlert: {
    backgroundColor: "#F97316",
  },
  myReportMarkerPending: {
    backgroundColor: "#2563EB",
  },
  myReportMarkerDuplicate: {
    backgroundColor: "#F97316",
  },
  myReportMarkerVerified: {
    backgroundColor: "#16A34A",
  },
  myReportMarkerFalse: {
    backgroundColor: "#DC2626",
  },
  statusChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  safeChip: {
    backgroundColor: COLORS.blueBg,
  },
  statusText: {
    fontWeight: "900",
    fontSize: 12,
  },
  safeText: {
    color: COLORS.blueText,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  sectionSub: {
    marginTop: 6,
    color: COLORS.subtext,
    fontSize: 12,
    lineHeight: 18,
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.slateBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: COLORS.blueDark,
  },
  filterChipText: {
    color: COLORS.slateText,
    fontWeight: "700",
    fontSize: 12,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  infoLabel: {
    color: COLORS.subtext,
    fontWeight: "700",
    fontSize: 12,
  },
  infoValue: {
    marginTop: 6,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 24,
  },
  infoSub: {
    marginTop: 4,
    color: COLORS.subtext,
    fontSize: 12,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    height: 58,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 999,
  },
});