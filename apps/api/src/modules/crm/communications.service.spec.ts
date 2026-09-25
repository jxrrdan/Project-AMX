import { NotFoundException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';

function makeEmail() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}
function makeSms() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}
function makeWhatsApp() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

describe('CommunicationsService.sendWhatsApp', () => {
  const dealerId = 'dealer-1';

  it('throws when the contact does not belong to this dealer', async () => {
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never, makeWhatsApp() as never);
    await expect(service.sendWhatsApp(dealerId, { contactId: 'other-dealer-contact', body: 'Hi' } as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('substitutes placeholders and sends via WhatsAppService', async () => {
    const whatsapp = makeWhatsApp();
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', firstName: 'Alex', lastName: 'Whitfield', phone: '+447700900000' }) },
      whatsAppMessage: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never, whatsapp as never);
    await service.sendWhatsApp(dealerId, { contactId: 'c1', body: 'Hi {{first_name}}, your car is ready' } as never);
    expect(whatsapp.send).toHaveBeenCalledWith('+447700900000', 'Hi Alex, your car is ready');
  });
});

describe('CommunicationsService.logCall / listCalls', () => {
  const dealerId = 'dealer-1';

  it('throws when logging a call against a contact outside this dealer', async () => {
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(null) }, callLog: { create: jest.fn() } };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never, makeWhatsApp() as never);
    await expect(
      service.logCall(dealerId, 'other-dealer-contact', { direction: 'OUTBOUND', outcome: 'CONNECTED' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.callLog.create).not.toHaveBeenCalled();
  });

  it('records the call once the contact is confirmed to belong to this dealer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'call-1' });
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) }, callLog: { create } };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never, makeWhatsApp() as never);
    await service.logCall(dealerId, 'c1', { direction: 'OUTBOUND', outcome: 'NO_ANSWER', notes: 'Left a message' } as never);
    expect(create).toHaveBeenCalledWith({
      data: { contactId: 'c1', direction: 'OUTBOUND', outcome: 'NO_ANSWER', notes: 'Left a message' },
    });
  });

  it('throws when listing calls for a contact outside this dealer', async () => {
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(null) }, callLog: { findMany: jest.fn() } };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never, makeWhatsApp() as never);
    await expect(service.listCalls(dealerId, 'other-dealer-contact')).rejects.toThrow(NotFoundException);
  });
});

describe('CommunicationsService.sendSms', () => {
  const dealerId = 'dealer-1';

  it('throws when the contact does not belong to this dealer', async () => {
    const prisma = { contact: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never, makeWhatsApp() as never);
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
    const service = new CommunicationsService(prisma as never, makeEmail() as never, sms as never, makeWhatsApp() as never);
    await service.sendSms(dealerId, { contactId: 'c1', body: 'Hi {{first_name}} {{last_name}}, your car is ready' } as never);
    expect(sms.send).toHaveBeenCalledWith('+447700900000', 'Hi Alex Whitfield, your car is ready');
  });

  it('never compiles the free-form SMS body as a Handlebars template (no server-side template injection)', async () => {
    const sms = makeSms();
    const prisma = {
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', firstName: 'Alex', lastName: 'Whitfield', phone: '+447700900000' }) },
      smsMessage: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CommunicationsService(prisma as never, makeEmail() as never, sms as never, makeWhatsApp() as never);
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
    const service = new CommunicationsService(prisma as never, makeEmail() as never, makeSms() as never, makeWhatsApp() as never);
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
    const service = new CommunicationsService(prisma as never, email as never, makeSms() as never, makeWhatsApp() as never);
    await service.sendEmail(dealerId, { templateId: 't1', contactId: 'c1' } as never);
    expect(email.send).toHaveBeenCalledWith({ to: 'alex@example.com', subject: 'Hi Alex', html: '<p>Whitfield</p>' });
  });
});
