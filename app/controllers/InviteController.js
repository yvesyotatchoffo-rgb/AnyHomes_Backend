const { v4: uuidv4 } = require('uuid');
const db = require('../models');
const { sendEmail } = require('../config/brevo.config');
const BREVO_TEMPLATES = require('../utls/constants').BREVO;

const Invite = db.invite;
const Property = db.property;
const Interest = db.interests;
const User = db.users;

exports.create = async (req, res) => {
  try {
    const { propertyId, email, funnelStage } = req.body;
    const ownerId = req.identity._id;

    if (!propertyId || !funnelStage) {
      return res.status(400).json({ success: false, message: 'propertyId and funnelStage are required' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (String(property.addedBy) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: 'You do not own this property' });
    }

    const token = uuidv4();
    const invite = await Invite.create({ propertyId, email, funnelStage, token });

    const frontUrl = process.env.FRONT_WEB_URL || 'http://localhost:8089';
    const inviteLink = `${frontUrl}/invite/${token}`;

    if (email) {
      const owner = await User.findById(ownerId);
      const image = property.images?.[0]?.file || '';
      const imageUrl = image.startsWith('http') ? image : `${frontUrl}/img/${image}`;

      await sendEmail({
        module: 'AUTH',
        to: email,
        templateId: BREVO_TEMPLATES.BUYER_INVITATION,
        params: {
          propertyImage: imageUrl,
          propertyTitle: property.propertyTitle || 'Bien immobilier',
          propertyType: property.propertyType || '',
          surface: String(property.surface || ''),
          zipcode: property.zipcode || '',
          city: property.city || '',
          ownerName: owner?.fullName || 'Un propriétaire',
          inviteLink,
        },
      });
    }

    return res.status(200).json({
      success: true,
      link: inviteLink,
      token,
    });
  } catch (err) {
    console.error('InviteController.create error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const { token } = req.params;
    const invite = await Invite.findOne({ token }).populate('propertyId');

    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    const property = invite.propertyId;
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    return res.status(200).json({
      success: true,
      property: {
        _id: property._id,
        propertyTitle: property.propertyTitle,
        propertyType: property.propertyType,
        surface: property.surface,
        zipcode: property.zipcode,
        city: property.city,
        images: property.images,
        address: property.address,
      },
      email: invite.email,
      funnelStage: invite.funnelStage,
      used: invite.used,
    });
  } catch (err) {
    console.error('InviteController.get error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.accept = async (req, res) => {
  try {
    const { token } = req.params;
    const buyerId = req.identity._id;

    const invite = await Invite.findOne({ token, used: false });
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invitation not found or already used' });
    }

    const property = await Property.findById(invite.propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (String(property.addedBy) === String(buyerId)) {
      return res.status(400).json({ success: false, message: 'You cannot accept an invitation for your own property' });
    }

    const existingInterest = await Interest.findOne({
      propertyId: invite.propertyId,
      buyerId,
      isDeleted: false,
    });

    if (existingInterest) {
      invite.used = true;
      invite.acceptedBy = buyerId;
      await invite.save();

      return res.status(200).json({ success: true, alreadyExists: true });
    }

    const interest = await Interest.create({
      propertyId: invite.propertyId,
      buyerId,
      funnelStatus: invite.funnelStage,
      propertyType: property.propertyType,
      status: 'active',
      interestStatus: 'pending',
    });

    await Property.findByIdAndUpdate(invite.propertyId, {
      $inc: { activityIndicatorCount: 1 },
      interestUpdatedTime: new Date(),
    });

    invite.used = true;
    invite.acceptedBy = buyerId;
    await invite.save();

    return res.status(200).json({ success: true, alreadyExists: false });
  } catch (err) {
    console.error('InviteController.accept error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
