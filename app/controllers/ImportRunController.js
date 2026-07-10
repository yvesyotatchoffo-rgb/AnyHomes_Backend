const db = require('../models');

module.exports = {
  list: async (req, res) => {
    try {
      const { page = 1, count = 20, source } = req.query;
      const pageNumber = Number(page) || 1;
      const pageSize = Number(count) || 20;
      if (pageSize <= 0) pageSize = 20;
      if (pageSize > 100) pageSize = 100;
      const skip = (pageNumber - 1) * pageSize;

      const query = {};
      if (source) query.source = source;

      const [data, total] = await Promise.all([
        db.importRun
          .find(query)
          .sort({ startDate: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        db.importRun.countDocuments(query),
      ]);

      return res.status(200).json({ success: true, data, total, page: pageNumber, limit: pageSize });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
