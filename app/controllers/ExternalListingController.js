const db = require('../models');

module.exports = {
  list: async (req, res) => {
    try {
      const { page = 1, count = 20, search, source } = req.query;
      const pageNumber = Number(page) || 1;
      const pageSize = Number(count) || 20;
      if (pageSize <= 0) pageSize = 20;
      if (pageSize > 100) pageSize = 100;
      const skip = (pageNumber - 1) * pageSize;

      const query = {};
      if (source) query.source = source;
      if (search) {
        query.$or = [
          { sourceId: { $regex: search, $options: 'i' } },
          { reference: { $regex: search, $options: 'i' } },
        ];
      }

      const [data, total] = await Promise.all([
        db.externalListing
          .find(query)
          .populate('propertyId', 'propertyTitle propertyRef price surface rooms city zipcode propertyType type status images')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        db.externalListing.countDocuments(query),
      ]);

      return res.status(200).json({ success: true, data, total, page: pageNumber, limit: pageSize });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  detail: async (req, res) => {
    try {
      const { id } = req.params;
      const listing = await db.externalListing
        .findById(id)
        .populate('propertyId')
        .lean();

      if (!listing) {
        return res.status(404).json({ success: false, message: 'External listing not found' });
      }

      return res.status(200).json({ success: true, data: listing });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
