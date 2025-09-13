import dotenv from "dotenv";
dotenv.config();
import SibApiV3Sdk from "sib-api-v3-sdk";


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
      htmlContent: `
  <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h1 style="color: #4f46e5; text-align: center;">🔐 OTP Verification</h1>
      <p style="font-size: 16px; color: #374151; text-align: center;">
        Use the following OTP to complete your verification:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="display: inline-block; background: #f3f4f6; color: #111827; font-size: 24px; letter-spacing: 6px; font-weight: bold; padding: 12px 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
          ${otp}
        </span>
      </div>
      <p style="font-size: 14px; color: #6b7280; text-align: center;">
        This OTP will expire in <strong>5 minutes</strong>.  
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
    <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 15px;">
      © ${new Date().getFullYear()} LiveMart. All rights reserved.
    </p>
  </div>
`

    });
    console.log("Email sent:", response);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}
export default sendOTPEmail;
