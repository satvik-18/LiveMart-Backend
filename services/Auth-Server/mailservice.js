require("dotenv").config();
const SibApiV3Sdk = require("sib-api-v3-sdk");

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendOTPEmail(to, otp) {
  const sender = { 
    email: process.env.SENDER_EMAIL, 
    name: process.env.SENDER_NAME 
  };
  const receivers = [{ email: to }];

  try {
    const response = await tranEmailApi.sendTransacEmail({
      sender,
      to: receivers,
      subject: "Your LiveMart OTP Code",
      htmlContent: `<h1>Your OTP is: ${otp}</h1><p>It will expire in 5 minutes.</p>`,
    });
    console.log("Email sent:", response);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

module.exports = sendOTPEmail;
