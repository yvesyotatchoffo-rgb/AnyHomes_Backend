const db = require("../models");
const { sendEmail } = require("../config/brevo.config");

const API_IMG_BASE = process.env.BACK_WEB_URL || "http://localhost:6089";

module.exports = {
    /**
     * POST /pro-request/add
     * Enregistre une demande de contact pro, crée l'intérêt transactionnel
     * et envoie un email de notification au pro.
     */
    add: async (req, res) => {
        try {
            const {
                propertyId,
                firstName,
                lastName,
                email,
                phone,
                likeToBuy,
                alreadyOwnProperty,
                noMarketingEmails,
                messageText,
            } = req.body;

            if (!propertyId || !firstName || !lastName || !email) {
                return res.status(400).json({
                    success: false,
                    message: "propertyId, firstName, lastName et email sont requis",
                });
            }

            const userId = req.identity?.id || null;

            // Récupérer le bien
            const property = await db.property.findById(propertyId).lean();
            if (!property) {
                return res.status(404).json({ success: false, message: "Bien introuvable" });
            }

            // Récupérer le pro (addedBy)
            const pro = property.addedBy
                ? await db.users.findById(property.addedBy).lean().catch(() => null)
                : null;

            const propertyImgFile = property.images?.[0]?.file || "";
            const propertyImgUrl = propertyImgFile ? `${API_IMG_BASE}/img/${propertyImgFile}` : "";

            // Créer l'entrée proRequest
            const proReq = await db.proRequest.create({
                userId:            userId || null,
                propertyId,
                proId:             property.addedBy || null,
                proEmail:          pro?.email || "",
                propertyRef:       property.propertyRef || "",
                propertyTitle:     property.address || property.title || "",
                propertyImage:     propertyImgFile,
                propertyZipcode:   property.zipcode || "",
                propertyPrice:     property.price || 0,
                propertySurface:   property.surface || "",
                firstName,
                lastName,
                email,
                phone:             phone || "",
                likeToBuy:         likeToBuy || "Now",
                alreadyOwnProperty: alreadyOwnProperty === true || alreadyOwnProperty === "true",
                noMarketingEmails:  noMarketingEmails  === true || noMarketingEmails  === "true",
                messageText:       messageText || "",
            });

            // Créer l'intérêt transactionnel si l'utilisateur est connecté
            if (userId) {
                try {
                    const existing = await db.interests.findOne({
                        propertyId,
                        buyerId: userId,
                        isDeleted: false,
                    });
                    if (!existing) {
                        await db.interests.create({
                            propertyId,
                            buyerId:      userId,
                            propertyType: property.propertyType || "",
                            funnelStatus: "interest sent",
                            interestType: "interest sent",
                        });
                    }
                } catch (interestErr) {
                    // Ne pas bloquer si la création de l'intérêt échoue
                    console.error("Erreur création intérêt:", interestErr.message);
                }
            }

            // Email de notification au pro
            if (pro?.email) {
                const proName = [pro.firstName, pro.lastName].filter(Boolean).join(" ") || pro.companyName || "Pro";
                const buyerName = `${firstName} ${lastName}`;
                const likeToBuyLabel = likeToBuy === "Later" ? "Plus tard" : "Maintenant";
                const ownerLabel = (alreadyOwnProperty === true || alreadyOwnProperty === "true") ? "Oui" : "Non";

                await sendEmail({
                    module: "AUTH",
                    to: pro.email,
                    subject: `Un utilisateur AnyHomes est intéressé par votre bien`,
                    htmlContent: `
                    <div style="font-family:sans-serif;max-width:620px;margin:auto;color:#47525E;">
                      <h2 style="color:#976DD0;">Nouvelle demande de contact</h2>
                      <p>Bonjour <strong>${proName}</strong>,</p>
                      <p>Un utilisateur AnyHomes est intéressé par votre bien et souhaite vous contacter.</p>

                      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                        <tr><td colspan="2" style="background:#976DD0;color:white;padding:8px 12px;font-weight:600;">Coordonnées du prospect</td></tr>
                        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;width:40%;">Nom</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${buyerName}</td></tr>
                        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
                        ${phone ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Téléphone</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${phone}</td></tr>` : ""}
                        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Délai d'achat</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${likeToBuyLabel}</td></tr>
                        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Déjà propriétaire</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${ownerLabel}</td></tr>
                        ${messageText ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Message</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${messageText}</td></tr>` : ""}
                      </table>

                      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                        <tr><td colspan="2" style="background:#976DD0;color:white;padding:8px 12px;font-weight:600;">Informations sur le bien</td></tr>
                        ${propertyImgUrl ? `<tr><td colspan="2" style="padding:8px 12px;border-bottom:1px solid #eee;"><img src="${propertyImgUrl}" alt="Photo du bien" style="width:120px;height:80px;object-fit:cover;border-radius:6px;"/></td></tr>` : ""}
                        ${property.address ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;width:40%;">Adresse</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${property.address}</td></tr>` : ""}
                        ${property.propertyRef ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Référence</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${property.propertyRef}</td></tr>` : ""}
                        ${property.surface ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Surface</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${property.surface} m²</td></tr>` : ""}
                        ${property.price ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Prix</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${Number(property.price).toLocaleString("fr-FR")} €</td></tr>` : ""}
                        ${property.zipcode ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#8492A6;">Code postal</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${property.zipcode}</td></tr>` : ""}
                      </table>

                      <p style="color:#8492A6;font-size:12px;">Connectez-vous à votre espace AnyHomes pour répondre à ce prospect.</p>
                      <p>Cordialement,<br/>L'équipe AnyHomes</p>
                    </div>
                    `,
                }).catch((err) => {
                    console.error("Erreur envoi email pro:", err);
                });
            }

            // Email de confirmation au user (demandeur)
            const proDisplayName = pro
                ? (pro.companyName || [pro.firstName, pro.lastName].filter(Boolean).join(" ") || "le professionnel")
                : "le professionnel";
            const proAvatarFile = pro?.image || pro?.companyLogo || pro?.featuredProfilePhoto || "";
            const proAvatarUrl = proAvatarFile ? `${API_IMG_BASE}/img/${proAvatarFile}` : "";
            const propertyImgUrlForUser = propertyImgFile ? `${API_IMG_BASE}/img/${propertyImgFile}` : "";
            const likeToBuyLabelUser = (likeToBuy === "Later") ? "Plus tard" : "Maintenant";

            await sendEmail({
                module: "AUTH",
                to: email,
                subject: `Votre demande a bien été transmise à ${proDisplayName}`,
                htmlContent: `
                <div style="font-family:sans-serif;max-width:620px;margin:auto;color:#47525E;">
                  <h2 style="color:#976DD0;">Votre demande a bien été envoyée !</h2>
                  <p>Bonjour <strong>${firstName} ${lastName}</strong>,</p>
                  <p>Votre demande de contact a bien été transmise à <strong>${proDisplayName}</strong>. Il vous recontactera dans les meilleurs délais.</p>

                  <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden;">
                    <tr><td colspan="2" style="background:#976DD0;color:white;padding:10px 14px;font-weight:600;">Le professionnel</td></tr>
                    ${proAvatarUrl ? `<tr><td colspan="2" style="padding:12px 14px;border-bottom:1px solid #eee;"><img src="${proAvatarUrl}" alt="Avatar" style="width:60px;height:60px;border-radius:50%;object-fit:cover;"/></td></tr>` : ""}
                    <tr><td colspan="2" style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:600;">${proDisplayName}</td></tr>
                  </table>

                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr><td colspan="2" style="background:#976DD0;color:white;padding:10px 14px;font-weight:600;">Le bien</td></tr>
                    ${propertyImgUrlForUser ? `<tr><td colspan="2" style="padding:10px 14px;border-bottom:1px solid #eee;"><img src="${propertyImgUrlForUser}" alt="Photo du bien" style="width:100%;max-height:160px;object-fit:cover;border-radius:6px;"/></td></tr>` : ""}
                    ${property.address ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#8492A6;width:40%;">Adresse</td><td style="padding:8px 14px;border-bottom:1px solid #eee;">${property.address}</td></tr>` : ""}
                    ${property.propertyRef ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#8492A6;">Référence</td><td style="padding:8px 14px;border-bottom:1px solid #eee;">${property.propertyRef}</td></tr>` : ""}
                    ${property.surface ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#8492A6;">Surface</td><td style="padding:8px 14px;border-bottom:1px solid #eee;">${property.surface} m²</td></tr>` : ""}
                    ${property.price ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#8492A6;">Prix</td><td style="padding:8px 14px;border-bottom:1px solid #eee;">${Number(property.price).toLocaleString("fr-FR")} €</td></tr>` : ""}
                    ${property.zipcode ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#8492A6;">Code postal</td><td style="padding:8px 14px;border-bottom:1px solid #eee;">${property.zipcode}</td></tr>` : ""}
                    <tr><td style="padding:8px 14px;color:#8492A6;">Délai d'achat souhaité</td><td style="padding:8px 14px;">${likeToBuyLabelUser}</td></tr>
                  </table>

                  <p style="color:#8492A6;font-size:12px;">Si vous avez des questions, connectez-vous à votre espace AnyHomes.</p>
                  <p>Cordialement,<br/>L'équipe AnyHomes</p>
                </div>
                `,
            }).catch((err) => {
                console.error("Erreur envoi email user:", err);
            });

            return res.status(200).json({ success: true, data: proReq });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },

    /**
     * GET /pro-request/listing
     * Liste paginée pour l'admin.
     */
    listing: async (req, res) => {
        try {
            const { status, page = 1, count = 20 } = req.query;
            const filter = { isDeleted: false };
            if (status) filter.status = status;

            const skip = (parseInt(page) - 1) * parseInt(count);

            const [data, total] = await Promise.all([
                db.proRequest
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(count))
                    .lean(),
                db.proRequest.countDocuments(filter),
            ]);

            return res.status(200).json({ success: true, data, total });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },

    /**
     * PUT /pro-request/status
     * Met à jour le statut d'une demande.
     */
    updateStatus: async (req, res) => {
        try {
            const { id, status } = req.body;
            if (!id || !status) {
                return res.status(400).json({ success: false, message: "id et status sont requis" });
            }
            const updated = await db.proRequest.findByIdAndUpdate(id, { status }, { new: true });
            if (!updated) {
                return res.status(404).json({ success: false, message: "Demande introuvable" });
            }
            return res.status(200).json({ success: true, data: updated });
        } catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    },
};
