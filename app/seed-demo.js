#!/usr/bin/env node
/**
 * Demo Seed Script — generates realistic billing data at scale
 * 50 agencies, 100 clinicians, 3000 patients, Jan 1 - now
 */
const mongoose = require('mongoose');
const Agency = require('./models/agency');
const Clinician = require('./models/clinician');
const Patient = require('./models/patient');
const Timesheet = require('./models/timesheet');
const Invoice = require('./models/invoice');
const BillingPeriod = require('./models/billing-period');
const Settings = require('./models/settings');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://billing:demodemo@localhost:27017/billing_demo?authSource=billing_demo';

// ── Realistic Name Data ──
const FIRST_NAMES = [
  'James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth',
  'William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Christopher','Karen',
  'Charles','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra',
  'Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle',
  'Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa','Timothy','Deborah',
  'Ronald','Stephanie','Edward','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia',
  'Jacob','Kathleen','Gary','Amy','Nicholas','Angela','Eric','Shirley','Jonathan','Anna',
  'Stephen','Brenda','Larry','Pamela','Justin','Emma','Scott','Nicole','Brandon','Helen',
  'Benjamin','Samantha','Samuel','Katherine','Raymond','Christine','Gregory','Debra','Frank','Rachel',
  'Alexander','Carolyn','Patrick','Janet','Jack','Catherine','Dennis','Maria','Jerry','Heather',
  'Tyler','Diane','Aaron','Ruth','Jose','Julie','Adam','Olivia','Nathan','Joyce'
];
const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
  'Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes',
  'Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper',
  'Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson',
  'Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes',
  'Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster','Jimenez'
];

const AGENCY_PREFIXES = [
  'Sunshine','Gulf Coast','Bay Area','Coastal','Premier','Compassionate','Harmony','Platinum',
  'Emerald','Golden','Silver','Diamond','Liberty','Unity','Horizon','Pinnacle','Evergreen',
  'Brightstar','Summit','Clearwater','Lakeside','Riverside','Oceanview','Palm','Tropical',
  'Heritage','Prestige','Elite','Guardian','Sentinel','Beacon','Crestview','Paramount',
  'Sterling','Sapphire','Cornerstone','Keystone','Milestone','Pathways','Bridges',
  'Haven','Oasis','Serenity','Tranquil','Graceful','Vitality','Wellspring','Nurture','Thrive','Uplift'
];
const AGENCY_SUFFIXES = [
  'Home Health','Care Services','Health Agency','Home Care','Nursing Services',
  'Health Solutions','Care Group','Healthcare','Staffing','Medical Services'
];

const FL_CITIES = [
  'Wesley Chapel','Tampa','Clearwater','St. Petersburg','Brandon','Riverview','Land O\' Lakes',
  'Lutz','New Tampa','Odessa','Spring Hill','Brooksville','Zephyrhills','Dade City',
  'Plant City','Lakeland','Winter Haven','Largo','Dunedin','Palm Harbor','Tarpon Springs',
  'Holiday','New Port Richey','Port Richey','Hudson','Trinity','Carrollwood','Temple Terrace',
  'Seffner','Valrico','Lithia','Apollo Beach','Ruskin','Sun City Center','Wimauma',
  'Gibsonton','Riverview','Fish Hawk','Bloomingdale','Citrus Park','Westchase','Oldsmar',
  'Safety Harbor','Seminole','Pinellas Park','Kenneth City','Gulfport','Treasure Island','Madeira Beach','Indian Rocks Beach'
];

const FL_STREETS = [
  'Main St','Oak Ave','Palm Blvd','Cypress Dr','Magnolia Way','Pine Ridge Rd','Lake Shore Dr',
  'Sunset Blvd','Bayshore Blvd','Gulf Blvd','Beach Dr','Harbor View Rd','Meadow Lane',
  'Forest Hill Dr','Country Club Rd','Industrial Blvd','Commerce Park Dr','Professional Pkwy',
  'Medical Center Dr','Healthcare Blvd','Wellness Way','Therapy Ln','Caregiver Ct','Nurses Way'
];

const CARE_TYPES = ['OT', 'PT', 'ST', 'RN', 'LPN', 'HHA', 'MSW', 'COTA', 'PTA'];
const CLINICIAN_TITLES = ['OT', 'PT', 'ST', 'RN', 'LPN', 'HHA', 'MSW', 'COTA', 'PTA', 'OTR/L', 'RPT', 'CCC-SLP'];

