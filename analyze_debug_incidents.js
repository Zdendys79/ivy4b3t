#!/usr/bin/env node

/**
 * Utility script pro analýzu debug incidents z databáze
 * Umožňuje prohlížet, analyzovat a označovat incidents jako vyřešené
 */

import fs from 'fs/promises';
import { db } from './ivy/iv_sql.js';
import { Log } from './ivy/iv_log.class.js';

const COMMANDS = {
  list: 'List recent debug incidents',
  show: 'Show specific incident details (usage: show INCIDENT_ID)',
  stats: 'Show debug incidents statistics',
  resolve: 'Mark incident as resolved (usage: resolve INCIDENT_ID "resolution notes")',
  cleanup: 'Delete resolved incidents older than N days (usage: cleanup 30)',
  export: 'Export incident DOM/screenshot to files (usage: export INCIDENT_ID)',
  help: 'Show this help message'
};

async function listIncidents(limit = 20) {
  try {
    const incidents = await db.safeQueryAll('system.getDebugIncidents', [limit]);
    
    if (!incidents.length) {
      console.log('📋 No debug incidents found.');
      return;
    }

    console.log(`\n📋 Recent Debug Incidents (${incidents.length}):\n`);
    console.log('ID'.padEnd(40) + ' | User'.padEnd(12) + ' | Level'.padEnd(8) + ' | Time'.padEnd(20) + ' | Status'.padEnd(10) + ' | Error Summary');
    console.log('-'.repeat(120));

    for (const incident of incidents) {
      const time = new Date(incident.timestamp).toLocaleString();
      const summary = incident.error_summary || 'No summary';
      
      console.log(
        incident.incident_id.padEnd(40) + ' | ' +
        (incident.user_id || 'N/A').padEnd(12) + ' | ' +
        incident.error_level.padEnd(8) + ' | ' +
        time.padEnd(20) + ' | ' +
        incident.status.padEnd(10) + ' | ' +
        summary.substring(0, 40)
      );
    }
    
    console.log(`\n💡 Use 'show INCIDENT_ID' for detailed analysis`);
    
  } catch (err) {
    Log.error('[ANALYZE]', `Failed to list incidents: ${err.message}`);
  }
}

async function showIncident(incidentId) {
  try {
    const incidents = await db.safeQueryAll('system.getDebugIncidentById', [incidentId]);
    
    if (!incidents.length) {
      console.log(`❌ Incident ${incidentId} not found.`);
      return;
    }

    const incident = incidents[0];
    
    console.log(`\n🔍 Debug Incident Analysis: ${incident.incident_id}`);
    console.log('='.repeat(80));
    
    // Basic info
    console.log(`📅 Timestamp: ${new Date(incident.timestamp).toLocaleString()}`);
    console.log(`👤 User ID: ${incident.user_id || 'N/A'}`);
    console.log(`🚨 Error Level: ${incident.error_level}`);
    console.log(`📊 Status: ${incident.status}`);
    console.log(`🌐 Page URL: ${incident.page_url || 'N/A'}`);
    console.log(`📄 Page Title: ${incident.page_title || 'N/A'}`);
    
    // Error details
    console.log(`\n💥 Error Message:`);
    console.log(incident.error_message);
    
    if (incident.user_comment) {
      console.log(`\n💬 User Comment:`);
      console.log(incident.user_comment);
    }
    
    if (incident.user_analysis_request) {
      console.log(`\n🔍 Analysis Request:`);
      console.log(incident.user_analysis_request);
    }
    
    // Technical details
    if (incident.stack_trace) {
      console.log(`\n📚 Stack Trace:`);
      console.log(incident.stack_trace.substring(0, 500) + (incident.stack_trace.length > 500 ? '...' : ''));
    }
    
    // Data sizes
    const screenshotSize = incident.screenshot_data ? incident.screenshot_data.length : 0;
    const domSize = incident.dom_html ? incident.dom_html.length : 0;
    
    console.log(`\n📊 Data Sizes:`);
    console.log(`  📸 Screenshot: ${screenshotSize} bytes`);
    console.log(`  📄 DOM HTML: ${domSize} characters`);
    
    if (incident.analysis_notes) {
      console.log(`\n🔬 Analysis Notes:`);
      console.log(incident.analysis_notes);
    }
    
    console.log(`\n💡 Available actions:`);
    console.log(`  export ${incidentId} - Export DOM and screenshot to files`);
    console.log(`  resolve ${incidentId} "Fixed login issue" - Mark as resolved`);
    
  } catch (err) {
    Log.error('[ANALYZE]', `Failed to show incident: ${err.message}`);
  }
}

