/**
 * Future-ready hooks for resolution notifications (24h / 1h / resolved).
 * No delivery implementation yet — thresholds for schedulers and UI copy.
 */

export const RESOLUTION_NOTIFICATION_THRESHOLDS = ["24h", "1h", "resolved"] as const;

export type ResolutionNotificationThreshold = (typeof RESOLUTION_NOTIFICATION_THRESHOLDS)[number];

export const RESOLUTION_NOTIFICATION_COPY: Record<ResolutionNotificationThreshold, string> = {
  "24h": "Your market resolves in 24 hours",
  "1h": "Outcome expected within the hour",
  resolved: "Market resolved — see who was right",
};
