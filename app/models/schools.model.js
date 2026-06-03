var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      schoolId: { type: String, required: true, unique: true },   //Identifiant_de_l_etablissement
      EstablishmentName: { type: String },        //Nom_etablissement
      establishmentType: { type: String, enum: ["college", "school", "highschool"] },        //Type_etablissement
      schoolStatus: { type: String, enum: ["Public", "Private"] },             //Statut_public_prive
      address: { type: String },                  //Address
      postalCode: { type: Number },
      schoolType: { type: String },               //Type_Ecole
      phone: { type: String },                    //Telephone
      website: { type: String },                  //Web
      email: { type: String },                    //Email
      numberOfStudents: { type: Number },         //Nombre_d_eleves
      position: { type: String },                 //position
      coordX_origin: { type: Number },            //coordX_origine (X coordinate (original))
      coordY_origin: { type: Number },           //coordY_origine (Y coordinate (original))
      latitude: { type: Number, required: true }, //latitude
      longitude: { type: Number, required: true },//longitude
      successRate: { type: Number },              //taux_de_réussite (School's overall success rate)
      examGrade: { type: Number },                //Note_écrite_collège (Average exam grade)
      distinctionRate: { type: Number },          //Taux_mention (Percentage of distinctions awarded)
      SPI: { type: Number },                      //IPS (Social Position Index)
      location: {
        type: { type: String, enum: ["Point"], required: true },
        coordinates: { type: [Number], required: true }, // Stores [longitude, latitude]
      },
      linkedProperties: [
        {
          propertyId: { type: Schema.Types.ObjectId, ref: "properties" },
        },
      ],
      isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
  );
  schema.index({ location: "2dsphere" });
  const schools = mongoose.model("schools", schema);

  return schools;
};