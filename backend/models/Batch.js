const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchNumber: {
    type: String,
    required: true,
    unique: true
  },
  harvestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Harvest',
    default: null
  },
  cloneDate: {
    type: Date,
    required: true
  },
  harvestDate: {
    type: Date,
    default: null
  },
  plants: [
    {
      strainId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Strain',
        required: true
      },
      count: {
        type: Number,
        required: true,
        default: 0
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Batch', batchSchema);
