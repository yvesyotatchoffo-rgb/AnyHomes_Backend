/**
 * Weekly Property Digest Cron
 *
 * Runs daily at 08:00. For each user whose weeklyDigest is enabled and
 * whose selected day includes today, sends a recap email:
 *
 *   Template 126 — WEEKLY_DIGEST_WITH_PROPS (owners with at least 1 property)
 *     Sections: top-10 property stats + learning center + platform stats
 *
 *   Template 127 — WEEKLY_DIGEST_NO_PROPS (users with no properties)
 *     Sections: learning center + platform stats
 */

const cron = require('node-cron');
const db = require('../models');
const { sendEmail } = require('../config/brevo.config');
const constants = require('../utls/constants');

// Map JS getDay() (0=Sun) to our day keys
const DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Build per-property stats for the digest (top 10 by recent activity).
 * Returns an HTML table string ready to inject in {{ params.propertiesTable }}.
 */
async function getPropertyStats(userId) {
  const properties = await db.property
    .find({ addedBy: userId, isDeleted: false })
    .sort({ interestUpdatedTime: -1, updatedAt: -1 })
    .limit(10)
    .select('_id propertyTitle propertyType like follow interestUpdatedTime updatedAt')
    .lean();

  if (!properties.length) return null; // null = user has no properties

  const propertyIds = properties.map((p) => p._id);

  const interestCounts = await db.interests.aggregate([
    { $match: { propertyId: { $in: propertyIds }, status: 'active' } },
    { $group: { _id: '$propertyId', count: { $sum: 1 } } },
  ]);
  const interestMap = {};
  interestCounts.forEach(({ _id, count }) => { interestMap[String(_id)] = count; });

  const purple = '#6B21A8';
  const border = '#e5e7eb';
  const light = '#6B7280';
  const dark = '#111827';

  let rows = '';
  properties.forEach((p, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f9fafb';
    const typeLabel = p.propertyType === 'rent' ? 'Location' : 'Vente';
    const likes = Array.isArray(p.like) ? p.like.length : 0;
    const followers = Array.isArray(p.follow) ? p.follow.length : 0;
    const interests = interestMap[String(p._id)] || 0;
    const date = (p.interestUpdatedTime || p.updatedAt || new Date()).toLocaleDateString('fr-FR');
    rows += `<tr style="background:${bg}">` +
      `<td style="padding:10px 12px;border-top:1px solid ${border};color:${dark};font-size:13px"><strong>${p.propertyTitle || '—'}</strong><br/><span style="color:${light};font-size:11px">${typeLabel}</span></td>` +
      `<td style="padding:10px 12px;border-top:1px solid ${border};text-align:center;color:${dark};font-size:13px">${likes}</td>` +
      `<td style="padding:10px 12px;border-top:1px solid ${border};text-align:center;color:${dark};font-size:13px">${followers}</td>` +
      `<td style="padding:10px 12px;border-top:1px solid ${border};text-align:center;color:${purple};font-size:13px;font-weight:bold">${interests}</td>` +
      `<td style="padding:10px 12px;border-top:1px solid ${border};text-align:right;color:${light};font-size:11px">${date}</td>` +
      `</tr>`;
  });

  return `<table style="width:100%;border-radius:8px;overflow:hidden;border:1px solid ${border}" cellpadding="0" cellspacing="0">` +
    `<tr style="background:#F3F4F6">` +
    `<td style="padding:10px 12px;color:${light};font-size:12px;font-weight:bold">Bien</td>` +
    `<td style="padding:10px 12px;color:${light};font-size:12px;font-weight:bold;text-align:center">❤️ Likes</td>` +
    `<td style="padding:10px 12px;color:${light};font-size:12px;font-weight:bold;text-align:center">👁 Suivis</td>` +
    `<td style="padding:10px 12px;color:${light};font-size:12px;font-weight:bold;text-align:center">🎯 Intérêts actifs</td>` +
    `<td style="padding:10px 12px;color:${light};font-size:12px;font-weight:bold;text-align:right">Dernière activité</td>` +
    `</tr>${rows}</table>`;
}

/**
 * Build AnyHomes platform stats for the current week vs previous week.
 * Returns an object with formatted values for all template params.
 */
