const db = require('../models');

module.exports = {
  stats: async (req, res) => {
    try {
      const [externalCount, propertyCount, runStats, recentRuns, recentChanges] = await Promise.all([
        db.externalListing.countDocuments({ source: 'moteurimmo' }),
        db.property.countDocuments({ importBy: 'platform', propertyType: { $in: ['sale', 'rent'] } }),
        db.importRun.aggregate([
          { $match: { source: 'moteurimmo' } },
          { $group: {
              _id: null,
              totalRuns: { $sum: 1 },
              failedRuns: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              totalItems: { $sum: '$totalCount' },
          }},
        ]),
        db.importRun.find({ source: 'moteurimmo' }).sort({ startDate: -1 }).limit(5).lean(),
        db.timeline.find({ type: { $in: ['priceChanged', 'statusChanged', 'photosAdded', 'moteurimmoLeavingMarket', 'propertyCreated'] } })
          .sort({ createdAt: -1 }).limit(10).populate('propertyId', 'propertyTitle price city propertyType').lean(),
      ]);

      const runAgg = runStats[0] || { totalRuns: 0, failedRuns: 0, totalItems: 0 };
      const successRate = runAgg.totalRuns > 0 ? Math.round(((runAgg.totalRuns - runAgg.failedRuns) / runAgg.totalRuns) * 100) : 100;

      const runsTimeline = await db.importRun.aggregate([
        { $match: { source: 'moteurimmo', startDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$startDate' } },
            count: { $sum: 1 },
            totalItems: { $sum: '$totalCount' },
        }},
        { $sort: { _id: 1 } },
      ]);

      return res.status(200).json({ success: true, data: {
        totalExternalListings: externalCount,
        totalPropertiesImported: propertyCount,
        totalRuns: runAgg.totalRuns,
        failedRuns: runAgg.failedRuns,
        totalItemsImported: runAgg.totalItems,
        successRate,
        lastRuns: recentRuns,
        recentChanges,
        runsTimeline,
      }});
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
