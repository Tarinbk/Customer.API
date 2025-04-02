const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const url = require("url");

mongoose.connect("mongodb://localhost:27017/customerDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const customerSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: String,
  rate_discount: { type: Number, default: null },
  wallet: { type: Number, default: 0 },
});
const Customer = mongoose.model("Customer", customerSchema);

const orderSchema = new mongoose.Schema({
  customer_id: mongoose.Schema.Types.ObjectId,
  product_name: String,
  price: Number,
  discounted_price: Number,
  purchase_date: Date,
});
const Order = mongoose.model("Order", orderSchema);

// สร้าง Schema สำหรับรายรับ-รายจ่าย
const transactionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["income", "expense"], required: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
});
const Transaction = mongoose.model("Transaction", transactionSchema);

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    body = body ? JSON.parse(body) : {};

    // CREATE: Create a new customer
    if (req.method === "POST" && parsedUrl.pathname === "/customers") {
      try {
        const hashedPassword = await bcrypt.hash(body.password, 10);
        const customer = new Customer({
          name: body.name,
          email: body.email,
          password: hashedPassword,
          phone: body.phone,
          rate_discount: body.rate_discount,
          wallet: body.wallet,
        });
        await customer.save();
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(customer));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }

    // READ: Get customer by ID
    else if (
      req.method === "GET" &&
      parsedUrl.pathname.startsWith("/customers/")
    ) {
      const customerId = parsedUrl.pathname.split("/")[2];
      try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Customer not found" }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(customer));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }

    // UPDATE: Update customer by ID
    else if (
      req.method === "PUT" &&
      parsedUrl.pathname.startsWith("/customers/")
    ) {
      const customerId = parsedUrl.pathname.split("/")[2];
      try {
        const customer = await Customer.findByIdAndUpdate(customerId, body, {
          new: true,
          runValidators: true,
        });
        if (!customer) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Customer not found" }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(customer));
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }

    // DELETE: Delete customer by ID
    else if (
      req.method === "DELETE" &&
      parsedUrl.pathname.startsWith("/customers/")
    ) {
      const customerId = parsedUrl.pathname.split("/")[2];
      try {
        const customer = await Customer.findByIdAndDelete(customerId);
        if (!customer) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Customer not found" }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Customer deleted" }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    } else if (
      req.method === "POST" &&
      parsedUrl.pathname.startsWith("/customers/") &&
      parsedUrl.pathname.endsWith("/wallet/topup")
    ) {
      const customerId = parsedUrl.pathname.split("/")[2];
      const { amount } = body;

      try {
        // ตรวจสอบว่าลูกค้าหรือไม่
        const customer = await Customer.findById(customerId);
        if (!customer) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "ไม่พบลูกค้า" }));
        }

        // ตรวจสอบว่า amount เป็นตัวเลขและมากกว่าศูนย์
        if (isNaN(amount) || amount <= 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "จำนวนเงินต้องเป็นตัวเลขที่มากกว่าศูนย์" })
          );
        }

        // ตรวจสอบให้แน่ใจว่า customer.wallet เป็นตัวเลขก่อนการบวก
        customer.wallet = Number(customer.wallet); // ทำให้ customer.wallet เป็นตัวเลข

        // เติมเงินในกระเป๋าของลูกค้า
        customer.wallet += Number(amount); // บวกเงินเข้าไปใน wallet

        await customer.save();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: "เติมเงินสำเร็จ",
            ยอดคงเหลือ: customer.wallet,
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }

    // การจัดการการซื้อสินค้า
    else if (
      req.method === "POST" &&
      parsedUrl.pathname.startsWith("/customers/") &&
      parsedUrl.pathname.endsWith("/purchase")
    ) {
      const customerId = parsedUrl.pathname.split("/")[2];
      const { product_name, price } = body;

      try {
        // ตรวจสอบว่าลูกค้าหรือไม่
        const customer = await Customer.findById(customerId);
        if (!customer) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "ไม่พบลูกค้า" }));
        }

        // ตรวจสอบว่าเงินในกระเป๋าของลูกค้าเพียงพอสำหรับการซื้อหรือไม่
        if (customer.wallet < price) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "ยอดเงินในกระเป๋าไม่เพียงพอ" })
          );
        }

        // คำนวณราคาที่ลดแล้ว (หากมีการใช้ส่วนลด)
        const discounted_price = customer.rate_discount
          ? price * (1 - customer.rate_discount / 100)
          : price;

        // สร้างคำสั่งซื้อใหม่
        const order = new Order({
          customer_id: customer._id,
          product_name,
          price,
          discounted_price,
          purchase_date: new Date(),
        });

        await order.save();

        // อัปเดตยอดเงินในกระเป๋าของลูกค้าหลังจากการซื้อ
        customer.wallet -= discounted_price;
        await customer.save();

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: "การซื้อสำเร็จ",
            order,
            updatedWallet: customer.wallet,
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
    // การดึงประวัติคำสั่งซื้อทั้งหมดของลูกค้า
    else if (
      req.method === "GET" &&
      parsedUrl.pathname.startsWith("/customers/") &&
      parsedUrl.pathname.endsWith("/orders")
    ) {
      const customerId = parsedUrl.pathname.split("/")[2];

      try {
        // ตรวจสอบว่ามีลูกค้าตาม ID หรือไม่
        const customer = await Customer.findById(customerId);
        if (!customer) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "ไม่พบลูกค้า" }));
        }

        // ดึงข้อมูลคำสั่งซื้อทั้งหมดที่เกี่ยวข้องกับลูกค้าจากฐานข้อมูล
        const orders = await Order.find({ customer_id: customer._id });

        // ตรวจสอบว่ามีคำสั่งซื้อหรือไม่
        if (orders.length === 0) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "ไม่มีคำสั่งซื้อสำหรับลูกค้านี้" })
          );
        }

        // ส่งกลับข้อมูลคำสั่งซื้อทั้งหมด
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ orders }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
    // การแสดงประวัติคำสั่งซื้อของลูกค้าโดยใช้ customerId
    else if (req.method === "GET" && parsedUrl.pathname === "/orders") {
      const { id } = body; // รับข้อมูลจาก body ของคำขอ

      try {
        // ตรวจสอบว่า id ของลูกค้าถูกต้องหรือไม่
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "กรุณาระบุ id ของลูกค้า" }));
        }

        // ตรวจสอบว่าลูกค้ามีอยู่ในระบบ
        const customer = await Customer.findById(id);
        if (!customer) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "ไม่พบลูกค้าตาม id ที่ระบุ" })
          );
        }

        // ดึงข้อมูลคำสั่งซื้อของลูกค้าจากฐานข้อมูล
        const orders = await Order.find({ customer_id: customer._id });

        // ตรวจสอบว่ามีคำสั่งซื้อหรือไม่
        if (orders.length === 0) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "ลูกค้านี้ไม่มีประวัติคำสั่งซื้อ" })
          );
        }

        // ส่งข้อมูลคำสั่งซื้อทั้งหมด
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ orders }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
    // API เพิ่มรายการรายรับหรือรายจ่าย
    else if (req.method === "POST" && parsedUrl.pathname === "/transactions") {
      const { name, type, amount } = body;

      try {
        // ตรวจสอบข้อมูลที่จำเป็น
        if (!name || !type || !amount) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              error: "กรุณาระบุชื่อรายการ, ประเภท และจำนวนเงิน",
            })
          );
        }

        // ตรวจสอบประเภทว่าเป็น "income" หรือ "expense"
        if (type !== "income" && type !== "expense") {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "ประเภทต้องเป็น 'income' หรือ 'expense'" })
          );
        }

        // สร้างธุรกรรมใหม่
        const newTransaction = new Transaction({
          name,
          type,
          amount,
          date: new Date(), // ใช้วันที่ปัจจุบัน
        });

        // บันทึกข้อมูล
        await newTransaction.save();

        // ส่งกลับผลลัพธ์เมื่อเพิ่มสำเร็จ
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: "เพิ่มธุรกรรมสำเร็จ",
            transaction: newTransaction,
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
    // เพิ่ม API สำหรับแสดงรายการรายรับและรายจ่ายพร้อมฟิลเตอร์
    else if (req.method === "GET" && parsedUrl.pathname === "/transactions") {
      const { type, startDate, endDate } = parsedUrl.query;

      try {
        // สร้างตัวกรองเบื้องต้น
        let filter = {};

        // ฟิลเตอร์ตามประเภท (income หรือ expense)
        if (type && (type === "income" || type === "expense")) {
          filter.type = type;
        }

        // ฟิลเตอร์ตามวันที่ (เริ่มต้นและสิ้นสุด)
        if (startDate || endDate) {
          const dateFilter = {};
          if (startDate) dateFilter.$gte = new Date(startDate);
          if (endDate) dateFilter.$lte = new Date(endDate);
          filter.date = dateFilter;
        }

        // ดึงข้อมูลธุรกรรมที่ตรงกับเงื่อนไขที่ฟิลเตอร์
        const transactions = await Transaction.find(filter);

        // คำนวณยอดคงเหลือ
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach((transaction) => {
          if (transaction.type === "income") {
            totalIncome += transaction.amount;
          } else if (transaction.type === "expense") {
            totalExpense += transaction.amount;
          }
        });

        const balance = totalIncome - totalExpense; // ยอดคงเหลือ

        // ส่งผลลัพธ์
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            transactions,
            balance,
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    } else if (req.method === "GET" && parsedUrl.pathname === "/dashboard") {
      try {
        // ดึงข้อมูลรายรับและรายจ่ายในปีนี้
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;

        // สร้างฟิลเตอร์เพื่อดึงข้อมูลปีนี้และปีที่แล้ว
        const currentYearFilter = {
          date: {
            $gte: new Date(`${currentYear}-01-01`),
            $lt: new Date(`${currentYear + 1}-01-01`),
          },
        };
        const previousYearFilter = {
          date: {
            $gte: new Date(`${previousYear}-01-01`),
            $lt: new Date(`${previousYear + 1}-01-01`),
          },
        };

        // ดึงข้อมูลรายรับและรายจ่ายในปีนี้
        const currentYearIncome = await Transaction.find({
          ...currentYearFilter,
          type: "income",
        });
        const currentYearExpense = await Transaction.find({
          ...currentYearFilter,
          type: "expense",
        });

        // ดึงข้อมูลรายรับและรายจ่ายในปีที่แล้ว
        const previousYearIncome = await Transaction.find({
          ...previousYearFilter,
          type: "income",
        });
        const previousYearExpense = await Transaction.find({
          ...previousYearFilter,
          type: "expense",
        });

        // คำนวณยอดรายรับและรายจ่ายรายเดือนในปีนี้
        const currentYearIncomeByMonth = Array(12).fill(0);
        const currentYearExpenseByMonth = Array(12).fill(0);

        currentYearIncome.forEach((transaction) => {
          const month = transaction.date.getMonth(); // 0-11
          currentYearIncomeByMonth[month] += transaction.amount;
        });

        currentYearExpense.forEach((transaction) => {
          const month = transaction.date.getMonth(); // 0-11
          currentYearExpenseByMonth[month] += transaction.amount;
        });

        // คำนวณยอดรายรับและรายจ่ายรายเดือนในปีที่แล้ว
        const previousYearIncomeByMonth = Array(12).fill(0);
        const previousYearExpenseByMonth = Array(12).fill(0);

        previousYearIncome.forEach((transaction) => {
          const month = transaction.date.getMonth(); // 0-11
          previousYearIncomeByMonth[month] += transaction.amount;
        });

        previousYearExpense.forEach((transaction) => {
          const month = transaction.date.getMonth(); // 0-11
          previousYearExpenseByMonth[month] += transaction.amount;
        });

        // คำนวณยอดรวมรายรับและรายจ่ายในปีนี้และปีที่แล้ว
        const totalCurrentYearIncome = currentYearIncome.reduce(
          (sum, transaction) => sum + transaction.amount,
          0
        );
        const totalCurrentYearExpense = currentYearExpense.reduce(
          (sum, transaction) => sum + transaction.amount,
          0
        );
        const totalPreviousYearIncome = previousYearIncome.reduce(
          (sum, transaction) => sum + transaction.amount,
          0
        );
        const totalPreviousYearExpense = previousYearExpense.reduce(
          (sum, transaction) => sum + transaction.amount,
          0
        );

        // คำนวณอัตราการเติบโต
        const incomeGrowth =
          totalPreviousYearIncome === 0
            ? 0
            : ((totalCurrentYearIncome - totalPreviousYearIncome) /
                totalPreviousYearIncome) *
              100;
        const expenseGrowth =
          totalPreviousYearExpense === 0
            ? 0
            : ((totalCurrentYearExpense - totalPreviousYearExpense) /
                totalPreviousYearExpense) *
              100;

        // ส่งข้อมูล
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            currentYearIncomeByMonth,
            currentYearExpenseByMonth,
            totalCurrentYearIncome,
            totalCurrentYearExpense,
            incomeGrowth,
            expenseGrowth,
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
