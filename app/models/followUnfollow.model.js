var Mongoose = require('mongoose'),
    Schema = Mongoose.Schema;
module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            follow_unfollow: { type: Boolean, default: false },
            isDeleted: { type: Boolean, default: false },
            createdAt: Date,
            updatedAt: Date,
            user_id: {
                type: Schema.Types.ObjectId,
                ref: 'users',
            },
            property_id: {
                type: Schema.Types.ObjectId,
                ref: 'properties',
            },
            p2pFollow: { type: Boolean, default: false },
            campaignId: { type: Schema.Types.ObjectId, ref: 'peerCampaigns', },
            status: { type: String, default: 'active' },
            createdAtTimestamp: Number,
            updatedAtTimestamp: Number,
        },
        { timestamps: true }
    );

    schema.method('toJSON', function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });


    schema.pre("save", function (next) {
        if (this.createdAt) {
            this.createdAtTimestamp = new Date(this.createdAt)
        }

        if (this.updatedAt) {
            this.updatedAtTimestamp = new Date(this.updatedAt)
        }

        next();
    });

    // Performance indexes—accelèrent les $lookup et comptages par bien
    schema.index({ property_id: 1 });
    schema.index({ user_id: 1, property_id: 1 }, { unique: false });
    schema.index({ property_id: 1, follow_unfollow: 1 });

    const followUnfollow = mongoose.model('followUnfollow', schema);
    return followUnfollow;
};