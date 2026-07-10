#!/usr/bin/env node
/**
 * Image downloader for MoteurImmo (and web-scraper) imported properties.
 *
 * Pipeline:
 *   1. sync.js pushes a placeholder { originalname: <sourceUrl>, status: 'queued' } into property.images
 *      and creates a mediaJob document with originalUrl = sourceUrl.
 *   2. This script finds mediaJob documents with status 'queued', downloads the image
 *      from originalUrl, saves it to public/img/, then updates the property image subdoc:
 *        { originalname: <sourceUrl>, file: <localFileName>, status: 'done' }
 *      The `file` field is what the frontend (noImg / ImageSlider) reads to build the URL.
 *
 * Can be used two ways:
 *   - CLI:  node scripts/image_downloader.js   (connects/disconnects mongoose itself)
 *   - Agenda job: require this module and call processQueuedImages() (mongoose already connected)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');
const moteuService = require('../app/services/moteurimmo.service');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');

const IMAGE_WORKERS = Number(process.env.IMAGE_WORKERS || 4);
const MAX_JOBS = Number(process.env.MAX_IMAGE_JOBS || 50);

async function ensurePublicImg() {
  const publicImg = path.join(process.cwd(), 'public', 'img');
  if (!fs.existsSync(publicImg)) fs.mkdirSync(publicImg, { recursive: true });
  return publicImg;
}

async function downloadToLocal(url, destFolder) {
  try {
    const res = await moteuService.client.get(url, { responseType: 'stream', timeout: 30000 });
    const rawName = path.basename(url.split('?')[0]) || 'img';
    const fileName = `${Date.now()}_${sanitize(rawName)}`;
    const destPath = path.join(destFolder, fileName);
    const writer = fs.createWriteStream(destPath);
    res.data.pipe(writer);
    await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
    return destPath;
  } catch (err) {
    throw err;
  }
}

async function processJob(job) {
  const publicImg = await ensurePublicImg();
  try {
    await db.mediaJob.updateOne({ _id: job._id }, { $set: { status: 'downloading' }, $inc: { attempts: 1 } });
    const saved = await downloadToLocal(job.originalUrl, publicImg);
    const fileName = path.basename(saved);
    await db.mediaJob.updateOne({ _id: job._id }, { $set: { status: 'done', localPath: saved, lastError: null } });
    if (job.propertyId) {
      const updated = await db.property.updateOne(
        { _id: job.propertyId, 'images.originalname': job.originalUrl },
        { $set: { 'images.$.file': fileName, 'images.$.fileName': fileName, 'images.$.status': 'done' } }
      );
      if (updated.nModified === 0) {
        await db.property.updateOne(
          { _id: job.propertyId },
          { $push: { images: { file: fileName, fileName: fileName, originalname: job.originalUrl, status: 'done' } } }
        );
      }
    }
    console.log('Downloaded', job.originalUrl, '->', saved);
  } catch (err) {
    console.warn('Job failed', job._id.toString(), job.originalUrl, err && err.message);
    await db.mediaJob.updateOne({ _id: job._id }, { $set: { status: 'failed', lastError: err && err.message } });
  }
}

async function processQueuedImages() {
  const jobs = await db.mediaJob.find({ status: 'queued' }).limit(MAX_JOBS).lean();
  if (!jobs || jobs.length === 0) {
    console.log('No queued media jobs found');
    return 0;
  }
  console.log('Found', jobs.length, 'jobs; processing with concurrency', IMAGE_WORKERS);
  let idx = 0;
  async function worker() {
    while (true) {
      const job = jobs[idx++];
      if (!job) return;
      await processJob(job);
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(IMAGE_WORKERS, jobs.length); i++) workers.push(worker());
  await Promise.all(workers);
  console.log('All jobs processed');
  return jobs.length;
}

module.exports = { processQueuedImages, processJob };

async function run() {
  await mongoose.connect(db.url, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await processQueuedImages();
    await mongoose.disconnect();
  } catch (err) {
    console.error('Worker failed', err && err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}