const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('https://rapidapi.com/skyscanner/api/skyscanner-flight-search', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log('Exists!');
  } catch(e) {
    console.log(e.response?.status);
  }
}
test();
