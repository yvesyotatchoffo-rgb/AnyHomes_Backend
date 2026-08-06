const db = require("../models");
const Users = db.users;
const ReferralInvitations = db.referralInvitations;
const crypto = require("crypto");
const { sendEmail } = require("../config/brevo.config");
const constants = require("../utls/constants");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITES_PER_DAY = 10; // per user per 24h
const DUPLICATE_INVITE_HOURS = 48; // same recipient hash, same inviter

// Charset excluant les caractères ambigus (0/O, I/l, 1)
const SAFE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

/**
 * Generate a unique share code for a user.
 */
const generateShareCode = () => {
  let code = "";
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return code;
};

/**
 * Ensure user has a shareCode, generating one if missing.
 */
const ensureShareCode = async (user) => {
  if (user.shareCode) return user;

  let code;
  let attempts = 0;
  while (attempts < 10) {
    code = generateShareCode();
    const existing = await Users.findOne({ shareCode: code, isDeleted: false });
    if (!existing) break;
    attempts++;
  }

  user.shareCode = code;
  await Users.updateOne({ _id: user._id }, { $set: { shareCode: code } });
  return user;
};

module.exports = {

  /**
   * POST /referrals/send-email-invite
   * Sends a referral invitation email to a single recipient.
   * Body: { email: string, personalMessage?: string, source?: string }
   */
  sendEmailInvite: async (req, res) => {
    try {
      const user = req.identity;
      if (!user || req.isGuest) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
      }

      const rawEmail = (req.body?.email || "").trim().toLowerCase();
      const personalMessage = (req.body?.personalMessage || "").trim().slice(0, 300) || null;
      const validSources = ["sidebar", "dashboard", "profile"];
      const requestedSource = req.body?.source || "unknown";
      const isValidToastSource = requestedSource.startsWith("toast-") && requestedSource.length > 6;
      const source = [...validSources, "unknown"].includes(requestedSource) || isValidToastSource
        ? requestedSource
        : "unknown";

      // Validate email
      if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
        return res.status(400).json({ success: false, message: "Adresse email invalide." });
      }

      // Cannot invite yourself
      if (user.email && user.email.toLowerCase() === rawEmail) {
        return res.status(400).json({ success: false, message: "Vous ne pouvez pas vous inviter vous-même." });
      }

      // Rate limit: max MAX_INVITES_PER_DAY email invites per 24h
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const countToday = await ReferralInvitations.countDocuments({
        inviterUserId: user._id,
        channel: "email",
        createdAt: { $gte: since24h },
      });
      if (countToday >= MAX_INVITES_PER_DAY) {
        return res.status(429).json({ success: false, message: "Limite d'invitations par email atteinte pour aujourd'hui. Réessayez demain." });
      }

      // Dedup: same recipient hash, same inviter, within DUPLICATE_INVITE_HOURS
      const recipientHash = crypto.createHash("sha256").update(rawEmail).digest("hex");
      const sinceDedup = new Date(Date.now() - DUPLICATE_INVITE_HOURS * 60 * 60 * 1000);
      const duplicate = await ReferralInvitations.findOne({
        inviterUserId: user._id,
        recipientHash,
        channel: "email",
        createdAt: { $gte: sinceDedup },
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: "Vous avez déjà invité cette adresse récemment." });
      }

      await ensureShareCode(user);
      const baseUrl = process.env.APP_FRONTEND_URL || "http://localhost:8089";

      // Unique token for precise attribution — valid 7 days
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Point to the marketing landing page so prospects discover the product
      // before being prompted to sign up. The ref + inv params are preserved for
      // attribution tracking when they eventually navigate to the signup flow.
      const inviteUrl = `${baseUrl}/?ref=${user.shareCode}&inv=${inviteToken}`;

      // Full name for the invitation title: "Jeanne M. vous invite à découvrir AnyHomes"
      const senderFullName =
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.fullName ||
        "Un membre";

      // Build optional personal message HTML block
      const personalMessageBlock = personalMessage
        ? `<div style="background:#f3f0ff;border-left:4px solid #6B21A8;border-radius:6px;padding:16px 20px;margin:0 0 24px;font-style:italic;color:#374151;font-size:15px;line-height:1.6">"${personalMessage}"</div>`
        : "";

      // Create invitation record
      const invitation = await ReferralInvitations.create({
        inviterUserId: user._id,
        shareCode: user.shareCode,
        channel: "email",
        source,
        recipientHash,
        recipientEmail: rawEmail,
        personalMessage,
        landingUrl: inviteUrl,
        status: "sent",
        metadata: {
          ip: req.ip || null,
          userAgent: req.headers["user-agent"] || null,
          inviteToken,
          tokenExpiresAt,
        },
      });

      // Send Brevo email (fire-and-forget on error — invitation is already recorded)
      sendEmail({
        to: rawEmail,
        templateId: constants.BREVO.REFERRAL_EMAIL_INVITE,
        params: {
          senderFullName,
          inviteUrl,
          personalMessageBlock,
        },
      }).catch((err) => console.error("[ReferralController.sendEmailInvite] Brevo error:", err));

      return res.json({ success: true, data: { invitationId: invitation._id } });
    } catch (err) {
      console.error("[ReferralController.sendEmailInvite]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /referrals/me
   * Returns the current user's shareCode, shareLink, and invitation history.
   */
  getMe: async (req, res) => {
    try {
      const user = req.identity;
      if (!user || req.isGuest) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
      }

      await ensureShareCode(user);
      const baseUrl = process.env.APP_FRONTEND_URL || "http://localhost:8089";
      const shareLink = `${baseUrl}/signup?ref=${user.shareCode}`;

      const invitations = await ReferralInvitations.find({
        inviterUserId: user._id,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return res.json({
        success: true,
        data: {
          shareCode: user.shareCode,
          shareLink,
          invitations: invitations.map((inv) => ({
            id: inv._id,
            channel: inv.channel,
            status: inv.status,
            recipientEmail: inv.recipientEmail || null,
            createdAt: inv.createdAt,
            openedAt: inv.openedAt,
            signedUpAt: inv.signedUpAt,
            activatedAt: inv.activatedAt,
          })),
        },
      });
    } catch (err) {
      console.error("[ReferralController.getMe]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /referrals/track-share
   * Records a share event (copy, whatsapp, email, sms).
   * Supported sources: sidebar, dashboard, profile, or toast-* (e.g., toast-after-signup, toast-after-property-created)
   */
  trackShare: async (req, res) => {
    try {
      const user = req.identity;
      if (!user || req.isGuest) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
      }

      const channel = ["copy", "email", "whatsapp", "sms"].includes(req.body?.channel)
        ? req.body.channel
        : "unknown";

      // Validate source: accept specific sources or toast-* patterns
      const validSources = ["sidebar", "dashboard", "profile"];
      const requestedSource = req.body?.source || "unknown";
      const isValidToastSource = requestedSource.startsWith("toast-") && requestedSource.length > 6;
      const source = [...validSources, "unknown"].includes(requestedSource) || isValidToastSource
        ? requestedSource
        : "unknown";

      await ensureShareCode(user);

      await ReferralInvitations.create({
        inviterUserId: user._id,
        shareCode: user.shareCode,
        channel,
        source,
        status: "sent",
        metadata: {
          ip: req.ip || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      return res.json({ success: true });
    } catch (err) {
      console.error("[ReferralController.trackShare]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /r/:shareCode  (public, no auth)
   * Tracks link open and redirects to signup.
   */
  trackLinkOpen: async (req, res) => {
    try {
      const { shareCode } = req.params;
      const baseUrl = process.env.APP_FRONTEND_URL || "http://localhost:8089";

      if (shareCode) {
        // Update the most recent "sent" invitation for this code, or just log the open
        await ReferralInvitations.findOneAndUpdate(
          { shareCode, status: "sent" },
          { $set: { status: "opened", openedAt: new Date() } },
          { sort: { createdAt: -1 } }
        );
      }

      return res.redirect(`${baseUrl}/signup?ref=${encodeURIComponent(shareCode || "")}`);
    } catch (err) {
      console.error("[ReferralController.trackLinkOpen]", err);
      const baseUrl = process.env.APP_FRONTEND_URL || "http://localhost:8089";
      return res.redirect(`${baseUrl}/signup`);
    }
  },

  /**
   * Called internally after a user registers with a ref code.
   * Attributes the invitation to the new account.
   */
  attributeSignup: async (newUserId, shareCode, metadata = {}, inviteToken = null) => {
    try {
      if (!shareCode) return;

      const inviter = await Users.findOne({ shareCode, isDeleted: false });
      if (!inviter) return;

      // Anti-abuse: cannot invite yourself
      if (String(inviter._id) === String(newUserId)) return;

      await Users.updateOne(
        { _id: newUserId },
        { $set: { invitedByUserId: inviter._id, invitationSource: shareCode, invitationAcceptedAt: new Date() } }
      );

      // If an invite token is provided, match the exact email invitation record
      const tokenQuery = inviteToken
        ? { inviterUserId: inviter._id, "metadata.inviteToken": inviteToken, "metadata.tokenExpiresAt": { $gt: new Date() }, status: { $in: ["sent", "opened"] } }
        : null;

      const fallbackQuery = {
        inviterUserId: inviter._id,
        shareCode,
        status: { $in: ["sent", "opened"] },
      };

      await ReferralInvitations.findOneAndUpdate(
        tokenQuery || fallbackQuery,
        {
          $set: {
            status: "signed_up",
            signedUpAt: new Date(),
            "metadata.invitedUserId": newUserId,
            "metadata.ip": metadata.ip || null,
            "metadata.userAgent": metadata.userAgent || null,
          },
        },
        { sort: { createdAt: -1 } }
      );
    } catch (err) {
      console.error("[ReferralController.attributeSignup]", err);
    }
  },
};
