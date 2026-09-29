/** Mirrors the Prisma `RecallCampaignStatus` enum — an OEM safety/quality recall campaign the
 * dealership is tracking to completion across all affected vehicles. */
export enum RecallCampaignStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export const RECALL_CAMPAIGN_STATUS_LABELS: Record<RecallCampaignStatus, string> = {
  [RecallCampaignStatus.OPEN]: 'Open',
  [RecallCampaignStatus.CLOSED]: 'Closed',
};

/** Mirrors the Prisma `RecallVehicleStatus` enum — remediation progress for one affected vehicle:
 * OUTSTANDING (identified, not yet booked) → BOOKED (workshop appointment made) → COMPLETED. */
export enum RecallVehicleStatus {
  OUTSTANDING = 'OUTSTANDING',
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
}

export const RECALL_VEHICLE_STATUS_LABELS: Record<RecallVehicleStatus, string> = {
  [RecallVehicleStatus.OUTSTANDING]: 'Outstanding',
  [RecallVehicleStatus.BOOKED]: 'Booked',
  [RecallVehicleStatus.COMPLETED]: 'Completed',
};

export const RECALL_VEHICLE_WORKFLOW: RecallVehicleStatus[] = [
  RecallVehicleStatus.OUTSTANDING,
  RecallVehicleStatus.BOOKED,
  RecallVehicleStatus.COMPLETED,
];
