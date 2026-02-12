const mongoose = require('mongoose');
const Batch = require('./Batch');

const harvestSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  room: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    }
  ],
  strains: [
    {
      strainId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Strain',
        required: true
      },
      totes: [
        {
          wetWeight: {
            type: Number,
            required: true
          }
        }
      ],
      totalDry: {
        type: Number,
        default: null
      }
    }
  ],
  harvestDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


// UNTESTED, attempting to automatically get the strain IDs from the batch when creating a harvest. Got this from reading some docs and forums but not sure if it works.
// If not we can just query the DB and populate that way after creating each harvest. Doesn't matter too much.

// Static method to create a harvest with strain IDs auto-populated from batch
harvestSchema.statics.createFromBatch = async function(batchId) {
  const batch = await Batch.findById(batchId);
  
  if (!batch) {
    throw new Error('Batch not found');
  }

  // Auto-populate strainIds from batch.plants
  const strains = batch.plants.map(plant => ({
    strainId: plant.strainId,
    totes: []
  }));

  return this.create({
    batchId,
    strains
  });
};

module.exports = mongoose.model('Harvest', harvestSchema);
