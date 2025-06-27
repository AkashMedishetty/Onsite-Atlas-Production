import React, { useState, useEffect } from 'react';
import logsService from '../../services/systemLogsService';
import { Card, Button, Alert, Spinner, Select } from '../../components/common';

const levels = [
  { value: 'all', label: 'All' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'http', label: 'HTTP' },
  { value: 'debug', label: 'Debug' }
];

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState('all');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await logsService.getLogs({ level, limit: 200 });
      if (res.success) {
        setLogs(res.data || []);
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
      setStatus({ type: 'error', message: 'Failed to fetch logs.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const handleDownload = async () => {
    try {
      const resp = await logsService.downloadLogs();
      const blob = new Blob([resp.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = resp.headers['content-disposition']?.split('filename=')[1]?.replaceAll('"','') || 'logs.zip';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download logs error:', err);
      setStatus({ type: 'error', message: 'Failed to download logs.' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">System Logs</h1>

      {status && <Alert type={status.type}>{status.message}</Alert>}

      <div className="flex items-center mb-4 space-x-4">
        <Select
          label="Level"
          value={level}
          onChange={(val) => setLevel(val)}
          options={levels}
          className="w-40"
        />
        <Button onClick={fetchLogs} disabled={loading} variant="outline">
          {loading ? <Spinner size="sm" className="mr-2" /> : null}
          Refresh
        </Button>
        <Button onClick={handleDownload} variant="primary">
          Download Logs
        </Button>
      </div>

      <Card>
        <div className="overflow-auto max-h-[70vh]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2 whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-2 whitespace-nowrap">Level</th>
                <th className="px-4 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="3" className="px-4 py-4 text-center text-gray-500">No logs available.</td>
                </tr>
              )}
              {logs.map((log, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{log.timestamp || '-'}</td>
                  <td className="px-4 py-2 capitalize whitespace-nowrap">{log.level}</td>
                  <td className="px-4 py-2 break-all">{log.message}</td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan="3" className="px-4 py-4 text-center"><Spinner /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SystemLogs; 