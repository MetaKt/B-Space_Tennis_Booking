-- CreateTable
CREATE TABLE "PaymentSlip" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "PaymentSlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentSlip_bookingId_idx" ON "PaymentSlip"("bookingId");

-- AddForeignKey
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy each booking's existing single slip into the new table
INSERT INTO "PaymentSlip" ("id", "filePath", "uploadedAt", "bookingId")
SELECT gen_random_uuid()::text, "paymentSlip", "updatedAt", "id"
FROM "Booking"
WHERE "paymentSlip" IS NOT NULL;

-- DropColumn
ALTER TABLE "Booking" DROP COLUMN "paymentSlip";
