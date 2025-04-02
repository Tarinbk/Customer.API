const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true},
  date: { type: Date, default: Date.now },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
