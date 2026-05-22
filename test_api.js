const API_BASE = 'https://heelsupnew.heelsup.workers.dev';

async function testApi() {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJzdW5pbGphbmkwMTJAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwic2Vzc2lvbiI6InRlc3QiLCJuYW1lIjoiU3VuaWwifQ.AEJtC_RnXRYp0vCDMR6xhIGz9rldSHvYz1D3pl0vY2U";
    
    console.log("\nTesting /api/admin/dashboard ...");
    const dashRes = await fetch(`${API_BASE}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Dashboard:", dashRes.status);
    if (dashRes.status !== 200) console.log(await dashRes.text());

    console.log("\nTesting /api/admin/products ...");
    const prodRes = await fetch(`${API_BASE}/api/admin/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Products:", prodRes.status);
    if (prodRes.status !== 200) console.log(await prodRes.text());
    
    console.log("\nTesting /api/admin/orders ...");
    const ordRes = await fetch(`${API_BASE}/api/admin/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Orders:", ordRes.status);
    if (ordRes.status !== 200) console.log(await ordRes.text());
    
    console.log("\nTesting /api/admin/analytics ...");
    const anRes = await fetch(`${API_BASE}/api/admin/analytics/dashboard?period=30`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Analytics:", anRes.status);
    if (anRes.status !== 200) console.log(await anRes.text());
}
testApi();
