const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// สร้าง Schema สำหรับข้อมูลลูกค้า
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  rate_discount: { type: Number, default: null },
  wallet: { type: Number, default: 0 }
});

// Hash password ก่อนเก็บลงฐานข้อมูล
customerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// สร้าง method เพื่อเปรียบเทียบ password
customerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// สร้าง model จาก Schema
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
