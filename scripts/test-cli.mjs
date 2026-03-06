#!/usr/bin/env node
/**
 * Integration test for PineScript Utils CLI
 * Run with: node scripts/test-cli.mjs
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CLI_PATH = join(ROOT, 'cli/dist/index.js');

console.log('🧪 PineScript Utils CLI Integration Tests');
console.log('=========================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${e.message}`);
    failed++;
  }
}

function runCLI(args) {
  return execSync(`node ${CLI_PATH} ${args}`, { 
    encoding: 'utf-8', 
    stdio: 'pipe',
    cwd: ROOT
  });
}

// Test 1: CLI Help
test('CLI shows all commands', () => {
  const output = runCLI('--help');
  if (!output.includes('arena-tournament')) throw new Error('Missing arena-tournament command');
  if (!output.includes('backtest')) throw new Error('Missing backtest command');
  if (!output.includes('rank')) throw new Error('Missing rank command');
  if (!output.includes('optimize')) throw new Error('Missing optimize command');
  if (!output.includes('walk-forward')) throw new Error('Missing walk-forward command');
});

// Test 2: Arena Tournament Help
test('Arena tournament shows all flags', () => {
  const output = runCLI('arena-tournament --help');
  if (!output.includes('--rounds')) throw new Error('Missing --rounds flag');
  if (!output.includes('--test-mode')) throw new Error('Missing --test-mode flag');
  if (!output.includes('--mock')) throw new Error('Missing --mock flag');
});

// Test 3: Arena Tournament Test Mode
test('Arena tournament runs in test mode', () => {
  const output = runCLI('arena-tournament --asset TEST --mock --test-mode --rounds 1');
  if (!output.includes('Tournament complete')) throw new Error('Tournament did not complete');
  if (!output.includes('kimi-k2.5')) throw new Error('Missing kimi-k2.5 in results');
  if (!output.includes('glm-4.7')) throw new Error('Missing glm-4.7 in results');
  if (!output.includes('grok-4.1-fast')) throw new Error('Missing grok-4.1-fast in results');
  if (!output.includes('TEST MODE')) throw new Error('Test mode not indicated');
});

// Test 4: Backtest Command
test('Backtest runs successfully', () => {
  const output = runCLI('backtest --strategy ./strategies/sma_crossover.pine --asset TEST --mock');
  if (!output.includes('Backtest complete')) throw new Error('Backtest did not complete');
  if (!output.includes('Return:')) throw new Error('Missing return metric');
  if (!output.includes('Sharpe')) throw new Error('Missing Sharpe ratio');
});

// Test 5: Rank Command
test('Rank runs successfully', () => {
  const output = runCLI('rank --directory ./strategies --asset TEST --mock');
  if (!output.includes('Ranking complete')) throw new Error('Ranking did not complete');
});

// Test 6: Optimize Command
test('Optimize runs successfully', () => {
  const output = runCLI('optimize --strategy ./strategies/sma_crossover.pine --asset TEST --mock');
  if (!output.includes('Optimization complete')) throw new Error('Optimization did not complete');
  if (!output.includes('Best Parameters')) throw new Error('Missing best parameters');
});

// Test 7: Walk-Forward Command  
test('Walk-forward runs successfully', () => {
  const output = runCLI('walk-forward --strategy ./strategies/sma_crossover.pine --asset TEST --mock --windows 2');
  if (!output.includes('Walk-forward analysis complete')) throw new Error('Walk-forward did not complete');
  if (!output.includes('Efficiency')) throw new Error('Missing efficiency metric');
});

console.log('\n=========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('=========================================\n');

if (failed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✨ All tests passed!');
  process.exit(0);
}
