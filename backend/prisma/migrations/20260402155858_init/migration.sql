-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin', 'master_admin');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'th');

-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('hard', 'clay', 'grass', 'synthetic');

-- CreateEnum
CREATE TYPE "Specialization" AS ENUM ('beginner', 'intermediate', 'advanced', 'kids', 'competition', 'fitness', 'strategy');

-- CreateEnum
CREATE TYPE "BookingProvisionStatus" AS ENUM ('provisional', 'confirmed_booking');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('upcoming', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'submitted', 'confirmed', 'refunded');

-- CreateEnum
CREATE TYPE "CoachOption" AS ENUM ('none', 'in_house', 'outside');

-- CreateEnum
CREATE TYPE "SettingCategory" AS ENUM ('court_operations', 'court_management', 'add_ons', 'general', 'payment', 'booking_rules');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "age" INTEGER,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "occupation" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL DEFAULT 'user',
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "courtNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "surface" "Surface" NOT NULL DEFAULT 'hard',
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT NOT NULL DEFAULT '06:00',
    "closeTime" TEXT NOT NULL DEFAULT '22:00',
    "image" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "bio" VARCHAR(1000) NOT NULL DEFAULT '',
    "specialization" "Specialization"[],
    "certifications" TEXT[],
    "yearsOfExperience" INTEGER NOT NULL DEFAULT 0,
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "pricePerSession" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInHouse" BOOLEAN NOT NULL DEFAULT true,
    "maxDailyBookings" INTEGER NOT NULL DEFAULT 8,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachAvailability" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,

    CONSTRAINT "CoachAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'upcoming',
    "bookingStatus" "BookingProvisionStatus" NOT NULL DEFAULT 'provisional',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "coachOption" "CoachOption" NOT NULL DEFAULT 'none',
    "outsideCoachName" TEXT NOT NULL DEFAULT '',
    "courtPrice" DOUBLE PRECISION NOT NULL,
    "coachPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addOnsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "creditUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "addOns" JSONB,
    "paymentSlip" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "coachId" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTP" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" "SettingCategory" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Court_courtNumber_key" ON "Court"("courtNumber");

-- CreateIndex
CREATE INDEX "Coach_isActive_idx" ON "Coach"("isActive");

-- CreateIndex
CREATE INDEX "Coach_pricePerHour_idx" ON "Coach"("pricePerHour");

-- CreateIndex
CREATE INDEX "CoachAvailability_coachId_idx" ON "CoachAvailability"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingId_key" ON "Booking"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_courtId_idx" ON "Booking"("courtId");

-- CreateIndex
CREATE INDEX "Booking_coachId_idx" ON "Booking"("coachId");

-- CreateIndex
CREATE INDEX "Booking_date_idx" ON "Booking"("date");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_bookingStatus_idx" ON "Booking"("bookingStatus");

-- CreateIndex
CREATE INDEX "Booking_expiresAt_idx" ON "Booking"("expiresAt");

-- CreateIndex
CREATE INDEX "OTP_phone_idx" ON "OTP"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "Setting_category_idx" ON "Setting"("category");

-- AddForeignKey
ALTER TABLE "CoachAvailability" ADD CONSTRAINT "CoachAvailability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;
