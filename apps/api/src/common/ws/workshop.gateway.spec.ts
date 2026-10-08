import { JwtService } from '@nestjs/jwt';
import { WorkshopGateway } from './workshop.gateway';

function makeClient(token: string) {
  return { handshake: { auth: { token }, query: {} }, join: jest.fn(), disconnect: jest.fn() };
}

describe('WorkshopGateway authentication', () => {
  const jwt = new JwtService({});
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  const gateway = new WorkshopGateway(jwt, config as never);

  it('joins the dealer room for a correctly signed token', () => {
    const client = makeClient(jwt.sign({ sub: 'u1', dealerId: 'dealer-1' }, { secret: 'test-secret' }));
    gateway.handleConnection(client as never);
    expect(client.join).toHaveBeenCalledWith('dealer:dealer-1');
  });

  it('rejects a forged token signed with the wrong secret', () => {
    const client = makeClient(jwt.sign({ sub: 'u1', dealerId: 'dealer-2' }, { secret: 'attacker-secret' }));
    gateway.handleConnection(client as never);
    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('rejects an unsigned (alg none) token', () => {
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"dealerId":"dealer-2"}').toString('base64url')}.`;
    const client = makeClient(none);
    gateway.handleConnection(client as never);
    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });
});
