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

/** Mirrors the Prisma `SaleModel` enum — RETAIL (dealer buys/sells, keeps its own margin) or
 * AGENCY (the OEM is the contracting seller; the dealer facilitates the order and earns a
 * commission instead). A trade-in the customer brings in is always the dealer's own purchase
 * either way — see PartExchangeAppraisal.newCarSaleId. */
export enum SaleModel {
  RETAIL = 'RETAIL',
  AGENCY = 'AGENCY',
}

export const SALE_MODEL_LABELS: Record<SaleModel, string> = {
  [SaleModel.RETAIL]: 'Retail (dealer sale)',
  [SaleModel.AGENCY]: 'Agency (OEM sale, dealer commission)',
};

/** Mirrors the Prisma `ConditionCheckStage` enum — a structured vehicle condition/damage check,
 * shared by courtesy/loan bookings (INITIAL when the car leaves with the customer, FINAL when
 * returned) and workshop job cards (INITIAL at drop-off, FINAL at handback). */
export enum ConditionCheckStage {
  INITIAL = 'INITIAL',
  FINAL = 'FINAL',
}

export const CONDITION_CHECK_STAGE_LABELS: Record<ConditionCheckStage, string> = {
  [ConditionCheckStage.INITIAL]: 'Initial (before)',
  [ConditionCheckStage.FINAL]: 'Final (after)',
};

/** Mirrors the Prisma `DamageSeverity` enum. */
export enum DamageSeverity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}
