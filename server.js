const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/customers") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const customer = new Customer({
          name: data.name,
          email: data.email,
          password: hashedPassword,
          phone: data.phone,
          rate_discount: data.rate_discount,
          wallet: data.wallet,
        });
        await customer.save();
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(customer));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  else if (req.method === "GET" && req.url.startsWith("/customers/")) {
    const id = req.url.split("/")[2];
    try {
      const customer = await Customer.findById(id);
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

  else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  }
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
