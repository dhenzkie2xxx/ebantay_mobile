import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigator";
import { navigationRef } from "./src/navigation/navigationService";
import { checkForUpdate } from "./src/utils/updateChecker";
import { initPushAndroid } from "./src/utils/push";
import { startRiskTracking } from "./src/utils/riskTracker";

const linking = {
  prefixes: ["ebantay://"],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: "login",
          ForgotPassword: "forgot-password",
          ResetPassword: "reset-password",
        },
      },
    },
  },
};

export default function App() {
  useEffect(() => {
    checkForUpdate({ silent: false });
    initPushAndroid();

    startRiskTracking({
      intervalMs: 60_000,
      days: 30,
      category: "All",
      riskRadiusMeters: 250,
      bboxMeters: 1500,
      cooldownMs: 10 * 60_000,
    });
  }, []);

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <RootNavigator />
    </NavigationContainer>
  );
}