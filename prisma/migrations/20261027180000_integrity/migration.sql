-- Pending review requests must also be unique under concurrent submissions.
CREATE UNIQUE INDEX "RankApplication_pending_unique"
ON "RankApplication" ("athleteId", "rankType") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "JudgeCategoryApplication_pending_unique"
ON "JudgeCategoryApplication" ("judgeId") WHERE "status" = 'PENDING';
ALTER TABLE "AgeGroup" ADD CONSTRAINT "AgeGroup_valid_bounds"
CHECK ("minAge" IS NULL OR "maxAge" IS NULL OR "minAge" <= "maxAge");
ALTER TABLE "RatingRule" ADD CONSTRAINT "RatingRule_nonnegative_points" CHECK ("points" >= 0);
