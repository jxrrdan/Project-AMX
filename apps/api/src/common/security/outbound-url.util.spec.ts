import { BadRequestException } from '@nestjs/common';
import { assertSafeOutboundUrl } from './outbound-url.util';

describe('assertSafeOutboundUrl', () => {
  it('allows an ordinary public https URL', () => {
    expect(() => assertSafeOutboundUrl('https://api.example-oem.com/v1/vehicles')).not.toThrow();
  });

  it('allows an ordinary public http URL', () => {
    expect(() => assertSafeOutboundUrl('http://api.example-oem.com/v1/vehicles')).not.toThrow();
  });

  it('rejects a malformed URL', () => {
    expect(() => assertSafeOutboundUrl('not a url')).toThrow(BadRequestException);
  });

  it('rejects a non-http(s) scheme', () => {
    expect(() => assertSafeOutboundUrl('file:///etc/passwd')).toThrow(BadRequestException);
    expect(() => assertSafeOutboundUrl('ftp://example.com/x')).toThrow(BadRequestException);
  });

  it('rejects localhost', () => {
    expect(() => assertSafeOutboundUrl('http://localhost:8080/admin')).toThrow(BadRequestException);
  });

  it('rejects the cloud metadata endpoint', () => {
    expect(() => assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data/')).toThrow(BadRequestException);
  });

  it('rejects loopback and private IPv4 ranges', () => {
    expect(() => assertSafeOutboundUrl('http://127.0.0.1/x')).toThrow(BadRequestException);
    expect(() => assertSafeOutboundUrl('http://10.0.0.5/x')).toThrow(BadRequestException);
    expect(() => assertSafeOutboundUrl('http://172.16.0.5/x')).toThrow(BadRequestException);
    expect(() => assertSafeOutboundUrl('http://192.168.1.5/x')).toThrow(BadRequestException);
  });

  it('allows a public IPv4 address', () => {
    expect(() => assertSafeOutboundUrl('http://93.184.216.34/x')).not.toThrow();
  });

  it('rejects IPv6 loopback and unique-local addresses', () => {
    expect(() => assertSafeOutboundUrl('http://[::1]/x')).toThrow(BadRequestException);
    expect(() => assertSafeOutboundUrl('http://[fd00::1]/x')).toThrow(BadRequestException);
  });
});
