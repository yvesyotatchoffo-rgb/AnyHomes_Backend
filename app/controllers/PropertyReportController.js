const db = require("../models");
const { sendEmail } = require("../config/brevo.config");

module.exports = {
    /**
     * POST /property-report/add
     * Enregistre un signalement de profil/bien et envoie un email de confirmation.
     * Accessible sans authentification (signalement anonyme possible).
     */
    add: async (req, res) => {
        try {
            const {
                propertyId,
                firstName,
                lastName,
                email,
                phone,
                reason,
            } = req.body;

            if (!email || !firstName || !lastName || !reason) {
                return res.status(400).json({
                    success: false,
                    message: "firstName, lastName, email et reason sont requis",
                });
            }

            // Récupérer les infos du bien si fourni
            let propertyRef = '';
            let propertyTitle = '';
            let propertyImage = '';
            if (propertyId) {
                const prop = await db.property.findById(propertyId).lean().catch(() => null);
                if (prop) {
                    propertyRef   = prop.ref || prop.propertyRef || prop._id?.toString() || '';
                    propertyTitle = prop.title || prop.address || '';
                    propertyImage = (prop.images?.[0]?.file) || '';
                }
            }

            // Résoudre l'userId si l'utilisateur est connecté
            const loggedUserId = req.identity?.id || null;

            const report = await db.propertyReport.create({
                userId:        loggedUserId,
                propertyId:    propertyId || null,
                propertyRef,
                propertyTitle,
                propertyImage,
                firstName,
                lastName,
                email,
                phone:  phone || '',
                reason,
            });

            // Email de confirmation au signalant
            const fullName = `${firstName} ${lastName}`;
            const propInfo = propertyRef ? `pour le bien <strong>${propertyRef}</strong>` : '';

            await sendEmail({
                module: "AUTH",
                to: email,
                subject: "Confirmation de votre signalement – Bookaroo",
                htmlContent: `
                    <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#47525E;">
                        <h2 style="color:#976DD0;">Votre signalement a bien été enregistré</h2>
                        <p>Bonjour <strong>${fullName}</strong>,</p>
                        <p>Nous avons bien reçu votre signalement ${propInfo} (référence : <strong>${report.ref}</strong>).</p>
                        <p>Notre équipe va examiner votre signalement dans les plus brefs délais.</p>
                        <p>Raison indiquée : <em>${reason}</em></p>
                        <br/>
                        <p>Cordialement,<br/>L'équipe Bookaroo</p>
                    </div>
                `,
            }).catch((err) => {
                console.error("Erreur envoi email signalement:", err);
            });

            return res.status(200).json({ success: true, data: report });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },

    /**
     * GET /admin/property-report/listing
     * Retourne la liste paginée des signalements pour l'admin.
     */
    listing: async (req, res) => {
        try {
            const { status, page = 1, count = 20 } = req.query;
            const filter = { isDeleted: false };
            if (status) filter.status = status;

            const skip = (parseInt(page) - 1) * parseInt(count);

            const [data, total] = await Promise.all([
                db.propertyReport
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(count))
                    .lean(),
                db.propertyReport.countDocuments(filter),
            ]);

            return res.status(200).json({ success: true, data, total });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },

    /**
     * PUT /admin/property-report/status
     * Met à jour le statut d'un signalement.
     */
    updateStatus: async (req, res) => {
        try {
            const { id, status } = req.body;
            if (!id || !status) {
                return res.status(400).json({
                    success: false,
                    message: "id et status sont requis",
                });
            }
            const updated = await db.propertyReport.findByIdAndUpdate(
                id,
                { status },
                { new: true }
            );
            if (!updated) {
                return res.status(404).json({ success: false, message: "Signalement introuvable" });
            }
            return res.status(200).json({ success: true, data: updated });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },
};
