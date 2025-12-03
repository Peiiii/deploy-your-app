#!/usr/bin/env node

/**
 * End-to-end test script for deployment functionality
 * Tests deploying a real project (mindflow) using Docker container
 * Uses Node.js for better SSE stream handling
 */

import { spawn } from 'child_process';
import http from 'http';

const IMAGE_NAME = 'deploy-your-app-server';
const CONTAINER_NAME = 'deploy-your-app-e2e-test';
const TEST_PORT = 8080;
const TEST_REPO = 'https://github.com/Peiiii/mindflow';
const TEST_PROJECT_NAME = 'mindflow';
const BASE_URL = `http://localhost:${TEST_PORT}`;

let containerId = null;

// Helper functions
function log(message, level = 'info') {
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  }[level] || 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject({ stdout, stderr, code });
      }
    });
  });
}

async function checkDocker() {
  try {
    await execCommand('docker', ['info']);
    return true;
  } catch {
    return false;
  }
}

async function buildImage(projectRoot) {
  log('Building Docker image...', 'info');
  try {
    await execCommand('docker', ['build', '-t', `${IMAGE_NAME}:latest`, '.'], {
      cwd: projectRoot,
    });
    log('Image built successfully', 'success');
  } catch (error) {
    log(`Failed to build image: ${error.stderr}`, 'error');
    throw error;
  }
}

async function startContainer(projectRoot) {
  log('Starting test container...', 'info');
  
  // Stop old container
  try {
    await execCommand('docker', ['stop', CONTAINER_NAME]);
    await execCommand('docker', ['rm', CONTAINER_NAME]);
  } catch {
    // Ignore if container doesn't exist
  }

  // Start new container
  const result = await execCommand('docker', [
    'run',
    '-d',
    '--name', CONTAINER_NAME,
    '-p', `${TEST_PORT}:4173`,
    '-v', `${projectRoot}/data:/data`,
    '-e', 'NODE_ENV=production',
    '-e', 'DATA_DIR=/data',
    '-e', 'PORT=4173',
    `${IMAGE_NAME}:latest`,
  ]);

  containerId = result.stdout.trim();
  log(`Container started: ${containerId}`, 'success');
  
  // Wait for server to start
  log('Waiting for server to start...', 'info');
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

async function waitForServer(maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/projects`);
      if (response.ok) {
        log('Server is responding', 'success');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

async function createProject() {
  log('Creating project...', 'info');
  
  const response = await fetch(`${BASE_URL}/api/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: TEST_PROJECT_NAME,
      identifier: TEST_REPO,
      sourceType: 'github',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create project: ${response.status} ${text}`);
  }

  const project = await response.json();
  log(`Project created with ID: ${project.id}`, 'success');
  return project;
}

async function triggerDeployment(project) {
  log('Triggering deployment...', 'info');
  
  const response = await fetch(`${BASE_URL}/api/v1/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: project.id,
      name: project.name,
      repoUrl: TEST_REPO,
      sourceType: 'github',
      framework: 'Unknown',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger deployment: ${response.status} ${text}`);
  }

  const result = await response.json();
  log(`Deployment triggered with ID: ${result.deploymentId}`, 'success');
  return result.deploymentId;
}

async function monitorDeployment(deploymentId) {
  log('Monitoring deployment progress via SSE...', 'info');
  log('(This may take a few minutes...)', 'info');
  console.log('');

  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/api/v1/deployments/${deploymentId}/stream`;
    const req = http.get(url, (res) => {
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'status') {
                log(`Status: ${data.status}`, 'info');
                if (data.status === 'SUCCESS') {
                  resolve({ status: 'SUCCESS', data });
                  return;
                } else if (data.status === 'FAILED') {
                  reject({ status: 'FAILED', data });
                  return;
                }
              } else if (data.type === 'log') {
                // Show important logs
                if (data.message.match(/(Starting|Building|Installing|Cloning|npm|vite|build|complete|failed|Error)/i)) {
                  const level = data.level || 'info';
                  const icon = {
                    info: '📝',
                    success: '✅',
                    error: '❌',
                    warning: '⚠️',
                  }[level] || '📝';
                  console.log(`   ${icon} [${level.toUpperCase()}] ${data.message}`);
                }
              }
            } catch (err) {
              // Ignore parse errors
            }
          }
        }
      });

      res.on('end', () => {
        // If stream ends without success/failure, check final status
        resolve({ status: 'UNKNOWN' });
      });

      res.on('error', (err) => {
        reject({ status: 'ERROR', error: err });
      });
    });

    req.on('error', (err) => {
      reject({ status: 'ERROR', error: err });
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      req.destroy();
      reject({ status: 'TIMEOUT' });
    }, 600000);
  });
}

