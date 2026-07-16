import { API_BASE_URL } from "../config/api";
import { authFetch } from "./auth";

export async function updatePoliceLocation(navigation, payload) {
  const res = await authFetch(navigation, `${API_BASE_URL}/police_update_location.php`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function getPoliceAssignments(navigation) {
  const res = await authFetch(navigation, `${API_BASE_URL}/police_assignment_inbox.php`, {
    method: "GET",
  });

  return res.json();
}

export async function requestToProceed(navigation, payload) {
  const res = await authFetch(navigation, `${API_BASE_URL}/police_request_to_proceed.php`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function updateAssignmentOutcome(navigation, payload) {
  const res = await authFetch(navigation, `${API_BASE_URL}/police_update_assignment_outcome.php`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function requestBackup(navigation, payload) {
  const res = await authFetch(navigation, `${API_BASE_URL}/police_request_backup.php`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return res.json();
}