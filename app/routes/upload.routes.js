const express = require("express");
var cors = require("cors");
const router = express.Router();
/**Image upload using multer */
var multer = require("multer");
const archiver = require("archiver");
const fs = require('fs');
const path = require("path");
const csv = require("csv-parser");
const csv1 = require("csv-parse");
const xlsx = require('xlsx');
const streamifier = require("streamifier");
const stream = require("stream");
const reader = require("xlsx");
const { v4: uuidv4 } = require('uuid');
const db = require("../models/index");
const { error } = require("console");
const BuildingPermits = require("../models/buildingPermit.model");
const { importFromDirectory, mapRowToDoc, defaultKeyMap } = require('../utils/pastTransactionsImporter');
// const { pastTransaction } = require("../models/past"); // Assuming your model is located in `models`
function createGeoLocation(longitude, latitude) {
  if (!isNaN(longitude) && !isNaN(latitude)) {
    return {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };
  }
  return null; // Return null if coords are invalid
}

function parseDecimalSafe(value) {
  const parsed = parseFloat(value);
  return !isNaN(parsed) && isFinite(parsed) ? parsed : undefined;
}
const normalizeSchoolType = (type) => {
  const map = {
    "Ecole elementaire": "elementarySchool",
    "Collège": "college",
    "Ecole maternelle": "kindergarten",
    "Elementaire/primaire": "elementaryPrimary",
    "Lycée": "highschool",
  };
  return map[type?.trim()] || type?.trim();
};

const normalizeEstType = (type) => {
  const map = {
    "Ecole": "school",
    "Collège": "college",
    "Lycée": "highschool",
  };
  return map[type?.trim()] || type?.trim();
};

const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/static");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// const uploadExcel = multer({ storage: excelStorage, limits: { fileSize: 5242880 } }); // 5 MB limit
const uploadExcel = multer({
  storage: excelStorage,
  limits: { fileSize: 350 * 1024 * 1024 } // 350 MB
});



var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/img");
  },
  filename: (req, file, cb) => {
    // console.log(file);
    var filetype = "";
    let extension = file.originalname.split(".")[1]

    if (file.mimetype === "image/gif") {
      filetype = "gif";
    }
    if (file.mimetype === "image/png") {
      filetype = "png";
    }
    if (file.mimetype === "image/jpeg") {
      filetype = "jpg";
    }
    const randomSuffix = Math.floor(Math.random() * 10000);

    cb(null, "image-" + Date.now() + "-" + randomSuffix + "." + extension);
  },
});
var upload = multer({ storage: storage });

var fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/document");
  },
  filename: (req, file, cb) => {
    console.log(file);
    var ext = file.mimetype.split("/")[1];

    cb(null, "document-" + Date.now() + `.${ext}`);
  },
});
var uploadJson = multer({ storage: fileStorage });

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/videos");
  },
  filename: (req, file, cb) => {
    var ext = file.originalname.split(".").pop(); // Get the file extension from original filename

    cb(null, "video-" + Date.now() + `.${ext}`);
  },
});

const uploadVideo = multer({ storage: videoStorage });

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/audios");
  },
  filename: (req, file, cb) => {
    var ext = file.originalname.split(".").pop(); // Get the file extension from original filename

    cb(null, "audio-" + Date.now() + `.${ext}`);
  },
});

const uploadAudio = multer({ storage: audioStorage });

const storageZip = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e4);
    cb(null, base + "-" + uniqueSuffix + ext);
  }
});
const uploadZip = multer({ storageZip })

// ----------------------------
const uploadDir = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup
const storageCSV = multer.memoryStorage();
const uploadCSV = multer({ storageCSV });

// const uploadSchool = multer({ dest: "uploads/" });
const storageSchool = multer.memoryStorage();
const uploadSchool = multer({ storageSchool });

const stroageEstimationPrice = multer.memoryStorage();
const uploadEstimationPrice = multer({ stroageEstimationPrice });

