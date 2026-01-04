require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Testing connection with URL:');
    // Hide password in log
    console.log(process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@'));

    try {
        await prisma.$connect();
        console.log('✅ Connection successful!');

        console.log('Attempting raw command...');
        const result = await prisma.$runCommandRaw({ ping: 1 });
        console.log('✅ Raw command successful:', result);

    } catch (e) {
        console.error('❌ Connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
