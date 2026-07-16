import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import MapView, { Heatmap, PROVIDER_GOOGLE, Circle, Marker } from "react-native-maps";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const DEFAULT_CATEGORIES = ["All"];

const HEATMAP_GRADIENT = {
  colors: [
    "rgba(0,0,255,0)",
    "#0066FF",
    "#FF9900",
    "#FF4500",
    "#DC2626",
    "#7F1D1D",
  ],
  startPoints: [0.0, 0.2, 0.48, 0.68, 0.84, 1.0],
  colorMapSize: 256,
};

function normalizeRiskColor(value) {
  const v = String(value || "").trim().toLowerCase();

  if (v === "high" || v === "red" || v === "dark_red" || v === "dark red") return "red";
  if (v === "medium" || v === "orange") return "orange";
  if (v === "low" || v === "blue") return "blue";
  if (v === "green" || v === "safe") return "green";

  return "default";
}

function hotspotStrokeFill(value) {
  const v = normalizeRiskColor(value);

  if (v === "red") {
    return {
      strokeColor: "rgba(127,29,29,0.98)",
      fillColor: "rgba(127,29,29,0.20)",
    };
  }

  if (v === "orange") {
    return {
      strokeColor: "rgba(249,115,22,0.98)",
      fillColor: "rgba(249,115,22,0.18)",
    };
  }

  if (v === "blue") {
    return {
      strokeColor: "rgba(37,99,235,0.95)",
      fillColor: "rgba(37,99,235,0.14)",
    };
  }

  if (v === "green") {
    return {
      strokeColor: "rgba(22,163,74,0.95)",
      fillColor: "rgba(22,163,74,0.16)",
    };
  }

  return {
    strokeColor: "rgba(148,163,184,0.75)",
    fillColor: "rgba(148,163,184,0.10)",
  };
}

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

function isSameCoordinate(lat1, lng1, lat2, lng2, tolerance = 0.00005) {
  return (
    Math.abs(Number(lat1) - Number(lat2)) <= tolerance &&
    Math.abs(Number(lng1) - Number(lng2)) <= tolerance
  );
}

function computeDensityLevel(perKm2) {
  if (!Number.isFinite(perKm2)) return "LOW";
  if (perKm2 >= 40) return "HIGH";
  if (perKm2 >= 15) return "MEDIUM";
  return "LOW";
}

function computeDashboardLikeHotspotRisk(hotspot, heatPoints, pendingRows) {
  const hotspotLat = Number(hotspot.lat);
  const hotspotLng = Number(hotspot.lng);
  const radius = Math.max(50, Number(hotspot.radius_m || 150));

  if (!Number.isFinite(hotspotLat) || !Number.isFinite(hotspotLng)) {
    return hotspot;
  }

  let verifiedCount = 0;
  let panicCount = 0;

  heatPoints.forEach((p) => {
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const dist = distanceMeters(hotspotLat, hotspotLng, lat, lng);
    if (dist <= radius) verifiedCount += 1;
  });

  pendingRows.forEach((p) => {
    if (p.marker_type !== "panic") return;

    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const dist = distanceMeters(hotspotLat, hotspotLng, lat, lng);
    if (dist <= radius) panicCount += 1;
  });

  const totalPoints = verifiedCount + panicCount;
  const areaM2 = Math.PI * Math.pow(radius, 2);
  const densityValue = areaM2 > 0 ? totalPoints / areaM2 : 0;
  const densityPerKm2 = densityValue * 1000000;
  const densityLevel = computeDensityLevel(densityPerKm2);

  const backendColor = String(hotspot.highlight_color || "").toUpperCase();
  const backendRisk = String(hotspot.risk_level || "").toUpperCase();

  const mobileRisk =
    backendColor === "RED"
      ? "RED"
      : backendColor === "ORANGE"
      ? "ORANGE"
      : backendColor === "YELLOW"
      ? "ORANGE"
      : backendColor === "GREEN"
      ? "GREEN"
      : backendRisk === "HIGH"
      ? "RED"
      : backendRisk === "MEDIUM"
      ? "ORANGE"
      : backendRisk === "LOW"
      ? "GREEN"
      : densityLevel === "HIGH"
      ? "RED"
      : densityLevel === "MEDIUM"
      ? "ORANGE"
      : "GREEN";

  return {
    ...hotspot,
    verifiedCount,
    panicCount,
    totalPoints,
    area_m2: areaM2,
    density_value: densityValue,
    density_per_km2: densityPerKm2,
    density_level: densityLevel,
    mobileRisk,
    highlight_color: mobileRisk.toLowerCase(),
  };
}