async function showStats() {
  try {
    const stats = await db.safeQueryAll('system.getDebugIncidentStats', []);
    
    console.log('\n📊 Debug Incidents Statistics:\n');
    console.log('Status'.padEnd(12) + ' | Level'.padEnd(8) + ' | Count'.padEnd(8) + ' | Latest Incident');
    console.log('-'.repeat(60));
    
    for (const stat of stats) {
      const latest = stat.latest_incident ? new Date(stat.latest_incident).toLocaleString() : 'N/A';
      console.log(
        stat.status.padEnd(12) + ' | ' +
        stat.error_level.padEnd(8) + ' | ' +
        stat.count.toString().padEnd(8) + ' | ' +
        latest
      );
    }
    
  } catch (err) {
    Log.error('[ANALYZE]', `Failed to show stats: ${err.message}`);
  }
}

async function resolveIncident(incidentId, resolution) {
  try {
    await db.safeExecute('system.markDebugIncidentResolved', [resolution, incidentId]);
    console.log(`✅ Incident ${incidentId} marked as resolved.`);
    
  } catch (err) {
    Log.error('[ANALYZE]', `Failed to resolve incident: ${err.message}`);
  }
}

async function cleanupOldIncidents(days) {
  try {
    const result = await db.safeExecute('system.deleteResolvedDebugIncidents', [days]);
    console.log(`🧹 Cleaned up resolved incidents older than ${days} days. Affected rows: ${result.affectedRows}`);
    
  } catch (err) {
    Log.error('[ANALYZE]', `Failed to cleanup incidents: ${err.message}`);
  }
}

async function exportIncident(incidentId) {
  try {
    const incidents = await db.safeQueryAll('system.getDebugIncidentById', [incidentId]);
    
    if (!incidents.length) {
      console.log(`❌ Incident ${incidentId} not found.`);
      return;
    }

    const incident = incidents[0];
    const exportDir = `./exported_incidents/${incidentId}`;
    
    // Create export directory
    await fs.mkdir(exportDir, { recursive: true });
    
    // Export DOM HTML
    if (incident.dom_html) {
      await fs.writeFile(`${exportDir}/dom.html`, incident.dom_html);
      console.log(`📄 DOM exported to ${exportDir}/dom.html`);
    }
    
    // Export screenshot
    if (incident.screenshot_data) {
      await fs.writeFile(`${exportDir}/screenshot.png`, incident.screenshot_data);
      console.log(`📸 Screenshot exported to ${exportDir}/screenshot.png`);
    }
    
    // Export metadata
    const metadata = {
      incident_id: incident.incident_id,
      timestamp: incident.timestamp,
      user_id: incident.user_id,
      error_level: incident.error_level,
      error_message: incident.error_message,
      page_url: incident.page_url,
      page_title: incident.page_title,
      user_comment: incident.user_comment,
      user_analysis_request: incident.user_analysis_request,
      stack_trace: incident.stack_trace
    };
    
    await fs.writeFile(`${exportDir}/metadata.json`, JSON.stringify(metadata, null, 2));
    console.log(`📋 Metadata exported to ${exportDir}/metadata.json`);
    
    // Export console logs
    if (incident.console_logs) {
      await fs.writeFile(`${exportDir}/console_logs.json`, incident.console_logs);
      console.log(`📝 Console logs exported to ${exportDir}/console_logs.json`);
    }
    
    console.log(`\n✅ Incident ${incidentId} exported to ${exportDir}/`);
    
  } catch (err) {
    Log.error('[ANALYZE]', `Failed to export incident: ${err.message}`);
  }
}

function showHelp() {
  console.log('\n🔍 Debug Incidents Analyzer\n');
  console.log('Available commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(10)} - ${desc}`);
  }
  console.log('\nExamples:');
  console.log('  node analyze_debug_incidents.js list');
  console.log('  node analyze_debug_incidents.js show 2025-07-03T15-30-45-123Z_USER_456_ERROR');
  console.log('  node analyze_debug_incidents.js resolve INCIDENT_ID "Fixed by updating login logic"');
  console.log('  node analyze_debug_incidents.js export INCIDENT_ID');
  console.log('  node analyze_debug_incidents.js cleanup 30');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    return;
  }
  
  const command = args[0].toLowerCase();
  
  try {
    switch (command) {
      case 'list':
        const limit = parseInt(args[1]) || 20;
        await listIncidents(limit);
        break;
        
      case 'show':
        if (!args[1]) {
          console.log('❌ Missing incident ID. Usage: show INCIDENT_ID');
          return;
        }
        await showIncident(args[1]);
        break;
        
      case 'stats':
        await showStats();
        break;
        
      case 'resolve':
        if (!args[1] || !args[2]) {
          console.log('❌ Missing parameters. Usage: resolve INCIDENT_ID "resolution notes"');
          return;
        }
        await resolveIncident(args[1], args[2]);
        break;
        
      case 'cleanup':
        const days = parseInt(args[1]) || 30;
        await cleanupOldIncidents(days);
        break;
        
      case 'export':
        if (!args[1]) {
          console.log('❌ Missing incident ID. Usage: export INCIDENT_ID');
          return;
        }
        await exportIncident(args[1]);
        break;
        
      case 'help':
        showHelp();
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        showHelp();
    }
    
  } catch (err) {
    Log.error('[ANALYZE]', `Command failed: ${err.message}`);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}