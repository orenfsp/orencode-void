const fs = require('fs');
const path = 'prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');
schema = schema.replace('model Athlete {', `model Athlete {
  regionalId String @unique @default(uuid())
  trainingMembers TrainingMember[]
  assessments Assessment[]
  regionalRequests RegionalRequest[]`);
schema = schema.replace('model Organization {', 'model Organization {\n  trainingGroups TrainingGroup[]');
schema = schema.replace('model Coach {', 'model Coach {\n  trainingGroups TrainingGroup[]');
schema = schema.replace('model User {', 'model User {\n  regionalRequests RegionalRequest[]');
schema += `
model TrainingGroup {
  id String @id @default(uuid())
  name String
  organizationId String
  coachId String
  stage String
  organization Organization @relation(fields: [organizationId], references: [id])
  coach Coach @relation(fields: [coachId], references: [id])
  members TrainingMember[]
  lessons TrainingLesson[]
  createdAt DateTime @default(now())
}

model TrainingMember {
  id String @id @default(uuid())
  groupId String
  athleteId String
  group TrainingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  athlete Athlete @relation(fields: [athleteId], references: [id])
  attendance TrainingAttendance[]
  @@unique([groupId, athleteId])
}

model TrainingLesson {
  id String @id @default(uuid())
  groupId String
  startsAt DateTime
  topic String
  minutes Int
  group TrainingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  attendance TrainingAttendance[]
  @@index([groupId, startsAt])
}

model TrainingAttendance {
  id String @id @default(uuid())
  lessonId String
  memberId String
  present Boolean
  lesson TrainingLesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  member TrainingMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([lessonId, memberId])
}

model TrainingStandard {
  id String @id @default(uuid())
  title String
  stage String
  unit String
  threshold Float
  comparison String
  source String
  assessments Assessment[]
  createdAt DateTime @default(now())
}

model Assessment {
  id String @id @default(uuid())
  athleteId String
  standardId String
  value Float
  passed Boolean
  assessedAt DateTime
  assessorId String
  athlete Athlete @relation(fields: [athleteId], references: [id])
  standard TrainingStandard @relation(fields: [standardId], references: [id])
  @@index([athleteId, assessedAt])
}

model AwardProgram {
  id String @id @default(uuid())
  title String
  season Int
  criteria String
  source String
  closesAt DateTime
  requests RegionalRequest[]
}

enum RegionalRequestKind {
  APPEAL
  VIOLATION
  AWARD
}

enum RegionalRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model RegionalRequest {
  id String @id @default(uuid())
  kind RegionalRequestKind
  title String
  description String
  athleteId String?
  programId String?
  submittedById String
  status RegionalRequestStatus @default(PENDING)
  decision String?
  reviewedById String?
  reviewedAt DateTime?
  createdAt DateTime @default(now())
  athlete Athlete? @relation(fields: [athleteId], references: [id])
  program AwardProgram? @relation(fields: [programId], references: [id])
  submittedBy User @relation(fields: [submittedById], references: [id])
  @@index([submittedById, createdAt])
  @@index([kind, status])
}

model TeamScenario {
  id String @id @default(uuid())
  title String
  description String
  steps String
  createdById String
  createdAt DateTime @default(now())
}

model ExternalMapping {
  id String @id @default(uuid())
  system String
  externalId String
  regionalId String
  updatedAt DateTime @updatedAt
  @@unique([system, externalId])
  @@unique([system, regionalId])
}
`;
fs.writeFileSync(path, schema);
