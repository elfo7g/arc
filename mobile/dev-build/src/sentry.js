import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const sentryDsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  Constants.expoConfig?.extra?.sentryDsn ||
  "";

const tracesSampleRate = Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0");
const isDebugEnabled = process.env.EXPO_PUBLIC_SENTRY_DEBUG === "true";

export const isSentryEnabled = Boolean(sentryDsn);

export function initSentry() {
  if (!isSentryEnabled) return;

  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    environment: process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? "development" : "production"),
    debug: __DEV__ && isDebugEnabled,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.breadcrumbs;
      delete event.request;
      delete event.user;
      return event;
    }
  });
}

export function withSentry(AppComponent) {
  return isSentryEnabled ? Sentry.wrap(AppComponent) : AppComponent;
}
