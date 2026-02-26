# Build Instructions

Read BUILD_SPEC.md completely before starting. That is your full specification.

## Key Points
- This is a Node.js + Express + React + MongoDB app in Docker
- Port 3001
- OCR uses Anthropic Claude Vision API (claude-sonnet-4-20250514 model) via @anthropic-ai/sdk
- 3 sample timesheet images in timesheets/ — test OCR against these
- Gmail integration can be stubbed for now (no credentials yet) — build the service layer but make it work without Gmail connected
- PDF generation: use puppeteer for HTML→PDF, pdf-lib to append timesheet images
- Frontend: React + Tailwind, built and served as static files by Express
- Database: MongoDB 7 in Docker, internal network only

## Build Order
1. Set up package.json with all dependencies
2. Build MongoDB models + connection
3. Build OCR service (Claude Vision) — test against sample images
4. Build PDF generation service
5. Build Express API routes
6. Build React frontend (Overview, Timesheets, Invoices, Payroll, Settings pages)
7. Build Gmail service (stubbed — functional interface, mock implementation)
8. Build cron jobs (email poller, billing cycle)
9. Update Dockerfile and docker-compose.yml
10. Test everything works with docker-compose up

## Notes
- The ANTHROPIC_API_KEY will come from .env
- Don't hardcode any credentials
- Keep PHI out of console.log in production
- Generate a secure DB_PASSWORD in .env.example
- The app should work standalone with just the sample timesheets (manual upload) even without Gmail connected
