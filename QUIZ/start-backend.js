#!/usr/bin/env node

/**
 * 🚀 Quiz Platform Backend Startup Script
 * Ensures proper setup for 300+ concurrent participants
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting Quiz Platform Backend for 300+ Participants...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18+ required. Current version:', nodeVersion);
  console.error('Please upgrade: https://nodejs.org/');
  process.exit(1);
}

console.log('✅ Node.js version:', nodeVersion);

// Check if we're in the backend directory
const backendDir = path.join(__dirname, 'backend');
const currentDir = process.cwd();

if (!fs.existsSync(path.join(currentDir, 'server.js')) && !fs.existsSync(path.join(backendDir, 'server.js'))) {
  console.error('❌ Backend files not found.');
  console.error('Run this script from the project root or backend directory.');
  process.exit(1);
}

// Determine correct backend directory
const workingDir = fs.existsSync(path.join(currentDir, 'server.js')) ? currentDir : backendDir;
console.log('✅ Backend directory:', workingDir);

// Check package.json exists
const packageJsonPath = path.join(workingDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found in:', workingDir);
  console.error('Please run: cd backend && npm install');
  process.exit(1);
}

console.log('✅ Package.json found');

// Check .env file exists
const envPath = path.join(workingDir, '.env');
if (!fs.existsSync(envPath)) {
  console.warn('⚠️  .env file not found');
  console.log('📋 Creating .env from template...');
  
  const envExamplePath = path.join(workingDir, 'env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created from env.example');
    console.log('\n🔧 IMPORTANT: Edit .env file with your actual values:');
    console.log('   - SUPABASE_URL');
    console.log('   - SUPABASE_SERVICE_KEY');
    console.log('   - REDIS_URL (if using external Redis)');
    console.log('\nPress Ctrl+C to edit .env, then run this script again.\n');
    
    // Don't exit, let them start with defaults for local testing
  }
}

// Check dependencies installed
const nodeModulesPath = path.join(workingDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  
  const npmInstall = spawn('npm', ['install'], {
    cwd: workingDir,
    stdio: 'inherit',
    shell: true
  });
  
  npmInstall.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Dependencies installed');
      startBackend();
    } else {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
  });
} else {
  console.log('✅ Dependencies already installed');
  startBackend();
}

function startBackend() {
  console.log('\n🔥 Starting backend server...\n');
  
  // Determine which script to run
  let scriptCommand = ['npm', 'run'];
  
  // Check if clustering should be enabled
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  const enableClustering = process.argv.includes('--cluster') || isProduction;
  
  if (enableClustering) {
    scriptCommand.push('cluster');
    console.log('🚀 Starting with clustering enabled (production mode)');
  } else {
    scriptCommand.push('dev');
    console.log('🛠️  Starting in development mode');
  }
  
  // Start the backend server
  const backend = spawn(scriptCommand[0], scriptCommand.slice(1), {
    cwd: workingDir,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: isProduction ? 'production' : 'development',
      CLUSTER_ENABLED: enableClustering ? 'true' : 'false'
    }
  });
  
  backend.on('error', (err) => {
    console.error('❌ Failed to start backend:', err);
    process.exit(1);
  });
  
  backend.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Backend exited with code ${code}`);
    }
    process.exit(code);
  });
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n⏹️  Shutting down backend server...');
    backend.kill('SIGTERM');
  });
  
  // Show helpful information
  setTimeout(() => {
    console.log('\n📊 Backend Status:');
    console.log('   Health: http://localhost:3001/health');
    console.log('   Metrics: http://localhost:3001/api/metrics');
    console.log('\n💡 Tips:');
    console.log('   - Run with --cluster for production scaling');
    console.log('   - Run with --production for production mode');
    console.log('   - Press Ctrl+C to stop');
    console.log('\n🎯 Ready for 300+ participants!');
  }, 3000);
} 