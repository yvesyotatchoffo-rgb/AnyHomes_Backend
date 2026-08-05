module.exports = (mongoose) => {
  const schema = mongoose.Schema({
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    role: { type: String, enum: ['admin', 'collaborator'], default: 'collaborator' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    status: { type: String, enum: ['pending', 'active'], default: 'pending' },
    permissions: {
      type: [String],
      default: ['view_dashboard', 'view_leads', 'view_properties', 'view_hot_leads', 'invite_lead'],
      enum: [
        'view_dashboard', 'view_leads', 'view_properties', 'view_hot_leads',
        'invite_lead', 'manage_collaborators', 'manage_settings',
      ],
    },
  }, { timestamps: true });

  schema.index({ agencyId: 1, userId: 1 }, { unique: true });

  return mongoose.model('agency_members', schema);
};