
require('../src/class.simple-allies');

const AllyChat = new SimpleAllies(['Bob','Ada','Omar'],90,'myName');

/// your loop code
AllyChat.initRun();

// Example 1: Remove specific requests using a predicate
// Remove all resource requests for room E5N1
let removedCount = AllyChat.removeRequests('resource', (req) => req.resourceType === RESOURCE_OXYGEN);
if (removedCount > 0) {
    console.log(`Removed ${removedCount} resource request(s) for E5N1`);
}

// Example 2: Remove all barrage requests from a specific username
let removedBarrageCount = AllyChat.removeRequests('barrage', (req) => req.username === 'Bob');
if (removedBarrageCount > 0) {
    console.log(`Removed ${removedBarrageCount} barrage request(s) from Bob`);
}

// Example 3: Reset all requests of a specific type
// Clear all resource requests
AllyChat.resetRequests('resource');
console.log('Cleared all resource requests');

// Example 4: Reset a specific barrage request type
AllyChat.resetRequests('barrage');
console.log('Cleared all barrage requests');

// Example 5: Reset ALL requests of all types
AllyChat.resetRequests('all');
console.log('Cleared all requests');

// Alternative: resetRequests() with no arguments also clears everything
AllyChat.resetRequests();
console.log('Cleared all requests (using no argument)');

AllyChat.endRun();
