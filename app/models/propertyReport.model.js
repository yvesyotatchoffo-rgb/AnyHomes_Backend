var Mongoose = require('mongoose'),
    Schema = Mongoose.Schema;

module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            // Reference unique auto-générée
            ref: { type: String, unique: true },
            // Lien vers l'utilisateur si connecté (optionnel)
            userId: { type: Schema.Types.ObjectId, ref: 'users', default: null },
            // Snapshot du bien signalé
            propertyId: { type: Schema.Types.ObjectId, ref: 'property', default: null },
            propertyRef: { type: String, default: '' },
            propertyTitle: { type: String, default: '' },
            propertyImage: { type: String, default: '' },
            // Données du signalant
            firstName: { type: String, default: '' },
            lastName:  { type: String, default: '' },
            email:     { type: String, default: '' },
            phone:     { type: String, default: '' },
            // Raison du signalement
            reason: { type: String, default: '' },
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

    // Génère une référence unique avant la sauvegarde
    schema.pre('save', async function (next) {
        if (!this.ref) {
            const ts = Date.now().toString(36).toUpperCase();
            const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
            this.ref = `RPT-${ts}-${rnd}`;
        }
        next();
    });

    schema.method('toJSON', function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });

    return mongoose.model('propertyReport', schema);
};
