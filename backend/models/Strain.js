const mongoose = require('mongoose');

const strainSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['indica', 'sativa', 'hybrid', 'CBD'],
    default: null
  },
   status: {
    type: String,
    enum: ['production', 'bench', 'pheno'],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Strain', strainSchema);
