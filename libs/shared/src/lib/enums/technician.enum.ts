export enum TechnicianAvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  LEAVE = 'LEAVE',
  SICKNESS = 'SICKNESS',
  TRAINING = 'TRAINING',
  OFF_SHIFT = 'OFF_SHIFT',
}

export const TECHNICIAN_AVAILABILITY_LABELS: Record<TechnicianAvailabilityStatus, string> = {
  [TechnicianAvailabilityStatus.AVAILABLE]: 'In',
  [TechnicianAvailabilityStatus.LEAVE]: 'Annual leave',
  [TechnicianAvailabilityStatus.SICKNESS]: 'Sickness',
  [TechnicianAvailabilityStatus.TRAINING]: 'Training',
  [TechnicianAvailabilityStatus.OFF_SHIFT]: 'Off shift',
};

export const TECHNICIAN_AVAILABILITY_COLOURS: Record<TechnicianAvailabilityStatus, string> = {
  [TechnicianAvailabilityStatus.AVAILABLE]: '#2E7D32',
  [TechnicianAvailabilityStatus.LEAVE]: '#0066B1',
  [TechnicianAvailabilityStatus.SICKNESS]: '#C62828',
  [TechnicianAvailabilityStatus.TRAINING]: '#EF6C00',
  [TechnicianAvailabilityStatus.OFF_SHIFT]: '#757575',
};
