import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  PermissionsAndroid,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import MapView, { Marker } from "react-native-maps";

import { API_BASE_URL } from "../config/api";
import { authFetch } from "../utils/auth";
import { requestLocationPermission, getCurrentLocation } from "../utils/location";

const MAX_PHOTOS = 5;

async function ensureCameraPermission() {
  if (Platform.OS !== "android") return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: "Camera Permission",
      message: "Allow eBantay to use your camera to capture incident evidence.",
      buttonPositive: "Allow",
      buttonNegative: "Cancel",
    }
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function ensureGalleryPermission() {
  if (Platform.OS !== "android") return true;

  const androidVersion = Number(Platform.Version);
  const perm =
    androidVersion >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const granted = await PermissionsAndroid.request(perm, {
    title: "Photos Permission",
    message: "Allow eBantay to access your photos to attach evidence.",
    buttonPositive: "Allow",
    buttonNegative: "Cancel",
  });

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function getAccountBlockedMessage(status, backendMessage) {
  const s = String(status || "").toLowerCase();

  if (backendMessage) return backendMessage;

  if (s === "pending") {
    return "Your account is pending verification. Please wait for the station administrator to review your account.";
  }
  if (s === "incomplete") {
    return "Please complete your account profile and upload all required documents before using this feature.";
  }
  if (s === "resubmission_required") {
    return "Your account requires resubmission. Please review the remarks in your Account screen and upload the required documents again.";
  }
  if (s === "rejected") {
    return "Your account verification was rejected. Please check the remarks in your Account screen or contact the station administrator.";
  }
  if (s === "disabled") {
    return "Your account is currently disabled. Please contact the administrator.";
  }

  return "Your account is not yet activated. Please complete account setup or contact the administrator.";
}

export default function ReportScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [incidentTypes, setIncidentTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [incidentTypeSearch, setIncidentTypeSearch] = useState("");

  const [selectedType, setSelectedType] = useState(null);
  const [otherIncidentType, setOtherIncidentType] = useState("");
  const [narrative, setNarrative] = useState("");

  const [placeOfIncident, setPlaceOfIncident] = useState("");
  const [sitio, setSitio] = useState("");
  const [barangay, setBarangay] = useState("");
  const [cityMunicipality, setCityMunicipality] = useState("");
  const [province, setProvince] = useState("");
  const [region, setRegion] = useState("");

  const [placeTouched, setPlaceTouched] = useState(false);
  const [barangayTouched, setBarangayTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [provinceTouched, setProvinceTouched] = useState(false);
  const [regionTouched, setRegionTouched] = useState(false);

  const [dateIncidentFrom, setDateIncidentFrom] = useState("");
  const [dateIncidentTo, setDateIncidentTo] = useState("");

  const [photos, setPhotos] = useState([]);
  const [loc, setLoc] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);

  const [locationMode, setLocationMode] = useState("current");
  const [mapVisible, setMapVisible] = useState(false);
  const [pinDraft, setPinDraft] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const didInitRef = useRef(false);

  const selectedIsOther = selectedType?.id === "other";

  const filteredIncidentTypes = useMemo(() => {
    const q = incidentTypeSearch.trim().toLowerCase();
    if (!q) return incidentTypes;

    return incidentTypes.filter((item) => {
      const crimeName = String(item.crime_name || "").toLowerCase();
      const crimeCategory = String(item.crime_category || "").toLowerCase();
      const focusCode = String(item.focus_crime_code || "").toLowerCase();
      const cirasCode = String(item.ciras_offense_code || "").toLowerCase();

      return (
        crimeName.includes(q) ||
        crimeCategory.includes(q) ||
        focusCode.includes(q) ||
        cirasCode.includes(q)
      );
    });
  }, [incidentTypes, incidentTypeSearch]);

  const canSubmit = useMemo(() => {
    const typeOk = selectedIsOther
      ? otherIncidentType.trim().length >= 3
      : !!selectedType?.id;

    return (
      title.trim().length >= 3 &&
      typeOk &&
      narrative.trim().length >= 10 &&
      barangay.trim().length >= 2 &&
      cityMunicipality.trim().length >= 2 &&
      province.trim().length >= 2 &&
      !!loc &&
      !submitting
    );
  }, [
    title,
    selectedIsOther,
    otherIncidentType,
    selectedType,
    narrative,
    barangay,
    cityMunicipality,
    province,
    loc,
    submitting,
  ]);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      await fetchCrimeTypes();
      await useCurrentLocation();
    })();
  }, []);

  const fetchCrimeTypes = async () => {
    try {
      setTypesLoading(true);

      const res = await fetch(`${API_BASE_URL}/crime_types.php`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok || !Array.isArray(data.crime_types)) {
        throw new Error(data?.message || "Unable to load incident types.");
      }

      const cleaned = data.crime_types.map((item) => ({
        id: item.id,
        crime_name: item.crime_name,
        crime_category: item.crime_category || "OTHER",
        focus_crime_code: item.focus_crime_code || null,
        ciras_offense_code: item.ciras_offense_code || null,
      }));

      const withOther = [
        ...cleaned,
        {
          id: "other",
          crime_name: "Other",
          crime_category: "OTHER",
          focus_crime_code: null,
          ciras_offense_code: null,
        },
      ];

      setIncidentTypes(withOther);
    } catch (e) {
      console.log("CRIME TYPES LOAD FAILED:", e);
      setIncidentTypes([
        {
          id: "other",
          crime_name: "Other",
          crime_category: "OTHER",
          focus_crime_code: null,
          ciras_offense_code: null,
        },
      ]);
    } finally {
      setTypesLoading(false);
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      setReverseLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/reverse_geocode.php?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.address) return;

      const a = data.address || {};

      const resolvedPlace =
        a.place_of_incident ||
        a.place ||
        a.landmark ||
        a.road ||
        "";

      const resolvedBarangay =
        a.barangay ||
        a.village ||
        a.suburb ||
        a.neighbourhood ||
        "";

      const resolvedCityMunicipality =
        a.city_municipality ||
        a.city ||
        a.municipality ||
        a.town ||
        "";

      const resolvedProvince =
        a.province ||
        a.state ||
        a.county ||
        "";

      const resolvedRegion =
        a.region ||
        a.state_district ||
        "";

      if (!placeTouched) setPlaceOfIncident(resolvedPlace);
      if (!barangayTouched) setBarangay(resolvedBarangay);
      if (!cityTouched) setCityMunicipality(resolvedCityMunicipality);
      if (!provinceTouched) setProvince(resolvedProvince);
      if (!regionTouched) setRegion(resolvedRegion);
    } catch (e) {
      console.log("REVERSE GEOCODE FAILED:", e);
    } finally {
      setReverseLoading(false);
    }
  };

  const useCurrentLocation = async () => {
    try {
      setLocationMode("current");
      setLocLoading(true);

      const ok = await requestLocationPermission();
      if (!ok) {
        Alert.alert(
          "Location Permission Required",
          "Please enable location permission to use current location."
        );
        setLoc(null);
        return;
      }

      const l = await getCurrentLocation();
      const nextLoc = { lat: l.lat, lng: l.lng, accuracy: l.accuracy };
      setLoc(nextLoc);
      setPinDraft(nextLoc);
      await reverseGeocode(nextLoc.lat, nextLoc.lng);
    } catch (e) {
      setLoc(null);
      Alert.alert("Location Error", "Unable to get your current location.");
    } finally {
      setLocLoading(false);
    }
  };

  const openPinPoint = async () => {
    try {
      const ok = await requestLocationPermission();
      if (!ok) {
        Alert.alert(
          "Location Permission Required",
          "Please enable location permission to open the map."
        );
        return;
      }

      let base = loc;
      if (!base) {
        const l = await getCurrentLocation();
        base = { lat: l.lat, lng: l.lng, accuracy: l.accuracy };
      }

      setLocationMode("pin");
      setPinDraft({
        lat: base.lat,
        lng: base.lng,
        accuracy: base.accuracy ?? null,
      });
      setMapVisible(true);
    } catch (e) {
      Alert.alert("Map Error", "Unable to open pin-point location.");
    }
  };

  const confirmPinnedLocation = async () => {
    if (!pinDraft) return;

    setMapVisible(false);
    setLoc({
      lat: pinDraft.lat,
      lng: pinDraft.lng,
      accuracy: pinDraft.accuracy ?? null,
    });
    await reverseGeocode(pinDraft.lat, pinDraft.lng);
  };

  const pickFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Photo limit", `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const ok = await ensureGalleryPermission();
    if (!ok) {
      Alert.alert("Permission denied", "Photos permission is required to choose images.");
      return;
    }

    const res = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: MAX_PHOTOS - photos.length,
      includeBase64: false,
      quality: 0.85,
    });

    if (res.didCancel) return;
    if (res.errorCode) {
      Alert.alert("Gallery Error", res.errorMessage || "Unable to open gallery.");
      return;
    }

    const picked = (res.assets || []).map((a) => ({
      uri: a.uri,
      type: a.type || "image/jpeg",
      fileName: a.fileName || `photo_${Date.now()}.jpg`,
    }));

    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Photo limit", `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const ok = await ensureCameraPermission();
    if (!ok) {
      Alert.alert("Permission denied", "Camera permission is required to take a photo.");
      return;
    }

    const res = await launchCamera({
      mediaType: "photo",
      cameraType: "back",
      includeBase64: false,
      quality: 0.85,
      saveToPhotos: true,
    });

    if (res.didCancel) return;
    if (res.errorCode) {
      Alert.alert("Camera Error", res.errorMessage || "Unable to open camera.");
      return;
    }

    const a = res.assets?.[0];
    if (!a?.uri) return;

    const shot = {
      uri: a.uri,
      type: a.type || "image/jpeg",
      fileName: a.fileName || `camera_${Date.now()}.jpg`,
    };

    setPhotos((prev) => [...prev, shot].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const openPhotoMenu = () => {
    Alert.alert("Add Photo", "Choose a source:", [
      { text: "Camera", onPress: takePhoto },
      { text: "Gallery", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const resetForm = () => {
    setTitle("");
    setSelectedType(null);
    setIncidentTypeSearch("");
    setOtherIncidentType("");
    setNarrative("");
    setPlaceOfIncident("");
    setSitio("");
    setBarangay("");
    setCityMunicipality("");
    setProvince("");
    setRegion("");
    setDateIncidentFrom("");
    setDateIncidentTo("");
    setPhotos([]);

    setPlaceTouched(false);
    setBarangayTouched(false);
    setCityTouched(false);
    setProvinceTouched(false);
    setRegionTouched(false);
  };

  const handleBlockedAccount = (data = {}) => {
    const msg = getAccountBlockedMessage(data?.account_status, data?.message);

    Alert.alert(
      "Account Verification Required",
      msg,
      [
        {
          text: "Go to My Account",
          onPress: () => navigation.navigate("Account"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const submitReport = async () => {
    if (!canSubmit) return;

    try {
      setSubmitting(true);

      const currentLoc = loc;
      if (!currentLoc) {
        throw new Error("Location is required.");
      }

      if (!selectedType) {
        throw new Error("Incident type is required.");
      }

      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        Alert.alert("Session expired", "Please log in again.");
        navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
        return;
      }

      const form = new FormData();
      form.append("token", token);
      form.append("title", title.trim());
      form.append("narrative", narrative.trim());

      form.append("place_of_incident", placeOfIncident.trim());
      form.append("sitio", sitio.trim());
      form.append("barangay", barangay.trim());
      form.append("city_municipality", cityMunicipality.trim());
      form.append("province", province.trim());
      form.append("region", region.trim());

      form.append("lat", String(currentLoc.lat));
      form.append("lng", String(currentLoc.lng));
      if (currentLoc.accuracy != null) {
        form.append("accuracy", String(currentLoc.accuracy));
      }

      if (dateIncidentFrom.trim()) {
        form.append("date_incident_from", dateIncidentFrom.trim());
      }
      if (dateIncidentTo.trim()) {
        form.append("date_incident_to", dateIncidentTo.trim());
      }

      form.append("device_time", new Date().toISOString());

      if (selectedIsOther) {
        form.append("incident_type", otherIncidentType.trim());
      } else if (selectedType?.id) {
        form.append("crime_type_id", String(selectedType.id));
      }

      photos.forEach((p, i) => {
        form.append("photos[]", {
          uri: p.uri,
          type: p.type || "image/jpeg",
          name: p.fileName || `photo_${i}.jpg`,
        });
      });

      const endpoint = `${API_BASE_URL}/report_incident.php`;

      const res = await authFetch(navigation, endpoint, {
        method: "POST",
        body: form,
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        console.log("NON-JSON RESPONSE:", text);
        throw new Error("Server returned invalid response.");
      }

      if (res.status === 403 && data?.account_status) {
        handleBlockedAccount(data);
        return;
      }

      if (!res.ok || !data.ok) {
        console.log("SERVER ERROR:", text);
        throw new Error(data?.message || "Failed to submit report.");
      }

      Alert.alert(
        "Report Sent",
        `Incident submitted successfully.\n\nCode: ${data.incident_code || "N/A"}`,
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (e) {
      console.log("REPORT SUBMIT FAILED:", e);
      Alert.alert("Submit Failed", e?.message || "Network request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
     <View style={styles.headerCard}>
       <View style={{ flex: 1 }}>
         <Text style={styles.hTitle}>Report an Incident</Text>
         <Text style={styles.hSub}>
           Add details and evidence. You may use your current location or pin-point the incident location.
         </Text>
       </View>
     </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Incident Location</Text>
            {reverseLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" />
                <Text style={styles.inlineLoadingText}>Auto-filling address...</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.locationModeRow}>
            <Pressable
              onPress={useCurrentLocation}
              style={[
                styles.modeBtn,
                locationMode === "current" && styles.modeBtnActive,
              ]}
            >
              <Icon
                name="my-location"
                size={18}
                color={locationMode === "current" ? "#fff" : COLORS.blueDark}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  locationMode === "current" && styles.modeBtnTextActive,
                ]}
              >
                Use Current Location
              </Text>
            </Pressable>

            <Pressable
              onPress={openPinPoint}
              style={[
                styles.modeBtn,
                locationMode === "pin" && styles.modeBtnActive,
              ]}
            >
              <Icon
                name="place"
                size={18}
                color={locationMode === "pin" ? "#fff" : COLORS.blueDark}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  locationMode === "pin" && styles.modeBtnTextActive,
                ]}
              >
                Pin-point
              </Text>
            </Pressable>
          </View>

          {locLoading ? (
            <View style={styles.locRow}>
              <ActivityIndicator />
              <Text style={styles.locText}>Getting location…</Text>
            </View>
          ) : loc ? (
            <View style={styles.locRow}>
              <Icon name="location-on" size={18} color={COLORS.blue} />
              <Text style={styles.locText}>
                {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                {loc.accuracy ? `  •  ±${Math.round(loc.accuracy)}m` : ""}
              </Text>
            </View>
          ) : (
            <Text style={styles.locError}>No location selected yet.</Text>
          )}

          <Text style={styles.locHint}>
            You can auto-fill the address from GPS, then still edit the fields below.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Incident Details</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Snatching near plaza"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>
            Incident Type <Text style={{ color: COLORS.red }}>*</Text>
          </Text>
          <Pressable
            onPress={() => {
              setIncidentTypeSearch("");
              setTypePickerVisible(true);
            }}
            disabled={typesLoading}
            style={[
              styles.dropdownBtn,
              !selectedType && styles.dropdownBtnRequired,
            ]}
          >
            <Text
              style={[
                styles.dropdownText,
                !selectedType && { color: COLORS.placeholder },
              ]}
            >
              {typesLoading
                ? "Loading incident types..."
                : selectedType?.crime_name || "Select Incident Type"}
            </Text>
            <Icon name="arrow-drop-down" size={22} color={COLORS.blueDark} />
          </Pressable>

          {selectedIsOther && (
            <>
              <Text style={styles.label}>Specify Incident Type</Text>
              <TextInput
                value={otherIncidentType}
                onChangeText={setOtherIncidentType}
                placeholder="e.g., Harassment"
                placeholderTextColor={COLORS.placeholder}
                style={styles.input}
                editable={!submitting}
              />
            </>
          )}

          <Text style={styles.label}>Narrative</Text>
          <TextInput
            value={narrative}
            onChangeText={setNarrative}
            placeholder="Describe what happened, suspect details, vehicle plate, witnesses, etc."
            placeholderTextColor={COLORS.placeholder}
            style={[styles.input, styles.textArea]}
            multiline
            textAlignVertical="top"
            editable={!submitting}
          />

          <Text style={styles.label}>Place / Landmark</Text>
          <TextInput
            value={placeOfIncident}
            onChangeText={(text) => {
              setPlaceTouched(true);
              setPlaceOfIncident(text);
            }}
            placeholder="e.g., Near public market / beside city plaza"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Sitio</Text>
          <TextInput
            value={sitio}
            onChangeText={setSitio}
            placeholder="Optional"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Barangay *</Text>
          <TextInput
            value={barangay}
            onChangeText={(text) => {
              setBarangayTouched(true);
              setBarangay(text);
            }}
            placeholder="Enter barangay"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>City / Municipality *</Text>
          <TextInput
            value={cityMunicipality}
            onChangeText={(text) => {
              setCityTouched(true);
              setCityMunicipality(text);
            }}
            placeholder="Enter city or municipality"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Province *</Text>
          <TextInput
            value={province}
            onChangeText={(text) => {
              setProvinceTouched(true);
              setProvince(text);
            }}
            placeholder="Enter province"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Region</Text>
          <TextInput
            value={region}
            onChangeText={(text) => {
              setRegionTouched(true);
              setRegion(text);
            }}
            placeholder="Optional"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Incident Start (optional)</Text>
          <TextInput
            value={dateIncidentFrom}
            onChangeText={setDateIncidentFrom}
            placeholder="YYYY-MM-DD HH:MM or readable date/time"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Incident End (optional)</Text>
          <TextInput
            value={dateIncidentTo}
            onChangeText={setDateIncidentTo}
            placeholder="YYYY-MM-DD HH:MM"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            editable={!submitting}
          />

          <View style={[styles.rowBetween, { marginTop: 14 }]}>
            <Text style={styles.cardTitle}>Evidence Photos</Text>
            <Text style={styles.counter}>
              {photos.length}/{MAX_PHOTOS}
            </Text>
          </View>

          <Pressable
            onPress={openPhotoMenu}
            disabled={submitting}
            style={({ pressed }) => [
              styles.addPhotoBtn,
              pressed && { opacity: 0.92 },
              submitting && { opacity: 0.6 },
            ]}
          >
            <Icon name="add-a-photo" size={18} color="#fff" />
            <Text style={styles.addPhotoText}>Add Photo (Camera / Gallery)</Text>
          </Pressable>

          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((p, idx) => (
                <View key={`${p.uri}_${idx}`} style={styles.photoTile}>
                  <Image source={{ uri: p.uri }} style={styles.photo} />
                  <Pressable
                    onPress={() => removePhoto(idx)}
                    style={({ pressed }) => [
                      styles.removeBtn,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Icon name="close" size={16} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={submitReport}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              !canSubmit && styles.submitBtnDisabled,
              pressed && canSubmit && { transform: [{ scale: 0.99 }] },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Submit Report</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.legal}>
            By submitting, you confirm the information is accurate to the best of your knowledge.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={typePickerVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Select Incident Type</Text>
              <Pressable onPress={() => setTypePickerVisible(false)}>
                <Icon name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <Icon name="search" size={18} color={COLORS.muted} />
              <TextInput
                value={incidentTypeSearch}
                onChangeText={setIncidentTypeSearch}
                placeholder="Search incident types..."
                placeholderTextColor={COLORS.placeholder}
                style={styles.searchInput}
              />
              {incidentTypeSearch ? (
                <Pressable onPress={() => setIncidentTypeSearch("")}>
                  <Icon name="close" size={18} color={COLORS.muted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              {filteredIncidentTypes.length > 0 ? (
                filteredIncidentTypes.map((item) => {
                  const active = selectedType?.id === item.id;
                  return (
                    <Pressable
                      key={String(item.id)}
                      onPress={() => {
                        setSelectedType(item);
                        setTypePickerVisible(false);
                      }}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>
                        {item.crime_name}
                      </Text>
                      {item.crime_category ? (
                        <Text style={styles.optionMeta}>{item.crime_category}</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="search-off" size={26} color={COLORS.muted} />
                  <Text style={styles.emptyStateText}>No incident types found.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.mapHeader}>
            <Pressable onPress={() => setMapVisible(false)} style={styles.mapHeaderBtn}>
              <Icon name="arrow-back" size={22} color={COLORS.text} />
            </Pressable>
            <Text style={styles.mapHeaderTitle}>Pin-point Incident Location</Text>
            <Pressable onPress={confirmPinnedLocation} style={styles.mapHeaderBtn}>
              <Icon name="check" size={22} color={COLORS.blueDark} />
            </Pressable>
          </View>

          {pinDraft ? (
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: pinDraft.lat,
                longitude: pinDraft.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setPinDraft((prev) => ({
                  lat: latitude,
                  lng: longitude,
                  accuracy: prev?.accuracy ?? null,
                }));
              }}
            >
              <Marker
                coordinate={{
                  latitude: pinDraft.lat,
                  longitude: pinDraft.lng,
                }}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setPinDraft((prev) => ({
                    lat: latitude,
                    lng: longitude,
                    accuracy: prev?.accuracy ?? null,
                  }));
                }}
              />
            </MapView>
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator />
              <Text style={styles.inlineLoadingText}>Loading map...</Text>
            </View>
          )}

          <View style={styles.mapFooter}>
            <Text style={styles.mapFooterText}>
              Tap on the map or drag the marker to set the incident location.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const COLORS = {
  bg: "#F4F7FF",
  blue: "#1D4ED8",
  blueDark: "#0B2A6F",
  red: "#DC2626",
  text: "#0F172A",
  muted: "#64748B",
  placeholder: "#94A3B8",
  border: "#E2E8F0",
  card: "#FFFFFF",
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 30 },

  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  hTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  hSub: { marginTop: 4, fontSize: 12, color: COLORS.muted, lineHeight: 16 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: { fontSize: 13, fontWeight: "900", color: COLORS.text },
  counter: { fontSize: 12, fontWeight: "800", color: COLORS.muted },

  locRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  locText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },
  locError: { marginTop: 10, color: COLORS.red, fontWeight: "800", fontSize: 12 },
  locHint: { marginTop: 10, color: COLORS.muted, fontSize: 11, lineHeight: 14 },

  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineLoadingText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "700",
  },

  locationModeRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#EFF6FF",
  },
  modeBtnActive: {
    backgroundColor: COLORS.blueDark,
    borderColor: COLORS.blueDark,
  },
  modeBtnText: {
    color: COLORS.blueDark,
    fontWeight: "900",
    fontSize: 12,
  },
  modeBtnTextActive: {
    color: "#fff",
  },

  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    color: COLORS.text,
  },
  textArea: { minHeight: 120 },

  dropdownBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownBtnRequired: {
    borderColor: "#FCA5A5",
  },
  dropdownText: {
    fontSize: 15,
    color: COLORS.text,
    flex: 1,
    paddingRight: 12,
  },

  searchWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
  },

  addPhotoBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.blueDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  addPhotoText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  photoTile: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    backgroundColor: "#F1F5F9",
  },
  photo: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },

  submitBtn: {
    marginTop: 16,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  submitBtnDisabled: { backgroundColor: "#94A3B8" },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  legal: { marginTop: 10, fontSize: 11, color: COLORS.muted, lineHeight: 15 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    maxHeight: "78%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },
  optionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  optionRowActive: {
    backgroundColor: "#F8FAFF",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  optionTextActive: {
    color: COLORS.blueDark,
  },
  optionMeta: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "700",
  },

  mapHeader: {
    height: 58,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapHeaderBtn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mapHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.text,
  },
  mapFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  mapFooterText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    fontWeight: "700",
  },
  mapLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});