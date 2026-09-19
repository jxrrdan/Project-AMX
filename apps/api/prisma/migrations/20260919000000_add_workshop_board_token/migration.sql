-- Backfill existing dealers with a random token, then drop the DB-level default so future
-- inserts get their value from Prisma's client-side @default(uuid()), matching every other
-- uuid-defaulted column in this schema (e.g. every model's own "id" column).
ALTER TABLE "dealers" ADD COLUMN "workshopBoardToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE "dealers" ALTER COLUMN "workshopBoardToken" DROP DEFAULT;

CREATE UNIQUE INDEX "dealers_workshopBoardToken_key" ON "dealers"("workshopBoardToken");
