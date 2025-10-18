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
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0a0e27 0%, #1a0b2e 50%, #16003b 100%); width: 100% !important; min-height: 100vh;">
  <div style="font-family: 'Courier New', monospace; padding: 20px 10px;">
    <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f0c29 0%, #1a0933 50%, #24243e 100%); border: 2px solid #00ff9f; border-radius: 15px; padding: 0; overflow: hidden; box-shadow: 0 0 40px rgba(0, 255, 159, 0.4), 0 0 80px rgba(255, 0, 255, 0.2); width: 100%; box-sizing: border-box;">
      
      <!-- Animated scanline effect -->
      <div style="height: 3px; background: linear-gradient(90deg, transparent, #00ff9f, transparent); animation: scan 2s linear infinite;"></div>
      
      <!-- Header -->
      <div style="background: linear-gradient(90deg, #ff006e 0%, #8338ec 50%, #00f5ff 100%); padding: 20px 15px; text-align: center; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px); pointer-events: none;"></div>
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 10px #00ff9f, 0 0 20px #00ff9f, 0 0 30px #ff006e; position: relative; z-index: 1;">
          ⚡ ACCESS CODE ⚡
        </h1>
        <div style="margin-top: 8px; color: #00ff9f; font-size: 11px; letter-spacing: 2px; text-shadow: 0 0 5px #00ff9f;">
          SYSTEM VERIFICATION REQUIRED
        </div>
      </div>

      <!-- Main content -->
      <div style="padding: 30px 20px;">
        <!-- Glitch text effect -->
        <div style="text-align: center; margin-bottom: 25px;">
          <p style="color: #00f5ff; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px #00f5ff;">
            &gt;&gt; IDENTITY VERIFICATION<br>PROTOCOL INITIATED
          </p>
        </div>

        <!-- OTP Box with neon glow -->
        <div style="background: rgba(0, 0, 0, 0.6); border: 3px solid #ff006e; border-radius: 10px; padding: 25px 15px; margin: 25px 0; position: relative; box-shadow: inset 0 0 30px rgba(255, 0, 110, 0.2), 0 0 30px rgba(255, 0, 110, 0.4);">
          <div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #0f0c29; padding: 0 10px; color: #ff006e; font-size: 10px; letter-spacing: 2px; white-space: nowrap;">
            SECURE TOKEN
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, #1a0933 0%, #0a0e27 100%); padding: 18px 30px; border-radius: 8px; border: 2px solid #00ff9f; box-shadow: 0 0 20px rgba(0, 255, 159, 0.5), inset 0 0 20px rgba(0, 255, 159, 0.1); max-width: 100%; box-sizing: border-box;">
              <span style="color: #00ff9f; font-size: 28px; font-weight: bold; letter-spacing: 8px; text-shadow: 0 0 10px #00ff9f, 0 0 20px #00ff9f; font-family: 'Courier New', monospace; display: block; word-break: break-all;">
                ${otp}
              </span>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #00f5ff; font-size: 12px; letter-spacing: 1px;">
            <span style="color: #ff006e;">⏱</span> EXPIRES IN:<br><strong style="color: #00ff9f; font-size: 14px;">05:00 MINUTES</strong>
          </div>
        </div>

        <!-- Warning message -->
        <div style="background: rgba(255, 0, 110, 0.1); border-left: 4px solid #ff006e; padding: 12px 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #00f5ff; font-size: 12px; line-height: 1.6;">
            <strong style="color: #ff006e;">⚠ SECURITY NOTICE:</strong><br>
            If you did not initiate this verification request, please disregard this transmission. Your account remains secure.
          </p>
        </div>

        <!-- Decorative elements -->
        <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(0, 255, 159, 0.2);">
          <div style="color: #8338ec; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;">
            █▓▒░ SECURED BY<br>LIVEMART PROTOCOL ░▒▓█
          </div>
        </div>
      </div>

      <!-- Footer with grid pattern -->
      <div style="background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.4) 100%); padding: 20px; text-align: center; border-top: 1px solid rgba(0, 255, 159, 0.3); position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: repeating-linear-gradient(0deg, rgba(0, 255, 159, 0.03) 0px, rgba(0, 255, 159, 0.03) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(0, 255, 159, 0.03) 0px, rgba(0, 255, 159, 0.03) 1px, transparent 1px, transparent 20px); pointer-events: none;"></div>
        <p style="margin: 0; color: #00f5ff; font-size: 11px; letter-spacing: 2px; position: relative; z-index: 1;">
          © ${new Date().getFullYear()} LIVEMART™ // ALL RIGHTS RESERVED
        </p>
        <p style="margin: 5px 0 0 0; color: #8338ec; font-size: 10px; position: relative; z-index: 1;">
          TOKYO DIGITAL DISTRICT // SECTOR 7
        </p>
      </div>
    </div>

    <!-- Bottom glow effect -->
    <div style="text-align: center; margin-top: 20px; color: rgba(0, 245, 255, 0.5); font-size: 10px; letter-spacing: 3px;">
      ▲ ENCRYPTED TRANSMISSION ▲
    </div>
  </div>
</body>
</html>
`

    });
    console.log("Email sent:", response);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}
export default sendOTPEmail;
