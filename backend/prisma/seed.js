// Prisma seed script — replaces utils/seed.js (Mongoose version)
// Run with: npm run seed
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const seedDB = async () => {
  try {
    console.log('Seeding database...');

    // Clear all tables in dependency order (relations first)
    await prisma.booking.deleteMany({});
    await prisma.oTP.deleteMany({});
    await prisma.coachAvailability.deleteMany({});
    await prisma.coach.deleteMany({});
    await prisma.court.deleteMany({});
    await prisma.setting.deleteMany({});
    await prisma.user.deleteMany({});

    // ─── Users ──────────────────────────────────────────────
    const masterAdmin = await prisma.user.create({
      data: {
        name: 'Master Admin',
        phone: '0800000001',
        email: 'master@tenniscourt.com',
        role: 'master_admin',
        preferredLanguage: 'en',
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Staff',
        phone: '0800000002',
        email: 'admin@tenniscourt.com',
        role: 'admin',
        preferredLanguage: 'en',
      },
    });

    await prisma.user.create({
      data: {
        name: 'John Player',
        phone: '0891234567',
        email: 'john@example.com',
        role: 'user',
        credit: 500,
        preferredLanguage: 'en',
      },
    });

    console.log('✓ Users seeded');

    // ─── Courts ─────────────────────────────────────────────
    await prisma.court.createMany({
      data: [
        { courtNumber: 1, name: 'Court A', surface: 'hard',      pricePerHour: 300, description: 'Premium hard court with lighting',  openTime: '06:00', closeTime: '22:00' },
        { courtNumber: 2, name: 'Court B', surface: 'hard',      pricePerHour: 300, description: 'Hard court with covered seating',   openTime: '06:00', closeTime: '22:00' },
        { courtNumber: 3, name: 'Court C', surface: 'clay',      pricePerHour: 400, description: 'Professional clay court',           openTime: '07:00', closeTime: '21:00' },
        { courtNumber: 4, name: 'Court D', surface: 'synthetic', pricePerHour: 250, description: 'Synthetic practice court',          openTime: '06:00', closeTime: '22:00' },
      ],
    });

    console.log('✓ Courts seeded');

    // ─── Coaches (with nested availability) ─────────────────
    await prisma.coach.create({
      data: {
        name: 'Somchai Rakdee',
        nickname: 'Coach Som',
        phone: '0811111111',
        email: 'somchai@tennis.com',
        bio: 'Professional tennis coach with 15 years of experience. Former national team player.',
        specialization: ['advanced', 'competition', 'strategy'],
        certifications: ['ITF Level 3', 'Thai Tennis Association Certified'],
        yearsOfExperience: 15,
        pricePerHour: 500,
        pricePerSession: 800,
        rating: 4.8,
        totalReviews: 120,
        isInHouse: true,
        maxDailyBookings: 6,
        availability: {
          create: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 4, startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 5, startTime: '08:00', endTime: '18:00' },
            { dayOfWeek: 6, startTime: '09:00', endTime: '15:00' },
          ],
        },
      },
    });

    await prisma.coach.create({
      data: {
        name: 'Nattaporn Srivilai',
        nickname: 'Coach Nat',
        phone: '0822222222',
        email: 'nat@tennis.com',
        bio: 'Specializing in beginner and intermediate coaching. Patient and encouraging teaching style.',
        specialization: ['beginner', 'intermediate', 'kids'],
        certifications: ['ITF Level 2', 'CPR Certified'],
        yearsOfExperience: 8,
        pricePerHour: 400,
        pricePerSession: 600,
        rating: 4.9,
        totalReviews: 85,
        isInHouse: true,
        maxDailyBookings: 8,
        availability: {
          create: [
            { dayOfWeek: 0, startTime: '09:00', endTime: '16:00' },
            { dayOfWeek: 1, startTime: '09:00', endTime: '19:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '19:00' },
            { dayOfWeek: 3, startTime: '09:00', endTime: '19:00' },
            { dayOfWeek: 4, startTime: '09:00', endTime: '19:00' },
            { dayOfWeek: 5, startTime: '09:00', endTime: '19:00' },
            { dayOfWeek: 6, startTime: '09:00', endTime: '16:00' },
          ],
        },
      },
    });

    await prisma.coach.create({
      data: {
        name: 'Wichai Thammasat',
        nickname: 'Coach Wi',
        phone: '0833333333',
        email: 'wichai@tennis.com',
        bio: 'Fitness-focused tennis coaching. Combines tennis skills with physical conditioning.',
        specialization: ['intermediate', 'advanced', 'fitness'],
        certifications: ['ITF Level 2', 'NSCA Certified Strength Coach'],
        yearsOfExperience: 10,
        pricePerHour: 450,
        pricePerSession: 700,
        rating: 4.7,
        totalReviews: 62,
        isInHouse: true,
        maxDailyBookings: 6,
        availability: {
          create: [
            { dayOfWeek: 1, startTime: '06:00', endTime: '14:00' },
            { dayOfWeek: 2, startTime: '06:00', endTime: '14:00' },
            { dayOfWeek: 3, startTime: '06:00', endTime: '14:00' },
            { dayOfWeek: 4, startTime: '06:00', endTime: '14:00' },
            { dayOfWeek: 5, startTime: '06:00', endTime: '14:00' },
          ],
        },
      },
    });

    console.log('✓ Coaches seeded');

    // ─── Settings ────────────────────────────────────────────
    await prisma.setting.createMany({
      data: [
        // Court operations
        { key: 'booking_advance_days', value: 14,     category: 'court_operations', label: 'Advance Booking Days',        description: 'How many days in advance can users book' },
        { key: 'min_booking_hours',    value: 1,      category: 'court_operations', label: 'Minimum Booking Hours',       description: 'Minimum hours per booking' },
        { key: 'max_booking_hours',    value: 4,      category: 'court_operations', label: 'Maximum Booking Hours',       description: 'Maximum hours per booking' },
        { key: 'cancellation_hours',   value: 24,     category: 'court_operations', label: 'Cancellation Window (hours)', description: 'Hours before booking that cancellation is allowed' },

        // Add-ons (object values stored as JSONB)
        { key: 'add_on_ball_rental',  value: { name: 'Ball Rental',  price: 50,  available: true }, category: 'add_ons', label: 'Tennis Ball Rental' },
        { key: 'add_on_racket_rental',value: { name: 'Racket Rental',price: 100, available: true }, category: 'add_ons', label: 'Racket Rental' },
        { key: 'add_on_towel',        value: { name: 'Towel Service',price: 30,  available: true }, category: 'add_ons', label: 'Towel Service' },
        { key: 'add_on_water',        value: { name: 'Water Bottle', price: 20,  available: true }, category: 'add_ons', label: 'Water Bottle' },
        { key: 'add_on_ball_machine', value: { name: 'Ball Machine', price: 200, available: true }, category: 'add_ons', label: 'Ball Machine Rental' },

        // Payment
        { key: 'payment_qr_image',      value: '/uploads/payment-qr.png', category: 'payment', label: 'Payment QR Code Image' },
        { key: 'payment_bank_name',     value: 'Bangkok Bank',            category: 'payment', label: 'Bank Name' },
        { key: 'payment_account_number',value: '123-456-7890',            category: 'payment', label: 'Account Number' },
        { key: 'payment_account_name',  value: 'Tennis Court Co., Ltd.',  category: 'payment', label: 'Account Name' },

        // Booking rules
        { key: 'outside_coach_allowed', value: true, category: 'booking_rules', label: 'Allow Outside Coaches' },
        { key: 'outside_coach_fee',     value: 100,  category: 'booking_rules', label: 'Outside Coach Fee',     description: 'Additional fee for bringing outside coach' },
        { key: 'credit_on_cancel',      value: true, category: 'booking_rules', label: 'Credit on Cancellation',description: 'Refund as credit on cancellation' },
      ],
    });

    console.log('✓ Settings seeded');

    console.log('\n========================================');
    console.log('  Database seeded successfully!');
    console.log('========================================');
    console.log(`  Master Admin Phone : ${masterAdmin.phone}`);
    console.log(`  Admin Phone        : ${admin.phone}`);
    console.log('  Sample User Phone  : 0891234567');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedDB();
