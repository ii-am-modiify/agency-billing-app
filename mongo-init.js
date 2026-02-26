// MongoDB initialization script — runs inside mongosh on first start
const dbName = process.env.DB_NAME || process.env.MONGO_INITDB_DATABASE || 'billing_automation';
const dbUser = process.env.DB_USER || 'billing';
const dbPass = process.env.DB_PASSWORD || 'changeme';

db = db.getSiblingDB(dbName);

// Create app user
try {
  db.createUser({
    user: dbUser,
    pwd: dbPass,
    roles: [{ role: 'readWrite', db: dbName }]
  });
  print('Created user: ' + dbUser);
} catch(e) {
  print('User may already exist: ' + e.message);
}

db.createCollection('settings');
print('Initialized database: ' + dbName);
