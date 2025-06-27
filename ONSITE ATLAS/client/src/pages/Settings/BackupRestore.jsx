import React, { useState } from 'react';
import backupService from '../../services/backupService';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Input
} from '../../components/common';

const BackupRestore = () => {
  const [status, setStatus] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [file, setFile] = useState(null);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setStatus(null);
      const response = await backupService.downloadBackup();
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers['content-disposition']?.split('filename=')[1]?.replaceAll('"','') || 'backup.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Backup downloaded successfully.' });
    } catch (error) {
      console.error('Download backup error:', error);
      setStatus({ type: 'error', message: 'Failed to download backup.' });
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Please select a backup file.' });
      return;
    }
    try {
      setRestoring(true);
      setStatus(null);
      await backupService.restoreBackup(file);
      setStatus({ type: 'success', message: 'Restore completed successfully.' });
    } catch (error) {
      console.error('Restore backup error:', error);
      const msg = error.response?.data?.message || 'Failed to restore backup.';
      setStatus({ type: 'error', message: msg });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Backup &amp; Restore</h1>

      {status && (
        <Alert type={status.type} className="mb-6">
          {status.message}
        </Alert>
      )}

      <Card className="mb-8">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Download Backup</h2>
          <p className="text-gray-600">Click the button below to generate and download a full backup of the system database.</p>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (<Spinner size="sm" className="mr-2" />) : null }
            Download Backup
          </Button>
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Restore Backup</h2>
          <p className="text-gray-600">Select a backup ZIP file and click Restore to import data. WARNING: this will overwrite existing data.</p>
          <Input type="file" accept=".zip" onChange={(e) => setFile(e.target.files[0])} />
          <Button onClick={handleRestore} disabled={restoring || !file} variant="primary">
            {restoring ? (<Spinner size="sm" className="mr-2" />) : null }
            Restore
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BackupRestore; 