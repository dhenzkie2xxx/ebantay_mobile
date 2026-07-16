import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";

function resetToAuth(navigation) {
  const nav = navigation?.getParent?.() || navigation;
  if (!nav?.reset) return;

  nav.reset({
    index: 0,
    routes: [{ name: "Auth" }],
  });
}

export async function clearSession(navigation, message) {
  try {
    await AsyncStorage.multiRemove(["auth_token", "user_data"]);
  } catch {}

  resetToAuth(navigation);
}

export async function validateSessionOrLogout(navigation) {
  const token = await AsyncStorage.getItem("auth_token");
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/me.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (res.status === 401 || res.status === 403) {
      await clearSession(navigation);
      return false;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      await clearSession(navigation);
      return false;
    }

    await AsyncStorage.setItem("user_data", JSON.stringify(data.user));
    return true;
  } catch {
    return true;
  }
}

export async function authFetch(navigation, url, options = {}) {
  const token = await AsyncStorage.getItem("auth_token");
  if (!token) {
    await clearSession(navigation);
    throw new Error("No session");
  }

  const isFormData =
    typeof FormData !== "undefined" && options?.body instanceof FormData;

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    await clearSession(navigation);
    throw new Error("Session expired. Please login again.");
  }

  if (res.status === 403) {
    const text = await res.text();
    let msg = "Access denied";

    try {
      const data = JSON.parse(text);
      msg = data?.message || msg;
    } catch {}

    throw new Error(msg);
  }

  return res;
}