router.post("/image", upload.single("file"), function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "Please upload a valid file." },
      });
    }
    return res.json({
      success: true,
      filePath: "img/" + req.file.filename,
      fileName: req.file.filename,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: { code: 400, message: error },
    });
  }
});

router.post("/document", uploadJson.single("file"), function (req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 400, message: "Please upload a valid document file." },
    });
  }
  return res.json({
    success: true,
    filePath: "document/" + req.file.filename,
    fileName: req.file.filename,
  });
});

router.post(
  "/multiple-images",
  upload.array("files"), // 'file' is the field name for multiple file
  function (req, res, next) {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "Please upload at least one valid file." },
      });
    }

    const allowedExtensions = [".xlsx", ".csv", ".jpeg", ".jpg", ".pdf", ".png", ".svg"];

    const invalidFiles = req.files.filter((file) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      return !allowedExtensions.includes(ext);
    });

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: `One or more files are not in valid format: ${invalidFiles
            .map((f) => f.originalname)
            .join(", ")}. Allowed: ${allowedExtensions.join(", ")}`
        },
      });
    }
    const fileDetails = req.files.map((files) => ({
      filePath: "img/" + files.filename,
      fileName: files.filename,
      originalname: files.originalname,

    }));

    return res.json({
      success: true,
      files: fileDetails,
    });
  }
);

router.post("/video", uploadVideo.single("file"), function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "Please upload a valid file." },
      });
    }
    return res.json({
      success: true,
      filePath: "videos/" + req.file.filename,
      fileName: req.file.filename,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: { code: 400, message: error },
    });
  }
});
router.post(
  "/multiple-videos",
  uploadVideo.array("files"), // 'file' is the field name for multiple file
  function (req, res, next) {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "Please upload at least one valid file." },
      });
    }
    const fileDetails = req.files.map((files) => ({
      filePath: "videos/" + files.filename,
      fileName: files.filename,
    }));

    return res.json({
      success: true,
      files: fileDetails,
    });
  }
);

router.post("/audio", uploadAudio.single("file"), function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "Please upload a valid file." },
      });
    }
    return res.json({
      success: true,
      filePath: "audios/" + req.file.filename,
      fileName: req.file.filename,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: { code: 400, message: error },
    });
  }
});

router.post("/importPastTransactions", uploadExcel.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 400, message: "Please upload a valid Excel file." },
    });
  }

  console.log("File received:", req.file.originalname, "Size:", req.file.size);

  try {
    const fileLocation = req.file.path;

    let successImport = 0;
    let data = [];
    let isInserting = false; // ✅ prevent parallel inserts


    // Reuse centralized mapping from importer to keep API and CLI aligned
    const keyMap = defaultKeyMap;

    function normalizeDate(value) {
      if (value == null) return null;
      if (!isNaN(value)) {
        const serial = parseFloat(value);
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return date_info.toISOString().split("T")[0];
      }
      return String(value).trim();
    }

    console.log("Starting CSV stream processing...");

    const stream = fs.createReadStream(fileLocation).pipe(csv());

    stream.on("data", async (row) => {
      stream.pause();

      try {
        // ✅ wait if insert is already running
        while (isInserting) {
          await new Promise(r => setTimeout(r, 10));
        }

        row = Object.keys(row).reduce((acc, key) => {
          acc[key.trim().toLowerCase()] = row[key];
          return acc;
        }, {});

        // normalize keys to lowercase trimmed
        const lower = Object.keys(row).reduce((acc, key) => {
          acc[key.trim().toLowerCase()] = row[key];
          return acc;
        }, {});

        const mappedRow = mapRowToDoc(lower, keyMap);
        // For this upload route we may not have year detection; keep existing behavior if missing
        if (!mappedRow.year) mappedRow.year = 2016;

        successImport++;
        data.push(mappedRow);

        // ✅ controlled batch insert
        if (data.length === 200) {
          isInserting = true;

          const batch = data;
          data = []; // free memory early

          try {
            await db.pastTransaction.insertMany(batch, { ordered: false });
            console.log(`Inserted batch of 200. Total: ${successImport}`);
          } catch (err) {
            console.log("Batch error:", err.message);
          }

          isInserting = false;
        }

      } catch (err) {
        console.log("Row error:", err.message);
      }

      stream.resume();
    });

    stream.on("end", async () => {
      try {
        // ✅ wait for any ongoing insert
        while (isInserting) {
          await new Promise(r => setTimeout(r, 50));
        }

        if (data.length > 0) {
          await db.pastTransaction.insertMany(data, { ordered: false });
        }

        console.log("Import completed:", successImport);

        return res.json({
          success: true,
          message: `${successImport} Data Imported successfully in batches of 200`,
        });

      } catch (error) {
        console.log(error, "final insert error");

        return res.status(400).json({
          success: false,
          error: { code: 400, message: error.message },
        });
      }
    });

    stream.on("error", (error) => {
      console.log("Stream error:", error);

      return res.status(400).json({
        success: false,
        error: { code: 400, message: error.message },
      });
    });

  } catch (error) {
    console.log(error, "===============error");

    return res.status(400).json({
      success: false,
      error: { code: 400, message: error.message || "An error occurred during the import." },
    });
  }
});


