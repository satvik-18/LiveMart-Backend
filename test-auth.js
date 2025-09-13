import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAuthFlow() {
    // Step 1: Login to get JWT
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser' })
    });
    const loginData = await loginRes.json();
    console.log('Login response:', loginData);
    if (!loginData.token) {
        console.error('No token received.');
        return;
    }

    // Step 2: Access protected route
    const protectedRes = await fetch(`${BASE_URL}/auth/protected`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    const protectedData = await protectedRes.json();
    console.log('Protected route response:', protectedData);
}

testAuthFlow();
