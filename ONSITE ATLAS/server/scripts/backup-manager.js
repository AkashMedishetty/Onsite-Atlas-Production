#!/usr/bin/env node

/**
 * Event Backup Manager CLI
 * Command-line tool for managing event deletion backups
 */

const EventBackupRecoveryService = require('../src/services/EventBackupRecoveryService');
const logger = require('../src/config/logger');

class BackupManagerCLI {
  constructor() {
    this.recoveryService = new EventBackupRecoveryService();
  }

  async listBackups() {
    try {
      console.log('\n📦 Event Deletion Backups\n');
      
      const backups = await this.recoveryService.listBackups();
      
      if (backups.length === 0) {
        console.log('🚫 No backups found\n');
        return;
      }

      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.backupId}`);
        console.log(`   Event: ${backup.eventName} (${backup.eventId})`);
        console.log(`   Date: ${new Date(backup.backupDate).toLocaleString()}`);
        console.log(`   Size: ${backup.fileSizeFormatted}`);
        console.log(`   Records: ${backup.totalRecords} across ${backup.collections.length} collections`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Error listing backups:', error.message);
    }
  }

  async showBackupDetails(backupId) {
    try {
      console.log(`\n🔍 Backup Details: ${backupId}\n`);
      
      const backup = await this.recoveryService.getBackupDetails(backupId);
      
      console.log(`Event: ${backup.eventName} (${backup.eventId})`);
      console.log(`Backup Date: ${new Date(backup.backupDate).toLocaleString()}`);
      console.log(`File Size: ${backup.fileSizeFormatted}`);
      console.log(`Total Records: ${backup.totalRecords}`);
      console.log('\n📊 Collections:');
      
      backup.collectionDetails.forEach(col => {
        console.log(`  • ${col.collection}: ${col.recordCount} records`);
      });
      
      console.log('');
      
    } catch (error) {
      console.error('❌ Error getting backup details:', error.message);
    }
  }

  async restoreBackup(backupId, options = {}) {
    try {
      const { dryRun = false, newEventId = null } = options;
      
      console.log(`\n🔄 ${dryRun ? '[DRY RUN] ' : ''}Restoring backup: ${backupId}\n`);
      
      const stats = await this.recoveryService.restoreFromBackup(backupId, options);
      
      console.log('✅ Restoration completed!');
      console.log(`📊 Collections processed: ${stats.collectionsProcessed}`);
      console.log(`📊 Records restored: ${stats.recordsRestored}`);
      
      if (stats.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        stats.errors.forEach(error => {
          console.log(`  • ${error.collection}: ${error.error}`);
        });
      }
      
      console.log('');
      
    } catch (error) {
      console.error('❌ Error restoring backup:', error.message);
    }
  }

  async deleteBackup(backupId) {
    try {
      console.log(`\n🗑️  Deleting backup: ${backupId}\n`);
      
      await this.recoveryService.deleteBackup(backupId);
      
      console.log('✅ Backup deleted successfully\n');
      
    } catch (error) {
      console.error('❌ Error deleting backup:', error.message);
    }
  }

  showHelp() {
    console.log(`
📦 Event Backup Manager CLI

Usage: node backup-manager.js <command> [options]

Commands:
  list                          List all available backups
  details <backupId>           Show detailed information about a backup
  restore <backupId>           Restore data from a backup
  restore-dry <backupId>       Dry run restoration (no actual changes)
  restore-new <backupId> <newEventId>  Restore to a new event ID
  delete <backupId>            Delete a backup file
  help                         Show this help message

Examples:
  node backup-manager.js list
  node backup-manager.js details event_12345_backup_1234567890
  node backup-manager.js restore event_12345_backup_1234567890
  node backup-manager.js restore-dry event_12345_backup_1234567890
  node backup-manager.js restore-new event_12345_backup_1234567890 new_event_id_here
  node backup-manager.js delete event_12345_backup_1234567890

Notes:
  - All restoration commands require database connection
  - Dry run shows what would be restored without making changes
  - Use restore-new to clone an event with a different ID
  - Delete operations are permanent
    `);
  }
}

// CLI Main Function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cli = new BackupManagerCLI();

  // Connect to database
  require('../src/config/database');

  switch (command) {
    case 'list':
      await cli.listBackups();
      break;
      
    case 'details':
      if (!args[1]) {
        console.error('❌ Please provide a backup ID');
        process.exit(1);
      }
      await cli.showBackupDetails(args[1]);
      break;
      
    case 'restore':
      if (!args[1]) {
        console.error('❌ Please provide a backup ID');
        process.exit(1);
      }
      await cli.restoreBackup(args[1]);
      break;
      
    case 'restore-dry':
      if (!args[1]) {
        console.error('❌ Please provide a backup ID');
        process.exit(1);
      }
      await cli.restoreBackup(args[1], { dryRun: true });
      break;
      
    case 'restore-new':
      if (!args[1] || !args[2]) {
        console.error('❌ Please provide both backup ID and new event ID');
        process.exit(1);
      }
      await cli.restoreBackup(args[1], { newEventId: args[2] });
      break;
      
    case 'delete':
      if (!args[1]) {
        console.error('❌ Please provide a backup ID');
        process.exit(1);
      }
      await cli.deleteBackup(args[1]);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      cli.showHelp();
      break;
      
    default:
      console.error('❌ Unknown command. Use "help" for usage information.');
      process.exit(1);
  }
  
  process.exit(0);
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ CLI Error:', error.message);
    process.exit(1);
  });
}

module.exports = BackupManagerCLI; 