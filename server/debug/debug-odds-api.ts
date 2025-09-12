import { getNflOddsToday, transformEspnToDbFormat, debugEspnOdds } from './server/services/espnOdds.js';
import { sportsDataIoService } from './server/services/sportsDataIoApi.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(`🔍 ${title}`, 'bright');
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

async function testEspnDirect() {
  logSection('Testing ESPN API Direct Access');
  
  try {
    // Test 1: Basic fetch
    logInfo('Fetching NFL odds from ESPN...');
    const startTime = Date.now();
    const odds = await getNflOddsToday();
    const elapsed = Date.now() - startTime;
    
    const eventCount = Object.keys(odds).length;
    
    if (eventCount > 0) {
      logSuccess(`Fetched ${eventCount} events in ${elapsed}ms`);
      
      // Analyze data
      let totalQuotes = 0;
      let eventsWithOdds = 0;
      const bookmakers = new Set<string>();
      const markets = new Set<string>();
      
      for (const [eventId, data] of Object.entries(odds)) {
        if (data.quotes.length > 0) {
          eventsWithOdds++;
          totalQuotes += data.quotes.length;
          
          data.quotes.forEach(q => {
            bookmakers.add(q.book);
            markets.add(q.market);
          });
        }
      }
      
      console.log('\n📊 ESPN Data Analysis:');
      console.log(`   Total Events: ${eventCount}`);
      console.log(`   Events with Odds: ${eventsWithOdds}`);
      console.log(`   Total Quotes: ${totalQuotes}`);
      console.log(`   Unique Bookmakers: ${bookmakers.size}`);
      console.log(`   Markets Found: ${Array.from(markets).join(', ')}`);
      
      if (bookmakers.size > 0) {
        console.log(`   Bookmakers: ${Array.from(bookmakers).slice(0, 5).join(', ')}${bookmakers.size > 5 ? '...' : ''}`);
      }
      
      // Show sample event
      const [firstId, firstData] = Object.entries(odds)[0];
      console.log('\n📌 Sample Event Details:');
      console.log(`   Event ID: ${firstId}`);
      console.log(`   Matchup: ${firstData.awayTeam} @ ${firstData.homeTeam}`);
      console.log(`   Time: ${new Date(firstData.commenceTime).toLocaleString()}`);
      console.log(`   Quotes: ${firstData.quotes.length}`);
      
      // Show best odds
      if (firstData.best.moneylineHome) {
        console.log(`   Best ML Home: ${firstData.best.moneylineHome.price} (${firstData.best.moneylineHome.book})`);
      }
      if (firstData.best.moneylineAway) {
        console.log(`   Best ML Away: ${firstData.best.moneylineAway.price} (${firstData.best.moneylineAway.book})`);
      }
      if (firstData.best.spreadHome) {
        console.log(`   Best Spread Home: ${firstData.best.spreadHome.point} @ ${firstData.best.spreadHome.price} (${firstData.best.spreadHome.book})`);
      }
      
      // Test transformation
      logInfo('\nTesting ESPN to DB format transformation...');
      const transformed = transformEspnToDbFormat(odds, 'NFL');
      logSuccess(`Transformed ${transformed.length} events to DB format`);
      
      if (transformed[0]) {
        console.log('\n📦 Sample Transformed Event:');
        console.log(`   ID: ${transformed[0].id}`);
        console.log(`   Teams: ${transformed[0].away_team} @ ${transformed[0].home_team}`);
        console.log(`   Bookmakers: ${transformed[0].bookmakers?.length || 0}`);
        
        if (transformed[0].bookmakers?.[0]) {
          const bm = transformed[0].bookmakers[0];
          console.log(`   First Book: ${bm.title}`);
          console.log(`   Markets: ${bm.markets?.length || 0}`);
        }
      }
    } else {
      logWarning('No events found - this might be normal if no games are scheduled');
    }
    
    return { success: true, eventCount };
    
  } catch (error: any) {
    logError(`ESPN test failed: ${error.message}`);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

async function testSportsDataIO() {
  logSection('Testing SportsDataIO API');
  
  // Check API key
  if (!process.env.SPORTSDATAIO_API_KEY) {
    logWarning('SPORTSDATAIO_API_KEY not set in environment');
    return { success: false, error: 'No API key' };
  }
  
  try {
    logInfo('Fetching NFL odds from SportsDataIO...');
    const startTime = Date.now();
    const odds = await sportsDataIoService.getOdds('NFL', 10);
    const elapsed = Date.now() - startTime;
    
    if (odds.length > 0) {
      logSuccess(`Fetched ${odds.length} events in ${elapsed}ms`);
      
      // Analyze data
      let totalQuotes = 0;
      const bookmakers = new Set<string>();
      const markets = new Set<string>();
      
      odds.forEach(event => {
        event.bookmakers?.forEach(bm => {
          bookmakers.add(bm.title);
          bm.markets?.forEach(m => {
            markets.add(m.key);
            totalQuotes += m.outcomes?.length || 0;
          });
        });
      });
      
      console.log('\n📊 SportsDataIO Data Analysis:');
      console.log(`   Total Events: ${odds.length}`);
      console.log(`   Total Quotes: ${totalQuotes}`);
      console.log(`   Unique Bookmakers: ${bookmakers.size}`);
      console.log(`   Markets Found: ${Array.from(markets).join(', ')}`);
      
      // Show sample event
      if (odds[0]) {
        console.log('\n📌 Sample Event Details:');
        console.log(`   Event ID: ${odds[0].id}`);
        console.log(`   Matchup: ${odds[0].away_team} @ ${odds[0].home_team}`);
        console.log(`   Time: ${new Date(odds[0].commence_time).toLocaleString()}`);
        console.log(`   Bookmakers: ${odds[0].bookmakers?.length || 0}`);
        
        if (odds[0].bookmakers?.[0]) {
          const bm = odds[0].bookmakers[0];
          console.log(`   First Book: ${bm.title}`);
          console.log(`   Markets: ${bm.markets?.length || 0}`);
        }
      }
    } else {
      logWarning('No events found from SportsDataIO');
    }
    
    return { success: true, eventCount: odds.length };
    
  } catch (error: any) {
    logError(`SportsDataIO test failed: ${error.message}`);
    if (error.status === 401) {
      logError('Authentication failed - check your API key');
    } else if (error.status === 429) {
      logError('Rate limit exceeded');
    }
    return { success: false, error: error.message };
  }
}

async function testServerEndpoints() {
  logSection('Testing Server Endpoints');
  
  const baseUrl = 'http://localhost:8080';
  
  async function testEndpoint(name: string, path: string, method = 'GET', body?: any) {
    try {
      logInfo(`Testing ${name}...`);
      const options: any = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${baseUrl}${path}`, options);
      
      if (response.ok) {
        const data = await response.json();
        logSuccess(`${name} responded with status ${response.status}`);
        return { success: true, data };
      } else {
        const text = await response.text();
        logError(`${name} failed with status ${response.status}: ${text}`);
        return { success: false, error: text };
      }
    } catch (error: any) {
      logError(`${name} connection failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  // Test each endpoint
  const endpoints = [
    { name: 'Health Check', path: '/api/health' },
    { name: 'ESPN NFL Odds', path: '/api/espn/nfl/odds' },
    { name: 'ESPN Debug', path: '/api/espn/debug' },
    { name: 'SportsDataIO Odds', path: '/api/odds?sport=NFL&limit=5' },
    { name: 'Compare Sources', path: '/api/odds/compare?sport=NFL' },
    { name: 'Best Odds', path: '/api/odds/best?sport=NFL' },
    { name: 'Unified Odds', path: '/api/odds/unified?sport=NFL&stats=true' },
    { name: 'Test All Sources', path: '/api/odds/test-all' },
  ];
  
  const results: any[] = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.name, endpoint.path);
    results.push({
      ...endpoint,
      ...result
    });
    
    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log('\n📊 Endpoint Test Summary:');
  const successful = results.filter(r => r.success).length;
  console.log(`   Successful: ${successful}/${results.length}`);
  
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('   Failed endpoints:');
    failed.forEach(r => {
      console.log(`     - ${r.name}: ${r.error?.slice(0, 50)}...`);
    });
  }
  
  return results;
}

async function compareDataQuality() {
  logSection('Comparing Data Quality');
  
  try {
    // Fetch from both sources
    const [espnResult, sdioResult] = await Promise.allSettled([
      getNflOddsToday(),
      sportsDataIoService.getOdds('NFL', 10)
    ]);
    
    const comparison: any = {
      espn: { available: false, events: 0, quotes: 0, books: 0 },
      sportsDataIO: { available: false, events: 0, quotes: 0, books: 0 }
    };
    
    // Analyze ESPN
    if (espnResult.status === 'fulfilled') {
      const data = espnResult.value;
      comparison.espn.available = true;
      comparison.espn.events = Object.keys(data).length;
      
      const books = new Set<string>();
      Object.values(data).forEach(event => {
        comparison.espn.quotes += event.quotes.length;
        event.quotes.forEach(q => books.add(q.book));
      });
      comparison.espn.books = books.size;
    }
    
    // Analyze SportsDataIO
    if (sdioResult.status === 'fulfilled') {
      const data = sdioResult.value;
      comparison.sportsDataIO.available = true;
      comparison.sportsDataIO.events = data.length;
      
      const books = new Set<string>();
      data.forEach(event => {
        event.bookmakers?.forEach(bm => {
          books.add(bm.title);
          bm.markets?.forEach(m => {
            comparison.sportsDataIO.quotes += m.outcomes?.length || 0;
          });
        });
      });
      comparison.sportsDataIO.books = books.size;
    }
    
    console.log('\n📊 Data Quality Comparison:');
    console.log('');
    console.log('         Source | Available | Events | Quotes | Books');
    console.log('   -------------|-----------|--------|--------|-------');
    console.log(`           ESPN |    ${comparison.espn.available ? '✅' : '❌'}     |   ${String(comparison.espn.events).padEnd(4)} |  ${String(comparison.espn.quotes).padEnd(5)} |  ${comparison.espn.books}`);
    console.log(`   SportsDataIO |    ${comparison.sportsDataIO.available ? '✅' : '❌'}     |   ${String(comparison.sportsDataIO.events).padEnd(4)} |  ${String(comparison.sportsDataIO.quotes).padEnd(5)} |  ${comparison.sportsDataIO.books}`);
    
    console.log('\n💡 Recommendation:');
    if (comparison.espn.quotes > comparison.sportsDataIO.quotes) {
      logSuccess('ESPN has more comprehensive odds data');
    } else if (comparison.sportsDataIO.quotes > comparison.espn.quotes) {
      logSuccess('SportsDataIO has more comprehensive odds data');
    } else if (comparison.espn.available || comparison.sportsDataIO.available) {
      logWarning('Both sources have similar coverage');
    } else {
      logError('No odds sources are currently available');
    }
    
    return comparison;
    
  } catch (error: any) {
    logError(`Comparison failed: ${error.message}`);
    return null;
  }
}

// Main execution
async function main() {
  console.clear();
  log('🏆 LineTracker Odds API Comprehensive Debug', 'bright');
  console.log('='.repeat(60));
  
  const results: any = {
    espn: null,
    sportsDataIO: null,
    endpoints: null,
    comparison: null
  };
  
  // Test ESPN
  results.espn = await testEspnDirect();
  
  // Test SportsDataIO
  results.sportsDataIO = await testSportsDataIO();
  
  // Compare sources
  results.comparison = await compareDataQuality();
  
  // Test server endpoints (optional)
  const testServer = process.argv.includes('--server');
  if (testServer) {
    logInfo('\nTesting server endpoints (ensure server is running on port 8080)...');
    results.endpoints = await testServerEndpoints();
  } else {
    logInfo('\nSkipping server endpoint tests (use --server flag to include)');
  }
  
  // Final summary
  logSection('Final Summary');
  
  console.log('✨ Test Results:');
  console.log(`   ESPN API: ${results.espn?.success ? '✅ Working' : '❌ Failed'}`);
  console.log(`   SportsDataIO: ${results.sportsDataIO?.success ? '✅ Working' : '❌ Failed'}`);
  
  if (results.espn?.success || results.sportsDataIO?.success) {
    logSuccess('\n✅ At least one odds source is working!');
    console.log('   You can use the /api/odds/best endpoint for automatic failover');
  } else {
    logError('\n❌ No odds sources are currently working');
    console.log('   Check your API keys and network connectivity');
  }
  
  console.log('\n' + '='.repeat(60));
  log('Debug complete!', 'bright');
}

// Run the debug script
main().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
