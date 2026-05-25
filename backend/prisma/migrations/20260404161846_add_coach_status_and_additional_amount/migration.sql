-- CreateEnum
CREATE TYPE "CoachStatus" AS ENUM ('active', 'cancelled', 'changed');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "additionalAmountDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "coachStatus" "CoachStatus" NOT NULL DEFAULT 'active';
