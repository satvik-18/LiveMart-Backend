const express = require("express");
const { sendOTPEmail } = require("./services/Auth-Server/mailservice"); // match your path exactly

const app = express();
const PORT = 3000;

// OTP route
app.get("/send-otp", async (req, res) => {
  const email = "your_email@example.com"; // test email
  const otp = Math.floor(100000 + Math.random() * 900000);

  await sendOTPEmail(email, otp);

  res.json({ success: true, otp });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
