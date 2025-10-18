import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
let accessToken = null;
let refreshToken = null;

async function testAuthFlow() {
    try {
        // Step 1: Request OTP for signup
        console.log('\n1. Requesting OTP for signup...');
        const otpRes = await fetch(`${BASE_URL}/auth/signup/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com' })
        });
        const otpData = await otpRes.json();
        console.log('OTP Request Response:', otpData);

        // For testing, we'll use a known OTP (you would normally get this from email)
        const testOTP = '123456'; // You'll need to check your email or Redis for the actual OTP

        // Step 2: Sign up with OTP
        console.log('\n2. Signing up with OTP...');
        const signupRes = await fetch(`${BASE_URL}/auth/signup/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test User',
                email: 'test@example.com',
                password: 'TestPass123!',
                role: 'customer',
                otp: testOTP
            })
        });
        const signupData = await signupRes.json();
        console.log('Signup Response:', signupData);

        // Step 3: Login with email/password
        console.log('\n3. Logging in with email/password...');
        const loginRes = await fetch(`${BASE_URL}/auth/login/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'TestPass123!'
            })
        });
        const loginData = await loginRes.json();
        console.log('Login Response:', loginData);

        if (!loginData.accessToken) {
            throw new Error('No access token received');
        }
        accessToken = loginData.accessToken;
        refreshToken = loginData.refreshToken;

        // Step 4: Access protected route
        console.log('\n4. Accessing protected route...');
        const protectedRes = await fetch(`${BASE_URL}/auth/protected`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const protectedData = await protectedRes.json();
        console.log('Protected Route Response:', protectedData);

        // Step 5: Refresh token
        console.log('\n5. Testing token refresh...');
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        const refreshData = await refreshRes.json();
        console.log('Token Refresh Response:', refreshData);

        if (refreshData.accessToken) {
            accessToken = refreshData.accessToken;
        }

        // Step 6: Change password
        console.log('\n6. Changing password...');
        const changePassRes = await fetch(`${BASE_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: 'TestPass123!',
                newPassword: 'NewTestPass123!'
            })
        });
        const changePassData = await changePassRes.json();
        console.log('Change Password Response:', changePassData);

        // Step 7: Logout
        console.log('\n7. Testing logout...');
        const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const logoutData = await logoutRes.json();
        console.log('Logout Response:', logoutData);

        // Step 8: Verify token is invalidated
        console.log('\n8. Verifying token is invalidated...');
        const invalidTokenRes = await fetch(`${BASE_URL}/auth/protected`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const invalidTokenData = await invalidTokenRes.json();
        console.log('Invalid Token Response:', invalidTokenData);

    } catch (error) {
        console.error('Test error:', error);
    }
}

// Run the tests
console.log('Starting authentication flow tests...');
testAuthFlow().then(() => console.log('\nTests completed!'));