async function checkDeployedApp() {
  log('Checking deployed app...', 'info');
  
  const response = await fetch(`${BASE_URL}/api/v1/projects`);
  const projects = await response.json();
  const project = projects.find((p) => p.name === TEST_PROJECT_NAME);
  
  if (project && project.url) {
    log(`Project URL: ${project.url}`, 'info');
    
    // Try to access the deployed app
    if (project.url.startsWith('/') || project.url.includes('localhost')) {
      const appUrl = project.url.startsWith('/') 
        ? `${BASE_URL}${project.url}`
        : project.url;
      
      try {
        const appResponse = await fetch(appUrl);
        if (appResponse.ok) {
          log('Deployed app is accessible', 'success');
        } else {
          log(`Deployed app returned ${appResponse.status}`, 'warning');
        }
      } catch (err) {
        log(`Failed to access deployed app: ${err.message}`, 'warning');
      }
    } else {
      log(`App deployed to: ${project.url}`, 'info');
    }
  }
}

async function cleanup() {
  log('Cleaning up test container...', 'info');
  try {
    await execCommand('docker', ['stop', CONTAINER_NAME]);
    await execCommand('docker', ['rm', CONTAINER_NAME]);
  } catch {
    // Ignore errors
  }
}

// Main test flow
async function runTest() {
  const projectRoot = process.cwd();
  
  try {
    log('Starting E2E Test...', 'info');
    console.log('');

    // Check Docker
    if (!(await checkDocker())) {
      log('Docker is not running. Please start Docker Desktop.', 'error');
      process.exit(1);
    }

    // Build image if needed
    try {
      await execCommand('docker', ['images', '-q', `${IMAGE_NAME}:latest`]);
    } catch {
      await buildImage(projectRoot);
    }

    // Start container
    await startContainer(projectRoot);

    // Wait for server
    if (!(await waitForServer())) {
      log('Server failed to start', 'error');
      const logs = await execCommand('docker', ['logs', '--tail', '30', CONTAINER_NAME]);
      console.log(logs.stdout);
      await cleanup();
      process.exit(1);
    }

    console.log('');

    // Test 1: Create project
    const project = await createProject();
    console.log('');

    // Test 2: Trigger deployment
    const deploymentId = await triggerDeployment(project);
    console.log('');

    // Test 3: Monitor deployment
    let deploymentStatus;
    try {
      deploymentStatus = await monitorDeployment(deploymentId);
    } catch (result) {
      deploymentStatus = result;
    }

    console.log('');
    log('Recent container logs:', 'info');
    const logs = await execCommand('docker', ['logs', '--tail', '50', CONTAINER_NAME]);
    console.log(logs.stdout.split('\n').slice(-30).join('\n'));

    console.log('');
    log('Test Results:', 'info');
    console.log(`   Project ID: ${project.id}`);
    console.log(`   Deployment ID: ${deploymentId}`);
    console.log(`   Status: ${deploymentStatus.status}`);

    // Test 4: Check deployed app
    if (deploymentStatus.status === 'SUCCESS') {
      console.log('');
      await checkDeployedApp();
    }

    // Cleanup
    console.log('');
    await cleanup();

    // Final result
    console.log('');
    if (deploymentStatus.status === 'SUCCESS') {
      log('E2E Test PASSED!', 'success');
      process.exit(0);
    } else {
      log(`E2E Test FAILED (Status: ${deploymentStatus.status})`, 'error');
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    log(`Test failed: ${error.message}`, 'error');
    if (error.stack) {
      console.error(error.stack);
    }
    await cleanup();
    process.exit(1);
  }
}

// Run the test
runTest();

