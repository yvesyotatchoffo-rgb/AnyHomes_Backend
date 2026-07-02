var Mongoose = require('mongoose'),
    Schema = Mongoose.Schema;

module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            // Reference unique auto-générée
            ref: { type: String, unique: true },
            // Utilisateur qui a soumis le formulaire
            userId: { type: Schema.Types.ObjectId, ref: 'users', default: null },
            // Bien concerné
            propertyId: { type: Schema.Types.ObjectId, ref: 'property', default: null },
            // Snapshot propriétaire du bien (pro)
            proId: { type: Schema.Types.ObjectId, ref: 'users', default: null },
            proEmail: { type: String, default: '' },
            // Snapshot bien
            propertyRef:    { type: String, default: '' },
            propertyTitle:  { type: String, default: '' },
            propertyImage:  { type: String, default: '' },
            propertyZipcode:{ type: String, default: '' },
            propertyPrice:  { type: Number, default: 0 },
            propertySurface:{ type: String, default: '' },
            // Données saisies dans le formulaire
            firstName:          { type: String, default: '' },
            lastName:           { type: String, default: '' },
            email:              { type: String, default: '' },
            phone:              { type: String, default: '' },
            likeToBuy:          { type: String, enum: ['Now', 'Later'], default: 'Now' },
            alreadyOwnProperty: { type: Boolean, default: false },
            noMarketingEmails:  { type: Boolean, default: false },
            messageText:        { type: String, default: '' },
            // Statut de traitement
            status: {
                type: String,
                enum: ['pending', 'processed', 'rejected'],
                default: 'pending',
            },
            isDeleted: { type: Boolean, default: false },
        },
        { timestamps: true }
    );

    schema.pre('save', async function (next) {
        if (!this.ref) {
            const ts = Date.now().toString(36).toUpperCase();
            const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
            this.ref = `PRQ-${ts}-${rnd}`;
        }
        next();
    });

    schema.method('toJSON', function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });

    return mongoose.model('proRequest', schema);
};
