# 📦 Event Backup & Recovery System

## Overview

The PurpleHat Event Management System includes a comprehensive backup and recovery system that automatically creates backups before permanent event deletions and provides multiple methods for data recovery.

## 🔧 How It Works

### Automatic Backup Creation
- **When**: Automatically triggered before every event deletion (both scheduled and force delete)
- **What**: Complete snapshot of all event-related data across 39+ database collections
- **Where**: Stored in `./backups/event_deletions/` as JSON files
- **Format**: `event_{eventId}_backup_{timestamp}.json`

### Backup Contents
Each backup contains:
- **Event Document**: The main event record
- **Related Collections**: All associated data (registrations, payments, resources, etc.)
- **User References**: Event references in user accounts (without full user data)
- **Metadata**: Backup information, timestamps, and statistics

## 📁 Backup File Structure

```
./backups/event_deletions/
├── event_680b92dbecb281d206fcc561_backup_1752077693516.json
├── event_681a45b7891bf5283e4d87b6_backup_1752234567890.json
└── ...
```

### Backup JSON Structure
```json
{
  "metadata": {
    "eventId": "680b92dbecb281d206fcc561",
    "eventName": "test bulk import",
    "backupId": "event_680b92dbecb281d206fcc561_backup_1752077693516",
    "backupDate": "2025-07-09T21:44:53.516Z",
    "version": "1.0"
  },
  "eventDocument": { /* Main event data */ },
  "collections": {
    "Registration": [ /* 7674 registration records */ ],
    "Resource": [ /* 22 resource records */ ],
    "ResourceSetting": [ /* 4 resource setting records */ ],
    // ... 39+ collections
  }
}
```

## 🔄 Recovery Methods

### 1. API Routes (Web Interface)

#### List Backups
```http
GET /api/backups
Authorization: Bearer {admin_token}
```

#### Get Backup Details
```http
GET /api/backups/{backupId}
Authorization: Bearer {admin_token}
```

#### Restore Backup
```http
POST /api/backups/{backupId}/restore
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "dryRun": false,
  "specificCollections": ["Registration", "Resource"],
  "newEventId": "new_event_id_here",
  "skipExistingRecords": true
}
```

#### Delete Backup
```http
DELETE /api/backups/{backupId}
Authorization: Bearer {admin_token}
```

### 2. Command Line Interface

#### Navigate to Script Directory
```bash
cd /path/to/ONSITE\ ATLAS/server/scripts
```

#### List All Backups
```bash
node backup-manager.js list
```

#### View Backup Details
```bash
node backup-manager.js details event_680b92dbecb281d206fcc561_backup_1752077693516
```

#### Restore Backup (Full)
```bash
node backup-manager.js restore event_680b92dbecb281d206fcc561_backup_1752077693516
```

#### Dry Run (Test Restoration)
```bash
node backup-manager.js restore-dry event_680b92dbecb281d206fcc561_backup_1752077693516
```

#### Restore to New Event ID (Clone)
```bash
node backup-manager.js restore-new event_680b92dbecb281d206fcc561_backup_1752077693516 new_event_id_here
```

#### Delete Backup File
```bash
node backup-manager.js delete event_680b92dbecb281d206fcc561_backup_1752077693516
```

## 🛠️ Advanced Recovery Options

### Selective Collection Restoration
Restore only specific collections:
```json
{
  "specificCollections": ["Registration", "Payment", "Resource"],
  "dryRun": false
}
```

### Event Cloning
Restore backup data to a new event ID:
```json
{
  "newEventId": "new_event_id_here",
  "skipExistingRecords": true
}
```

### Dry Run Testing
Test restoration without making changes:
```json
{
  "dryRun": true
}
```

## 🚨 Emergency Recovery Scenarios

### Scenario 1: Recently Deleted Event (< 24 hours)
**Best Method**: API or CLI restoration
```bash
# 1. List recent backups
node backup-manager.js list

# 2. Restore the event
node backup-manager.js restore event_{eventId}_backup_{timestamp}
```

### Scenario 2: Partial Data Loss
**Best Method**: Selective collection restoration
```bash
# Restore only specific collections
curl -X POST "/api/backups/{backupId}/restore" \
  -H "Authorization: Bearer {token}" \
  -d '{"specificCollections": ["Registration", "Payment"]}'
```

### Scenario 3: Event Duplication Needed
**Best Method**: Clone to new event ID
```bash
# Clone event with new ID
node backup-manager.js restore-new {backupId} {newEventId}
```

## 📊 Backup Statistics

From your recent force delete:
- **Event**: "test bulk import" 
- **Total Records Deleted**: 7,743 records
- **Collections Affected**: 39 collections
- **Backup Location**: `./backups/event_deletions/event_680b92dbecb281d206fcc561_backup_1752077693516.json`
- **Backup Size**: ~500-2000KB (estimated)

## 🔍 Troubleshooting

### Backup Directory Missing
```bash
# Create backup directory structure
mkdir -p ./backups/event_deletions
```

### Permission Issues
```bash
# Fix permissions
chmod 755 ./backups
chmod 644 ./backups/event_deletions/*.json
```

### Test Backup System
```bash
# Test backup creation
curl -X POST "/api/backups/test" \
  -H "Authorization: Bearer {admin_token}"
```

### Verify Backup Integrity
```bash
# Check backup details
node backup-manager.js details {backupId}
```

## ⚠️ Important Notes

### Data Safety
- ✅ **Backups are automatic** - created before every deletion
- ✅ **Multiple recovery methods** - API, CLI, manual
- ✅ **Selective restoration** - restore specific collections
- ✅ **Event cloning** - restore to new event IDs
- ✅ **Dry run testing** - test before actual restoration

### Limitations
- ⚠️ **File-based storage** - backups stored as JSON files
- ⚠️ **Manual cleanup** - old backups need manual deletion
- ⚠️ **Single event scope** - each backup covers one event only
- ⚠️ **No incremental backups** - full snapshots only

### Best Practices
1. **Test first** - always use dry run before real restoration
2. **Verify backups** - check backup details before deletion
3. **Multiple options** - use CLI for complex operations, API for simple ones
4. **Monitor space** - backup files can be large (MB to GB)
5. **Document changes** - log all restoration activities

## 🆘 Emergency Contact

If backup restoration fails or you need assistance:
1. Check server logs for detailed error messages
2. Verify database connectivity and permissions
3. Ensure backup file integrity
4. Contact system administrator with backup ID and error details

---

**The backup system is now fully functional and will automatically protect against data loss during event deletions.** 