const PAY_RATES = {
  'OT': { min: 45, max: 65 }, 'OTR/L': { min: 50, max: 70 }, 'PT': { min: 45, max: 65 },
  'RPT': { min: 50, max: 70 }, 'ST': { min: 50, max: 70 }, 'CCC-SLP': { min: 55, max: 75 },
  'RN': { min: 35, max: 55 }, 'LPN': { min: 25, max: 40 }, 'HHA': { min: 15, max: 25 },
  'MSW': { min: 35, max: 50 }, 'COTA': { min: 30, max: 45 }, 'PTA': { min: 30, max: 45 }
};

const BILLING_RATES = {
  'OT': { min: 75, max: 120 }, 'PT': { min: 75, max: 120 }, 'ST': { min: 80, max: 130 },
  'RN': { min: 60, max: 95 }, 'LPN': { min: 45, max: 70 }, 'HHA': { min: 30, max: 50 },
  'MSW': { min: 60, max: 90 }, 'COTA': { min: 55, max: 85 }, 'PTA': { min: 55, max: 85 }
};

// ── Helpers ──
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }
function fakeName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
function fakeEmail(name, domain) { return `${name.toLowerCase().replace(/[^a-z]/g, '').slice(0,12)}@${domain}`; }
function fakePhone() { return `(${randInt(200,999)}) ${randInt(200,999)}-${String(randInt(1000,9999))}`; }
function fakeAddress() {
  return `${randInt(100,9999)} ${pick(FL_STREETS)}\n${pick(FL_CITIES)}, FL ${randInt(33500,34999)}`;
}
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

