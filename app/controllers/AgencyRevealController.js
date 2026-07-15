const db = require('../models');
const { default: mongoose } = require('mongoose');

module.exports = {
  log: async (req, res) => {
    try {
      const { propertyId } = req.body;
      if (!propertyId) {
        return res.status(400).json({ success: false, message: 'propertyId is required' });
      }
      const userId = req.identity?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const property = await db.property.findById(propertyId).lean();
      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      const externalListing = await db.externalListing
        .findOne({ propertyId, source: 'moteurimmo' })
        .lean();

      const agencyName = externalListing?.raw?.publisher?.name || null;

      await db.agencyReveal.create({ propertyId, userId, agencyName });

      return res.status(200).json({
        success: true,
        data: { agencyName },
        message: 'Agency reveal logged',
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  list: async (req, res) => {
    try {
      const { page = 1, count = 20, search } = req.query;
      const pageNumber = Number(page) || 1;
      const pageSize = Number(count) || 20;
      const skip = (pageNumber - 1) * pageSize;

      const query = {};
      if (search) {
        query.$or = [
          { agencyName: { $regex: search, $options: 'i' } },
        ];
      }

      const [data, total] = await Promise.all([
        db.agencyReveal
          .find(query)
          .populate('propertyId', 'propertyTitle propertyRef price surface city zipcode propertyType type images')
          .populate('userId', 'fullName email firstName lastName')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        db.agencyReveal.countDocuments(query),
      ]);

      return res.status(200).json({ success: true, data, total, page: pageNumber, limit: pageSize });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
