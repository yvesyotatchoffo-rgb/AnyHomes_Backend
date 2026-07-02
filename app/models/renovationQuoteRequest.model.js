var Mongoose = require('mongoose'),
    Schema = Mongoose.Schema;

module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
            propertyId: { type: Schema.Types.ObjectId, ref: 'property', default: null },
            // Snapshot utilisateur
            firstName: { type: String, default: '' },
            lastName:  { type: String, default: '' },
            email:     { type: String, default: '' },
            phone:     { type: String, default: '' },
            // Snapshot bien immobilier
            address:            { type: String, default: '' },
            zipcode:            { type: String, default: '' },
            city:               { type: String, default: '' },
            surface:            { type: String, default: '' },
            rooms:              { type: String, default: '' },
            type:               { type: String, default: '' },
            propertyType:       { type: String, default: '' },
            heatingType:        { type: String, default: '' },
            energymode:         { type: String, default: '' },
            energyConsumption:  { type: String, default: '' },
            emissions:          { type: String, default: '' },
            energy_efficient:   { type: String, default: '' },
            emission_efficient: { type: String, default: '' },
            dateOfDiagnosis:    { type: String, default: '' },
            // Statut de traitement
            status: {
                type: String,
                enum: ['pending', 'accepted', 'rejected'],
                default: 'pending',
            },
            isDeleted: { type: Boolean, default: false },
        },
        { timestamps: true }
    );

    schema.method('toJSON', function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });

    return mongoose.model('renovationQuoteRequest', schema);
};
