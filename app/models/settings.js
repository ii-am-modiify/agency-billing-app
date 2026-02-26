const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

settingsSchema.statics.get = async function(key, defaultValue = null) {
  const doc = await this.findOne({ key });
  return doc ? doc.value : defaultValue;
};

settingsSchema.statics.set = async function(key, value) {
  return this.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
};

settingsSchema.statics.getAll = async function() {
  const docs = await this.find({});
  return docs.reduce((acc, d) => { acc[d.key] = d.value; return acc; }, {});
};

module.exports = mongoose.model('Settings', settingsSchema);
