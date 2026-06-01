const db = require("../models");
const Users = db.users;
var bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("../utls/constants");
const Emails = require("../Emails/onBoarding");
const helper = require("../utls/helper");
var mongoose = require("mongoose");
const multer = require("multer");
const csvParser = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { createObjectCsvStringifier } = require('csv-writer');
const { Readable } = require('stream');
const fs = require("fs");

const upload = multer({
    dest: "uploads/", // Destination folder
    limits: { fileSize: 10485760 }, // 10 MB limit
}).single("file");

const parseCSV = (data) => {
    return new Promise((resolve, reject) => {
        const results = [];
        data
            .pipe(csvParser())
            .on("data", (row) => {
                results.push(row);
            })
            .on("end", () => {
                resolve(results);
            })
            .on("error", (error) => {
                reject(error);
            });
    });
};

module.exports = {
    add: async (req, res) => {
        var date = new Date();
        try {
            const data = req.body;
            data.email = data.email.toLowerCase();

            if (!req.body.email) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 400,
                        message: constants.onBoarding.PAYLOAD_MISSING,
                    },
                });
            }
            let query = {};
            query.isDeleted = false;
            query.email = req.body.email.toLowerCase();
            var user = await Users.findOne(query);

            if (user) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 400,
                        message: constants.onBoarding.EMAIL_EXIST,
                    },
                });
            } else {
                data["date_registered"] = date;
                data["createdAt"] = date;
                data["updatedAt"] = date;
                data["status"] = "active";
                data["addedBy"] = req.identity.id;
                data["addedType"] = "admin";
                data["role"] = "agency";
                var password = req.body.password;
                if (req.body.password) {
                    data.password = await bcrypt.hashSync(
                        req.body.password,
                        bcrypt.genSaltSync(10)
                    );
                } else {
                    password = await helper.generatePassword();
                    data.password = await bcrypt.hashSync(
                        password,
                        bcrypt.genSaltSync(10)
                    );
                }

                data.isVerified = "Y";
                data.email = data.email.toLowerCase();

                if (req.body.firstName && req.body.lastName) {
                    data["fullName"] = req.body.firstName + " " + req.body.lastName;
                }
                data.addedBy = req.identity.id ? req.identity.id : req.identity._id;

                let newUser = await Users.create(data);

                let email_payload = {
                    email: newUser.email,
                    fullName: newUser.fullName,
                    password: password,
                    role: newUser.role,
                };
                await Emails.addUserEmail(email_payload);

                return res.status(200).json({
                    success: true,
                    message: constants.AGENCY.AGENCY_ADDED,
                });
            }
        } catch (err) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: "" + err,
            });
        }

    },
    agencyDetails: async (req, res) => {
        try {
            let agencyId = req.query.id;
            let query = {};
            query._id = agencyId;
            let agencyData = await Users.findOne(query);
            if (agencyData) {
                return res.status(200).json({
                    success: true,
                    data: agencyData,
                    message: constants.AGENCY.DETAILS
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: constants.AGENCY.NOT_EXIST
                });
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: "" + err,
            });
        }
    },
    editAgencyDetails: async (req, res) => {
        try {
            let data = req.body;
            let companyData = await Users.findOne({ _id: data.companyId });
            if (companyData) {

                if (req.body.firstName && req.body.lastName) {
                    data["fullName"] = req.body.firstName + " " + req.body.lastName;
                }
                await Users.updateOne({ _id: companyData._id }, data);
                return res.status(200).json({
                    success: true,
                    code: 200,
                    message: constants.onBoarding.PROFILE_UPDATED
                })
            } else {
                return res.status(400).json({
                    success: false,
                    message: constants.onBoarding.ACCOUNT_NOT_FOUND
                })
            }
        } catch (err) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 400,
                    message: "" + err,
                },
            });
        }
    },


    deleteAgency: async (req, res) => {
        try {
            const id = req.query.id;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: constants.onBoarding.PAYLOAD_MISSING,
                });
            }
            const findUser = await Users.findOne({ _id: id });
            if (!findUser) {
                return res.status(404).json({
                    success: false,
                    message: constants.AGENCY.NOT_FOUND,
                });
            }
            const query = {
                venue: findUser._id,
            };

            const deletedUser = await Users.updateOne(
                {
                    _id: id,
                },
                {
                    isDeleted: true,
                }
            );
            if (deletedUser) {
                return res.status(200).json({
                    success: true,
                    message: constants.AGENCY.AGENCY_DELETED,
                });
            }
        } catch (err) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 400,
                    message: "" + err,
                },
            });
        }
    },

    agencyListing: async (req, res) => {
        try {
            let { search, sortBy, page, count, status, isVerified, companyName, role, accountType } =
                req.query;
            let query = {};
            if (search) {
                query.$or = [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { companyName: { $regex: search, $options: "i" } }
                ];
            }

            query.isDeleted = false;
            if (role) {
                query.role = role;
            }
            if (accountType) {
                query.accountType = accountType;
            }
            if (!role && !accountType) {
                query.$or = [
                    { role: "agency" },
                    { accountType: "pro" },
                ];
            }

            if (isVerified) {
                query.isVerified = isVerified;
            }
            if (status) {
                query.status = status;
            }

            let sortquery = {};
            if (sortBy) {
                let [field, sortType] = sortBy.split(" ");
                sortquery[field ? field : "createdAt"] = sortType === "desc" ? -1 : 1;
            } else {
                sortquery.createdAt = -1;
            }

            const pipeline = [

                { $match: query },
                { $sort: sortquery },
            ];

            const total = await Users.countDocuments(query);

            if (page && count) {
                let skipNo = (Number(page) - 1) * Number(count);
                pipeline.push({ $skip: Number(skipNo) }, { $limit: Number(count) });
            }

            const result = await Users.aggregate([...pipeline]);

            return res.status(200).json({
                success: true,
                data: result,
                total: total,
            });
        } catch (err) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 400,
                    message: "" + err,
                },
            });
        }
    },

    exportAgencyListing: async (req, res) => {
        try {
            let { role, accountType } = req.query;
            let query = {};
            if (role) {
                query.role = role;
            }
            if (accountType) {
                query.accountType = accountType;
            }
            if (!role && !accountType) {
                query.$or = [
                    { role: "agency" },
                    { accountType: "pro" },
                ];
            }
            query.isDeleted = false;
            const pipeline = [
                { $match: query },
                {
                    $project: {
                        id: "$_id",
                        fullName: 1,
                        firstName: 1,
                        lastName: 1,
                        companyName: 1,
                        email: 1,
                        city: 1,
                        street: 1,
                        country: 1,
                        mobileNo: 1,
                        postalCode: "$pinCode",
                        status: 1,
                        registrationNumber: 1,
                        companyRole: 1,
                    },
                },

            ];


            const result = await Users.aggregate([...pipeline]);

            const csvStringifier = createObjectCsvStringifier({
                header: [
                    { id: "fullName", title: "fullName" },
                    { id: "firstName", title: "firstName" },
                    { id: "lastName", title: "lastName" },
                    { id: "companyName", title: "companyName" },
                    { id: "email", title: "email" },
                    { id: "city", title: "city" },
                    { id: "country", title: "country" },
                    { id: "street", title: "street" },
                    { id: "postalCode", title: "postalCode" },
                    { id: "mobileNo", title: "mobileNo" },
                    { id: "status", title: "status" },
                    { id: "registrationNumber", title: "registrationNumber" },
                    { id: "companyRole", title: "companyRole" },
                ],
            });

            const csvData = result.map(item => {
                return {
                    fullName: item.fullName,
                    firstName: item.firstName,
                    lastName: item.lastName,
                    companyName: item.companyName,
                    email: item.email,
                    mobileNo: item.mobileNo,
                    status: item.status,
                    postalCode: item.postalCode,
                    city: item.city,
                    street: item.street,
                    country: item.country,
                    registrationNumber: item.registrationNumber,
                    companyRole: item.companyRole,
                };
            });
            const readable = new Readable({
                read() {
                    this.push(csvStringifier.getHeaderString());
                    this.push(csvStringifier.stringifyRecords(csvData));
                    this.push(null);
                }
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=agencies.csv');
            readable.pipe(res);

        } catch (err) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 400,
                    message: "" + err,
                },
            });
        }
    },

    importAgencyListing: async (req, res) => {
        let duplicate = 0;
        let createdCount = 0;

        upload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 400,
                            message: "File size must be less than 10 MB",
                        },
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 400,
                        message: "File upload error",
                    },
                });
            } else if (err) {
                return res.status(500).json({
                    success: false,
                    error: {
                        code: 500,
                        message: "Unknown server error",
                    },
                });
            }

            const uploadedFile = req.file;

            if (!uploadedFile) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 400,
                        message: "No file uploaded",
                    },
                });
            }

            if (
                uploadedFile.mimetype !==
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
                uploadedFile.mimetype !== "text/csv"
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 400,
                        message: "Invalid file type",
                    },
                });
            }

            const filename = uploadedFile.originalname;
            const filepath = uploadedFile.path;

            try {
                let users_arr;

                if (filename.endsWith(".csv")) {
                    const fileStream = fs.createReadStream(filepath, "utf8");
                    users_arr = await parseCSV(fileStream);
                } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
                    const workbook = xlsx.readFile(filepath);
                    const sheetName = workbook.SheetNames[0];
                    users_arr = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                } else {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 400,
                            message: "Unsupported file format",
                        },
                    });
                }

                if (users_arr && users_arr.length > 0) {
                    let totalUser = users_arr.length;
                    let alreadyExist = 0;
                    let newusers = 0;
                    for (let user of users_arr) {
                        try {
                            user.fullName = user["firstName"] + " " + user["lastName"];
                            user.addedBy = req.identity.id;
                            user.firstName = user["firstName"];
                            user.lastName = user["lastName"];
                            user.mobileNo = user.mobileNo;
                            user.importBy = "csv";
                            if (user.status == "active") {
                                user.status = "active";
                            } else if (user.status == "InActive" || user.status == "N/A") {
                                user.status = "inactive";
                            } else if (user.status == "cancelled") {
                                user.status = "cancelled";
                            }
                            user.role = "agency";
                            user.pinCode = user['postalCode'];
                            user.city = user.city;
                            user.street = user.street;
                            user.country = user.country;
                            user.companyName = user.companyName;
                            user.registrationNumber = user.registrationNumber;
                            user.companyRole = user.companyRole;

                            /////

                            let findUser = await Users.findOne({
                                email: user.email.toLowerCase(),
                            });

                            if (!findUser) {
                                newusers = newusers + 1;
                                user.email = user.email.toLowerCase();
                                let password = await helper.generatePassword();
                                user.password = await bcrypt.hashSync(
                                    password,
                                    bcrypt.genSaltSync(10)
                                );
                                let payload = { email: user.email }
                                await Emails.welcomeUser(payload)
                                let createdUser = await Users.create(user);
                            } else {
                                alreadyExist = alreadyExist + 1;
                                user.fullName = findUser.fullName;
                                await Users.updateOne({ _id: findUser._id }, user);
                            }

                            createdCount++;
                        } catch (err) {
                            return res.status(400).json({
                                success: false,
                                error: {
                                    code: 400,
                                    message: err.message,
                                },
                            });
                        }
                    }
                    let message;
                    if (alreadyExist == totalUser) {
                        return res.status(400).json({
                            success: false,
                            code: 400,
                            message: "This file user has been already exist"
                        })
                    } else if (alreadyExist == 0) {
                        message = "Users imported successfully";
                    } else {
                        message = `${newusers} record successfully imported out of ${totalUser} because excel sheet having ${totalUser - newusers
                            } duplicate/already exist in system records.`;
                    }
                    return res.status(200).json({
                        success: true,
                        message: message,
                    });
                }

                res.status(200).json({
                    success: true,
                    message: `Users imported successfully`,
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 500,
                        message: err.message,
                    },
                });
            } finally {
                // Clean up the uploaded file
                fs.unlink(filepath, (err) => {
                    if (err) {
                        console.error("Error removing uploaded file:", err);
                    }
                });
            }
        });
    }
}