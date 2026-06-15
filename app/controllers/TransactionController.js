const db = require("../models");
const Transaction = db.pastTransaction;
const User = db.users;
const constants = require("../utls/constants");
const mongoose = require("mongoose");

module.exports = {
  transactionList: async (req, res) => {
    try {
      let {
        page,
        count,
        sortBy,
        status,
        number_of_main_pieces,
        year,
        minPrice,
        maxPrice,
        minSurface,
        maxSurface,
        maxDistance,
        userLat,
        userLng,
        local_type,
        loggedInUser,
        q,
        city,
        postal_code,
        postalCode,
        address,
        search
      } = req.query;

      // Priority: use explicit postalCode param if provided by frontend (most reliable)
      // Check for both undefined and empty string cases
      if (postalCode && postalCode?.length > 0 && !postal_code) {
        postal_code = postalCode;
      }
      
      console.log('🔍 [TransactionController] Received params:', { 
        postalCode, 
        postal_code, 
        userLat, 
        userLng, 
        maxDistance,
        search,
        address
      });
      
      // 'search' is the frontend param; treat it as 'address' when address is not set
      let addressFilter = address || search;
      
      // If postal_code is already set (from postalCode param), never apply addressFilter
      // (it would cause a regex on address_channel_name and return 0 results)
      if (postal_code) {
        addressFilter = null;
      }
      
      // Smart postal code detection: if search term looks like a French postal code (5 digits),
      // treat it as exact postal_code match instead of address regex (MUCH faster)
      if (addressFilter && !postal_code && /^\d{5}$/.test(addressFilter)) {
        postal_code = addressFilter;
        addressFilter = null; // Don't apply regex filter
      }
      
      console.log('🔍 [TransactionController] After processing - postal_code:', postal_code, 'addressFilter:', addressFilter);

      var query = {};

      if (local_type) {
        query.local_type = local_type;
      }

      let findUser = null;
      if (loggedInUser) {
        findUser = await db.users
          .findById(loggedInUser)
          .populate('planId')
          .select('otherDetails');

        if (findUser?.planId?.otherDetails?.browsePastTrans?.key === "custom") {
          count = Number(findUser.planId?.otherDetails?.browsePastTrans?.value) || 10;
        }
      }

      var sortquery = {};
      if (sortBy) {
        var order = sortBy.split(" ");
        var field = order[0];
        var sortType = order[1];
        sortquery[field] = sortType === "asc" ? 1 : -1;
      } else {
        // Default sort by _id (always indexed, fast on any collection size)
        sortquery._id = -1;
      }
      const after = req.query.after || null; // cursor-based pagination (after = last _id from previous page)

      if (number_of_main_pieces) {
        const arr = number_of_main_pieces.split(',').map(String);
        query.number_of_main_pieces = { $in: arr };
      }
      // free-text q: search address, city, postal code (case-insensitive)
      if (q) {
        // prefer text index search when available (faster on large collections)
        query.$text = { $search: q };
        // when using text search, if sort not provided, sort by text score
        if (!sortBy) {
          sortquery = { score: { $meta: "textScore" } };
        }
      }

      if (city) {
        query.community_name = { $regex: city, $options: 'i' };
      }

      if (postal_code) {
        query.postal_code = String(postal_code);
      }

      // Only apply address filter if we DON'T have geographic coordinates
      // (geographic search already filters by location via geoNear)
      if (addressFilter && !(userLat && userLng)) {
        query.address_channel_name = { $regex: addressFilter, $options: 'i' };
      }
      if (year) {
        const arr = year.split(',').map(Number);
        query.year = { $in: arr };
      }

      if (minPrice || maxPrice) {
        query.land_value_num = {};
        if (minPrice) query.land_value_num.$gte = Number(minPrice);
        if (maxPrice) query.land_value_num.$lte = Number(maxPrice);
      }

      if (minSurface || maxSurface) {
        query.lot1_surface_carrez_num = {};
        if (minSurface) query.lot1_surface_carrez_num.$gte = Number(minSurface);
        if (maxSurface) query.lot1_surface_carrez_num.$lte = Number(maxSurface);
      }

      if (status) {
        query.status = status;
      }

      let pipeline = [];

      // IMPORTANT: If we have a postal_code filter, DON'T apply geo search
      // (geo search with small radius would return 0 results for a postal code)
      // Postal code search is already handled in the $match stage below
      if (userLat && userLng && !postal_code) {
        pipeline.push({
          $geoNear: {
            near: { type: "Point", coordinates: [Number(userLng), Number(userLat)] },
            distanceField: "distance",
            spherical: true,
            maxDistance: maxDistance ? Number(maxDistance) : undefined
          }
        });
      }

      // IMPORTANT: Put $match BEFORE $facet but NOT $sort (sort goes inside $facet for performance)
      pipeline.push({ $match: query });

      const projectFields = {
        // include id and core fields
        id: "$_id",
          id_mutation: 1,
          mutation_date: 1,
          provision_number: 1,
          nature_mutation: 1,
          land_value: 1,
          address_number: 1,
          address_suffix: 1,
          address_channel_name: 1,
          channel_code_address: 1,
          postal_code: 1,
          // community_code: 1,
          // community_name: 1,
          // department_code: 1,
          // old_community_code: 1,
          // old_community_name: 1,
          plot_id: 1,
          old_plot_id: 1,
          volume_number: 1,
          // lot1_number: 1,
          // lot1_surface_carrez: 1,
          // lot2_number: 1,
          // lot2_surface_carrez: 1,
          // lot3_number: 1,
          // lot3_surface_carrez: 1,
          // lot4_number: 1,
          // lot4_surface_carrez: 1,
          // lot5_number: 1,
          // lot5_surface_carrez: 1,
          number_lots: 1,
          local_type_code: 1,
          year: 1,
          local_type: 1,
          real_built_surface: 1,
          number_of_main_pieces: 1,
          code_nature_culture: 1,
          nature_culture: 1,
          code_nature_culture_special: 1,
          nature_culture_special: 1,
          land_surface: 1,
          longitude: 1,
          latitude: 1,
          createdAt: 1,
          // updatedAt: 1,
          // distance: 1
      };

      // include text score only when a text search was performed
      if (q) {
        projectFields.score = { $meta: "textScore" };
      }

      const projectStage = { $project: projectFields };

      const MAX_PAGES = 100;
      const PAGE_SIZE = 30;
      // Cap page and count: never show more than MAX_PAGES * PAGE_SIZE results
      const pageNum = Math.min(Number(page) || 1, MAX_PAGES);
      const countNum = PAGE_SIZE; // always 30 per page regardless of what frontend sends

      // Fast path: no filters and no geo → use estimatedDocumentCount + simple skip/limit
      // This avoids a full-collection $count scan (which takes ~60s on 5M+ docs)
      const hasFilters = !!(
        userLat || userLng || q || city || postal_code || addressFilter ||
        year || minPrice || maxPrice || minSurface || maxSurface ||
        number_of_main_pieces || status || sortBy
      );

      let data, rawTotal;

      if (!hasFilters) {
        // Ultra-fast unfiltered path
        rawTotal = await Transaction.estimatedDocumentCount();
        const docs = await Transaction.aggregate([
          { $sort: sortquery },
          { $skip: (pageNum - 1) * countNum },
          { $limit: countNum },
          { $project: projectFields }
        ]);
        data = docs;
      } else {
        // Filtered path: use $facet for data + count in one call
        // NOTE: $sort goes INSIDE $facet for performance (only sorts paginated results, not all matching docs)
        if (after) {
          try {
            const op = sortType === 'asc' ? '$gt' : '$lt';
            query._id = { [op]: mongoose.Types.ObjectId(after) };
          } catch (e) { /* ignore invalid ObjectId */ }
          pipeline.push({
            $facet: {
              data: [
                { $sort: sortquery },
                { $limit: countNum },
                projectStage
              ],
              totalCount: [{ $count: 'count' }]
            }
          });
        } else {
          pipeline.push({
            $facet: {
              data: [
                { $sort: sortquery },
                { $skip: (pageNum - 1) * countNum },
                { $limit: countNum },
                projectStage
              ],
              totalCount: [{ $count: 'count' }]
            }
          });
        }

        const [result] = await Transaction.aggregate(pipeline);
        data = result?.data || [];
        rawTotal = result?.totalCount?.[0]?.count || 0;
      }

      // ✅ Keep original plan-based total cap logic unchanged
      let totalCount = rawTotal;
      if (loggedInUser && findUser?.planId?.otherDetails?.browsePastTrans?.key === "custom") {
        totalCount = countNum;
      }

      return res.status(200).json({
        success: true,
        data,
        total: totalCount,
        nextCursor: data.length ? data[data.length - 1]?.id : null,
      });

    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  migrateNumericFieldsFast: async (req, res) => {
    try {
      const WORKERS = 5; // increase if DB can handle
      const BATCH_SIZE = 5000;

      const toNumberOrNull = (val) => {
        if (val === null || val === undefined || val === "") return null;
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
      };

      const total = await Transaction.countDocuments();

      const chunkSize = Math.ceil(total / WORKERS);

      console.log("Total docs:", total);

      for (let w = 0; w < WORKERS; w++) {
        const skip = w * chunkSize;

        processWorker(w, skip, chunkSize);
      }

      async function processWorker(workerId, skip, limit) {
        console.log(`🚀 Worker ${workerId} started`);

        let processed = 0;

        while (true) {
          const docs = await Transaction.find()
            .sort({ _id: 1 })
            .skip(skip + processed)
            .limit(BATCH_SIZE)
            .lean();

          if (!docs.length) {
            console.log(`✅ Worker ${workerId} done`);
            break;
          }

          const bulkOps = docs.map(doc => ({
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: {
                  land_value_num: toNumberOrNull(doc.land_value),
                  lot1_surface_carrez_num: toNumberOrNull(doc.lot1_surface_carrez),
                  real_built_surface_num: toNumberOrNull(doc.real_built_surface),
                  number_of_main_pieces_num: toNumberOrNull(doc.number_of_main_pieces),
                  land_surface_num: toNumberOrNull(doc.land_surface),
                  longitude_num: toNumberOrNull(doc.longitude),
                  latitude_num: toNumberOrNull(doc.latitude)
                }
              }
            }
          }));

          await Transaction.bulkWrite(bulkOps, { ordered: false });

          processed += docs.length;

          console.log(
            `Worker ${workerId} | batch done: ${docs.length} | total: ${processed}`
          );
        }
      }

      return res.json({
        success: true,
        message: "Fast parallel migration started"
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
};
