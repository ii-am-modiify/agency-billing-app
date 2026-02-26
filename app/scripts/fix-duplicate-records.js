#!/usr/bin/env node
/**
 * One-time cleanup: find and fix duplicate clinicalRecordNumber values.
 * Keeps the record number on the first (oldest) patient, clears it on duplicates.
 * Run inside the container: node scripts/fix-duplicate-records.js
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/billing';

async function main() {
  await mongoose.connect(MONGO_URI);
  const Patient = require('../models/patient');

  // Find duplicate clinical record numbers
  const dupes = await Patient.aggregate([
    { $match: { clinicalRecordNumber: { $ne: null, $ne: '' } } },
    { $group: { _id: '$clinicalRecordNumber', count: { $sum: 1 }, ids: { $push: '$_id' }, names: { $push: '$name' } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (dupes.length === 0) {
    console.log('✅ No duplicate clinical record numbers found.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${dupes.length} duplicate record number(s):\n`);

  for (const dupe of dupes) {
    console.log(`Record #${dupe._id} — used by ${dupe.count} patients: ${dupe.names.join(', ')}`);
    // Keep it on the oldest patient, clear from the rest
    const patients = await Patient.find({ _id: { $in: dupe.ids } }).sort({ createdAt: 1 });
    const keeper = patients[0];
    console.log(`  → Keeping on: ${keeper.name} (${keeper._id})`);
    for (let i = 1; i < patients.length; i++) {
      console.log(`  → Clearing from: ${patients[i].name} (${patients[i]._id})`);
      patients[i].clinicalRecordNumber = null;
      await patients[i].save();
    }
  }

  console.log('\n✅ Done. Duplicates cleared.');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
