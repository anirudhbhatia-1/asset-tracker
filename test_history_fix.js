async function runTest() {
  try {
    console.log('Logging in as admin (Admin)...');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@assettrack.com', password: 'password123' })
    });
    
    if (!loginRes.ok) throw new Error('Login failed');
    const cookie = loginRes.headers.get('set-cookie');

    console.log('Creating a new asset...');
    const assetRes = await fetch('http://localhost:3001/api/assets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
          name: 'Test History Asset',
          serialNumber: 'SN-TEST' + Date.now(),
          status: 'available'
        })
    });
    if (!assetRes.ok) throw new Error('Asset creation failed: ' + await assetRes.text());
    
    const assetData = await assetRes.json();
    const assetId = assetData.data.id;
    console.log('Asset created with ID:', assetId);

    console.log('Fetching asset history...');
    const historyRes = await fetch(`http://localhost:3001/api/assets/${assetId}/history`, {
        headers: { 'Cookie': cookie }
    });
    const historyData = await historyRes.json();
    console.log('History event:', historyData.data[0]);

    if (historyData.data[0].performedBy === 'Admin') {
        console.log('✅ Success! Performed by is dynamically pulled from the actor name.');
    } else {
        console.log('❌ Failed! Performed by is', historyData.data[0].performedBy);
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTest();
