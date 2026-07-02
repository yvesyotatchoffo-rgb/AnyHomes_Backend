const db = require("../models");

module.exports = {
    add: async (req, res) => {
        try {
            const userId = req.identity?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Non authentifié" });
            }

            const user = await db.users.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ success: false, message: "Utilisateur introuvable" });
            }

            const {
                propertyId,
                address, zipcode, city, surface, rooms,
                type, propertyType,
                heatingType, energymode,
                energyConsumption, emissions,
                energy_efficient, emission_efficient,
                dateOfDiagnosis,
            } = req.body;

            // Éviter les doublons pour le même bien
            if (propertyId) {
                const existing = await db.renovationQuoteRequest.findOne({
                    propertyId,
                    isDeleted: false,
                }).lean();
                if (existing) {
                    return res.status(200).json({
                        success: true,
                        data: existing,
                        message: "Demande déjà enregistrée",
                    });
                }
            }

            // Résoudre les noms des équipements (ObjectId → nom lisible)
            const [heatingTypeDoc, energymodeDoc] = await Promise.all([
                heatingType ? db.amenities.findById(heatingType).lean().catch(() => null) : null,
                energymode  ? db.amenities.findById(energymode).lean().catch(() => null)  : null,
            ]);

            const data = {
                userId,
                propertyId: propertyId || null,
                firstName: user.firstName || '',
                lastName:  user.lastName  || '',
                email:     user.email     || '',
                phone:     user.mobileNo  || user.phoneNumber || '',
                address:            address            || '',
                zipcode:            zipcode            || '',
                city:               city               || '',
                surface:            surface            || '',
                rooms:              rooms              || '',
                type:               type               || '',
                propertyType:       propertyType       || '',
                heatingType:        heatingTypeDoc?.name || heatingType || '',
                energymode:         energymodeDoc?.name  || energymode  || '',
                energyConsumption:  energyConsumption  || '',
                emissions:          emissions          || '',
                energy_efficient:   energy_efficient   || '',
                emission_efficient: emission_efficient || '',
                dateOfDiagnosis:    dateOfDiagnosis    || '',
            };

            const created = await db.renovationQuoteRequest.create(data);
            return res.status(200).json({ success: true, data: created });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },

    listing: async (req, res) => {
        try {
            const { status, page = 1, count = 20 } = req.query;
            const filter = { isDeleted: false };
            if (status) filter.status = status;

            const skip = (parseInt(page) - 1) * parseInt(count);

            const [data, total] = await Promise.all([
                db.renovationQuoteRequest
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(count)),
                db.renovationQuoteRequest.countDocuments(filter),
            ]);

            return res.status(200).json({ success: true, data, total });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },

    updateStatus: async (req, res) => {
        try {
            const { id, status } = req.body;
            if (!id || !status) {
                return res.status(400).json({ success: false, message: "id et status sont requis" });
            }
            const updated = await db.renovationQuoteRequest.findByIdAndUpdate(
                id,
                { status },
                { new: true }
            );
            return res.status(200).json({ success: true, data: updated });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },
};