router.post("/zip-files", async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided."
      });
    }
    const allowedExtensions = [".xlsx", ".csv", ".jpeg", ".jpg", ".pdf", ".png", ".svg"];
    const invalidFiles = files.filter((filename) => {
      const ext = path.extname(filename || "").toLowerCase();
      return !allowedExtensions.includes(ext);
    });

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid file format detected: ${invalidFiles.join(", ")}. Allowed formats are: ${allowedExtensions.join(", ")}`
      });
    }
    // Set headers for ZIP download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=download.zip");

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      res.status(500).send({ success: false, message: "ZIP error", error: err.message });
    });

    archive.pipe(res); // Pipe archive to response

    // Add each file from uploads directory
    files.forEach(filename => {
      const filePath = path.join(__dirname, "../../public/img", filename);
      console.log("Checking:", filePath, fs.existsSync(filePath))
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: filename });
      } else {
        console.warn("File not found:", filePath);
      }
    });

    // Finalize the ZIP archive
    archive.finalize().then(() => {
      console.log("Archive finalized");
    });

  } catch (err) {
    console.error("ZIP creation failed:", err);
    return res.status(500).json({
      success: false,
      message: "Error while creating zip.",
      error: err.message
    });
  }
});

router.post("/importBuildingPermits", uploadCSV.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file not found in memory.",
      });
    }

    const results = [];
    let insertedCount = 0;

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    bufferStream
      .pipe(csv())
      .on("data", (row) => {
        const isValidCoords =
          !isNaN(row.latitude) &&
          !isNaN(row.longitude) &&
          !isNaN(row.xAxis) &&
          !isNaN(row.yAxis);

        if (isValidCoords && insertedCount < 300) {   // here limitter added to limit the number of docs getting added 
          results.push({
            type: "residential",   // demolitionPermit or nonResdential or interiorDesign
            requestType: row.requestType,
            requestId: row.requestId,
            status: parseInt(row.status),
            authorizationDate: row.authorizationDate,
            authorizationYear: parseInt(row.authorizationYear),
            requestSubmissionYear: parseInt(row.requestSubmissionYear),
            requesterName: row.requesterName,
            requesterSiren: parseInt(row.requesterSiren),
            number: parseInt(row.number),
            roadType: row.roadType,
            roadName: row.roadName,
            city: row.city,
            postalCode: parseInt(row.postalCode),
            address: row.address,
            address1: row.address1,
            latitude: row.latitude,
            longitude: row.longitude,
            projectOwner: row.projectOwner,
            xAxis: row.xAxis,
            yAxis: row.yAxis,
            worksStartDate: row.worksStartDate,
            elevationIndicator: row.elevationIndicator === "true",
            additionalLevelCreation: row.additionalLevelCreation === "true",
            highestLevel: row.highestLevel,
          });

          insertedCount++;
        }
      })
      .on("end", async () => {
        if (results.length > 0) {
          await db.buildingPermits.insertMany(results);
        }

        return res.status(200).json({
          success: true,
          inserted: results.length,
          message: "CSV import completed (max 500 rows).",
        });
      })
      .on("error", (err) => {
        console.error("CSV parse error:", err);
        res.status(500).json({
          success: false,
          message: "Failed to parse CSV.",
          error: err.message,
        });
      });
  }
  catch (err) {
    console.error("CSV import failed:", err);
    return res.status(500).json({
      success: false,
      message: "Error while importing building permits.",
      error: err.message,
    });
  }
})



// router.post("/importSchools", uploadSchool.single("file"), async (req, res) => {
//   try {
//     console.log(req.file.buffer);
//     if (!req.file || !req.file.buffer) {
//       return res.status(400).json({
//         success: false,
//         message: "Uploaded file not found in memory."
//       })
//     }


//     const stream = streamifier.createReadStream(req.file.buffer);
//     const chunks = [];

//     stream.on('data', (chunk) => chunks.push(chunk));
//     stream.on('end', async () => {
//       const buffer = Buffer.concat(chunks);
//       const workbook = xlsx.read(buffer, { type: "buffer" });
//       const sheetName = workbook.SheetNames[0];
//       const sheet = workbook.Sheets[sheetName];
//       const rows = xlsx.utils.sheet_to_json(sheet);
//       const results = [];
//       let insertedCount = 0;

//       for (const row of rows) {
//         const isValidCoords =
//           // !isNaN(row.SPI) &&
//           // !isNaN(row.distinctionRate) &&
//           // !isNaN(row.examGrade) &&
//           !isNaN(row.latitude) &&
//           !isNaN(row.longitude) &&
//           // !isNaN(row.successRate) &&
//           !isNaN(row.coordY_origin) &&
//           !isNaN(row.coordX_origin) &&
//           !isNaN(row.numberOfStudents) &&
//           !isNaN(row.postalCode);

//         if (isValidCoords && insertedCount < 2000) {
//           results.push({
//             schoolId: row.schoolId,
//             EstablishmentName: row.EstablishmentName,
//             establishmentType: normalizeEstType(row.establishmentType),
//             schoolStatus: row.schoolStatus,
//             address: row.address,
//             postalCode: Number(row.postalCode),
//             schoolType: normalizeSchoolType(row.schoolType),
//             phone: row.phone,
//             website: row.website,
//             email: row.email,
//             numberOfStudents: parseDecimalSafe(row.numberOfStudents),
//             position: row.position,
//             coordX_origin: parseDecimalSafe(row.coordX_origin),
//             coordY_origin: parseDecimalSafe(row.coordY_origin),
//             latitude: parseDecimalSafe(row.latitude),
//             longitude: parseDecimalSafe(row.longitude),
//             successRate: parseDecimalSafe(row.successRate),
//             examGrade: parseDecimalSafe(row.examGrade),
//             distinctionRate: parseDecimalSafe(row.distinctionRate),
//             SPI: parseDecimalSafe(row.SPI),
//             location: createGeoLocation(row.longitude, row.latitude),
//           });
//           insertedCount++;
//         }
//       }

//       if (results.length > 0) {
//         await db.schools.insertMany(results);
//       }

//       return res.status(200).json({
//         success: true,
//         inserted: results.length,
//         message: "XLSX import completed (max 1200 rows).",
//       });
//     });
//   } catch (err) {
//     console.error("Import error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Something went wrong.",
//       error: err.message,
//     });
//   }
// });



router.post("/importSchools", uploadSchool.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file not found in memory."
      });
    }

    // Parse CSV
    const rows = await new Promise((resolve, reject) => {
      csv1.parse(req.file.buffer.toString(), {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, parsedRows) => {
        if (err) return reject(err);
        resolve(parsedRows);
      });
    });

    console.log("Parsed rows:", rows.length);

    const results = [];

    // Helper functions
    const parseDecimalSafe = (value) => {
      const num = Number(value);
      return isNaN(num) ? null : num;
    };
    const isValidNumber = (num) => typeof num === "number" && !isNaN(num);

    for (const row of rows) {
      const lat = parseDecimalSafe(row.latitude);
      const lng = parseDecimalSafe(row.longitude);
      const coordX = parseDecimalSafe(row.coordX_origin);
      const coordY = parseDecimalSafe(row.coordY_origin);
      const students = parseDecimalSafe(row.numberOfStudents);
      const postal = parseDecimalSafe(row.postalCode);

      if (
        isValidNumber(lat) &&
        isValidNumber(lng) &&
        isValidNumber(coordX) &&
        isValidNumber(coordY) &&
        isValidNumber(students) &&
        isValidNumber(postal)
      ) {
        results.push({
          schoolId: row.schoolId,
          EstablishmentName: row.EstablishmentName,
          establishmentType: normalizeEstType(row.establishmentType),
          schoolStatus: row.schoolStatus,
          address: row.address,
          postalCode: postal,
          schoolType: normalizeSchoolType(row.schoolType),
          phone: row.phone,
          website: row.website,
          email: row.email,
          numberOfStudents: students,
          position: row.position,
          coordX_origin: coordX,
          coordY_origin: coordY,
          latitude: lat,
          longitude: lng,
          successRate: parseDecimalSafe(row.successRate),
          examGrade: parseDecimalSafe(row.examGrade),
          distinctionRate: parseDecimalSafe(row.distinctionRate),
          SPI: parseDecimalSafe(row.SPI),
          location: {
            type: "Point",
            coordinates: [lng, lat], // GeoJSON expects [longitude, latitude]
          },
        });
      }
    }

    // Insert in batches of 200
    // Insert in batches of 200
    let insertedCount = 0;
    for (let i = 0; i < results.length; i += 200) {
      const batch = results.slice(i, i + 200);
      try {
        const inserted = await db.schools.insertMany(batch, { ordered: false });
        insertedCount += inserted.length;
        console.log(`Inserted batch ${i / 200 + 1}: ${inserted.length} records`);
      } catch (err) {
        // Duplicate key errors will be ignored, but log others
        if (err.code === 11000) {
          console.warn("Duplicate key error ignored:", err.message);
        } else {
          console.error("Batch insert error:", err);
        }
      }
    }
    return res.status(200).json({
      success: true,
      inserted: insertedCount,
      message: "CSV import completed in batches of 200.",
    });

  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: err.message,
    });
  }
});

// Admin: trigger import from a local server path (process runs async)
let queue = null;
let jobStore = {}; // in-memory fallback job store when BullMQ not available
try {
  const qmod = require('../queues/importQueue');
  queue = qmod.queue;
} catch (e) {
  console.warn('BullMQ queue not available, falling back to in-process imports');
}

router.post('/admin/importFromLocal', async (req, res) => {
  try {
    const { path: localPath, years, batchSize } = req.body || {};
    if (!localPath || !Array.isArray(years) || years.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide localPath and years[] in body' });
    }

    if (queue) {
      // enqueue job in BullMQ
      const job = await queue.add('import', { localPath, years, batchSize }, { attempts: 3, backoff: { type: 'exponential', delay: 60000 } });

      // persist initial job record in MongoDB for audit & UI
      try {
        if (db && db.importJobs) {
          await db.importJobs.create({ jobId: String(job.id), queueName: 'pastTransactionsImport', status: 'waiting', params: { localPath, years, batchSize } });
        }
      } catch (e) {
        console.error('Failed to persist importJob on enqueue:', e && e.message);
      }

      return res.json({ success: true, jobId: job.id, message: 'Import job enqueued' });
    }

    // Fallback: run import in-process and keep progress in memory
    const jobId = uuidv4();
    jobStore[jobId] = { state: 'running', progress: null, attemptsMade: 0, returnvalue: null };

    (async () => {
      console.log(`[importJob ${jobId}] starting fallback import from ${localPath} years=${years.join(',')}`);
      try {
        const resImport = await importFromDirectory(localPath, years, {
          batchSize: batchSize || 5000,
          onProgress: (info) => {
            jobStore[jobId].progress = info;
          }
        });
        jobStore[jobId].state = 'completed';
        jobStore[jobId].returnvalue = resImport;
        console.log(`[importJob ${jobId}] finished`, resImport);
      } catch (err) {
        console.error(`[importJob ${jobId}] error`, err.message);
        jobStore[jobId].state = 'failed';
        jobStore[jobId].returnvalue = { error: err.message };
      }
    })();

    return res.json({ success: true, jobId, message: 'Import started (fallback in-process)' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: get import job status/progress (supports BullMQ job or fallback in-memory jobStore)
router.get('/admin/importStatus/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (queue) {
      const job = await queue.getJob(jobId);
      if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

      const state = await job.getState();
      // Support both Bull (v3) and BullMQ (v4) job APIs for progress
      let progress = null;
      try {
        if (typeof job.progress === 'function') {
          // Bull v3
          progress = await job.progress();
        } else if (typeof job.asJSON === 'function') {
          const j = await job.asJSON();
          progress = j.progress;
        }
      } catch (e) {
        // best-effort: leave progress null on error
        console.warn('Failed to read job progress', e && e.message);
      }

      // attempts and return value
      let attemptsMade = job.attemptsMade || 0;
      let returnvalue = null;
      try {
        if (typeof job.returnvalue !== 'undefined') returnvalue = job.returnvalue;
        else if (typeof job.asJSON === 'function') {
          const j = await job.asJSON();
          returnvalue = j.returnvalue;
        }
      } catch (e) {
        // ignore
      }

      return res.json({ success: true, jobId, state, progress, attemptsMade, returnvalue });
    }

    const j = jobStore[jobId];
    if (!j) return res.status(404).json({ success: false, message: 'Job not found' });
    return res.json({ success: true, jobId, state: j.state, progress: j.progress, attemptsMade: j.attemptsMade, returnvalue: j.returnvalue });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: list import jobs (most recent first)
router.get('/admin/importJobs', async (req, res) => {
  try {
    const limit = safeParseInt(req.query.limit) || 50;
    if (!db || !db.importJobs) return res.status(500).json({ success: false, message: 'ImportJobs model unavailable' });
    const jobs = await db.importJobs.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ success: true, count: jobs.length, jobs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: retry a previously recorded import job
router.post('/admin/importJobs/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!db || !db.importJobs) return res.status(500).json({ success: false, message: 'ImportJobs model unavailable' });

    const original = await db.importJobs.findOne({ jobId: String(jobId) }).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Original job not found' });

    const params = original.params || {};

    if (queue) {
      const newJob = await queue.add('import', { localPath: params.localPath, years: params.years, batchSize: params.batchSize }, { attempts: 3, backoff: { type: 'exponential', delay: 60000 } });
      try {
        await db.importJobs.create({ jobId: String(newJob.id), queueName: 'pastTransactionsImport', status: 'waiting', params, retriesFrom: String(jobId) });
      } catch (e) {
        console.error('Failed to persist retry importJob:', e && e.message);
      }
      return res.json({ success: true, message: 'Retry enqueued', jobId: newJob.id });
    }

    // fallback: run in-process and persist job document
    const fallbackId = uuidv4();
    try {
      await db.importJobs.create({ jobId: fallbackId, queueName: 'fallback', status: 'running', params, retriesFrom: String(jobId) });
    } catch (e) {
      console.error('Failed to create fallback importJob record:', e && e.message);
    }

    (async () => {
      try {
        const resImport = await importFromDirectory(params.localPath, params.years, {
          batchSize: params.batchSize || 5000,
          onProgress: async (info) => {
            try {
              await db.importJobs.findOneAndUpdate({ jobId: fallbackId }, { $set: { progress: info } }).exec();
            } catch (e) {}
          }
        });
        await db.importJobs.findOneAndUpdate({ jobId: fallbackId }, { $set: { status: 'completed', result: resImport } }).exec();
      } catch (err) {
        console.error('Fallback retry job error:', err && err.message);
        await db.importJobs.findOneAndUpdate({ jobId: fallbackId }, { $set: { status: 'failed', error: { message: err && err.message } } }).exec();
      }
    })();

    return res.json({ success: true, message: 'Retry started (fallback)', jobId: fallbackId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});



function safeParseInt(value) {
  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

// Admin: geo-search endpoint for UI
router.get('/admin/geoSearch', async (req, res) => {
  try {
    const lng = parseFloat(req.query.lng);
    const lat = parseFloat(req.query.lat);
    const maxDistance = parseInt(req.query.maxDistance) || 500; // meters
    const limit = safeParseInt(req.query.limit) || 100;
    const year = req.query.year ? safeParseInt(req.query.year) : null;

    if (!isFinite(lng) || !isFinite(lat)) return res.status(400).json({ success: false, message: 'Provide numeric lng and lat query params' });
    if (!db || !db.pastTransaction) return res.status(500).json({ success: false, message: 'pastTransaction model unavailable' });

    const query = { location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: maxDistance } } };
    if (year) query.year = year;

    const projection = { id_mutation: 1, mutation_date: 1, year: 1, location: 1, land_value_num: 1 };
    const results = await db.pastTransaction.find(query).limit(limit).select(projection).lean();

    return res.json({ success: true, count: results.length, results });
  } catch (err) {
    console.error('geoSearch error:', err && err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/importReferencePrice", uploadEstimationPrice.single("file"), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: "Uploaded file not found in memory." });
  }

  const results = [];
  let insertedCount = 0;

  const bufferStream = new stream.PassThrough();
  bufferStream.end(req.file.buffer);

  bufferStream
    // ensure csv-parser does not auto-cast values
    .pipe(csv({ mapValues: ({ value }) => value }))
    .on("data", (row) => {
      // Pad postalCode to 5 digits if it lost its leading zero
      let postalCode = String(row.postalCode || "").trim();
      if (postalCode && !postalCode.startsWith("0") && postalCode.length === 4) {
        postalCode = postalCode.padStart(5, "0");
      }

      // Same for code_insee (typically 5 chars)
      let code_insee = String(row.code_insee || "").trim();
      if (code_insee && code_insee.length === 4) {
        code_insee = code_insee.padStart(5, "0");
      }

      if (postalCode && !isNaN(parseInt(postalCode, 10))) {
        results.push({
          postalCode, // stays "01400"
          INSEE_COM: safeParseInt(row.INSEE_COM),
          annee: safeParseInt(row.annee),
          nb_mutations: safeParseInt(row.nb_mutations),
          NbMaisons: safeParseInt(row.NbMaisons),
          NbApparts: safeParseInt(row.NbApparts),
          PropMaison: safeParseInt(row.PropMaison),
          PropAppart: safeParseInt(row.PropAppart),
          PrixMoyen: safeParseInt(row.PrixMoyen),
          SurfaceMoy: safeParseInt(row.SurfaceMoy),
          refPrice: safeParseInt(row.price),
          code_insee: row.code_insee || null,
          municipality_name: row.municipality_name || null,
          unique_filter: row.unique_filter || null,
        });
      }
    })
    .on("end", async () => {
      if (results.length > 0) {
        for (let i = 0; i < results.length; i += 200) {
          const batch = results.slice(i, i + 200);
          for (const record of batch) {
            const exists = await db.campaignRefPrice.findOne({ postalCode: record.postalCode });
            if (exists) {
              console.log(`Skipped duplicate postalCode: ${record.postalCode}`);
              continue;
            }
            try {
              await db.campaignRefPrice.insertOne(record);
              insertedCount++;
            } catch (err) {
              console.log(`Skipped invalid record for postalCode ${record.postalCode}: ${err.message}`);
            }
          }
        }
      }
      return res.status(200).json({ success: true, inserted: insertedCount, message: `CSV import completed. Inserted ${insertedCount} records.` });
    });
});

module.exports = router;
