const { app } = require('../src/app');

async function runTestSuite() {
  console.log('--- Starting ArcadiaX Automated Endpoint Verification Suite ---');

  const server = app.listen(5099);
  const baseUrl = 'http://127.0.0.1:5099';
  const headers = {
    'Content-Type': 'application/json',
    'x-dev-admin': 'true'
  };

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  try {
    // 1. Health
    await test('GET /health', async () => {
      const res = await fetch(`${baseUrl}/health`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (json.status !== 'ok') throw new Error('Status not ok');
    });

    // 2. Auth Profile
    await test('GET /api/auth/me', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, { headers });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data.user) throw new Error('Missing user data');
    });

    // 3. Dashboard Overview
    await test('GET /api/dashboard/overview', async () => {
      const res = await fetch(`${baseUrl}/api/dashboard/overview`, { headers });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data.stats) throw new Error('Missing stats in overview');
    });

    // 4. Dashboard Status
    await test('GET /api/dashboard/status', async () => {
      const res = await fetch(`${baseUrl}/api/dashboard/status`, { headers });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data.system) throw new Error('Missing system status');
    });

    // 5. Antinuke Config & Update
    await test('GET & PUT /api/antinuke', async () => {
      const getRes = await fetch(`${baseUrl}/api/antinuke`, { headers });
      if (getRes.status !== 200) throw new Error(`GET expected 200, got ${getRes.status}`);
      
      const putRes = await fetch(`${baseUrl}/api/antinuke`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ mass_channel_delete_threshold: 4, response_action: 'strip_roles' })
      });
      if (putRes.status !== 200) throw new Error(`PUT expected 200, got ${putRes.status}`);
      const json = await putRes.json();
      if (json.data.mass_channel_delete_threshold !== 4) throw new Error('Value not updated');
    });

    // 6. Antinuke Logs
    await test('GET /api/antinuke/logs', async () => {
      const res = await fetch(`${baseUrl}/api/antinuke/logs`, { headers });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.data.logs)) throw new Error('Logs should be an array');
    });

    // 7. Antibetray Config & Update
    await test('GET & PUT /api/antibetray', async () => {
      const getRes = await fetch(`${baseUrl}/api/antibetray`, { headers });
      if (getRes.status !== 200) throw new Error(`GET expected 200, got ${getRes.status}`);

      const putRes = await fetch(`${baseUrl}/api/antibetray`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ auto_rollback: 1, admin_perm_monitoring: 1 })
      });
      if (putRes.status !== 200) throw new Error(`PUT expected 200, got ${putRes.status}`);
      const json = await putRes.json();
      if (json.data.auto_rollback !== 1) throw new Error('Value not updated');
    });

    // 8. Welcome Config & Preview
    await test('GET, PUT & Preview /api/welcome', async () => {
      const getRes = await fetch(`${baseUrl}/api/welcome`, { headers });
      if (getRes.status !== 200) throw new Error(`GET expected 200, got ${getRes.status}`);

      const prevRes = await fetch(`${baseUrl}/api/welcome/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message_type: 'text',
          text_content: 'Hello {username}, welcome to {server}! Member #{memberCount}'
        })
      });
      if (prevRes.status !== 200) throw new Error(`Preview expected 200, got ${prevRes.status}`);
      const prevJson = await prevRes.json();
      if (!prevJson.data.formattedText.includes('Member #1337')) throw new Error('Variables not formatted correctly');
    });

    // 9. Autorole Config & Update
    await test('GET & PUT /api/autorole', async () => {
      const getRes = await fetch(`${baseUrl}/api/autorole`, { headers });
      if (getRes.status !== 200) throw new Error(`GET expected 200, got ${getRes.status}`);

      const putRes = await fetch(`${baseUrl}/api/autorole`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ human_enabled: 1, human_role_id: '123456789' })
      });
      if (putRes.status !== 200) throw new Error(`PUT expected 200, got ${putRes.status}`);
      const json = await putRes.json();
      if (json.data.human_role_id !== '123456789') throw new Error('Role ID not updated');
    });

    // 10. Embeds Preview
    await test('POST /api/embeds/preview', async () => {
      const res = await fetch(`${baseUrl}/api/embeds/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'ArcadiaX Test Announcement',
          description: 'This is a test preview embed.',
          color: '#5865F2',
          fields: [{ name: 'Status', value: 'Active', inline: true }]
        })
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (json.data.embed.title !== 'ArcadiaX Test Announcement') throw new Error('Embed title mismatch');
    });

    // 11. Tickets Config & Options
    await test('GET & PUT /api/tickets/config', async () => {
      const getRes = await fetch(`${baseUrl}/api/tickets/config`, { headers });
      if (getRes.status !== 200) throw new Error(`GET expected 200, got ${getRes.status}`);
      const getJson = await getRes.json();
      if (!Array.isArray(getJson.data.options) || getJson.data.options.length < 5) throw new Error('Missing default ticket options');

      const putRes = await fetch(`${baseUrl}/api/tickets/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ panel_title: 'Updated Support Portal' })
      });
      if (putRes.status !== 200) throw new Error(`PUT expected 200, got ${putRes.status}`);
      const putJson = await putRes.json();
      if (putJson.data.panel_title !== 'Updated Support Portal') throw new Error('Panel title not updated');
    });

    // 12. Tickets List
    await test('GET /api/tickets', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, { headers });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.data.tickets)) throw new Error('Tickets should be an array');
    });

    // 13. Backups List
    await test('GET /api/backups', async () => {
      const res = await fetch(`${baseUrl}/api/backups`, { headers });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error('Backups should be an array');
    });

    // 14. Music Status
    await test('GET /api/music/status', async () => {
      const res = await fetch(`${baseUrl}/api/music/status`, { headers });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = await res.json();
      if (json.data.volume !== 100) throw new Error('Expected default volume 100');
    });

    // 15. Settings & Update
    await test('GET & PUT /api/settings', async () => {
      const getRes = await fetch(`${baseUrl}/api/settings`, { headers });
      if (getRes.status !== 200) throw new Error(`GET expected 200, got ${getRes.status}`);

      const putRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ prefix: '?' })
      });
      if (putRes.status !== 200) throw new Error(`PUT expected 200, got ${putRes.status}`);
      const putJson = await putRes.json();
      if (putJson.data.prefix !== '?') throw new Error('Prefix not updated');
    });

    // 16. Logs by Type
    await test('GET /api/logs and /api/logs/:type', async () => {
      const secRes = await fetch(`${baseUrl}/api/logs/security`, { headers });
      if (secRes.status !== 200) throw new Error(`Security logs expected 200, got ${secRes.status}`);

      const msgRes = await fetch(`${baseUrl}/api/logs/messages`, { headers });
      if (msgRes.status !== 200) throw new Error(`Message logs expected 200, got ${msgRes.status}`);

      const actRes = await fetch(`${baseUrl}/api/logs/activity`, { headers });
      if (actRes.status !== 200) throw new Error(`Activity logs expected 200, got ${actRes.status}`);
    });

  } finally {
    server.close();
    console.log(`\n--- Verification Summary: ${passed} Passed, ${failed} Failed ---`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
