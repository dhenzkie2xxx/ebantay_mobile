import { createNavigationContainerRef } from "@react-navigation/native";
import { markNotificationReadLocal } from "../utils/notifications";
import { markAlertsRead } from "../utils/push";

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

async function markNotificationOpened(data={}) {
  try{
    if(data?.localNotificationId){
      await markNotificationReadLocal(
        data.localNotificationId
      );
    }

    if(data?.serverAlertId){
      await markAlertsRead([
        Number(data.serverAlertId)
      ]);
    }
  } catch(e){
    console.log("notification mark read error",e);
  }
}

export async function handleNotificationNavigation(data = {}) {

  await markNotificationOpened(data);

  const type = String(
    data?.notificationType ||
    data?.type ||
    ""
  ).toUpperCase();

  /*
    ACCOUNT related notifications
    open Account screen
  */
  if(
     type==="ACCOUNT_STATUS" ||
     type==="ACCOUNT_VERIFIED" ||
     type==="ACCOUNT_APPROVED" ||
     type==="ACCOUNT_SUSPENDED"
  ){
     navigate("Account");
     return;
  }

  /*
    User report/panic updates
    open My Activity
  */
  if(
      type==="PANIC_STATUS" ||
      type==="INCIDENT_STATUS" ||
      type==="REPORT_STATUS" ||
      type==="PANIC_RESOLVED" ||
      type==="FALSE_ALARM"
  ){
      navigate("MyActivity",{
        highlightId:
          data.incidentId ||
          data.panicId ||
          null
      });
      return;
  }

  /*
    Community / hotspot
  */
  if(type==="HOTSPOT_ALERT"){
      navigate(
        "Heatmap",
        data?.hotspotId
          ? {hotspotId:data.hotspotId}
          : undefined
      );
      return;
  }

  if(type==="COMMUNITY_ANNOUNCEMENT"){
      navigate("Alerts");
      return;
  }

  /*
    Police dispatch notifications
  */
  if(
    type==="GO_SIGNAL" ||
    type==="NEAREST_UNIT_DETECTED" ||
    type==="PROCEED_APPROVED" ||
    type==="PROCEED_DENIED" ||
    type==="REQUEST_TO_PROCEED" ||
    type==="BACKUP_REQUEST" ||
    type==="ASSIGNMENT_OUTCOME"
  ){
      navigate("PoliceHome");
      return;
  }

  navigate("Notifications");
}