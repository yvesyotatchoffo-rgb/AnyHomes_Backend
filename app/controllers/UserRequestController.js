const db = require("../models");

module.exports = {
    add: async (req, res) => {
        try {
            const { firstName, lastName, email, phone, message, type } = req.body;

            if (!firstName || !email) {
                return res.status(400).json({
                    success: false,
                    message: "Prénom et email sont obligatoires",
                });
            }

            const data = {
                firstName: firstName.trim(),
                lastName: (lastName || '').trim(),
                email: email.trim().toLowerCase(),
                phone: (phone || '').trim(),
                message: (message || '').trim(),
                type: type || 'training_partnership',
                addedBy: req.identity?.id || null,
            };

            const created = await db.userRequest.create(data);

            return res.status(200).json({
                success: true,
                message: "Votre demande a bien été envoyée. Nous vous répondrons rapidement.",
                data: created,
            });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },

    listing: async (req, res) => {
        try {
            const { type, status, page = 1, count = 20 } = req.query;
            const filter = { isDeleted: false };
            if (type) filter.type = type;
            if (status) filter.status = status;

            const skip = (parseInt(page) - 1) * parseInt(count);

            const [data, total] = await Promise.all([
                db.userRequest
                    .find(filter)
                    .populate('addedBy', 'firstName lastName email fullName')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(count)),
                db.userRequest.countDocuments(filter),
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
            const updated = await db.userRequest.findByIdAndUpdate(
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