async function getPlatformStats() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);

  function evol(curr, prev) {
    if (!prev) return { val: curr, evol: curr > 0 ? '+∞' : '—', color: '#6B7280' };
    const pct = Math.round(((curr - prev) / prev) * 100);
    const sign = pct >= 0 ? '+' : '';
    const color = pct > 0 ? '#16A34A' : pct < 0 ? '#DC2626' : '#6B7280';
    return { val: curr, evol: `${sign}${pct}%`, color };
  }

  const [newPropsCurr, newPropsPrev, txSaleCurr, txSalePrev, txRentCurr, txRentPrev, dirCurr, dirPrev] = await Promise.all([
    // Nouveaux biens publiés cette semaine
    db.property.countDocuments({ createdAt: { $gte: weekStart }, isDeleted: false }),
    db.property.countDocuments({ createdAt: { $gte: prevWeekStart, $lt: weekStart }, isDeleted: false }),
    // Transactions conclues — Vente (interestStatus = completed, propertyType != rent)
    db.interests.countDocuments({ interestStatus: 'completed', propertyType: { $ne: 'rent' }, updatedAt: { $gte: weekStart } }),
    db.interests.countDocuments({ interestStatus: 'completed', propertyType: { $ne: 'rent' }, updatedAt: { $gte: prevWeekStart, $lt: weekStart } }),
    // Transactions conclues — Location (interestStatus = completed, propertyType = rent)
    db.interests.countDocuments({ interestStatus: 'completed', propertyType: 'rent', updatedAt: { $gte: weekStart } }),
    db.interests.countDocuments({ interestStatus: 'completed', propertyType: 'rent', updatedAt: { $gte: prevWeekStart, $lt: weekStart } }),
    // Biens publiés en annuaires (directoryPurchaseProsals non vide)
    db.property.countDocuments({ directoryPurchaseProsals: { $exists: true, $not: { $size: 0 } }, isDeleted: false, updatedAt: { $gte: weekStart } }),
    db.property.countDocuments({ directoryPurchaseProsals: { $exists: true, $not: { $size: 0 } }, isDeleted: false, updatedAt: { $gte: prevWeekStart, $lt: weekStart } }),
  ]);

  const newProps = evol(newPropsCurr, newPropsPrev);
  const txSale  = evol(txSaleCurr,   txSalePrev);
  const txRent  = evol(txRentCurr,   txRentPrev);
  const dir     = evol(dirCurr,      dirPrev);

  return {
    statNewProperties:      String(newProps.val),
    statNewPropertiesEvol:  newProps.evol,
    statNewPropertiesColor: newProps.color,
    statTxSale:             String(txSale.val),
    statTxSaleEvol:         txSale.evol,
    statTxSaleColor:        txSale.color,
    statTxRent:             String(txRent.val),
    statTxRentEvol:         txRent.evol,
    statTxRentColor:        txRent.color,
    statDirectory:          String(dir.val),
    statDirectoryEvol:      dir.evol,
    statDirectoryColor:     dir.color,
  };
}

/**
 * Build the learning center section HTML from real DB content.
 * Fetches the 2 most recent active videos + 3 most recent articles.
 */
async function buildLearningSection(frontendUrl) {
  const border  = '#e5e7eb';
  const purple  = '#6B21A8';
  const dark    = '#111827';
  const mid     = '#374151';
  const light   = '#6B7280';
  const grayBg  = '#f9fafb';

  const [videos, articles] = await Promise.all([
    db.funnelUrl.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(2)
      .select('title title_fr youtubeUrl duration image')
      .lean(),
    db.blogs.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('title title_fr banner duration _id')
      .lean(),
  ]);

  let html = '';

  // ── Videos ──────────────────────────────────────────────────────────────────
  if (videos.length) {
    html += `<p style="color:${dark};font-size:14px;font-weight:bold;margin:0 0 10px 0">🎬 Vidéos</p>`;
    html += `<table style="width:100%;border:1px solid ${border};border-radius:8px;overflow:hidden" cellpadding="0" cellspacing="0">`;
    videos.forEach((v, i) => {
      const bg    = i % 2 === 0 ? '#fff' : grayBg;
      const title = v.title_fr || v.title || 'Sans titre';
      const dur   = v.duration ? ` · ${v.duration}` : '';
      const url   = `${frontendUrl}/learning-center`;
      html += `<tr style="background:${bg}${i > 0 ? `;border-top:1px solid ${border}` : ''}">` +
        `<td style="padding:12px 14px;width:28px;font-size:18px">▶️</td>` +
        `<td style="padding:12px 4px 12px 0">` +
        `<a href="${url}" style="color:${purple};font-size:14px;font-weight:bold;text-decoration:none">${title}</a>` +
        `<br/><span style="color:${light};font-size:12px">Vidéo${dur}</span>` +
        `</td></tr>`;
    });
    html += `</table>`;
  }

  // ── Articles ─────────────────────────────────────────────────────────────────
  if (articles.length) {
    html += `<p style="color:${dark};font-size:14px;font-weight:bold;margin:20px 0 10px 0">📝 Articles</p>`;
    html += `<table style="width:100%;border:1px solid ${border};border-radius:8px;overflow:hidden" cellpadding="0" cellspacing="0">`;
    articles.forEach((a, i) => {
      const bg    = i % 2 === 0 ? '#fff' : grayBg;
      const title = a.title_fr || a.title || 'Sans titre';
      const dur   = a.duration ? ` · ${a.duration} min de lecture` : '';
      const url   = `${frontendUrl}/blog-detail?id=${a._id}`;
      html += `<tr style="background:${bg}${i > 0 ? `;border-top:1px solid ${border}` : ''}">` +
        `<td style="padding:12px 14px;width:28px;font-size:18px">📄</td>` +
        `<td style="padding:12px 4px 12px 0">` +
        `<a href="${url}" style="color:${purple};font-size:14px;font-weight:bold;text-decoration:none">${title}</a>` +
        `<br/><span style="color:${light};font-size:12px">Article${dur}</span>` +
        `</td></tr>`;
    });
    html += `</table>`;
  }

  if (!html) {
    html = `<p style="color:${mid};font-size:14px">Aucun contenu disponible cette semaine.</p>`;
  }

  return html;
}

