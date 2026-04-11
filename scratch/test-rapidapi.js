const axios = require('axios');
const headers1 = { 'x-rapidapi-key': 'cfc85dfc8amshc65eb97fc5d5fdfp14bbdejsn3748f001d490', 'x-rapidapi-host': 'skyscanner-api.p.rapidapi.com' };
const headers2 = { 'x-rapidapi-key': 'cfc85dfc8amshc65eb97fc5d5fdfp14bbdejsn3748f001d490', 'x-rapidapi-host': 'skyscanner-flights-travel-api.p.rapidapi.com' };

const urlsToTry = [
  { url: 'https://skyscanner-api.p.rapidapi.com/v3/flights/live/search/create', headers: headers1 },
  { url: 'https://skyscanner-api.p.rapidapi.com/v2/flights/search', headers: headers1 },
  { url: 'https://skyscanner-api.p.rapidapi.com/api/v1/flights/search', headers: headers1 },
  { url: 'https://skyscanner-flights-travel-api.p.rapidapi.com/v3/flights/live/search/create', headers: headers2 },
  { url: 'https://skyscanner-flights-travel-api.p.rapidapi.com/v2/flights/search', headers: headers2 },
  { url: 'https://skyscanner-flights-travel-api.p.rapidapi.com/api/v1/flights/search', headers: headers2 }
];

async function run() {
  for (const test of urlsToTry) {
    try {
      console.log('Trying: ' + test.url + ' with host ' + test.headers['x-rapidapi-host']);
      const res = await axios.get(test.url, { headers: test.headers });
      console.log('SUCCESS:', res.status, Object.keys(res.data));
    } catch (e) {
      console.log('FAILED:', e.response ? e.response.status : e.message, e.response?.data);
    }
  }
}
run();
