export enum WarrantyClaimStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  AUTHORISED = 'AUTHORISED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export const WARRANTY_CLAIM_WORKFLOW: WarrantyClaimStatus[] = [
  WarrantyClaimStatus.DRAFT,
  WarrantyClaimStatus.SUBMITTED,
  WarrantyClaimStatus.AUTHORISED,
  WarrantyClaimStatus.REJECTED,
  WarrantyClaimStatus.PAID,
];
