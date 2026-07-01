-- Remove avatar feature: drop avatar columns from User and Coach
ALTER TABLE "User" DROP COLUMN "avatar";
ALTER TABLE "Coach" DROP COLUMN "avatar";
