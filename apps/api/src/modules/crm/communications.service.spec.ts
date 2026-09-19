import { NotFoundException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';

function makeEmail() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}
function makeSms() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

describe('CommunicationsService.sendSms', () => {
  const dealerId = 'dealer-1';

  it('throws when the contact does not belong to this dealer', async () => {
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never);
    await expect(service.sendSms(dealerId, { contactId: 'other-dealer-contact', body: 'Hi' } as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('substitutes only the known placeholders rather than compiling the body as a template', async () => {
    const sms = makeSms();
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', firstName: 'Alex', lastName: 'Whitfield', phone: '+447700900000' }) },
      smsMessage: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, sms as never);
    await service.sendSms(dealerId, { contactId: 'c1', body: 'Hi {{first_name}} {{last_name}}, your car is ready' } as never);
    expect(sms.send).toHaveBeenCalledWith('+447700900000', 'Hi Alex Whitfield, your car is ready');
  });

  it('never compiles the free-form SMS body as a Handlebars template (no server-side template injection)', async () => {
    const sms = makeSms();
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', firstName: 'Alex', lastName: 'Whitfield', phone: '+447700900000' }) },
      smsMessage: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, sms as never);
    // A classic Handlebars SSTI probe — if this were compiled as a template it would throw or
    // evaluate; substitutePlaceholders must pass it through untouched (aside from the two
    // known placeholders, which aren't present here).
    const payload = '{{#with this.constructor as |c|}}{{c}}{{/with}}';
    await service.sendSms(dealerId, { contactId: 'c1', body: payload } as never);
    expect(sms.send).toHaveBeenCalledWith('+447700900000', payload);
  });
});

describe('CommunicationsService.sendEmail', () => {
  const dealerId = 'dealer-1';

  it('throws when the template does not belong to this dealer', async () => {
    const prisma = {
      emailTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', email: 'a@b.com' }) },
    };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never);
    await expect(
      service.sendEmail(dealerId, { templateId: 'other-dealer-template', contactId: 'c1' } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('renders the (trusted, dealer-authored) template with the contact as data and sends it', async () => {
    const email = makeEmail();
    const prisma = {
      emailTemplate: {
        findFirst: jest.fn().mockResolvedValue({ id: 't1', subject: 'Hi {{first_name}}', bodyHtml: '<p>{{last_name}}</p>' }),
      },
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', firstName: 'Alex', lastName: 'Whitfield', email: 'alex@example.com' }) },
      emailMessage: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CommunicationsService(prisma as never, email as never, makeSms() as never);
    await service.sendEmail(dealerId, { templateId: 't1', contactId: 'c1' } as never);
    expect(email.send).toHaveBeenCalledWith({ to: 'alex@example.com', subject: 'Hi Alex', html: '<p>Whitfield</p>' });
  });
});
