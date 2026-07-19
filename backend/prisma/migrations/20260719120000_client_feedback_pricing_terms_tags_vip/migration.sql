-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'comp';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guestName" TEXT NOT NULL DEFAULT '';

-- AlterTable
-- Convert enum[] to text[] IN PLACE (hand-edited: Prisma's generated diff would
-- DROP and recreate the column, losing every coach's existing tags).
ALTER TABLE "Coach" ALTER COLUMN "specialization" TYPE TEXT[] USING "specialization"::TEXT[];

-- AlterTable
ALTER TABLE "CoachAvailability" ADD COLUMN     "pricePerHour" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "Specialization";

-- CreateTable
CREATE TABLE "CourtPricing" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "courtId" TEXT NOT NULL,

    CONSTRAINT "CourtPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtPricing_courtId_idx" ON "CourtPricing"("courtId");

-- AddForeignKey
ALTER TABLE "CourtPricing" ADD CONSTRAINT "CourtPricing_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;
