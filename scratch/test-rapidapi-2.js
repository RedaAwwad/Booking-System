const axios = require('axios');
const headers1 = { 'x-rapidapi-key': 'cfc85dfc8amshc65eb97fc5d5fdfp14bbdejsn3748f001d490', 'x-rapidapi-host': 'skyscanner-api.p.rapidapi.com' };
const headers3 = { 'x-rapidapi-key': 'cfc85dfc8amshc65eb97fc5d5fdfp14bbdejsn3748f001d490', 'x-rapidapi-host': 'skyscanner44.p.rapidapi.com' }; // Another common one
const headers4 = { 'x-rapidapi-key': 'cfc85dfc8amshc65eb97fc5d5fdfp14bbdejsn3748f001d490', 'x-rapidapi-host': 'skyscanner50.p.rapidapi.com' };
const urlsToTry = [
  { url: 'https://skyscanner-api.p.rapidapi.com/flights/live/search/create', headers: headers1 },
  { url: 'https://skyscanner44.p.rapidapi.com/search', headers: headers3 },
  { url: 'https://skyscanner50.p.rapidapi.com/api/v1/flights/searchFlights', headers: headers4 }
];

async function run() {
  for (const test of urlsToTry) {
    try {
      console.log('Trying: ' + test.url + ' with host ' + test.headers['x-rapidapi-host']);
      const res = await axios.get(test.url, { headers: test.headers });
      console.log('SUCCESS:', res.status, Object.keys(res.data));
    } catch (e) {
      console.log('FAILED:', e.response?.status, e.response?.data);
    }
  }
}
run();
