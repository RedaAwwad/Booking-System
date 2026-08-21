import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';
import { User } from '../modules/user/entities/user.entity';
import { Customer } from '../modules/customer/entities/customer.entity';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────
const SEED_COUNT = parseInt(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] ?? '100');
const BCRYPT_ROUNDS = 10;
const SEED_PASSWORD = 'SeedPassword123!'; // same password for all seeded users — easy to use in k6

// ─── DB Connection ────────────────────────────────────────────────────────────
// Running seed from HOST (not inside Docker), so connect via the exposed port.
// Your docker-compose.yml maps DATABASE_LOCAL_PORT=5434 → container:5432
// so localhost:5434 is how the host reaches the postgres container.
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST_OVERRIDE ?? 'localhost',  // always localhost when run from host
  port: parseInt(process.env.DATABASE_LOCAL_PORT ?? '5434'), // exposed port from docker-compose
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? '01284842880',
  database: process.env.DATABASE_NAME ?? 'booking',
  entities: [User, Customer],
  synchronize: false,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generatePhone(): string {
  // Generates a phone like +201234567890 (20 chars max to fit varchar(20))
  return `+20${faker.string.numeric(10)}`;
}

function generateAddresses() {
  return [
    {
      label: faker.helpers.arrayElement(['Home', 'Work', 'Other']),
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      country: faker.location.country(),
      zip: faker.location.zipCode(),
    },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🌱 Starting seed — target: ${SEED_COUNT} users\n`);

  await AppDataSource.initialize();
  console.log('✅ Database connected\n');

  const userRepo = AppDataSource.getRepository(User);
  const customerRepo = AppDataSource.getRepository(Customer);

  // Hash password once — reuse for all users (bcrypt is slow by design)
  console.log('🔐 Hashing seed password...');
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);
  console.log('✅ Password hashed\n');

  // ── Verify the customer role key exists in the DB before inserting ──────────
  // Change 'customer' below if your RoleKey enum uses a different value e.g. 'CUSTOMER'
  const CUSTOMER_ROLE_KEY = 'CUSTOMER';
  const roleExists = await AppDataSource.query(
    `SELECT id FROM roles WHERE key = $1 LIMIT 1`,
    [CUSTOMER_ROLE_KEY],
  );
  if (roleExists.length === 0) {
    console.error(`❌ Role "${CUSTOMER_ROLE_KEY}" not found in roles table. Check your RoleKey enum value.`);
    console.error(`   Run: SELECT key FROM roles; — to see what keys exist.`);
    await AppDataSource.destroy();
    process.exit(1);
  }
  console.log(`✅ Role "${CUSTOMER_ROLE_KEY}" confirmed in DB\n`);

  let createdUsers = 0;
  let skippedUsers = 0;

  const BATCH_SIZE = 50; // insert in batches to avoid memory spikes

  for (let batch = 0; batch < Math.ceil(SEED_COUNT / BATCH_SIZE); batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, SEED_COUNT);

    const usersToInsert: Partial<User>[] = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const userIndex = i + 1;                          // 1-based → perf_user_1, perf_user_2 ...
      const email = `perf_user_${userIndex}@test.local`; // matches getSeededUserBatch() template
      const name = `Perf User ${userIndex}`;

      // Idempotency: skip if email already exists
      const existing = await userRepo.findOne({ where: { email } });
      if (existing) {
        skippedUsers++;
        continue;
      }

      usersToInsert.push({
        name,
        email,
        password: hashedPassword,
        isActive: true,
        isConfirmed: true,                   // ← skip email verification for stress tests
        isAdmin: false,
        roles: [CUSTOMER_ROLE_KEY],    // ← assigns customer role
      });
    }

    if (usersToInsert.length === 0) continue;

    // Insert users
    const savedUsers = await userRepo.save(usersToInsert);
    createdUsers += savedUsers.length;

    // Insert matching Customer profile for each user
    const customersToInsert: Partial<Customer>[] = savedUsers.map(user => ({
      userId: user.id,
      phone: generatePhone(),
      addresses: generateAddresses(),
      deactivatedAt: null,
    }));

    await customerRepo.save(customersToInsert);

    console.log(`📦 Batch ${batch + 1}: inserted ${savedUsers.length} users (total: ${createdUsers}/${SEED_COUNT})`);
  }

  console.log(`\n✅ Seed complete`);
  console.log(`   Created  : ${createdUsers} users`);
  console.log(`   Skipped  : ${skippedUsers} (already existed)`);
  console.log(`   Emails   : perf_user_1@test.local → perf_user_${SEED_COUNT}@test.local`);
  console.log(`   Password : "${SEED_PASSWORD}" — use this in your k6 scripts\n`);

  await AppDataSource.destroy();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});