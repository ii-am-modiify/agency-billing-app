require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/user');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/billing');
  console.log('Connected to MongoDB');

  const users = [
    { username: 'sandra', password: 'Welcome1!', name: 'Sandra', role: 'admin' },
    { username: 'admin', password: 'Welcome1!', name: 'Admin', role: 'admin' },
  ];

  for (const u of users) {
    const existing = await User.findOne({ username: u.username });
    if (existing) {
      console.log(`  ⏭️  Exists: ${u.username}`);
    } else {
      await User.create(u);
      console.log(`  ✅ Created: ${u.username} (${u.role})`);
    }
  }

  console.log(`Total users: ${await User.countDocuments()}`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
