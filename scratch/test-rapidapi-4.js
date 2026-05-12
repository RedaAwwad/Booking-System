const axios = require('axios');

async function run() {
  try {
    const res = await axios.get('https://skyscanner-flights-travel-api.p.rapidapi.com/search-flights', {
      headers: {
        'x-rapidapi-key': 'cfc85dfc8amshc65eb97fc5d5fdfp14bbdejsn3748f001d490',
        'x-rapidapi-host': 'skyscanner-flights-travel-api.p.rapidapi.com'
      }
    });
    console.log(res.status, res.data);
  } catch (e) {
    console.log('FAILED:', e.response?.status, e.response?.data);
  }
}
run();
