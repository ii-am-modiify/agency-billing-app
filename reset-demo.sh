#!/bin/bash
# Reset demo database to fresh seeded state
# Runs daily via cron to keep demo clean

echo "[$(date)] Resetting demo database..."

# Run the seed script inside the container (it clears + reseeds)
docker exec billing-demo-app node seed-demo.js 2>&1

echo "[$(date)] Demo reset complete."
