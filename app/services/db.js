const mongoose = require('mongoose');

let connected = false;

async function connect() {
  if (connected) return;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable not set');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  connected = true;
  console.log('[DB] Connected to MongoDB');

  mongoose.connection.on('disconnected', () => {
    connected = false;
    console.warn('[DB] Disconnected from MongoDB');
  });

  mongoose.connection.on('reconnected', () => {
    connected = true;
    console.log('[DB] Reconnected to MongoDB');
  });
}

async function disconnect() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

module.exports = { connect, disconnect };
