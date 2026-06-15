const path = require('path');
const { Queue, Worker, JobScheduler } = require('bullmq');
const IORedis = require('ioredis');
const { importFromDirectory } = require('../utils/pastTransactionsImporter');
const db = require('../models/index');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let connection;
let queue;
let worker;
const queueName = 'pastTransactionsImport';

try {
  console.log('Initializing BullMQ import queue:', queueName);
  try {
    const bmqPkg = require('bullmq/package.json');
    console.log('Detected bullmq version:', bmqPkg.version);
  } catch (vErr) {
    console.warn('Could not read bullmq package.json:', vErr && vErr.message);
  }

  // Provide explicit ioredis options required by BullMQ (maxRetriesPerRequest must be null)
  const redisOptions = { maxRetriesPerRequest: null };
  console.log('Connecting to Redis at', redisUrl, 'with options', redisOptions);
  connection = new IORedis(redisUrl, redisOptions);

  queue = new Queue(queueName, { connection });

  try {
    if (typeof JobScheduler === 'function') {
      new JobScheduler(queueName, { connection });
      console.log('JobScheduler created for', queueName);
    } else {
      console.warn('JobScheduler not available on bullmq export; skipping scheduler creation');
    }
  } catch (qsErr) {
    console.error('Failed to create JobScheduler:', qsErr && qsErr.message);
    // continue — worker may still operate depending on environment
  }

  worker = new Worker(
    queueName,
    async (job) => {
      console.log('Worker: processing job', job.id, 'data keys:', Object.keys(job.data || {}));
      const { localPath, years } = job.data;

      // run import and report progress via job.updateProgress
      const res = await importFromDirectory(localPath, years, {
        batchSize: job.data.batchSize || 5000,
        onProgress: async (info) => {
          try {
            await job.updateProgress(info);
            console.log('Worker progress update for job', job.id, JSON.stringify(info));
          } catch (e) {
            console.error('Failed to update job progress', e && e.message);
          }
        }
      });

      console.log('Worker: completed import job', job.id, 'result:', res && res.inserted);
      return res;
    },
    { connection }
  );

  worker.on('completed', (job, returnvalue) => {
    console.log(`Import job ${job.id} completed. Inserted:`, returnvalue && returnvalue.inserted);
    // persist to MongoDB job record
    try {
      if (db && db.importJobs) {
        db.importJobs.findOneAndUpdate(
          { jobId: String(job.id) },
          {
            $set: {
              status: 'completed',
              progress: job.progress ? job.progress : { inserted: returnvalue && returnvalue.inserted },
              attemptsMade: job.attemptsMade || 0,
              result: returnvalue,
            }
          },
          { upsert: true }
        ).catch(e => console.error('Failed to update importJob (completed):', e && e.message));
      }
    } catch (e) {
      console.error('Error while persisting job completed state', e && e.message);
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`Import job ${job && job.id} failed:`, err && err.message);
    try {
      if (db && db.importJobs) {
        db.importJobs.findOneAndUpdate(
          { jobId: String(job && job.id) },
          {
            $set: {
              status: 'failed',
              error: { message: err && err.message, stack: err && err.stack },
              attemptsMade: job && job.attemptsMade || 0,
            }
          },
          { upsert: true }
        ).catch(e => console.error('Failed to update importJob (failed):', e && e.message));
      }
    } catch (e) {
      console.error('Error while persisting job failed state', e && e.message);
    }
  });

  worker.on('active', (job) => {
    console.log('Worker active job', job && job.id);
    try {
      if (db && db.importJobs) {
        db.importJobs.findOneAndUpdate(
          { jobId: String(job.id) },
          {
            $set: {
              status: 'active',
              params: job.data,
              attemptsMade: job.attemptsMade || 0,
            }
          },
          { upsert: true }
        ).catch(e => console.error('Failed to update importJob (active):', e && e.message));
      }
    } catch (e) {
      console.error('Error while persisting job active state', e && e.message);
    }
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err && err.message);
  });
} catch (e) {
  console.warn('BullMQ queue not available, falling back to in-process imports', e && e.message);
}

module.exports = { queue, worker, connection };
