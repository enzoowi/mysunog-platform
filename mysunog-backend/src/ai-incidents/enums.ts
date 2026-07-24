/**
 * Enums for the AI Incident system.
 * These are used by the AiIncident entity, DTOs, gateway events,
 * and the frontend to ensure consistent status/priority values across
 * the entire system.
 *
 * DESIGN NOTE — Separation of AI vs Human status:
 * The system NEVER automatically sets a human-facing verification status.
 * Every incident starts as UNVERIFIED. A BFP_STAFF or ADMIN user must
 * explicitly transition it. This enforces the thesis requirement that
 * AI PREDICTION ≠ HUMAN CONFIRMATION.
 */

export enum AiIncidentStatus {
  /** Initial status. Set by the AI service. No human action taken yet. */
  UNVERIFIED = 'UNVERIFIED',

  /** BFP officer has seen and acknowledged the alert. Not yet verified. */
  ACKNOWLEDGED = 'ACKNOWLEDGED',

  /** Officer confirmed this is a real fire. */
  VERIFIED_FIRE = 'VERIFIED_FIRE',

  /** Officer believes there is likely a fire but cannot fully confirm yet. */
  POSSIBLE_FIRE = 'POSSIBLE_FIRE',

  /** Officer confirmed this is NOT a real fire (e.g., vehicle, sunlight). */
  FALSE_ALARM = 'FALSE_ALARM',

  /** Officer confirmed smoke only — no visible flame. */
  SMOKE_ONLY = 'SMOKE_ONLY',

  /** Fire trucks or personnel are en route. */
  RESPONSE_INITIATED = 'RESPONSE_INITIATED',

  /** Fire has been put out or situation resolved. */
  RESOLVED = 'RESOLVED',
}

export enum IncidentPriority {
  /** Small or stable detection. Monitor only. */
  LOW = 'LOW',

  /** Persistent detection. BFP officer should verify. */
  MODERATE = 'MODERATE',

  /** Probable fire with increasing activity. Respond promptly. */
  HIGH = 'HIGH',

  /** Rapidly spreading or large fire. Treat as real until verified. */
  CRITICAL = 'CRITICAL',
}

export enum FireGrowthStatus {
  /** Area fluctuates within ±0.5% per sample. */
  STABLE = 'STABLE',

  /** Linear regression slope > +0.5% per sample. */
  INCREASING = 'INCREASING',

  /** Linear regression slope < -0.5% per sample. */
  DECREASING = 'DECREASING',

  /** Single-frame jump of ≥ 8% area — rapid spread event. */
  SPREADING = 'SPREADING',

  /** Not enough data points yet (< 3 samples). */
  UNKNOWN = 'UNKNOWN',
}

export enum AiDetectionType {
  FIRE = 'FIRE',
  SMOKE = 'SMOKE',
  FIRE_AND_SMOKE = 'FIRE_AND_SMOKE',
}

/** Maps priority → display color hex for the frontend badge */
export const PRIORITY_COLOR: Record<IncidentPriority, string> = {
  [IncidentPriority.LOW]:      '#22c55e',
  [IncidentPriority.MODERATE]: '#f97316',
  [IncidentPriority.HIGH]:     '#ef4444',
  [IncidentPriority.CRITICAL]: '#7f1d1d',
};

/** Human-readable status labels for the frontend timeline */
export const STATUS_LABEL: Record<AiIncidentStatus, string> = {
  [AiIncidentStatus.UNVERIFIED]:         'Unverified',
  [AiIncidentStatus.ACKNOWLEDGED]:       'Acknowledged',
  [AiIncidentStatus.VERIFIED_FIRE]:      'Verified Fire',
  [AiIncidentStatus.POSSIBLE_FIRE]:      'Possible Fire',
  [AiIncidentStatus.FALSE_ALARM]:        'False Alarm',
  [AiIncidentStatus.SMOKE_ONLY]:         'Smoke Only',
  [AiIncidentStatus.RESPONSE_INITIATED]: 'Response Initiated',
  [AiIncidentStatus.RESOLVED]:           'Resolved',
};

/** Statuses that indicate the incident is still active (not terminal) */
export const ACTIVE_STATUSES: AiIncidentStatus[] = [
  AiIncidentStatus.UNVERIFIED,
  AiIncidentStatus.ACKNOWLEDGED,
  AiIncidentStatus.VERIFIED_FIRE,
  AiIncidentStatus.POSSIBLE_FIRE,
  AiIncidentStatus.RESPONSE_INITIATED,
];
