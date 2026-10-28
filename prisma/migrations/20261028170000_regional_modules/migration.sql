-- CreateEnum
CREATE TYPE "RegionalRequestKind" AS ENUM ('APPEAL', 'VIOLATION', 'AWARD');

-- CreateEnum
CREATE TYPE "RegionalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "license" TEXT,
ADD COLUMN     "programs" TEXT;

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "regionalId" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN     "sex" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "TrainingGroup" (
    "disciplineId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingMember" (
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,

    CONSTRAINT "TrainingMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingLesson" (
    "format" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "evidenceUrl" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "topic" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "TrainingLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAttendance" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "TrainingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingStandard" (
    "disciplineId" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL DEFAULT 0,
    "maxAge" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "comparison" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "thresholdSnapshot" DOUBLE PRECISION NOT NULL,
    "comparisonSnapshot" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "assessorId" TEXT NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "criteria" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionalRequest" (
    "competitionId" TEXT,
    "evidenceUrls" TEXT[],
    "history" JSONB NOT NULL DEFAULT '[]',
    "id" TEXT NOT NULL,
    "kind" "RegionalRequestKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "athleteId" TEXT,
    "programId" TEXT,
    "submittedById" TEXT NOT NULL,
    "status" "RegionalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegionalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamScenario" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalMapping" (
    "id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "regionalId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTransfer" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "fromGroupId" TEXT,
    "toGroupId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentEvidence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "indicator" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevelopmentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardRule" (
    "id" TEXT NOT NULL,
    "band" "RatingBand" NOT NULL,
    "place" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source" TEXT NOT NULL,
    "minParticipants" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AwardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardPetition" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "candidates" JSONB NOT NULL,
    "history" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardPetition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OidcClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcGrant" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "OidcGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcAccessToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OidcAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcSigningKey" (
    "id" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "publicKey" JSONB NOT NULL,

    CONSTRAINT "OidcSigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "competitionId" TEXT,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingMember_groupId_athleteId_key" ON "TrainingMember"("groupId", "athleteId");

-- CreateIndex
CREATE INDEX "TrainingLesson_groupId_startsAt_idx" ON "TrainingLesson"("groupId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAttendance_lessonId_memberId_key" ON "TrainingAttendance"("lessonId", "memberId");

-- CreateIndex
CREATE INDEX "Assessment_athleteId_assessedAt_idx" ON "Assessment"("athleteId", "assessedAt");

-- CreateIndex
CREATE INDEX "RegionalRequest_submittedById_createdAt_idx" ON "RegionalRequest"("submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "RegionalRequest_kind_status_idx" ON "RegionalRequest"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMapping_system_externalId_key" ON "ExternalMapping"("system", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMapping_system_regionalId_key" ON "ExternalMapping"("system", "regionalId");

-- CreateIndex
CREATE UNIQUE INDEX "AwardRule_band_place_key" ON "AwardRule"("band", "place");

-- CreateIndex
CREATE UNIQUE INDEX "OidcGrant_codeHash_key" ON "OidcGrant"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "OidcAccessToken_tokenHash_key" ON "OidcAccessToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationToken_tokenHash_key" ON "IntegrationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_subscriptionId_auditId_key" ON "WebhookDelivery"("subscriptionId", "auditId");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_regionalId_key" ON "Athlete"("regionalId");

-- AddForeignKey
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMember" ADD CONSTRAINT "TrainingMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMember" ADD CONSTRAINT "TrainingMember_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLesson" ADD CONSTRAINT "TrainingLesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "TrainingLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TrainingMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "TrainingStandard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionalRequest" ADD CONSTRAINT "RegionalRequest_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionalRequest" ADD CONSTRAINT "RegionalRequest_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AwardProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionalRequest" ADD CONSTRAINT "RegionalRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Athlete" ALTER COLUMN "regionalId" DROP DEFAULT;
