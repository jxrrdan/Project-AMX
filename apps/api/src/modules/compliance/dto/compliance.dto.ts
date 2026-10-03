import { ConsentType, SignatureDocType } from '@project-amx/shared';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateConsentDto {
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  contactRef?: string;

  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSignatureDto {
  @IsEnum(SignatureDocType)
  documentType!: SignatureDocType;

  @IsString()
  documentRef!: string;

  @IsString()
  signerName!: string;

  /** Data URL of the drawn signature (image/png;base64) or a typed-signature representation. */
  @IsString()
  signatureData!: string;
}
