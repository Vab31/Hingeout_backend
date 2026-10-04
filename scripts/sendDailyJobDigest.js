#!/usr/bin/env node

/**
 * HingeOut Daily Job Digest Automated Batch Dispatcher
 * 
 * Executed via GitHub Actions Cron (Daily at 9:00 AM IST) or manual CLI.
 * 
 * Features:
 * - Reads clean verified subscriber list (CSV / MongoDB)
 * - Checks MongoDB UnsubscribedEmail collection (Suppression List)
 * - Fetches live high-CPC tech opportunities, freshers & internships
 * - Zero mention of external providers (100% HingeOut white-labeled)
 * - Full RFC 8058 1-Click Unsubscribe headers
 * - Controlled concurrency & rate-limit throttling
 * - Detailed execution report & dry-run mode support
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { getTopJobsForDigest, buildSubscriberEmail } = require('../services/jobDigestService');
const UnsubscribedEmail = require('../models/UnsubscribedEmail');

// Parse CLI Arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : parseInt(process.env.BATCH_SIZE, 10) || 500;
const offsetArg = args.find((a) => a.startsWith('--offset='));
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : parseInt(process.env.BATCH_OFFSET, 10) || 0;
const delayArg = args.find((a) => a.startsWith('--delay-ms='));
const DELAY_MS = delayArg ? parseInt(delayArg.split('=')[1], 10) : parseInt(process.env.DELAY_MS, 10) || 100;

const CSV_PATH = path.resolve(__dirname, '../email_cleaning_results/clean_subscribers_50k.csv');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadSuppressionList() {
  const suppressed = new Set();

  if (MONGO_URI) {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      }
      const records = await UnsubscribedEmail.find({}, { email: 1, _id: 0 }).lean();
      records.forEach((r) => suppressed.add(r.email.toLowerCase().trim()));
      console.log(`[Suppression] Loaded ${suppressed.size} unsubscribed users from MongoDB.`);
    } catch (err) {
      console.warn('[Suppression] MongoDB suppression fetch warning (continuing with clean CSV):', err.message);
    }
  }

  return suppressed;
}

async function readSubscribers(csvPath, offset, limit, suppressedSet) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Subscribers CSV file not found at: ${csvPath}`);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const subscribers = [];
  let isHeader = true;
  let currentIndex = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      isHeader = false;
      continue;
    }

    currentIndex++;
    if (currentIndex <= offset) continue;
    if (subscribers.length >= limit) break;

    // Line format: Name,Email,Source
    const parts = line.split(',');
    const name = (parts[0] || '').trim();
    const email = (parts[1] || '').trim().toLowerCase();

    if (email && !suppressedSet.has(email)) {
      subscribers.push({ name: name || 'Valued Candidate', email });
    }
  }

  return subscribers;
}

function createTransporter() {
  if (isDryRun) {
    console.log('🧪 DRY-RUN MODE: Transporter configured in mock simulation mode.');
    return null;
  }

  // 1. Check Standard SMTP configuration
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    console.log(`📧 Connected to Production SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  // 2. Check Gmail App Password fallback
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || process.env.SMTP_PASSWORD;

  if (gmailUser && gmailPass) {
    console.log(`📧 Connected via Gmail SMTP: ${gmailUser}`);
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
  }

  console.warn('⚠️ No SMTP credentials configured. Defaulting to Dry-Run simulation.');
  return null;
}

async function runDailyDigest() {
  const startTime = Date.now();
  console.log('====================================================');
  console.log('🚀 HINGEOUT DAILY JOB ALERT DISPATCHER');
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`⚙️ Mode: ${isDryRun ? 'DRY-RUN SIMULATION' : 'LIVE PRODUCTION SEND'}`);
  console.log(`📊 Target Batch Size: ${BATCH_SIZE} | Offset: ${OFFSET}`);
  console.log('====================================================');

  // 1. Fetch top live opportunities
  console.log('\n[1/4] Fetching top high-CPC tech fresher & internship opportunities...');
  const topJobs = await getTopJobsForDigest(4);
  console.log(`✅ Loaded ${topJobs.length} top curated tech opportunities:`);
  topJobs.forEach((job, i) => {
    console.log(`   ${i + 1}. ${job.title} | ${job.company} | CPC: ₹${job.cpc_rate} | ${job.jobType}`);
  });

  // 2. Load suppression list & target subscribers
  console.log('\n[2/4] Reading clean subscriber list and filtering suppression...');
  const suppressionList = await loadSuppressionList();
  const subscribers = await readSubscribers(CSV_PATH, OFFSET, BATCH_SIZE, suppressionList);
  console.log(`✅ Loaded ${subscribers.length} target subscribers for this batch.`);

  if (subscribers.length === 0) {
    console.log('No eligible subscribers to send to in this batch.');
    process.exit(0);
  }

  // 3. Setup transporter
  console.log('\n[3/4] Initializing email transporter...');
  const transporter = createTransporter();
  const gmailSender = process.env.GMAIL_USER || process.env.SMTP_USER;
  const fromAddress = process.env.SMTP_FROM || (gmailSender ? `HingeOut AI Jobs <${gmailSender}>` : 'HingeOut Jobs <jobs@hingeout.com>');

  // 4. Dispatch batch
  console.log('\n[4/4] Dispatching daily job alerts...');
  let sentCount = 0;
  let failCount = 0;
  const errors = [];

  const BATCH_CHUNK = 10;
  for (let i = 0; i < subscribers.length; i += BATCH_CHUNK) {
    const chunk = subscribers.slice(i, i + BATCH_CHUNK);

    await Promise.all(
      chunk.map(async (sub) => {
        try {
          const emailData = await buildSubscriberEmail({
            email: sub.email,
            name: sub.name,
            jobs: topJobs,
          });

          if (!isDryRun && transporter) {
            await transporter.sendMail({
              from: fromAddress,
              to: sub.email,
              subject: emailData.subject,
              html: emailData.html,
              headers: emailData.headers,
            });
          }

          sentCount++;
        } catch (sendErr) {
          failCount++;
          errors.push({ email: sub.email, error: sendErr.message });
        }
      })
    );

    const progress = Math.min(i + BATCH_CHUNK, subscribers.length);
    const pct = ((progress / subscribers.length) * 100).toFixed(1);
    process.stdout.write(`\r📤 Dispatched: ${progress}/${subscribers.length} [${pct}%] | Sent: ${sentCount} | Failed: ${failCount}`);

    if (DELAY_MS > 0 && i + BATCH_CHUNK < subscribers.length) {
      await sleep(DELAY_MS);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n\n====================================================');
  console.log('🏁 DAILY DISPATCH COMPLETED');
  console.log(`⏱️ Duration: ${durationSec} seconds`);
  console.log(`✅ Total Successfully Dispatched: ${sentCount}`);
  console.log(`❌ Total Failures: ${failCount}`);
  console.log('====================================================');

  // Save execution report
  const reportDir = path.resolve(__dirname, '../email_cleaning_results');
  const reportPath = path.join(reportDir, `daily_dispatch_report_${Date.now()}.json`);
  const reportData = {
    executedAt: new Date().toISOString(),
    isDryRun,
    batchSize: BATCH_SIZE,
    offset: OFFSET,
    totalTargeted: subscribers.length,
    sentCount,
    failCount,
    durationSeconds: parseFloat(durationSec),
    curatedJobs: topJobs.map((j) => ({ id: j.id, title: j.title, company: j.company, cpc: j.cpc_rate })),
    errors: errors.slice(0, 50),
  };

  try {
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`📄 Dispatch report saved to: ${reportPath}`);
  } catch (err) {
    console.warn('Could not save report file:', err.message);
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  process.exit(0);
}

runDailyDigest().catch((err) => {
  console.error('\n💥 Fatal Dispatch Error:', err);
  process.exit(1);
});
