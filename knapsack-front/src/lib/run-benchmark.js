#!/usr/bin/env node

// run-benchmark.js
// Simple runner for the knapsack benchmark suite

import { runBenchmark } from './optimizer-benchmark.js';

console.log('Starting Knapsack Algorithm Benchmark...\n');

// Run with default settings (all algorithms, all test cases)
const results = runBenchmark({
  timeout: 5000 // 5 second timeout per test
});

console.log('\nBenchmark complete!');
