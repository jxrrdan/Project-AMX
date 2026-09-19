import { ModuleKey } from '../enums/module-key.enum';
import { PermissionAction } from '../enums/permission-action.enum';

export interface AuthUser {
  id: string;
  dealerId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: { module: ModuleKey; action: PermissionAction }[];
}

export interface LoginRequest {
  subdomain: string;
  email: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshRequest {
  refreshToken: string;
}
