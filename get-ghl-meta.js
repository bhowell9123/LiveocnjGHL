// get-ghl-meta.js
const axios = require("axios");

const API_KEY   = process.env.GHL_API_KEY;          // location key
const LOCATION  = process.env.GHL_LOCATION_ID;      // the sub-account id
const BASE      = "https://rest.gohighlevel.com/v1";

if (!API_KEY || !LOCATION) {
  throw new Error("Set GHL_API_KEY and GHL_LOCATION_ID in your env");
}

const hdrs = { Authorization: `Bearer ${API_KEY}` };

async function getPipelines() {
  const { data } = await axios.get(`${BASE}/pipelines/`, { headers: hdrs });
  // response shape: { pipelines: [ { id, name, stages: [ { id, name } ] } ] }
  return data.pipelines.map(p => ({
    id: p.id,
    name: p.name,
    stages: p.stages.map(s => ({ id: s.id, name: s.name }))
  }));
}

async function getUsers() {
  // the users list is under /users/ at location scope
  const { data } = await axios.get(`${BASE}/users/`, { headers: hdrs });
  // response shape: { users: [ { id, firstName, lastName, email } ] }
  return data.users.map(u => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email
  }));
}

(async () => {
  const pipelines = await getPipelines();
  const users     = await getUsers();

  console.log("PIPELINES");
  pipelines.forEach(p => {
    console.log(`  ${p.name}: ${p.id}`);
    p.stages.forEach(s =>
      console.log(`    - ${s.name}: ${s.id}`)
    );
  });

  console.log("\nUSERS");
  users.forEach(u =>
    console.log(`  ${u.name} (${u.email}): ${u.id}`)
  );
})();