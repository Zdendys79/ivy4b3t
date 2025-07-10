#!/usr/bin/env node

/**
 * Test script for getUserWithAvailableActions method
 */

import { db } from './iv_sql.js';
import { Log } from './iv_log.class.js';
import os from 'node:os';

const hostname = os.hostname();

async function testUserSelection() {
  try {
    console.log('=== TEST getUserWithAvailableActions ===');
    console.log(`Hostname: ${hostname}`);
    console.log('');

    // Test 1: Volání metody s parametrem
    console.log('Test 1: getUserWithAvailableActions(hostname)');
    const userWithHost = await db.getUserWithAvailableActions(hostname);
    console.log('Result:', userWithHost);
    console.log('');

    // Test 2: Volání metody bez parametru (default)
    console.log('Test 2: getUserWithAvailableActions() - default');
    const userDefault = await db.getUserWithAvailableActions();
    console.log('Result:', userDefault);
    console.log('');

    // Test 3: Přímý SQL dotaz
    console.log('Test 3: Direct SQL query test');
    const directResult = await db.safeQueryFirst('users.getWithAvailableActions', [hostname]);
    console.log('Direct SQL result:', directResult);
    console.log('');

    // Test 4: Porovnání s původním getUser
    console.log('Test 4: Original getUser() comparison');
    const originalUser = await db.getUser(hostname);
    console.log('Original getUser result:', originalUser);

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

testUserSelection();