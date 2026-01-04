import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    await prisma.$runCommandRaw({
        delete: 'Admin',
        deletes: [
            { q: { username: 'admin' }, limit: 1 }
        ]
    });
    console.log('Admin deleted');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