export default function HeatmapMap({
  height = 320,
  initialRegion,
  userLocation,
  nearestStation = null,
  showNearestStation = true,
  onExpandChange,
  category,
  showCategoryFilter = true,
  categories = DEFAULT_CATEGORIES,
  days = 30,
  useBbox = false,
  riskRadiusMeters = 250,
  onDataChange,
  showLegend = false,
}) {
  const mapRef = useRef(null);
  const mapRefFull = useRef(null);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  const [pendingMarkers, setPendingMarkers] = useState([]);
  const [myMarkers, setMyMarkers] = useState([]);
  const [assignedMarkers, setAssignedMarkers] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [mapType, setMapType] = useState("standard");
  const [allStations, setAllStations] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [scopeProvince, setScopeProvince] = useState(null);
  const [scopeCityMunicipality, setScopeCityMunicipality] = useState(null);

  const [localCategory, setLocalCategory] = useState("All");
  const activeCategory = category ?? localCategory;

  const region = useMemo(() => {
    if (initialRegion) return initialRegion;
    const lat = userLocation?.lat ?? 8.14;
    const lng = userLocation?.lng ?? 123.84;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [initialRegion, userLocation]);

  const requestScope = useMemo(() => {
    return {
      province: scopeProvince || null,
      city_municipality: scopeCityMunicipality || null,
    };
  }, [scopeProvince, scopeCityMunicipality]);

  const computeAndReportStats = useCallback(
    (heatPts, hotspotRows, province, cityMunicipality) => {
      const count = Array.isArray(heatPts) ? heatPts.length : 0;

      let nearestMeters = null;
      let hotspotColor = "none";
      let hotspotName = null;
      let isRisk = false;

      if (userLocation?.lat && userLocation?.lng && Array.isArray(hotspotRows) && hotspotRows.length) {
        let nearest = null;

        for (const h of hotspotRows) {
          const hLat = Number(h.lat);
          const hLng = Number(h.lng);
          if (!Number.isFinite(hLat) || !Number.isFinite(hLng)) continue;

          const d = distanceMeters(userLocation.lat, userLocation.lng, hLat, hLng);
          if (nearest == null || d < nearest) {
            nearest = d;
            nearestMeters = Math.round(d);
            hotspotColor = h.highlight_color || h.risk_level || h.mobileRisk || "none";
            hotspotName = h.name || null;

            const radius = Number.isFinite(Number(h.radius_m))
              ? Number(h.radius_m || riskRadiusMeters)
              : riskRadiusMeters;

            isRisk = d <= radius;
          }
        }
      }

      onDataChange?.({
        count,
        nearestMeters,
        isRisk,
        hotspotColor,
        hotspotName,
        province: province || null,
        cityMunicipality: cityMunicipality || null,
      });
    },
    [onDataChange, riskRadiusMeters, userLocation]
  );

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("auth_token");

      const headers = {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      /*
        HEATMAP:
        - last 30 days only
      */
      const pointsQs = new URLSearchParams();

      /*
        HOTSPOTS:
        - last 365 days
        - same behavior as Station Admin dashboard
      */
      const hotspotQs = new URLSearchParams();

      const heatmapDays = 30;
      const hotspotDays = 365;

      pointsQs.set("days", String(heatmapDays));
      hotspotQs.set("days", String(hotspotDays));

      if (activeCategory && activeCategory !== "All") {
        pointsQs.set("category", activeCategory);
      }

      if (userLocation?.lat && userLocation?.lng) {
        pointsQs.set("lat", String(userLocation.lat));
        pointsQs.set("lng", String(userLocation.lng));

        hotspotQs.set("lat", String(userLocation.lat));
        hotspotQs.set("lng", String(userLocation.lng));
      }

      if (requestScope.province) {
        pointsQs.set("province", requestScope.province);
        hotspotQs.set("province", requestScope.province);
      }

      if (requestScope.city_municipality) {
        pointsQs.set("city_municipality", requestScope.city_municipality);
        hotspotQs.set("city_municipality", requestScope.city_municipality);
      }

      if (useBbox && mapRegion) {
        const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;

        const minLat = latitude - latitudeDelta / 2;
        const maxLat = latitude + latitudeDelta / 2;
        const minLng = longitude - longitudeDelta / 2;
        const maxLng = longitude + longitudeDelta / 2;

        pointsQs.set("minLat", String(minLat));
        pointsQs.set("maxLat", String(maxLat));
        pointsQs.set("minLng", String(minLng));
        pointsQs.set("maxLng", String(maxLng));
      }

      pointsQs.set("group", "0");

      const [pointsRes, hotspotRes] = await Promise.all([
        fetch(`${API_BASE_URL}/incidents_points.php?${pointsQs.toString()}`, {
          method: "GET",
          headers,
        }),

        fetch(`${API_BASE_URL}/hotspots.php?${hotspotQs.toString()}`, {
          method: "GET",
          headers,
        }),
      ]);

      const pointsData = await pointsRes.json().catch(() => ({}));
      const hotspotPack = await hotspotRes.json().catch(() => ({}));

      const rawPoints =
        !pointsRes.ok || !pointsData.ok
          ? []
          : Array.isArray(pointsData.data)
          ? pointsData.data
          : [];

      const cleanedPendingMarkers =
        !pointsRes.ok || !pointsData.ok || !Array.isArray(pointsData.pending_markers)
          ? []
          : pointsData.pending_markers
              .map((m) => ({
                ...m,
                lat: typeof m.lat === "string" ? parseFloat(m.lat) : m.lat,
                lng: typeof m.lng === "string" ? parseFloat(m.lng) : m.lng,
              }))
              .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

      const cleanedMyMarkers =
        !pointsRes.ok || !pointsData.ok || !Array.isArray(pointsData.my_markers)
          ? []
          : pointsData.my_markers
              .map((m) => ({
                ...m,
                lat: typeof m.lat === "string" ? parseFloat(m.lat) : m.lat,
                lng: typeof m.lng === "string" ? parseFloat(m.lng) : m.lng,
              }))
              .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

      const cleanedAssignedMarkers =
        !pointsRes.ok || !pointsData.ok || !Array.isArray(pointsData.assigned_markers)
          ? []
          : pointsData.assigned_markers
              .map((m) => ({
                ...m,
                lat: typeof m.lat === "string" ? parseFloat(m.lat) : m.lat,
                lng: typeof m.lng === "string" ? parseFloat(m.lng) : m.lng,
              }))
              .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

      const verifiedMyReports = cleanedMyMarkers.filter(
        (m) =>
          m.marker_type === "my_report" &&
          String(m.verification_status || "").toUpperCase() === "VERIFIED"
      );

      /*
        HEATMAP POINTS
        - 30 DAYS ONLY
      */
      const cleanedPoints = rawPoints
        .map((p, index) => ({
          id: p.id ?? p.incident_id ?? `pt_${index}`,
          latitude: typeof p.lat === "string" ? parseFloat(p.lat) : p.lat,
          longitude: typeof p.lng === "string" ? parseFloat(p.lng) : p.lng,
          weight: clamp(Number(p.weight ?? p.severity_score ?? 1), 1, 10),
          category: p.category || "Other",
          source: p.source || "incident_report",
        }))
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .filter((p) => {
          const matchedVerifiedOwnReport = verifiedMyReports.some((m) => {
            const sameId =
              m.id != null &&
              p.id != null &&
              String(m.id) === String(p.id);

            const sameLocation = isSameCoordinate(
              m.lat,
              m.lng,
              p.latitude,
              p.longitude
            );

            return sameId || sameLocation;
          });

          return !matchedVerifiedOwnReport;
        });

      /*
        HOTSPOTS
        - 365 DAYS
        - SAME COLORS AS STATION ADMIN
      */
      const cleanedHotspots =
        !hotspotRes.ok || !hotspotPack.ok || !Array.isArray(hotspotPack.hotspots)
          ? []
          : hotspotPack.hotspots
              .map((h) => ({
                ...h,
                lat: typeof h.lat === "string" ? parseFloat(h.lat) : h.lat,
                lng: typeof h.lng === "string" ? parseFloat(h.lng) : h.lng,

                /*
                  IMPORTANT:
                  preserve backend color exactly
                */
                highlight_color:
                  h.highlight_color ||
                  h.risk_level ||
                  h.mobileRisk ||
                  "green",

                radius_m:
                  h.radius_m == null
                    ? null
                    : typeof h.radius_m === "string"
                    ? parseInt(h.radius_m, 10)
                    : h.radius_m,
              }))
              .filter(
                (h) =>
                  Number.isFinite(Number(h.lat)) &&
                  Number.isFinite(Number(h.lng))
              );

      const provinceFromScope =
        pointsData?.scope?.province ||
        hotspotPack?.scope?.province ||
        null;

      const cityFromScope =
        pointsData?.scope?.city_municipality ||
        hotspotPack?.scope?.city_municipality ||
        null;

      setScopeProvince(provinceFromScope);
      setScopeCityMunicipality(cityFromScope);

      setPoints(cleanedPoints);

      setPendingMarkers(cleanedPendingMarkers);

      setMyMarkers(cleanedMyMarkers);

      setAssignedMarkers(cleanedAssignedMarkers);

      const dashboardLikeHotspots = cleanedHotspots.map((h) =>
        computeDashboardLikeHotspotRisk(h, cleanedPoints, cleanedPendingMarkers)
      );

      setHotspots(dashboardLikeHotspots);

      computeAndReportStats(
        cleanedPoints,
        dashboardLikeHotspots,
        provinceFromScope,
        cityFromScope
      );

    } catch (err) {
      console.log("Heatmap fetch error", err);

      setPoints([]);
      setPendingMarkers([]);
      setMyMarkers([]);
      setAssignedMarkers([]);
      setHotspots([]);
    } finally {
      setLoading(false);
    }
  }, [
    activeCategory,
    computeAndReportStats,
    mapRegion,
    requestScope.city_municipality,
    requestScope.province,
    useBbox,
    userLocation,
  ]);

  const fetchStations = useCallback(async () => {
    try {
      if (!userLocation?.lat || !userLocation?.lng) {
        setAllStations([]);
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/get_nearest_station.php?lat=${encodeURIComponent(userLocation.lat)}&lng=${encodeURIComponent(userLocation.lng)}`
      );

      const data = await res.json().catch(() => ({}));

      setAllStations(
        Array.isArray(data?.stations)
          ? data.stations
              .map((s) => ({
                ...s,
                lat: Number(s.lat),
                lng: Number(s.lng),
              }))
              .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          : []
      );
    } catch (e) {
      console.log("station load", e?.message || e);
      setAllStations([]);
    }
  }, [userLocation]);

  useEffect(() => {
    fetchAll();
    fetchStations();
  }, [
    fetchAll,
    fetchStations,
    days,
    activeCategory,
    userLocation?.lat,
    userLocation?.lng,
    requestScope.province,
    requestScope.city_municipality,
    useBbox,
  ]);

  const centerToUser = async (ref) => {
    if (!userLocation?.lat || !userLocation?.lng) return;

    ref?.current?.animateToRegion(
      {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400
    );
  };

  const fitToContent = async (ref) => {
    const coords = [];

    if (userLocation?.lat && userLocation?.lng) {
      coords.push({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });
    }

    allStations.forEach((s) => {
      coords.push({
        latitude: Number(s.lat),
        longitude: Number(s.lng),
      });
    });

    points.forEach((p) => {
      coords.push({
        latitude: p.latitude,
        longitude: p.longitude,
      });
    });

    hotspots.forEach((h) => {
      coords.push({
        latitude: Number(h.lat),
        longitude: Number(h.lng),
      });
    });

    pendingMarkers.forEach((m) => {
      coords.push({
        latitude: m.lat,
        longitude: m.lng,
      });
    });

    myMarkers.forEach((m) => {
      coords.push({
        latitude: m.lat,
        longitude: m.lng,
      });
    });

    assignedMarkers.forEach((m) => {
      coords.push({
        latitude: m.lat,
        longitude: m.lng,
      });
    });

    if (coords.length >= 2 && ref?.current?.fitToCoordinates) {
      ref.current.fitToCoordinates(coords, {
        edgePadding: {
          top: 90,
          right: 70,
          bottom: 90,
          left: 70,
        },
        animated: true,
      });
    }
  };

  const routeToStation = () => {
    if (!nearestStation?.lat) return;

    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${nearestStation.lat},${nearestStation.lng}&travelmode=driving`
    );
  };

  const openFull = () => {
    setExpanded(true);
    onExpandChange?.(true);

    setTimeout(() => {
      if (mapRefFull.current) {
        fitToContent(mapRefFull);
      }
    }, 100);
  };

  const closeFull = () => {
    setExpanded(false);
    onExpandChange?.(false);
  };

  const hotspotCircles = (hotspots || []).map((h) => {
    const colorPack = hotspotStrokeFill(
      h.highlight_color ||
        h.mobileRisk ||
        h.risk_level ||
        h.density_level
    );

    return (
      <Circle
        key={`hotspot_${h.id}`}
        center={{
          latitude: Number(h.lat),
          longitude: Number(h.lng),
        }}
        radius={Number(h.radius_m || riskRadiusMeters)}
        strokeWidth={2}
        strokeColor={colorPack.strokeColor}
        fillColor={colorPack.fillColor}
      />
    );
  });

  const renderPendingMarkers = () =>
    pendingMarkers.map((m) => {
      const isPanic = m.marker_type === "panic";
      const bubbleStyle = isPanic
        ? getPanicMarkerStyle(m.level)
        : styles.pendingMarkerReport;

      return (
        <Marker
          key={`pending_${m.source || "item"}_${m.id}`}
          coordinate={{
            latitude: m.lat,
            longitude: m.lng,
          }}
          title={isPanic ? "Pending Panic Request" : "Pending Incident Report"}
          description={m.category || m.level || "Pending"}
        >
          <View style={[styles.pendingMarkerWrap, bubbleStyle]}>
            <Icon
              name={isPanic ? "priority-high" : "description"}
              size={18}
              color="#fff"
            />
          </View>
        </Marker>
      );
    });

  const renderMyMarkers = () =>
    myMarkers.map((m) => {
      const isPanic = m.marker_type === "my_panic";

      const bubbleStyle = isPanic
        ? getPanicMarkerStyle(m.level)
        : getReportMarkerStyle(m.verification_status);

      return (
        <Marker
          key={`mine_${m.source || "item"}_${m.id}`}
          coordinate={{
            latitude: m.lat,
            longitude: m.lng,
          }}
          title={isPanic ? "My Panic Request" : "My Incident Report"}
          description={m.category || m.status || m.verification_status || "My report"}
        >
          <View style={[styles.pendingMarkerWrap, bubbleStyle]}>
            <Icon
              name={isPanic ? "priority-high" : "description"}
              size={18}
              color="#fff"
            />
          </View>
        </Marker>
      );
    });

  const renderAssignedMarkers = () =>
    assignedMarkers.map((m) => {
      const isPanic = m.marker_type === "assigned_panic";
      const assigned =
        String(m.authorization_status || "").toLowerCase() === "go_signal_sent" ||
        String(m.authorization_status || "").toLowerCase() === "approved_to_proceed";

      return (
        <Marker
          key={`assigned_${m.assignment_id || m.id}`}
          coordinate={{
            latitude: m.lat,
            longitude: m.lng,
          }}
          title={m.title || (isPanic ? "Assigned Panic Request" : "Assigned Incident")}
          description={
            `${assigned ? "Assigned" : "Detected"} • ${
              m.barangay || "No barangay"
            }, ${m.city_municipality || "No city"}`
          }
        >
          <View
            style={[
              styles.assignedMarkerWrap,
              isPanic ? styles.assignedMarkerPanic : styles.assignedMarkerIncident,
              !assigned && styles.assignedMarkerDetected,
            ]}
          >
            <Icon
              name={isPanic ? "warning" : "assignment-turned-in"}
              size={19}
              color="#fff"
            />
          </View>
        </Marker>
      );
    });

  const renderAllStations = allStations.map((s) => {
    const isNearest =
      String(nearestStation?.id || "") ===
      String(s.id);

    return (
      <Marker
        key={`station_${s.id}`}
        coordinate={{
          latitude: Number(s.lat),
          longitude: Number(s.lng),
        }}
        title={s.station_name}
      >
        <View
          style={[
            styles.stationMarkerWrap,
            isNearest && {
              backgroundColor: "#0B2A6F",
              width: 42,
              height: 42,
              borderRadius: 21,
            },
          ]}
        >
          <Icon name="local-police" size={20} color="#fff" />
        </View>
      </Marker>
    );
  });

  const categoryChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryRow}
    >
      {categories.map((item) => {
        const active = item === activeCategory;

        return (
          <Pressable
            key={item}
            onPress={() => setLocalCategory(item)}
            style={[
              styles.categoryChip,
              active && styles.categoryChipActive,
            ]}
          >
            <Text
              style={[
                styles.categoryChipText,
                active && styles.categoryChipTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const MapBody = ({ full = false }) => (
    <View
      style={[
        styles.mapCard,
        full ? styles.mapCardFull : { height },
      ]}
    >
      {showCategoryFilter ? categoryChips : null}

      <MapView
        ref={full ? mapRefFull : mapRef}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onRegionChangeComplete={(r) => {
          if (useBbox) setMapRegion(r);
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {points.length > 0 && (
          <Heatmap
            points={points}
            radius={42}
            opacity={0.95}
            maxIntensity={10}
            gradient={HEATMAP_GRADIENT}
          />
        )}

        {hotspotCircles}
        {renderAllStations}
        {renderPendingMarkers()}
        {renderMyMarkers()}
        {renderAssignedMarkers()}
      </MapView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#0B2A6F" />
          <Text style={styles.loadingText}>Loading map data...</Text>
        </View>
      ) : null}

      {showLegend ? (
        <View style={styles.legendBox}>
          <Text style={styles.legendTitle}>Map Legend</Text>
          <Text style={styles.legendText}>Blue: Pending Report</Text>
          <Text style={styles.legendText}>Orange/Red: Panic</Text>
          <Text style={styles.legendText}>Purple: Assigned Incident</Text>
          <Text style={styles.legendText}>Dark Red: Assigned Panic</Text>
        </View>
      ) : null}

      <View style={styles.ctrlWrap}>
        <Pressable
          onPress={() => centerToUser(full ? mapRefFull : mapRef)}
          style={styles.ctrlBtn}
        >
          <Icon name="my-location" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={() => fitToContent(full ? mapRefFull : mapRef)}
          style={styles.ctrlBtn}
        >
          <Icon name="center-focus-strong" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={() =>
            setMapType((m) =>
              m === "standard"
                ? "satellite"
                : "standard"
            )
          }
          style={styles.ctrlBtn}
        >
          <Icon name="satellite" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={routeToStation}
          style={[
            styles.ctrlBtn,
            { backgroundColor: "#0F766E" },
          ]}
        >
          <Icon name="directions" size={18} color="#fff" />
        </Pressable>

        {!full ? (
          <Pressable onPress={openFull} style={styles.ctrlBtn}>
            <Icon name="open-in-full" size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable onPress={closeFull} style={styles.ctrlBtn}>
            <Icon name="close-fullscreen" size={18} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <>
      <MapBody />

      <Modal
        visible={expanded}
        animationType="slide"
        onRequestClose={closeFull}
      >
        <View style={styles.fullWrap}>
          <View style={styles.fullHeader}>
            <Text style={styles.fullTitle}>Map View</Text>

            <Pressable onPress={closeFull} style={styles.closeBtn}>
              <Icon name="close" size={22} color="#0F172A" />
            </Pressable>
          </View>

          <MapBody full />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
    position: "relative",
  },
  mapCardFull: {
    flex: 1,
    borderRadius: 0,
  },
  ctrlWrap: {
    position: "absolute",
    right: 12,
    bottom: 12,
    gap: 10,
  },
  ctrlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0B2A6F",
    alignItems: "center",
    justifyContent: "center",
  },
  stationMarkerWrap: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pendingMarkerWrap: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  assignedMarkerWrap: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  assignedMarkerIncident: {
    backgroundColor: "#7C3AED",
  },
  assignedMarkerPanic: {
    backgroundColor: "#7F1D1D",
  },
  assignedMarkerDetected: {
    backgroundColor: "#64748B",
  },
  panicMarkerUrgent: {
    backgroundColor: "#DC2626",
  },
  panicMarkerAlert: {
    backgroundColor: "#F97316",
  },
  pendingMarkerReport: {
    backgroundColor: "#2563EB",
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
  categoryRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 64,
    zIndex: 5,
  },
  categoryChip: {
    backgroundColor: "rgba(255,255,255,.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: "#0B2A6F",
  },
  categoryChipText: {
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  loadingBox: {
    position: "absolute",
    left: 12,
    top: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadingText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
  },
  legendBox: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 180,
  },
  legendTitle: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 2,
  },
  legendText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "700",
  },
  fullWrap: {
    flex: 1,
    backgroundColor: "#fff",
  },
  fullHeader: {
    height: 58,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 6,
  },
});