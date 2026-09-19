export enum VehiclePipelineStatus {
  ORDERED = 'ORDERED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  PDI_SCHEDULED = 'PDI_SCHEDULED',
  PDI_COMPLETE = 'PDI_COMPLETE',
  READY_FOR_HANDOVER = 'READY_FOR_HANDOVER',
  DELIVERED = 'DELIVERED',
}

export const VEHICLE_PIPELINE_COLUMNS: VehiclePipelineStatus[] = [
  VehiclePipelineStatus.ORDERED,
  VehiclePipelineStatus.IN_PRODUCTION,
  VehiclePipelineStatus.IN_TRANSIT,
  VehiclePipelineStatus.ARRIVED,
  VehiclePipelineStatus.PDI_SCHEDULED,
  VehiclePipelineStatus.PDI_COMPLETE,
  VehiclePipelineStatus.READY_FOR_HANDOVER,
  VehiclePipelineStatus.DELIVERED,
];

export enum PdiStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETE = 'COMPLETE',
}

export enum PdiItemRating {
  PASS = 'PASS',
  ADVISORY = 'ADVISORY',
  FAIL = 'FAIL',
}

export enum HandoverType {
  NEW_CAR = 'NEW_CAR',
  USED_CAR = 'USED_CAR',
}
