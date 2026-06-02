const db = require("../models");
let mongoose = require("mongoose");
const constants = require("../utls/constants");
const csvParser = require("csv-parser");
const multer = require("multer");
const { message } = require("../services");
const { success } = require("../services/Response");
const { find, property } = require("lodash");
const { query } = require("express");
const recentLogs = db.recentLogs;
const saveSearch = db.savesearch;
const Property = db.property;
const logActivity = require("../services/activityLog.service");

module.exports = {
    addSaveSearch: async (req, res) => {
        try {
            console.log(req.body);
            const data = req.body;
            const { searchBy, propertyType, searchLocation, propertyId, zipcode } = req.body;
            if (!searchBy) {
                return res.status(400).json({
                    success: false,
                    message: "Payload Missing."
                })
            }
            let validatedPropertyType = propertyType ? propertyType : null;
            let LowerCaseSearchLocation = searchLocation ? searchLocation.toLowerCase() : "";
            if (propertyId) {
                const findProperty = await Property.findById(propertyId);

                if (!findProperty) {
                    return res.status(404).json({ success: false, message: "Property not found" });
                }

                let log = await recentLogs.findOne({ userId: searchBy });

                if (!log) {
                    log = new recentLogs({
                        userId: searchBy,
                        propertyIds: [propertyId],
                        zipcodes: [findProperty.zipcode],
                        propertyTypes: [findProperty.propertyType],
                    });
                } else {
                    log.propertyIds.push(propertyId);
                    log.zipcodes.push(findProperty.zipcode);
                    log.propertyTypes.push(findProperty.propertyType);

                    if (log.propertyIds.length > 3) log.propertyIds.shift();
                    if (log.zipcodes.length > 3) log.zipcodes.shift();
                    if (log.propertyTypes.length > 3) log.propertyTypes.shift();
                }

                await log.save();

                return res.status(200).json({
                    success: true,
                    message: "Recent visit saved",
                });
            }
            if (!zipcode) {
                return res.status(200).json({
                    success: false,
                    message: "History not saved as zipcode is not there"
                });
            }
            const zipcodesArray = zipcode ? zipcode.split(",").map(z => z.trim()) : [];

            for (const zip of zipcodesArray) {
                const existingEntry = await saveSearch.findOne({ searchBy: searchBy, propertyType: propertyType, searchLocation: LowerCaseSearchLocation, zipcode: zip }); if (!existingEntry) {
                    await saveSearch.create({
                        searchBy: data.searchBy,
                        propertyType: validatedPropertyType,
                        searchLocation: LowerCaseSearchLocation,
                        zipcode: zip,
                        searchByCount: 1,
                        propertyTypeCount: 1,
                        searchLocationCount: 1,
                        zipcodeCount: 1,
                    });
                    logActivity(searchBy, "search_saved", { label: `Recherche sauvegardée — ${LowerCaseSearchLocation || zip}`, objectType: "search", metadata: { location: LowerCaseSearchLocation, zipcode: zip, propertyType: validatedPropertyType } });
                } else {
                    existingEntry.searchByCount += 1;
                    existingEntry.propertyTypeCount += 1;
                    existingEntry.searchLocationCount += 1;
                    existingEntry.zipcodeCount = (existingEntry.zipcodeCount || 0) + 1;
                    await existingEntry.save();
                }
            }
            res.status(200).json({
                success: true,
                message: "Search history updated for zipcodes",
            });
        }
        catch (err) {
            console.log("ERROR", err);
            return res.status(400).json({
                success: false,
                error: {
                    code: 400,
                    message: err,
                },
            });
        }
    },

    getSavedSearch: async (req, res) => {
        try {
            const propertyType = req.query.propertyType;
            const outsideId = "678a3e7eed16184ae239953c";
            const terraceId = "678a3c44ed16184ae23994c7";
            let zipcode = req.query.zipcode.trim();
            // console.log(req.query);
            // const searchLocation = req.query.searchLocation.toLowerCase();
            // if (!propertyType && !searchLocation) {
            if (!propertyType && !zipcode) {
                return res.status(400).json({
                    success: false,
                    message: "propertyType and zipcode parameter is required",
                });
            }
            const getPropertyTypeCount = await saveSearch.countDocuments({ propertyType: propertyType, zipcode: zipcode });
            const averageRoomsPipeline = [
                {
                    $match: {
                        propertyType: propertyType,
                        zipcode: zipcode,
                        // $expr: { $eq: [{ $toLower: "$city" }, searchLocation] }
                    }
                },
                { $group: { _id: null, averageRooms: { $avg: { $toInt: "$rooms" } } } },
            ];

            const averageRoomsResult = await Property.aggregate(averageRoomsPipeline).exec();
            const averageRooms = averageRoomsResult.length ? averageRoomsResult[0].averageRooms : 0;
            // Aggregation to count unique users for a particular search location(city)
            const uniqueUserCountPipeline = [
                { $match: { zipcode: zipcode } },
                // { $match: { searchLocation: searchLocation } },
                { $group: { _id: { searchBy: "$searchBy" }, count: { $sum: 1 } } },
            ];

            const uniqueUserCount = (await saveSearch.aggregate(uniqueUserCountPipeline).exec()).length;

            // const totalGardenCount = await Property.countDocuments({ outside: outsideId });
            // const totalTerraceCount = await Property.countDocuments({ outside: terraceId });
            const totalGardenCount = await Property.countDocuments({
                outside: outsideId,
                zipcode: zipcode,
                // $expr: { $eq: [{ $toLower: "$city" }, searchLocation] }
            });

            const totalTerraceCount = await Property.countDocuments({
                outside: terraceId,
                zipcode: zipcode,
                // $expr: { $eq: [{ $toLower: "$city" }, searchLocation] }
            });
            // const totalProperties = await Property.countDocuments({});
            const totalProperties = await Property.countDocuments({
                // $expr: { $eq: [{ $toLower: "$city" }, searchLocation] }
                zipcode: zipcode,
            });
            // const gardenPercent = (totalGardenCount / totalProperties) * 100;
            // const terracePercent = (totalTerraceCount / totalProperties) * 100;
            const gardenPercent = totalProperties > 0 ? (totalGardenCount / totalProperties) * 100 : 0;
            const terracePercent = totalProperties > 0 ? (totalTerraceCount / totalProperties) * 100 : 0;

           const averageGarden = totalProperties > 0 ? totalGardenCount / totalProperties : 0;

           const averageTerrace = totalProperties > 0  ? totalTerraceCount / totalProperties : 0;

            const averageMonthlyChargesPipeline = [
                {
                    $match: {
                        propertyType: "rent",
                        zipcode: zipcode,
                        // $expr: { $eq: [{ $toLower: "$city" }, searchLocation] }
                    }
                },
                { $group: { _id: null, averageMonthlyCharges: { $avg: "$propertyMonthlyCharges" } } },
            ];

            const averageMonthlyChargesResult = await Property.aggregate(averageMonthlyChargesPipeline).exec();
            const averageMonthlyCharges = averageMonthlyChargesResult.length ? averageMonthlyChargesResult[0].averageMonthlyCharges : 0;

            const averageSalePricePipeline = [
                {
                    $match: {
                        propertyType: "sale",
                        zipcode: zipcode,
                        // $expr: { $eq: [{ $toLower: "$city" }, searchLocation] }
                    }
                },
                { $group: { _id: null, averageSalePrice: { $avg: "$price" } } },
            ];

            const averageSalePriceResult = await Property.aggregate(averageSalePricePipeline).exec();
            const averageSalePrice = averageSalePriceResult.length ? averageSalePriceResult[0].averageSalePrice : 0;
            // console.log(uniqueUserCount);
            return res.status(200).json({
                success: true,
                message: "Total Data",
                data: {
                    PropertyCount: getPropertyTypeCount,
                    gardenPercent: gardenPercent,
                    terracePercent: terracePercent,
                    UsersInArea: uniqueUserCount,
                    averageRooms: averageRooms,
                    averageMonthlyCharges: averageMonthlyCharges,
                    averageSalePrice: averageSalePrice,
                    averageGarden: averageGarden,
                    averageTerrace: averageTerrace
                
                }
            });
        } catch (err) {
            console.error("Error fetching data:", err);
            return res.status(500).json({
                success: false,
                error: {
                    code: 500,
                    message: err.message,
                },
            });
        }
    }

}