// Database connection — migrated from MongoDB/Mongoose to PostgreSQL/Prisma
const prisma = require('../lib/prisma');

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected via Prisma');
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
