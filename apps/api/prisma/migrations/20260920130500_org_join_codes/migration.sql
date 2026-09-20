-- Add unguessable invite-code columns so joining a franchise/group requires presenting a code
-- rather than trusting the caller-supplied raw id (see OrgService doc comment).
ALTER TABLE "franchises" ADD COLUMN "joinCode" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "franchises" ALTER COLUMN "joinCode" DROP DEFAULT;
CREATE UNIQUE INDEX "franchises_joinCode_key" ON "franchises"("joinCode");

ALTER TABLE "groups" ADD COLUMN "joinCode" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "groups" ALTER COLUMN "joinCode" DROP DEFAULT;
CREATE UNIQUE INDEX "groups_joinCode_key" ON "groups"("joinCode");