// Generate biweekly periods from Jan 1 to now
function generatePeriods() {
  const periods = [];
  let start = new Date('2024-12-22T00:00:00'); // Anchor: aligns Feb 15-28, 2026 as a period
  const now = new Date();
  let idx = 0;
  while (start < now) {
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    end.setHours(23, 59, 59, 999);
    const isClosed = end < now;
    periods.push({
      startDate: new Date(start),
      endDate: new Date(end),
      label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      status: isClosed ? 'invoiced' : 'open',
      invoicesGenerated: isClosed,
      closedAt: isClosed ? end : null
    });
    start = new Date(end);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    idx++;
  }
  return periods;
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected. Clearing existing data...');

  await Promise.all([
    Agency.deleteMany({}), Clinician.deleteMany({}),
    Timesheet.deleteMany({}), Invoice.deleteMany({}),
    BillingPeriod.deleteMany({}), Settings.deleteMany({})
  ]);
  // Clear patients if model exists
  try { await Patient.deleteMany({}); } catch(e) {}

  // ── Settings ──
  await Settings.create([
    { key: 'biller_name', value: 'Tech Adventures Agency Billing System Demo' },
    { key: 'default_billing_rate', value: 85 },
    { key: 'billing_cycle_start', value: '2025-01-01' }
  ]);

  // ── Billing Periods ──
  const periodData = generatePeriods();
  const periods = await BillingPeriod.insertMany(periodData);
  console.log(`Created ${periods.length} billing periods`);

  // ── Agencies ──
  const agencies = [];
  const usedAgencyNames = new Set();
  for (let i = 0; i < 50; i++) {
    let name;
    do {
      name = `${pick(AGENCY_PREFIXES)} ${pick(AGENCY_SUFFIXES)}`;
    } while (usedAgencyNames.has(name));
    usedAgencyNames.add(name);

    const domain = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 15) + '.com';
    const contactName = fakeName();
    const paymentTerms = pick([15, 30, 30, 30, 45, 60]);

    // Build rates map for this agency
    const rates = {};
    for (const ct of CARE_TYPES) {
      const range = BILLING_RATES[ct] || { min: 60, max: 100 };
      rates[ct] = randInt(range.min, range.max);
    }

    agencies.push(await Agency.create({
      name,
      address: '',
      contactName,
      contactEmail: fakeEmail(contactName, domain),
      contactPhone: '',
      paymentTerms,
      billingRate: { default: randInt(70, 110) },
      rates,
      active: true
    }));
  }
  console.log(`Created ${agencies.length} agencies`);

  // ── Clinicians ──
  const clinicians = [];
  for (let i = 0; i < 100; i++) {
    const name = fakeName();
    const title = pick(CLINICIAN_TITLES);
    const rateRange = PAY_RATES[title] || { min: 25, max: 50 };
    const payRate = randFloat(rateRange.min, rateRange.max);

    // Each clinician works for 1-4 agencies
    const numAgencies = randInt(1, 4);
    const clinAgencies = [];
    for (let j = 0; j < numAgencies; j++) {
      const ag = pick(agencies);
      if (!clinAgencies.includes(ag._id)) clinAgencies.push(ag._id);
    }

    clinicians.push(await Clinician.create({
      name,
      title,
      payRate,
      agencies: clinAgencies,
      active: Math.random() > 0.05 // 95% active
    }));
  }
  console.log(`Created ${clinicians.length} clinicians`);

  // ── Patients ──
  const patients = [];
  for (let i = 0; i < 3000; i++) {
    const name = fakeName();
    const agency = pick(agencies);
    patients.push({
      name,
      agencyId: agency._id,
      agencyName: agency.name,
      address: '',
      active: Math.random() > 0.1
    });
  }
  // Try to insert if Patient model exists, otherwise just keep in memory
  try {
    await Patient.insertMany(patients);
    console.log(`Created ${patients.length} patients in DB`);
  } catch(e) {
    console.log(`${patients.length} patients generated (in-memory, no Patient model)`);
  }
  // Group patients by agency
  const patientsByAgency = {};
  for (const p of patients) {
    const aid = p.agencyId.toString();
    if (!patientsByAgency[aid]) patientsByAgency[aid] = [];
    patientsByAgency[aid].push(p);
  }

  // ── Timesheets + Invoices ──
  const TARGET_TIMESHEETS = 20775;
  const closedPeriods = periods.filter(p => p.status === 'invoiced');
  const openPeriods = periods.filter(p => p.status === 'open');

  // Reserve ~600 for open periods (matching ~600/period target)
  const closedTarget = TARGET_TIMESHEETS - 600;

  let timesheetCount = 0;
  let invoiceCount = 0;
  let invoiceNum = 1;

  const perPeriodBudget = Math.floor(closedTarget / closedPeriods.length); // ~672

  for (const period of closedPeriods) {
    if (timesheetCount >= closedTarget) break;

    const periodStart = period.startDate;
    const periodEnd = period.endDate;
    const periodDays = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;
    let periodCount = 0;

    for (const agency of agencies) {
      if (periodCount >= perPeriodBudget) break;
      const agencyPatients = patientsByAgency[agency._id.toString()] || [];
      if (agencyPatients.length === 0) continue;

      const agencyClinicians = clinicians.filter(c =>
        c.agencies.some(a => a.toString() === agency._id.toString())
      );
      if (agencyClinicians.length === 0) continue;

      const isLarge = agencies.indexOf(agency) < 10;
      const maxClinicians = isLarge ? Math.min(agencyClinicians.length, 8) : Math.min(agencyClinicians.length, 4);
      const activeClinicians = agencyClinicians.slice(0, randInt(isLarge ? 5 : 1, maxClinicians));
      const lineItems = [];
      const tsIds = [];

      for (const clin of activeClinicians) {
        if (periodCount >= perPeriodBudget) break;
        const maxVisits = isLarge ? Math.min(10, agencyPatients.length) : Math.min(6, agencyPatients.length);
        const minVisits = isLarge ? 6 : 2;
        const numVisits = randInt(minVisits, maxVisits);
        const visitPatients = [];
        for (let v = 0; v < numVisits; v++) {
          visitPatients.push(pick(agencyPatients));
        }

        for (const pat of visitPatients) {
          if (periodCount >= perPeriodBudget) break;
          const visitDay = randInt(0, periodDays - 1);
          const visitDate = addDays(periodStart, visitDay);
          const hour = randInt(7, 16);
          const durationMins = pick([30, 45, 60, 60, 60, 90, 120]);
          const endHour = hour + Math.floor(durationMins / 60);
          const endMin = durationMins % 60;

          const careType = clin.title.replace('/L', '').replace('R/', '').slice(0, 3).toUpperCase() || 'OT';
          const rate = agency.rates?.get?.(careType) || agency.rates?.[careType] || agency.billingRate?.default || 85;

          const visitData = {
            date: visitDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
            timeIn: `${String(hour).padStart(2, '0')}:${pick(['00', '15', '30'])}`,
            timeOut: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
            durationMinutes: durationMins,
            visitCode: careType
          };

          // Create timesheet
          const ts = await Timesheet.create({
            agencyId: agency._id,
            clinicianId: clin._id,
            billingPeriodId: period._id,
            status: 'invoiced',
            ocrData: {
              patientName: pat.name,
              employeeName: clin.name,
              employeeTitle: clin.title,
              visits: [visitData]
            },
            ocrConfidence: randFloat(0.85, 0.99),
            reviewedAt: addDays(periodEnd, randInt(1, 3))
          });

          tsIds.push(ts._id);
          timesheetCount++;
          periodCount++;

          lineItems.push({
            timesheetId: ts._id,
            patientName: pat.name,
            clinicianName: clin.name,
            clinicianTitle: clin.title,
            date: visitData.date,
            timeIn: visitData.timeIn,
            timeOut: visitData.timeOut,
            durationMinutes: durationMins,
            careType,
            rate,
            amount: rate
          });
        }
      }

      if (lineItems.length === 0) continue;

      const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);

      // Determine invoice status based on age
      const daysSincePeriodEnd = Math.round((new Date() - periodEnd) / (1000 * 60 * 60 * 24));
      let status, paidAt = null, sentAt = null, paidAmount = null;

      if (daysSincePeriodEnd > 45) {
        // Old ones: 80% paid, 15% overdue, 5% sent
        const roll = Math.random();
        if (roll < 0.80) {
          status = 'paid';
          sentAt = addDays(periodEnd, randInt(1, 5));
          paidAt = addDays(sentAt, randInt(7, 35));
          paidAmount = subtotal;
        } else if (roll < 0.95) {
          status = 'overdue';
          sentAt = addDays(periodEnd, randInt(1, 5));
        } else {
          status = 'sent';
          sentAt = addDays(periodEnd, randInt(1, 5));
        }
      } else if (daysSincePeriodEnd > 20) {
        // Recent: 50% paid, 30% sent, 20% overdue
        const roll = Math.random();
        if (roll < 0.50) {
          status = 'paid';
          sentAt = addDays(periodEnd, randInt(1, 3));
          paidAt = addDays(sentAt, randInt(5, 20));
          paidAmount = subtotal;
        } else if (roll < 0.80) {
          status = 'sent';
          sentAt = addDays(periodEnd, randInt(1, 5));
        } else {
          status = 'overdue';
          sentAt = addDays(periodEnd, randInt(1, 3));
        }
      } else {
        // Very recent: 30% sent, 70% draft
        if (Math.random() < 0.3) {
          status = 'sent';
          sentAt = addDays(periodEnd, randInt(1, 3));
        } else {
          status = 'draft';
        }
      }

      const dueDate = addDays(periodEnd, agency.paymentTerms || 30);

      const inv = await Invoice.create({
        invoiceNumber: `INV-2025-${String(invoiceNum++).padStart(4, '0')}`,
        agencyId: agency._id,
        billingPeriodId: period._id,
        timesheetIds: tsIds,
        lineItems,
        subtotal,
        adjustments: 0,
        total: subtotal,
        status,
        dueDate,
        sentAt,
        paidAt,
        paidAmount,
        paymentNotes: status === 'paid' ? pick(['Check received', 'Wire transfer', 'Zelle payment', 'Direct deposit', 'ACH payment', '']) : ''
      });
      invoiceCount++;
    }

    if (timesheetCount % 500 === 0) {
      console.log(`  ...${timesheetCount} timesheets, ${invoiceCount} invoices so far`);
    }
  }

  // Add ~600 timesheets for open period (no invoices yet) — fill to exact target
  for (const period of openPeriods) {
    const periodStart = period.startDate;
    const now = new Date();
    const daysActive = Math.min(14, Math.round((now - periodStart) / (1000 * 60 * 60 * 24)));

    for (const agency of agencies) {
      if (timesheetCount >= TARGET_TIMESHEETS) break;
      const agencyPatients = patientsByAgency[agency._id.toString()] || [];
      const agencyClinicians = clinicians.filter(c =>
        c.agencies.some(a => a.toString() === agency._id.toString())
      ).slice(0, randInt(3, 6));

      for (const clin of agencyClinicians) {
        if (timesheetCount >= TARGET_TIMESHEETS) break;
        const numVisits = randInt(2, 5);
        for (let v = 0; v < numVisits; v++) {
          if (timesheetCount >= TARGET_TIMESHEETS) break;
          const pat = pick(agencyPatients);
          if (!pat) continue;
          const visitDay = randInt(0, Math.max(0, daysActive - 1));
          const visitDate = addDays(periodStart, visitDay);
          const hour = randInt(7, 16);
          const durationMins = pick([30, 45, 60, 60, 90]);

          const careType = clin.title.slice(0, 3).toUpperCase();

          await Timesheet.create({
            agencyId: agency._id,
            clinicianId: clin._id,
            billingPeriodId: period._id,
            status: pick(['processed', 'processed', 'reviewed', 'pending']),
            ocrData: {
              patientName: pat.name,
              employeeName: clin.name,
              employeeTitle: clin.title,
              visits: [{
                date: visitDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
                timeIn: `${String(hour).padStart(2, '0')}:${pick(['00', '15', '30'])}`,
                timeOut: `${String(hour + 1).padStart(2, '0')}:${String(durationMins % 60).padStart(2, '0')}`,
                durationMinutes: durationMins,
                visitCode: careType
              }]
            },
            ocrConfidence: randFloat(0.85, 0.99)
          });
          timesheetCount++;
        }
      }
    }
  }

  // ── Pad to exact target ──
  if (timesheetCount < TARGET_TIMESHEETS) {
    console.log(`  Padding ${TARGET_TIMESHEETS - timesheetCount} timesheets to hit target...`);
    while (timesheetCount < TARGET_TIMESHEETS) {
      const period = pick(closedPeriods);
      const agency = pick(agencies);
      const clin = pick(clinicians);
      const pat = pick(patients);
      const periodStart = period.startDate;
      const periodDays = Math.round((period.endDate - periodStart) / (1000 * 60 * 60 * 24)) + 1;
      const visitDay = randInt(0, periodDays - 1);
      const visitDate = addDays(periodStart, visitDay);
      const hour = randInt(7, 16);
      const durationMins = pick([30, 45, 60, 60, 90]);
      const careType = clin.title.slice(0, 3).toUpperCase();

      await Timesheet.create({
        agencyId: agency._id,
        clinicianId: clin._id,
        billingPeriodId: period._id,
        status: 'invoiced',
        ocrData: {
          patientName: pat.name,
          employeeName: clin.name,
          employeeTitle: clin.title,
          visits: [{
            date: visitDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
            timeIn: `${String(hour).padStart(2, '0')}:${pick(['00', '15', '30'])}`,
            timeOut: `${String(hour + 1).padStart(2, '0')}:${String(durationMins % 60).padStart(2, '0')}`,
            durationMinutes: durationMins,
            visitCode: careType
          }]
        },
        ocrConfidence: randFloat(0.85, 0.99),
        reviewedAt: addDays(period.endDate, randInt(1, 3))
      });
      timesheetCount++;
    }
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`   ${agencies.length} agencies`);
  console.log(`   ${clinicians.length} clinicians`);
  console.log(`   ${patients.length} patients`);
  console.log(`   ${timesheetCount} timesheets`);
  console.log(`   ${invoiceCount} invoices`);
  console.log(`   ${periods.length} billing periods`);

  // Print some stats
  const paidInvoices = await Invoice.countDocuments({ status: 'paid' });
  const totalRevenue = await Invoice.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  const outstanding = await Invoice.aggregate([
    { $match: { status: { $in: ['sent', 'overdue'] } } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);

  console.log(`\n📊 Revenue Stats:`);
  console.log(`   Paid: ${paidInvoices} invoices = $${(totalRevenue[0]?.total || 0).toLocaleString()}`);
  console.log(`   Outstanding: $${(outstanding[0]?.total || 0).toLocaleString()}`);

  await mongoose.disconnect();
  console.log('\nDone!');
}

seed().catch(err => { console.error(err); process.exit(1); });
