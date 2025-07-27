#!/usr/bin/env node

/**
 * Test script pro Interactive Debugging System
 * Spustí: node test_interactive_debug.js
 */

import { enableDebugger, setDebugContext, quickPause } from './ivy/iv_interactive_debugger.js';
import { Log } from './ivy/iv_log.class.js';

async function testInteractiveDebugger() {
  console.log('Testing Interactive Debugging System...\n');

  // Enable debugger
  enableDebugger(true);

  // Simulate user and page context
  const mockUser = { id: 'TEST_USER_123' };
  const mockPage = {
    url: () => 'https://www.facebook.com/test',
    screenshot: async () => console.log('Mock screenshot taken'),
    content: async () => '<html><body>Mock DOM content</body></html>',
    evaluate: async () => 'Mock user agent',
    isClosed: () => false
  };

  setDebugContext(mockUser, mockPage);

  console.log('Debugger initialized\n');

  // Test 1: Quick pause
  console.log('Test 1: Quick pause for generic warning');
  await quickPause('This is a test warning message');

  // Test 2: Error with context
  console.log('\nTest 2: Error with detailed context');
  try {
    throw new Error('Test error for debugging');
  } catch (err) {
    await Log.errorInteractive('[TEST]', err);
  }

  // Test 3: Warning with context
  console.log('\nTest 3: Warning with context');
  await Log.warnInteractive('[TEST]', 'Test warning message with context');

  console.log('\nAll tests completed!');
  console.log('Check ./debug_reports/ for generated reports');
}

// Run tests
testInteractiveDebugger().catch(console.error);