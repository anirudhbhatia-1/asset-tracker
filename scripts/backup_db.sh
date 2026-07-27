#!/bin/bash
# ==========================================
# AssetTrack SQLite Database Backup Script
# ==========================================
# Best run via a daily cron job.
# Example: 0 2 * * * /path/to/assettrack/scripts/backup_db.sh

# Configuration
# Path to your live database file
DB_FILE="/var/www/assettrack/server/data/assets.db"

# Directory where backups will be stored
BACKUP_DIR="/var/backups/assettrack"

# Number of days to retain backups
RETENTION_DAYS=30

# Ensure the backup directory exists
mkdir -p "$BACKUP_DIR"

# Generate a timestamp (YYYY-MM-DD_HH-MM-SS)
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="assets_backup_$TIMESTAMP"
BACKUP_ARCHIVE="$BACKUP_DIR/$BACKUP_NAME.tar.gz"

echo "[$(date)] Starting backup of $DB_FILE..."

# Check if the database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "ERROR: Database file not found at $DB_FILE!"
    exit 1
fi

# We use the SQLite online backup API to safely snapshot the database
# without corrupting it if it's currently being written to.
# This creates a temporary snapshot file.
TEMP_BACKUP="/tmp/$BACKUP_NAME.db"

sqlite3 "$DB_FILE" ".backup '$TEMP_BACKUP'"

if [ $? -eq 0 ]; then
    # Compress the snapshot into the backup directory
    tar -czf "$BACKUP_ARCHIVE" -C /tmp "$BACKUP_NAME.db"
    
    if [ $? -eq 0 ]; then
        echo "[$(date)] Backup successfully created: $BACKUP_ARCHIVE"
        
        # Clean up the temporary uncompressed snapshot
        rm -f "$TEMP_BACKUP"
        
        # Enforce retention policy (delete backups older than RETENTION_DAYS)
        echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
        find "$BACKUP_DIR" -name "assets_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
        echo "[$(date)] Cleanup complete."
        exit 0
    else
        echo "ERROR: Failed to compress backup."
        rm -f "$TEMP_BACKUP"
        exit 1
    fi
else
    echo "ERROR: SQLite .backup command failed."
    exit 1
fi
