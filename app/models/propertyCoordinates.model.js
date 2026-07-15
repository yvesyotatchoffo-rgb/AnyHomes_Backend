const mongoose = require('mongoose');

const propertyCoordinatesSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    price: { type: Number },
    propertyType: { type: String },
    city: { type: String },
    zipcode: { type: String },
    propertyTitle: { type: String },
    image: { type: String },
  },
  { _id: false, versionKey: false }
);

module.exports = mongoose.model('PropertyCoordinates', propertyCoordinatesSchema, 'property_coordinates');