/**
 * Send the weekly digest to a single user.
 * Chooses v1 (with properties) or v2 (no properties) automatically.
 */
async function sendDigestToUser(user, setting) {
  if (!user.email) return;

  const userName = user.fullName || user.firstName || '';
  const digestDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const frontendUrl = process.env.FRONTEND_URL || 'https://app.anyhomes.fr';

  const [propertiesTable, platformStats, learningSection] = await Promise.all([
    getPropertyStats(user._id),
    getPlatformStats(),
    buildLearningSection(frontendUrl),
  ]);

  const hasProperties = propertiesTable !== null;
  const templateId = hasProperties
    ? constants.BREVO.WEEKLY_DIGEST_WITH_PROPS
    : constants.BREVO.WEEKLY_DIGEST_NO_PROPS;

  const params = {
    userName,
    digestDate,
    settingsUrl: `${frontendUrl}/profile/manage-notifications`,
    learningSection,
    ...platformStats,
    ...(hasProperties ? { propertiesTable } : {}),
  };

  try {
    await sendEmail({
      to: [{ email: user.email, name: userName }],
      templateId,
      params,
    });
    console.log(`[WeeklyDigest] Sent to ${user.email} (template=${templateId})`);
  } catch (err) {
    console.error(`[WeeklyDigest] Failed for ${user.email}:`, err.message);
  }
}

/**
 * Main digest job — called by node-cron every day at 08:00.
 */
async function sendWeeklyDigests() {
  const today = DAY_MAP[new Date().getDay()];
  console.log(`[WeeklyDigest] Running for day=${today}`);

  try {
    // Find all settings where weeklyDigest is enabled and today is selected
    // weeklyDigest.day is a single string (e.g. "mon") saved by the frontend
    const settings = await db.setting.find({
      'weeklyDigest.enabled': true,
      'weeklyDigest.day': today,
    }).lean();

    if (!settings.length) {
      console.log('[WeeklyDigest] No users scheduled for today.');
      return;
    }

    const userIds = settings.map((s) => s.user_id);
    const users = await db.users.find({ _id: { $in: userIds }, isDeleted: false })
      .select('_id email fullName firstName')
      .lean();

    const userMap = {};
    users.forEach((u) => { userMap[String(u._id)] = u; });

    let sent = 0;
    for (const setting of settings) {
      const user = userMap[String(setting.user_id)];
      if (!user) continue;
      await sendDigestToUser(user, setting);
      sent++;
    }

    console.log(`[WeeklyDigest] Done — ${sent} email(s) sent.`);
  } catch (err) {
    console.error('[WeeklyDigest] Fatal error:', err.message);
  }
}

/**
 * Register the cron — every day at 08:00 server time.
 */
function startWeeklyDigestCron() {
  cron.schedule('0 8 * * *', sendWeeklyDigests, { timezone: 'Europe/Paris' });
  console.log('[WeeklyDigest] Cron scheduled — daily at 08:00 Europe/Paris');
}

module.exports = { startWeeklyDigestCron, sendWeeklyDigests };
