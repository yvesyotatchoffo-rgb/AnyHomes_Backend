const Mongoose = require("mongoose");
const Schema = Mongoose.Schema;

const visitFolderSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "properties", required: true, index: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "generated", "modified", "ready"],
      default: "draft",
      index: true,
    },
    version: { type: Number, default: 1 },
    destination: { type: String, enum: ["sale", "rent"], required: true },
    selectedPhotos: [
      {
        fileName: String,
        originalname: String,
        order: Number,
      },
    ],
    editableContent: {
      visitHighlights: { type: String, default: "" },
      neighborhood: { type: String, default: "" },
      practicalLife: { type: String, default: "" },
      condominium: { type: String, default: "" },
      price: { type: String, default: "" },
      spaces: [
        {
          label: { type: String, default: "" },
          surface: { type: String, default: "" },
        },
      ],
      valorizationItems: [{ type: Schema.Types.ObjectId, ref: "valorizationitems" }],
      selectedDocumentIds: [{ type: String }],
      plans: [
        {
          fileName: { type: String, default: "" },
          originalname: { type: String, default: "" },
        },
      ],
    },
    generatedSnapshot: {
      cover: { type: Object, default: {} },
      summary: { type: Object, default: {} },
      media: { type: Object, default: {} },
      environment: { type: Object, default: {} },
      keyFigures: { type: Object, default: {} },
      valueHistory: { type: Object, default: {} },
      nextSteps: { type: Object, default: {} },
    },
    generatedAt: { type: Date, default: null },
    modifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = (mongoose) => mongoose.model("visitfolders", visitFolderSchema);
