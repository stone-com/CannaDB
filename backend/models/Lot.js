const mongoose = require('mongoose');

const lotSchema = new mongoose.Schema({
  strainIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Strain',
      required: true
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Lot', lotSchema);
