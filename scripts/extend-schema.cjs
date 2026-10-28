const fs = require('fs');
const file='prisma/schema.prisma'; let s=fs.readFileSync(file,'utf8');
s=s.replace('model Athlete {','model Athlete {\n  sex String @default("UNKNOWN")');
s=s.replace('model Organization {','model Organization {\n  license String?\n  programs String?');
s=s.replace('model TrainingGroup {','model TrainingGroup {\n  disciplineId String');
s=s.replace('model TrainingMember {','model TrainingMember {\n  joinedAt DateTime @default(now())\n  endedAt DateTime?');
s=s.replace('model TrainingLesson {','model TrainingLesson {\n  format String @default("IN_PERSON")\n  evidenceUrl String');
s=s.replace('model TrainingStandard {','model TrainingStandard {\n  disciplineId String\n  sex String\n  minAge Int @default(0)\n  maxAge Int @default(100)\n  active Boolean @default(true)');
s=s.replace('model Assessment {','model Assessment {\n  thresholdSnapshot Float\n  comparisonSnapshot String');
s=s.replace('model RegionalRequest {','model RegionalRequest {\n  competitionId String?\n  evidenceUrls String[]\n  history Json @default("[]")');
s += `
model TrainingTransfer {
  id String @id @default(uuid())
  athleteId String
  fromGroupId String?
  toGroupId String
  approvedById String
  requirements Json
  createdAt DateTime @default(now())
}

model DevelopmentEvidence {
  id String @id @default(uuid())
  year Int
  indicator String
  title String
  url String
  createdById String
  createdAt DateTime @default(now())
}

model AwardRule {
  id String @id @default(uuid())
  band RatingBand
  place Int
  amount Decimal @db.Decimal(12,2)
  source String
  minParticipants Int @default(10)
  active Boolean @default(true)
  @@unique([band, place])
}

model AwardPetition {
  id String @id @default(uuid())
  year Int
  status String @default("PREPARED")
  candidates Json
  history Json
  createdById String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model OidcClient {
  id String @id @default(uuid())
  name String
  redirectUri String
  active Boolean @default(true)
  createdAt DateTime @default(now())
}
model OidcGrant {
  id String @id @default(uuid())
  codeHash String @unique
  userId String
  sessionId String
  clientId String
  redirectUri String
  challenge String
  nonce String
  scope String
  expiresAt DateTime
  usedAt DateTime?
}
model OidcAccessToken {
  id String @id @default(uuid())
  tokenHash String @unique
  userId String
  clientId String
  sessionId String
  scope String
  expiresAt DateTime
}
model OidcSigningKey {
  id String @id
  privateKey String
  publicKey Json
}
model IntegrationToken {
  id String @id @default(uuid())
  name String
  tokenHash String @unique
  scopes String[]
  competitionId String?
  ownerId String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
}
model WebhookSubscription {
  id String @id @default(uuid())
  url String
  secret String
  events String[]
  active Boolean @default(true)
  deliveries WebhookDelivery[]
}
model WebhookDelivery {
  id String @id @default(uuid())
  subscriptionId String
  auditId String
  event String
  payload Json
  attempts Int @default(0)
  nextAttemptAt DateTime @default(now())
  deliveredAt DateTime?
  lastError String?
  subscription WebhookSubscription @relation(fields: [subscriptionId], references: [id])
  @@unique([subscriptionId, auditId])
}
`;
fs.writeFileSync(file,s);
