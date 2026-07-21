export enum LatencyBreachType {
  TRANSIT_ETA = 'transit_eta',
  USER_PRESENCE = 'user_presence',
}

export enum LatencyNotifyChannel {
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  BOTH = 'both',
}

export enum LatencyNotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}
