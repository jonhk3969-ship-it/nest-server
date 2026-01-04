import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = process.env.ADMIN_PASSWORD;
    const hashedPassword = await bcrypt.hash(password || 'admin123@#$%ERTY#$%^&Cvbnmetewu5w4wytd1234567890-/.,mnbvcxzertyuiop[ytresafghjklt;wsrfdypuij;k4mweasiudc,m,i3i3mdrwuiwerujioewf7hf3nucmwo,mersnhrg45nwunvi', 10);

    // Check if admin exists to avoid P2031 (Transaction req for Upsert on standalone Mongo)
    const existingAdmin = await prisma.admin.findUnique({ where: { username: 'admin' } });

    if (!existingAdmin) {
        try {
            // Use runCommandRaw to bypass P2031 (Transaction requirement) on standalone MongoDB
            // Collection name is 'Admin' based on model name
            await prisma.$runCommandRaw({
                insert: 'Admin',
                documents: [
                    {
                        username: 'admin',
                        password: hashedPassword,
                        role: 'ADMIN',
                        status: true,
                        createdAt: { $date: new Date().toISOString() },
                        updatedAt: { $date: new Date().toISOString() },
                    }
                ]
            });
            console.log('Admin seeded via raw command');
        } catch (e) {
            console.error('Failed to seed admin', e);
        }
    } else {
        console.log('Admin already exists');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
