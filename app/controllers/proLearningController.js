const db = require("../models");
const mongoose = require("mongoose");

const Users = db.users;
const Blogs = db.blogs;
const FunnelUrl = db.funnelUrl;

const toObjectId = (id) =>
  mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

/**
 * Détermine si un compte pro a accès au Learning Center (publication).
 * Accès si accountType === 'pro' ET (plan.learningCenterEnabled OU user.learningCenterEnabled).
 */
const hasLearningAccess = async (user) => {
  if (!user || user.accountType !== "pro") return false;
  if (user.learningCenterEnabled === true) return true;
  if (user.planId && (user.planId.learningCenterEnabled === true)) return true;
  // planId peut être peuplé ou un ObjectId brut
  if (user.planId && mongoose.isValidObjectId(user.planId)) {
    const plan = await db.plans.findById(user.planId).select("learningCenterEnabled").lean();
    if (plan?.learningCenterEnabled) return true;
  }
  return false;
};

const getProContent = async (proId) => {
  const [blogs, videos] = await Promise.all([
    Blogs.find({ addedBy: proId, isDeleted: false }).lean(),
    FunnelUrl.find({ addedBy: proId }).lean(),
  ]);

  const items = [
    ...blogs.map((b) => ({
      id: b._id,
      contentType: "article",
      title: b.title || b.title_fr || "",
      image: b.images?.[0] || b.banner || null,
      personaId: b.categoryId || null,
      categoryId: b.subCategoryId || null,
      readMinutes: b.readMinutes || 0,
      viewCount: b.viewCount || 0,
      shareCount: b.shareCount || 0,
      likeCount: (b.contentLike || []).length,
      status: b.status,
      isProContent: b.isProContent,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
    ...videos.map((v) => ({
      id: v._id,
      contentType: "video",
      title: v.title || v.title_fr || "",
      image: v.image || null,
      personaId: v.type ? toObjectId(v.type) : null,
      categoryId: v.topic ? toObjectId(v.topic) : null,
      duration: v.duration || "",
      viewCount: v.viewCount || 0,
      shareCount: v.shareCount || 0,
      likeCount: v.funnelLikesCount || (v.viewersId?.length || 0),
      status: v.status,
      isProContent: v.isProContent,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })),
  ];
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

module.exports = {
  /**
   * GET /pro/learning/access
   * Renvoie l'accès du pro + stats globales.
   */
  access: async (req, res) => {
    try {
      const user = req.identity;
      if (!user || req.isGuest) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
      }
      const access = await hasLearningAccess(user);
      if (!access) {
        return res.status(403).json({ success: false, message: "Vous n'avez pas accès au Learning Center." });
      }
      const items = await getProContent(user._id);
      const stats = {
        published: items.filter((i) => i.status === "active").length,
        draft: items.filter((i) => i.status === "pending" || i.status === "rejected").length,
        totalViews: items.reduce((s, i) => s + i.viewCount, 0),
        totalShares: items.reduce((s, i) => s + i.shareCount, 0),
        totalLikes: items.reduce((s, i) => s + i.likeCount, 0),
      };
      return res.json({
        success: true,
        data: { access: true, stats, items },
      });
    } catch (err) {
      console.error("[ProLearning.access]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /pro/learning/content — liste paginée/filtrée des contenus du pro.
   */
  list: async (req, res) => {
    try {
      const user = req.identity;
      if (!(await hasLearningAccess(user))) {
        return res.status(403).json({ success: false, message: "Accès refusé." });
      }
      const { contentType, status, search, personaId, page = 1, count = 10 } = req.query;
      let items = await getProContent(user._id);

      if (contentType) items = items.filter((i) => i.contentType === contentType);
      if (status) items = items.filter((i) => i.status === status);
      if (personaId) items = items.filter((i) => String(i.personaId || "") === String(personaId));
      if (search && search.trim()) {
        const q = search.toLowerCase();
        items = items.filter((i) => (i.title || "").toLowerCase().includes(q));
      }

      const total = items.length;
      const pageNum = Math.max(1, Number(page) || 1);
      const perPage = Math.max(1, Number(count) || 10);
      const start = (pageNum - 1) * perPage;
      const paginated = items.slice(start, start + perPage);

      return res.json({
        success: true,
        data: paginated,
        total,
        page: pageNum,
        count: perPage,
      });
    } catch (err) {
      console.error("[ProLearning.list]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /pro/learning/video — crée un contenu vidéo (pending).
   */
  createVideo: async (req, res) => {
    try {
      const user = req.identity;
      if (!(await hasLearningAccess(user))) {
        return res.status(403).json({ success: false, message: "Accès refusé." });
      }
      const { title, youtubeUrl, description, image, type, topic, duration, tags } = req.body;
      if (!title || !youtubeUrl || !image || !type || !topic || !tags || !tags.length) {
        return res.status(400).json({ success: false, message: "Titre, lien vidéo, image, persona, training topic et tags requis." });
      }
      const created = await FunnelUrl.create({
        title,
        title_fr: title,
        youtubeUrl,
        description,
        description_fr: description,
        image,
        type,
        topic,
        duration,
        tags,
        addedBy: user._id,
        status: "pending",
        isProContent: true,
        isLearning: true,
        isFunnel: false,
      });
      return res.json({ success: true, data: created });
    } catch (err) {
      console.error("[ProLearning.createVideo]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /pro/learning/blog — crée un article (pending).
   */
  createBlog: async (req, res) => {
    try {
      const user = req.identity;
      if (!(await hasLearningAccess(user))) {
        return res.status(403).json({ success: false, message: "Accès refusé." });
      }
      const { title, description, categoryId, subCategoryId, banner, images, readMinutes } = req.body;
      if (!title || !description || !categoryId) {
        return res.status(400).json({ success: false, message: "Titre, description et persona requis." });
      }
      const created = await Blogs.create({
        title,
        title_fr: title,
        description,
        description_fr: description,
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        banner: banner || null,
        images: Array.isArray(images) ? images : banner ? [banner] : [],
        readMinutes: readMinutes || 0,
        addedBy: user._id,
        blogOwner: user._id,
        status: "pending",
        isProContent: true,
      });
      return res.json({ success: true, data: created });
    } catch (err) {
      console.error("[ProLearning.createBlog]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * PUT /pro/learning/content/:id — modifie un contenu du pro (pending/rejected).
   */
  updateContent: async (req, res) => {
    try {
      const user = req.identity;
      if (!(await hasLearningAccess(user))) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { id, contentType } = req.params;
      const body = req.body;

      if (contentType === "video") {
        const doc = await FunnelUrl.findById(id);
        if (!doc || String(doc.addedBy) !== String(user._id)) {
          return res.status(404).json({ success: false, message: "Contenu introuvable." });
        }
        if (!["pending", "rejected"].includes(doc.status)) {
          return res.status(400).json({ success: false, message: "Un contenu actif ne peut être modifié que via le toggle." });
        }
        const upd = await FunnelUrl.findByIdAndUpdate(id, {
          $set: {
            title: body.title ?? doc.title,
            title_fr: body.title ?? doc.title,
            youtubeUrl: body.youtubeUrl ?? doc.youtubeUrl,
            description: body.description ?? doc.description,
            description_fr: body.description ?? doc.description,
            image: body.image ?? doc.image,
            type: body.type ?? doc.type,
            topic: body.topic ?? doc.topic,
            duration: body.duration ?? doc.duration,
            tags: Array.isArray(body.tags) ? body.tags : doc.tags,
          },
        }, { new: true });
        return res.json({ success: true, data: upd });
      } else {
        const doc = await Blogs.findById(id);
        if (!doc || String(doc.addedBy) !== String(user._id)) {
          return res.status(404).json({ success: false, message: "Contenu introuvable." });
        }
        if (!["pending", "rejected"].includes(doc.status)) {
          return res.status(400).json({ success: false, message: "Un contenu actif ne peut être modifié que via le toggle." });
        }
        const upd = await Blogs.findByIdAndUpdate(id, {
          $set: {
            title: body.title ?? doc.title,
            title_fr: body.title ?? doc.title,
            description: body.description ?? doc.description,
            description_fr: body.description ?? doc.description,
            categoryId: body.categoryId ?? doc.categoryId,
            subCategoryId: body.subCategoryId ?? doc.subCategoryId,
            banner: body.banner ?? doc.banner,
            images: Array.isArray(body.images) ? body.images : (body.banner ? [body.banner] : doc.images),
            readMinutes: body.readMinutes ?? doc.readMinutes,
          },
        }, { new: true });
        return res.json({ success: true, data: upd });
      }
    } catch (err) {
      console.error("[ProLearning.updateContent]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /pro/learning/content/:id/toggle — active/désactive un contenu actif/inactif.
   */
  toggleContent: async (req, res) => {
    try {
      const user = req.identity;
      if (!(await hasLearningAccess(user))) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { id, contentType } = req.params;
      let doc;
      if (contentType === "video") {
        doc = await FunnelUrl.findById(id);
        if (!doc || String(doc.addedBy) !== String(user._id)) return res.status(404).json({ success: false, message: "Contenu introuvable." });
        if (!["active", "inactive"].includes(doc.status)) return res.status(400).json({ success: false, message: "Contenu non activable." });
        const next = doc.status === "active" ? "inactive" : "active";
        const upd = await FunnelUrl.findByIdAndUpdate(id, { $set: { status: next } }, { new: true });
        return res.json({ success: true, data: upd, next });
      } else {
        doc = await Blogs.findById(id);
        if (!doc || String(doc.addedBy) !== String(user._id)) return res.status(404).json({ success: false, message: "Contenu introuvable." });
        if (!["active", "deactive"].includes(doc.status)) return res.status(400).json({ success: false, message: "Contenu non activable." });
        const next = doc.status === "active" ? "deactive" : "active";
        const upd = await Blogs.findByIdAndUpdate(id, { $set: { status: next } }, { new: true });
        return res.json({ success: true, data: upd, next });
      }
    } catch (err) {
      console.error("[ProLearning.toggleContent]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * DELETE /pro/learning/content/:id — supprime un contenu du pro (soft delete).
   */
  deleteContent: async (req, res) => {
    try {
      const user = req.identity;
      if (!(await hasLearningAccess(user))) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { id, contentType } = req.params;
      if (contentType === "video") {
        const doc = await FunnelUrl.findById(id);
        if (!doc || String(doc.addedBy) !== String(user._id)) return res.status(404).json({ success: false, message: "Contenu introuvable." });
        await FunnelUrl.findByIdAndDelete(id);
      } else {
        const doc = await Blogs.findById(id);
        if (!doc || String(doc.addedBy) !== String(user._id)) return res.status(404).json({ success: false, message: "Contenu introuvable." });
        await Blogs.findByIdAndUpdate(id, { $set: { isDeleted: true } });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error("[ProLearning.deleteContent]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /learning/share — incrémente le compteur de partage d'un contenu.
   * Appelé quand un utilisateur partage un contenu du learning center.
   */
  share: async (req, res) => {
    try {
      const { contentType, id } = req.params;
      if (contentType === "video") {
        await FunnelUrl.updateOne({ _id: id }, { $inc: { shareCount: 1 } });
      } else {
        await Blogs.updateOne({ _id: id }, { $inc: { shareCount: 1 } });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error("[ProLearning.share]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },
};
