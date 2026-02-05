const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Flower', 'Veg', 'Mom', 'Clone', 'Culture', 'Inventory', 'Packaging', 'Storage', 'Drying'],
    required: true
  },
  sqFoot: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Room', roomSchema);
