async function test() {
  const url = 'http://localhost:3000/api/player/register';
  console.log(`Testing fetch to ${url}...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test-device', name: 'Test Player' })
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 500)}`);
  } catch (err: any) {
    console.error(`Fetch failed: ${err.message}`);
  }
}
test();
