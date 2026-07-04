import { User } from '../models/user.model.js';
import { CHAPELS } from '../config/chapels.js';

const superAdminDefaults = {
  username: 'superadmin',
  password: 'KaloobAdmin2026!',
  role: 'superadmin',
  label: 'Super Admin',
  active: true,
};

export async function seedUsers() {
  const adminHash = await User.hashPassword(process.env.SUPERADMIN_PASSWORD ?? superAdminDefaults.password);
  await User.updateOne(
    { username: superAdminDefaults.username },
    {
      $set: {
        role: 'superadmin',
        label: 'Super Admin',
        active: true,
        passwordHash: adminHash,
      },
    },
    { upsert: true }
  );

  for (const chapel of CHAPELS) {
    const passwordHash = await User.hashPassword(chapel.password);
    await User.updateOne(
      { username: chapel.username.toLowerCase() },
      {
        $setOnInsert: {
          username: chapel.username.toLowerCase(),
          passwordHash,
          role: 'church',
          label: chapel.name,
          churchId: chapel.id,
          active: true,
        },
      },
      { upsert: true }
    );
  }
}
