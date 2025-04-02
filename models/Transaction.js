const mongoose = require("mongoose");

// สร้าง Schema สำหรับรายรับ-รายจ่าย
const transactionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["income", "expense"], required: true }, // รายรับหรือรายจ่าย
  amount: { type: Number, required: true, min: 0 }, // จำนวนเงิน (ต้องไม่ติดลบ)
  date: { type: Date, default: Date.now }, // วันที่ทำรายการ
});
const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
