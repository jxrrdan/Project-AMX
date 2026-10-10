/**
 * Creates the FIRST dealer and its principal user in a fresh production database. Unlike seed.ts
 * (demo data, well-known password) this creates no sample records and no shared credentials.
 *
 *   BOOTSTRAP_DEALER_NAME="BMW Northampton" BOOTSTRAP_SUBDOMAIN=bmwnorthampton \
 *   BOOTSTRAP_ADMIN_EMAIL=principal@dealer.co.uk BOOTSTRAP_ADMIN_FIRST_NAME=Alex BOOTSTRAP_ADMIN_LAST_NAME=Whitfield \
 *   [BOOTSTRAP_ADMIN_PASSWORD=...]  npx prisma ... / npm run bootstrap:dealer
 *
 * If BOOTSTRAP_ADMIN_PASSWORD is omitted a strong random one is generated and printed once; the
 * user should change it at first sign-in. Safe to re-run: it refuses if the subdomain exists, so it
 * can never overwrite a live dealer.
 */
import { PrismaClient } from '@prisma/client';
// bootstrap.ts runs standalone via ts-node, outside the Nx project graph (same as seed.ts).
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ModuleKey, SYSTEM_ROLE_PERMISSIONS, SystemRole } from '../../../libs/shared/src/index';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const name = required('BOOTSTRAP_DEALER_NAME');
  const subdomain = required('BOOTSTRAP_SUBDOMAIN').toLowerCase();
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const firstName = required('BOOTSTRAP_ADMIN_FIRST_NAME');
  const lastName = required('BOOTSTRAP_ADMIN_LAST_NAME');

  if (!/^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/.test(subdomain)) {
    throw new Error('BOOTSTRAP_SUBDOMAIN must be 3-63 characters: lowercase letters, digits and hyphens');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL is not a valid email address');
  }
  const supplied = process.env['BOOTSTRAP_ADMIN_PASSWORD'];
  if (supplied !== undefined && supplied.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters');
  }
  const password = supplied ?? randomBytes(18).toString('base64url');

  if (await prisma.dealer.findUnique({ where: { subdomain } })) {
    throw new Error(`A dealer with subdomain "${subdomain}" already exists; refusing to modify it`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const dealer = await tx.dealer.create({
      data: { name, subdomain, timeZone: 'Europe/London', locale: 'en-GB', primaryColour: '#0066B1' },
    });
    await tx.moduleLicense.createMany({
      data: Object.values(ModuleKey).map((module) => ({ dealerId: dealer.id, module, enabled: true })),
    });

    const roleIds = {} as Record<SystemRole, string>;
    for (const systemRole of Object.values(SystemRole)) {
      const role = await tx.role.create({ data: { dealerId: dealer.id, name: systemRole, systemRole, isCustom: false } });
      roleIds[systemRole] = role.id;
      await tx.rolePermission.createMany({
        data: SYSTEM_ROLE_PERMISSIONS[systemRole].map((p) => ({ roleId: role.id, module: p.module, action: p.action })),
      });
    }

    await tx.user.create({
      data: {
        dealerId: dealer.id,
        email,
        firstName,
        lastName,
        passwordHash,
        roles: { create: { roleId: roleIds[SystemRole.DEALER_PRINCIPAL] } },
      },
    });
  });

  console.log(`Created dealer "${name}" (${subdomain}) with principal ${email}`);
  if (supplied === undefined) {
    console.log(`Generated one-time password (shown once, change it at first sign-in): ${password}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
