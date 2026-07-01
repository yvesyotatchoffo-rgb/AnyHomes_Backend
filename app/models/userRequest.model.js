var Mongoose = require('mongoose'),
    Schema = Mongoose.Schema;

module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            firstName: { type: String, required: true },
            lastName: { type: String, default: '' },
            email: { type: String, required: true },
            phone: { type: String, default: '' },
            message: { type: String, default: '' },
            // Type de demande — extensible pour futures thématiques
            type: {
                type: String,
                default: 'training_partnership',
                enum: ['training_partnership', 'support', 'account_deletion', 'other'],
            },
            status: {
                type: String,
                default: 'pending',
                enum: ['pending', 'processed', 'rejected'],
            },
            addedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
            isDeleted: { type: Boolean, default: false },
        },
        { timestamps: true }
    );

    schema.method('toJSON', function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });

    const userRequest = mongoose.model('userRequest', schema);
    return userRequest;
};
