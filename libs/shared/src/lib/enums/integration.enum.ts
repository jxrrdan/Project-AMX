export enum IntegrationType {
  REST_PULL = 'REST_PULL',
  REST_PUSH = 'REST_PUSH',
  MQTT = 'MQTT',
}

export enum IntegrationStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

/** The AMX entity a connector's inbound records get written into — a short, explicit allowlist. */
export enum IntegrationTargetEntity {
  VEHICLE = 'VEHICLE',
  USED_VEHICLE = 'USED_VEHICLE',
  PART = 'PART',
  CONTACT = 'CONTACT',
}

export const INTEGRATION_TARGET_ENTITY_LABELS: Record<IntegrationTargetEntity, string> = {
  [IntegrationTargetEntity.VEHICLE]: 'New Car Stock',
  [IntegrationTargetEntity.USED_VEHICLE]: 'Used Car Stock',
  [IntegrationTargetEntity.PART]: 'Parts',
  [IntegrationTargetEntity.CONTACT]: 'CRM Contacts',
};

export enum CustomFieldDataType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
}

export enum IntegrationRunStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

/** Simple value transforms available on a field mapping, applied before the value is written. */
export enum IntegrationTransform {
  UPPERCASE = 'UPPERCASE',
  LOWERCASE = 'LOWERCASE',
  TRIM = 'TRIM',
  PARSE_NUMBER = 'PARSE_NUMBER',
  PARSE_DATE = 'PARSE_DATE',
}

/** Outbound authentication a REST_PULL connector can add to its request. */
export enum IntegrationAuthType {
  NONE = 'NONE',
  BASIC = 'BASIC',
  BEARER = 'BEARER',
  API_KEY = 'API_KEY',
}
