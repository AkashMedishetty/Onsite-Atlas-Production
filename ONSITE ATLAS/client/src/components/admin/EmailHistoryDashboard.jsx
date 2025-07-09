import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Spinner, Modal, Input, Select } from '../common';
import { Mail, AlertCircle, CheckCircle, Clock, XCircle, TrendingUp, Filter, Download, Users, BarChart3 } from 'lucide-react';
import emailService from '../../services/emailService';
import { toast } from 'react-hot-toast';

const EmailHistoryDashboard = ({ eventId }) => {
  const [loading, setLoading] = useState(true);
  const [emailHistory, setEmailHistory] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [errorPatterns, setErrorPatterns] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    templateUsed: '',
    dateFrom: '',
    dateTo: ''
  });

  // Modal states
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [selectedEmailFailures, setSelectedEmailFailures] = useState(null);
  const [failureLoading, setFailureLoading] = useState(false);

  // Filter options
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'completed_with_errors', label: 'Completed with Errors' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' }
  ];

  const templateOptions = [
    { value: '', label: 'All Templates' },
    { value: 'registration', label: 'Registration' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'custom', label: 'Custom' }
  ];

  // Fetch enhanced email history
  const fetchEmailHistory = async () => {
    try {
      setLoading(true);
      const response = await emailService.getEnhancedEmailHistory(eventId, filters);
      
      if (response.success) {
        setEmailHistory(response.data.history);
        setStatistics(response.data.statistics);
        setErrorPatterns(response.data.errorPatterns);
      } else {
        toast.error('Failed to load email history');
      }
    } catch (error) {
      console.error('Error fetching email history:', error);
      toast.error('Failed to load email history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailHistory();
  }, [eventId, filters]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Get failure details for specific email
  const handleViewFailures = async (emailId) => {
    try {
      setFailureLoading(true);
      setShowFailureModal(true);
      
      const response = await emailService.getEmailFailureReport(eventId, emailId);
      if (response.success) {
        setSelectedEmailFailures(response.data);
      } else {
        toast.error('Failed to load failure details');
      }
    } catch (error) {
      console.error('Error fetching failure details:', error);
      toast.error('Failed to load failure details');
    } finally {
      setFailureLoading(false);
    }
  };

  // Status badge component
  const StatusBadge = ({ status, sent, failed, total }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'completed':
          return { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Completed' };
        case 'completed_with_errors':
          return { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, text: 'With Errors' };
        case 'failed':
          return { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Failed' };
        case 'pending':
          return { color: 'bg-blue-100 text-blue-800', icon: Clock, text: 'Pending' };
        default:
          return { color: 'bg-gray-100 text-gray-800', icon: Clock, text: status };
      }
    };

    const { color, icon: Icon, text } = getStatusConfig();
    
    return (
      <div className="flex flex-col space-y-1">
        <Badge className={`${color} inline-flex items-center`}>
          <Icon className="w-3 h-3 mr-1" />
          {text}
        </Badge>
        <div className="text-xs text-gray-500">
          {sent}/{total} sent
          {failed > 0 && <span className="text-red-600 ml-1">({failed} failed)</span>}
        </div>
      </div>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Format processing time
  const formatProcessingTime = (durationMs) => {
    if (!durationMs) return 'N/A';
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Email History & Failures</h2>
        <Button onClick={() => fetchEmailHistory()} className="flex items-center">
          <Download className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Emails</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.totalEmails || 0}</p>
            </div>
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">{statistics.successRate || 0}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Recipients</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.totalRecipients || 0}</p>
            </div>
            <Users className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed Emails</p>
              <p className="text-2xl font-bold text-red-600">{statistics.totalFailed || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Error Patterns */}
      <Card className="mb-6">
        <div className="p-4">
          <h3 className="text-lg font-medium flex items-center mb-4">
            <BarChart3 className="h-5 w-5 mr-2" />
            Common Error Patterns
          </h3>
          {errorPatterns.length === 0 ? (
            <p className="text-gray-500">No errors detected</p>
          ) : (
            <div className="space-y-2">
              {errorPatterns.map((pattern, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{pattern.pattern}</span>
                  <Badge className="bg-red-100 text-red-800">{pattern.count} occurrences</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <div className="p-4">
          <h3 className="text-lg font-medium flex items-center mb-4">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                options={statusOptions}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
              <Select
                value={filters.templateUsed}
                onChange={(e) => handleFilterChange('templateUsed', e.target.value)}
                options={templateOptions}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Email History Table */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-medium mb-4">Email History</h3>
          
          {emailHistory.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No emails found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Template
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Processing Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {emailHistory.map((email, index) => (
                    <tr key={email._id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(email.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">{email.subject}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Badge variant="outline">
                          {email.templateUsed || 'custom'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge 
                          status={email.status}
                          sent={email.sent}
                          failed={email.failed}
                          total={email.recipients}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {email.sentByName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatProcessingTime(email.processingTime?.durationMs)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {email.failed > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewFailures(email._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            View Failures ({email.failed})
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Failure Details Modal */}
      <Modal
        isOpen={showFailureModal}
        onClose={() => setShowFailureModal(false)}
        title="Email Failure Analysis"
        size="lg"
      >
        <div className="space-y-4">
          {failureLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : selectedEmailFailures ? (
            <>
              {/* Email Summary */}
              <Card className="p-4">
                <h4 className="font-medium mb-2">Email Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Subject:</span>
                    <div className="font-medium">{selectedEmailFailures.emailRecord.subject}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <div className="font-medium">{formatDate(selectedEmailFailures.emailRecord.date)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Recipients:</span>
                    <div className="font-medium">{selectedEmailFailures.emailRecord.recipients}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Failed:</span>
                    <div className="font-medium text-red-600">{selectedEmailFailures.emailRecord.failed}</div>
                  </div>
                </div>
              </Card>

              {/* Error Analysis */}
              <Card className="p-4">
                <h4 className="font-medium mb-4">Error Analysis</h4>
                {Object.keys(selectedEmailFailures.errorAnalysis).length === 0 ? (
                  <p className="text-gray-500">No detailed error information available</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(selectedEmailFailures.errorAnalysis).map(([errorType, details]) => (
                      <div key={errorType} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="font-medium text-red-600">{errorType}</h5>
                          <Badge className="bg-red-100 text-red-800">
                            {details.count} {details.count === 1 ? 'error' : 'errors'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{details.description}</p>
                        
                        {/* Failed email addresses */}
                        <div className="max-h-32 overflow-y-auto">
                          <div className="text-xs text-gray-500 mb-1">Failed Recipients:</div>
                          <div className="space-y-1">
                            {details.emails.map((failedEmail, index) => (
                              <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                                <div className="font-medium">{failedEmail.email}</div>
                                <div className="text-gray-600">{failedEmail.error}</div>
                                <div className="text-gray-500">{formatDate(failedEmail.timestamp)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Alert type="error">Failed to load failure details</Alert>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EmailHistoryDashboard; 