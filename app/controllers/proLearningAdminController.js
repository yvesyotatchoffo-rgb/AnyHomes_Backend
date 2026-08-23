const db = require("../models");
const mongoose = require("mongoose");
const { sendEmail } = require("../config/brevo.config");
const constants = require("../utls/constants");

const Users = db.users;
const Blogs = db.blogs;
const FunnelUrl = db.funnelUrl;
const Notifications = db.notifications;

const isAdmin = (user) => user && (user.role === "admin" || user.role === "staff" || user.isAdmin === true);

const resolveContent = async (contentType, id) => {
  if (contentType === "video") return FunnelUrl.findById(id);
  if (contentType === "article") return Blogs.findById(id);
  return null;
};

const notifyPro = async ({ proId, title, message, link, resourceId, resourceType }) => {
  try {
    await Notifications.create({
      sendBy: proId,
      sendTo: proId,
      title,
      message,
      type: "learningContent",
      link,
      resourceId,
      resourceType,
    });
  } catch (e) {
    console.error("[ProLearningAdmin] notify error:", e.message);
  }
};

module.exports = {
  /**
   * GET /admin/pro-learning/pending — liste des contenus en attente (vidéos + articles).
   */
  listPending: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { contentType, page = 1, count = 20 } = req.query;

      let videos = [],
        blogs = [];
      if (!contentType || contentType === "video") {
        videos = await FunnelUrl.find({ status: "pending", isProContent: true })
          .populate("addedBy", "email firstName lastName fullName")
          .sort({ createdAt: -1 })
          .lean();
      }
      if (!contentType || contentType === "article") {
        blogs = await Blogs.find({ status: "pending", isProContent: true, isDeleted: false })
          .populate("addedBy", "email firstName lastName fullName")
          .sort({ createdAt: -1 })
          .lean();
      }

      const items = [
        ...videos.map((v) => ({
          id: v._id,
          contentType: "video",
          title: v.title || v.title_fr || "",
          image: v.image || null,
          authorEmail: v.addedBy?.email || null,
          authorName: v.addedBy?.fullName || v.addedBy?.firstName || "Pro",
          createdAt: v.createdAt,
        })),
        ...blogs.map((b) => ({
          id: b._id,
          contentType: "article",
          title: b.title || b.title_fr || "",
          image: b.images?.[0] || b.banner || null,
          authorEmail: b.addedBy?.email || null,
          authorName: b.addedBy?.fullName || b.addedBy?.firstName || "Pro",
          createdAt: b.createdAt,
        })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = items.length;
      const pageNum = Math.max(1, Number(page) || 1);
      const perPage = Math.max(1, Number(count) || 20);
      const start = (pageNum - 1) * perPage;

      return res.json({
        success: true,
        data: items.slice(start, start + perPage),
        total,
        page: pageNum,
        count: perPage,
      });
    } catch (err) {
      console.error("[ProLearningAdmin.listPending]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /admin/pro-learning/content/:contentType/:id — détail/preview d'un contenu.
   */
  getContent: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });
      const { contentType, id } = req.params;
      const doc = await resolveContent(contentType, id)
        ?.populate("addedBy", "email firstName lastName fullName")
        .lean();
      if (!doc) return res.status(404).json({ success: false, message: "Contenu introuvable." });
      return res.json({ success: true, data: doc });
    } catch (err) {
      console.error("[ProLearningAdmin.getContent]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /admin/pro-learning/:contentType/:id/validate
   */
  validate: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { contentType, id } = req.params;
      let doc;
      if (contentType === "video") {
        doc = await FunnelUrl.findByIdAndUpdate(id, { $set: { status: "active" } }, { new: true });
      } else {
        doc = await Blogs.findByIdAndUpdate(id, { $set: { status: "active" } }, { new: true });
      }
      if (!doc) return res.status(404).json({ success: false, message: "Contenu introuvable." });

      const pro = await Users.findById(doc.addedBy).select("_id email firstName fullName").lean();
      const title = doc.title || doc.title_fr || "";
      if (pro?.email) {
        sendEmail({
          to: pro.email,
          templateId: constants.BREVO.LEARNING_CONTENT_VALIDATED,
          params: { proFirstName: pro.firstName || pro.fullName || "", contentTitle: title },
        }).catch((e) => console.error("[ProLearningAdmin] email validated error:", e.message));
      }
      await notifyPro({
        proId: pro?._id || doc.addedBy,
        title: "Contenu validé",
        message: `Votre contenu "${title}" a été validé et publié sur le Learning Center.`,
        link: "/pro-learning",
        resourceId: doc._id,
        resourceType: "learningContent",
      });

      return res.json({ success: true, data: doc });
    } catch (err) {
      console.error("[ProLearningAdmin.validate]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /admin/pro-learning/:contentType/:id/reject
   */
  reject: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { contentType, id } = req.params;
      const reason = req.body?.reason || null;
      let doc;
      if (contentType === "video") {
        doc = await FunnelUrl.findByIdAndUpdate(id, { $set: { status: "rejected" } }, { new: true });
      } else {
        doc = await Blogs.findByIdAndUpdate(id, { $set: { status: "rejected" } }, { new: true });
      }
      if (!doc) return res.status(404).json({ success: false, message: "Contenu introuvable." });

      const pro = await Users.findById(doc.addedBy).select("_id email firstName fullName").lean();
      const title = doc.title || doc.title_fr || "";
      if (pro?.email) {
        sendEmail({
          to: pro.email,
          templateId: constants.BREVO.LEARNING_CONTENT_REJECTED,
          params: { proFirstName: pro.firstName || pro.fullName || "", contentTitle: title, reason: reason || "Non précisée" },
        }).catch((e) => console.error("[ProLearningAdmin] email rejected error:", e.message));
      }
      await notifyPro({
        proId: pro?._id || doc.addedBy,
        title: "Contenu refusé",
        message: `Votre contenu "${title}" a été refusé.${reason ? " Motif : " + reason : ""}`,
        link: "/pro-learning",
        resourceId: doc._id,
        resourceType: "learningContent",
      });

      return res.json({ success: true, data: doc });
    } catch (err) {
      console.error("[ProLearningAdmin.reject]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },
};
