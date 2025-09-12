import { getNflOddsToday, _debugFetchEspnOddsRaw } from './server/services/espnOdds.js';

async function testEspnApi() {
  console.log('🔍 Testing ESPN API Integration\n');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Get today's NFL odds
    console.log('\n📊 Test 1: Fetching NFL odds for today...');
    const oddsData = await getNflOddsToday();
    
    const eventCount = Object.keys(oddsData).length;
    console.log(`✅ Found ${eventCount} NFL events`);
    
    if (eventCount > 0) {
      // Show first event details
      const firstEventId = Object.keys(oddsData)[0];
      const firstEvent = oddsData[firstEventId];
      console.log(`\n📌 Sample Event ID: ${firstEventId}`);
      console.log(`   - Quotes found: ${firstEvent.quotes.length}`);
      
      if (firstEvent.quotes.length > 0) {
        console.log('   - Sample quotes:');
        firstEvent.quotes.slice(0, 3).forEach(q => {
          console.log(`     • ${q.book}: ${q.team} @ ${q.price} (${q.market})`);
        });
      }
    }
    
    // Test 2: Debug raw API response for a specific event
    if (eventCount > 0) {
      console.log('\n📊 Test 2: Debug raw ESPN API response...');
      const eventId = Object.keys(oddsData)[0];
      const debugData = await _debugFetchEspnOddsRaw(eventId, undefined, true, 2);
      
      console.log(`\n🔍 Debug info for event ${eventId}:`);
      console.log(`   - API Status: ${debugData.status}`);
      console.log(`   - Competition ID: ${debugData.compId}`);
      console.log(`   - Items Count: ${debugData.itemsCount}`);
      console.log(`   - URL: ${debugData.url}`);
      
      if (debugData.expandedSample.length > 0) {
        console.log('\n   📦 Expanded provider samples:');
        debugData.expandedSample.forEach((sample, i) => {
          console.log(`\n   Provider ${i + 1}:`);
          if (sample.inline) {
            console.log(`     - Type: Inline data`);
            console.log(`     - Keys: ${sample.keys.join(', ')}`);
          } else {
            console.log(`     - URL: ${sample.href}`);
            console.log(`     - Status: ${sample.status}`);
            console.log(`     - Keys: ${sample.keys?.join(', ') || 'N/A'}`);
          }
        });
      }
    }
    
    // Test 3: Check data structure
    console.log('\n📊 Test 3: Analyzing data structure...');
    let totalQuotes = 0;
    let eventsWithOdds = 0;
    let uniqueBooks = new Set<string>();
    
    for (const [eventId, data] of Object.entries(oddsData)) {
      if (data.quotes.length > 0) {
        eventsWithOdds++;
        totalQuotes += data.quotes.length;
        data.quotes.forEach(q => uniqueBooks.add(q.book));
      }
    }
    
    console.log(`\n📈 Summary Statistics:`);
    console.log(`   - Total events: ${eventCount}`);
    console.log(`   - Events with odds: ${eventsWithOdds}`);
    console.log(`   - Total quotes: ${totalQuotes}`);
    console.log(`   - Unique bookmakers: ${uniqueBooks.size}`);
    if (uniqueBooks.size > 0) {
      console.log(`   - Books found: ${Array.from(uniqueBooks).slice(0, 5).join(', ')}${uniqueBooks.size > 5 ? '...' : ''}`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error testing ESPN API:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ ESPN API test complete\n');
}

// Test the Express endpoint
async function testExpressEndpoint() {
  console.log('\n🌐 Testing Express Endpoint...');
  
  try {
    // Assuming your server is running on port 8080
    const response = await fetch('http://localhost:8080/api/espn/nfl/odds');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Endpoint responded successfully');
      console.log(`   - Events returned: ${Object.keys(data).length}`);
    } else {
      console.log(`❌ Endpoint error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`   - Response: ${text}`);
    }
  } catch (error: any) {
    console.log('❌ Could not connect to endpoint:', error.message);
    console.log('   Make sure your server is running on port 8080');
  }
}

// Run tests
async function main() {
  await testEspnApi();
  await testExpressEndpoint();
}

main().catch(console.error);
