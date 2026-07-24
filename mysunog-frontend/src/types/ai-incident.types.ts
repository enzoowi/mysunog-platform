/**
 * TypeScript types shared across AI incident components.
 * These mirror the NestJS entity / enums exactly.
 */

export type AiIncidentStatus =
  | 'UNVERIFIED'
  | 'ACKNOWLEDGED'
  | 'VERIFIED_FIRE'
  | 'POSSIBLE_FIRE'
  | 'FALSE_ALARM'
  | 'SMOKE_ONLY'
  | 'RESPONSE_INITIATED'
  | 'RESOLVED';

export type IncidentPriority = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type FireGrowthStatus = 'STABLE' | 'INCREASING' | 'DECREASING' | 'SPREADING' | 'UNKNOWN';
export type AiDetectionType  = 'FIRE' | 'SMOKE' | 'FIRE_AND_SMOKE';

export interface AiIncident {
  id:                   string;
  detectionType:        AiDetectionType;
  detectionConfidence:  number;

  cameraId:             string;
  cameraName:           string | null;
  cameraLocation:       string | null;
  latitude:             number | null;
  longitude:            number | null;

  firstDetectionTime:   string;   // ISO string
  lastDetectionTime:    string | null;
  durationSeconds:      number;
  consecutiveFrameCount: number;
  growthStatus:         FireGrowthStatus;
  fireAreaHistory:      number[];
  smokeAreaHistory:     number[];

  severityScore:        number;
  severityLevel:        IncidentPriority;
  severityReasons:      string[];

  priority:             IncidentPriority;
  status:               AiIncidentStatus;

  acknowledgedById:     number | null;
  acknowledgedByName:   string | null;
  acknowledgedAt:       string | null;
  verifiedById:         number | null;
  verifiedByName:       string | null;
  verifiedAt:           string | null;
  resolvedAt:           string | null;

  cameraCount:          number;
  correlatedIncidentId: string | null;

  createdAt:            string;
  updatedAt:            string;
}

export interface AiIncidentStatusHistory {
  id:              number;
  incidentId:      string;
  performedById:   number | null;
  performedByName: string;
  previousStatus:  AiIncidentStatus | null;
  newStatus:       AiIncidentStatus;
  remarks:         string | null;
  changedAt:       string;
}

export interface AiIncidentAnalytics {
  total:                       number;
  active:                      number;
  verifiedFires:               number;
  falseAlarms:                 number;
  byPriority:                  Record<IncidentPriority, number>;
  byStatus:                    Record<AiIncidentStatus, number>;
  avgAcknowledgementSeconds:   number;
  avgVerificationSeconds:      number;
}

/** Statuses that indicate the incident is still actionable */
export const ACTIVE_STATUSES: AiIncidentStatus[] = [
  'UNVERIFIED', 'ACKNOWLEDGED', 'VERIFIED_FIRE', 'POSSIBLE_FIRE', 'RESPONSE_INITIATED',
];

export const PRIORITY_CONFIG: Record<IncidentPriority, {
  label:   string;
  color:   string;
  bgColor: string;
  border:  string;
  ring:    string;
  emoji:   string;
}> = {
  LOW:      { label: 'LOW',      color: 'text-emerald-700', bgColor: 'bg-emerald-50',  border: 'border-emerald-200', ring: 'ring-emerald-400', emoji: '🟢' },
  MODERATE: { label: 'MODERATE', color: 'text-amber-700',   bgColor: 'bg-amber-50',    border: 'border-amber-200',   ring: 'ring-amber-400',   emoji: '🟡' },
  HIGH:     { label: 'HIGH',     color: 'text-red-700',     bgColor: 'bg-red-50',      border: 'border-red-200',     ring: 'ring-red-400',     emoji: '🔴' },
  CRITICAL: { label: 'CRITICAL', color: 'text-white',       bgColor: 'bg-red-700',     border: 'border-red-900',     ring: 'ring-red-600',     emoji: '🚨' },
};

export const STATUS_CONFIG: Record<AiIncidentStatus, { label: string; color: string; bgColor: string }> = {
  UNVERIFIED:         { label: 'Unverified',          color: 'text-gray-600',    bgColor: 'bg-gray-100'   },
  ACKNOWLEDGED:       { label: 'Acknowledged',         color: 'text-blue-700',    bgColor: 'bg-blue-100'   },
  VERIFIED_FIRE:      { label: 'Verified Fire',        color: 'text-red-700',     bgColor: 'bg-red-100'    },
  POSSIBLE_FIRE:      { label: 'Possible Fire',        color: 'text-orange-700',  bgColor: 'bg-orange-100' },
  FALSE_ALARM:        { label: 'False Alarm',          color: 'text-emerald-700', bgColor: 'bg-emerald-100'},
  SMOKE_ONLY:         { label: 'Smoke Only',           color: 'text-yellow-700',  bgColor: 'bg-yellow-100' },
  RESPONSE_INITIATED: { label: 'Response Initiated',   color: 'text-purple-700',  bgColor: 'bg-purple-100' },
  RESOLVED:           { label: 'Resolved',             color: 'text-slate-700',   bgColor: 'bg-slate-100'  },
};

export const GROWTH_CONFIG: Record<FireGrowthStatus, { label: string; color: string; icon: string }> = {
  STABLE:     { label: 'Stable',     color: 'text-emerald-600', icon: '→' },
  INCREASING: { label: 'Increasing', color: 'text-red-600',     icon: '↑' },
  DECREASING: { label: 'Decreasing', color: 'text-blue-600',    icon: '↓' },
  SPREADING:  { label: 'Spreading',  color: 'text-red-900',     icon: '↗' },
  UNKNOWN:    { label: 'Unknown',    color: 'text-gray-500',    icon: '?' },
};
