import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ModuleKey, PermissionAction } from '@project-amx/shared';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
  });

  it('starts unauthenticated with no stored session', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('hasPermission is false for any module/action before login', () => {
    expect(service.hasPermission(ModuleKey.WORKSHOP, PermissionAction.VIEW)).toBe(false);
  });

  it('reflects permissions once a user is present in storage', () => {
    localStorage.setItem(
      'ams.user',
      JSON.stringify({
        id: '1',
        dealerId: 'd1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        roles: ['DEALER_PRINCIPAL'],
        permissions: [{ module: ModuleKey.WORKSHOP, action: PermissionAction.VIEW }],
      }),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const freshService = TestBed.inject(AuthService);

    expect(freshService.isAuthenticated()).toBe(true);
    expect(freshService.hasPermission(ModuleKey.WORKSHOP, PermissionAction.VIEW)).toBe(true);
    expect(freshService.hasPermission(ModuleKey.ADMIN, PermissionAction.DELETE)).toBe(false);
  });
});
