import redis from '../config/redis.js';
import crypto from 'crypto';

class OTPService {
    generateOTP() {
        const otp = crypto.randomInt(100000, 999999).toString(); // Fixed typo: "cryopto" -> "crypto", and range for 6-digit OTP
        return otp; // Added return statement
    }
    
    async storeOTP(email, otp, expiration = 300) {
        try {
            const key = `otp:${email}`; // Fixed spacing in key
            await redis.setex(key, expiration, otp);
            console.log(`Stored OTP for ${email} with expiration of ${expiration} seconds.`);
            return true;
        }
        catch(err) {
            console.error('Error storing OTP in Redis:', err);
            return false;
        }
    }
    
    async verifyOTP(email, otp) {
        try {
            const key = `otp:${email}`; // Fixed spacing in key
            const storedOTP = await redis.get(key);
            if(!storedOTP) {
                console.log(`No OTP found for ${email} or it has expired.`);
                return false;
            }
            if(storedOTP === otp) {
                await redis.del(key); // Fixed: use key instead of email
                console.log(`OTP for ${email} verified successfully.`);
                return true;
            }
            else {
                console.log(`Invalid OTP for ${email}.`);
                return false;
            }
        }
        catch(err) {
            console.error('Error verifying OTP:', err);
            return false;
        }
    }
    
    async deleteOTP(email) {
        try {
            const key = `otp:${email}`; // Fixed spacing in key
            const result = await redis.del(key);
            console.log(`Deleted OTP for ${email}.`);
            return result === 1;
        }
        catch(err) {
            console.error('Error deleting OTP:', err);
            return false;
        }
    }
    
     async checkRateLimit(email, maxAttempts = 3, windowMinutes = 15) {
    try {
      const key = `otp_rate:${email}`;
      const current = await redis.get(key);
      
      if (!current) {
        // First attempt
        await redis.setex(key, windowMinutes * 60, '1');
        return { allowed: true, remainingAttempts: maxAttempts - 1, resetTime: windowMinutes * 60 };
      }
      
      const attempts = parseInt(current);
      
      if (attempts >= maxAttempts) {
        const ttl = await redis.ttl(key);
        return { allowed: false, remainingAttempts: 0, resetTime: ttl };
      }
    
      await redis.incr(key);
      const ttl = await redis.ttl(key);
      
      return { 
        allowed: true, 
        remainingAttempts: maxAttempts - attempts - 1, 
        resetTime: ttl 
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true, remainingAttempts: maxAttempts - 1, resetTime: windowMinutes * 60 };
    }
  }
}

export default new OTPService();