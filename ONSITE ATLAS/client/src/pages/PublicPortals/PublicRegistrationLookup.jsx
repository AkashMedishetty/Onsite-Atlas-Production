import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Input, Button, message, Spin, Descriptions, Tag, QRCode, Divider } from 'antd';
import { 
  SearchOutlined, 
  UserOutlined, 
  MailOutlined, 
  PhoneOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PrinterOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import registrationService from '../../services/registrationService';

const PublicRegistrationLookup = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(true);
  const [eventDetails, setEventDetails] = useState(null);
  const [registrationId, setRegistrationId] = useState('');
  const [registration, setRegistration] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        // Fetch basic event details
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/events/${eventId}/public`);
        if (response.ok) {
          const data = await response.json();
          setEventDetails(data.data);
        }
      } catch (error) {
        console.error('Error fetching event details:', error);
      } finally {
        setSearchLoading(false);
      }
    };

    if (eventId) {
      fetchEventDetails();
    }
  }, [eventId]);

  const handleSearch = async () => {
    if (!registrationId.trim()) {
      message.warning('Please enter a registration ID');
      return;
    }

    setLoading(true);
    setSearchAttempted(true);
    
    try {
      // Use the public lookup endpoint
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/events/${eventId}/registrations/public-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registrationId: registrationId.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setRegistration(data.data);
          message.success('Registration found!');
        } else {
          setRegistration(null);
          message.error('Registration not found. Please check your registration ID.');
        }
      } else {
        setRegistration(null);
        const errorData = await response.json();
        message.error(errorData.message || 'Registration not found. Please check your registration ID.');
      }
    } catch (error) {
      console.error('Error searching registration:', error);
      setRegistration(null);
      message.error('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStatusTag = (status) => {
    const statusConfig = {
      'active': { color: 'green', icon: <CheckCircleOutlined /> },
      'cancelled': { color: 'red', icon: <CheckCircleOutlined /> },
      'no-show': { color: 'default', icon: <ClockCircleOutlined /> }
    };
    
    const config = statusConfig[status] || statusConfig['active'];
    return (
      <Tag color={config.color} icon={config.icon}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active'}
      </Tag>
    );
  };

  const renderPaymentStatus = (status) => {
    const statusConfig = {
      'completed': { color: 'green', text: 'Paid' },
      'pending': { color: 'orange', text: 'Pending' },
      'failed': { color: 'red', text: 'Failed' },
      'refunded': { color: 'blue', text: 'Refunded' }
    };
    
    const config = statusConfig[status] || statusConfig['pending'];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  if (searchLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {eventDetails?.name || 'Event'} - Registration Lookup
            </h1>
            <p className="text-gray-600">
              Enter your registration ID to view your registration details
            </p>
          </div>
        </Card>

        {/* Search Form */}
        <Card className="mb-6">
          <div className="max-w-md mx-auto">
            <div className="flex space-x-2">
              <Input
                size="large"
                placeholder="Enter Registration ID (e.g., REG001)"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                onKeyPress={handleKeyPress}
                prefix={<SearchOutlined />}
              />
              <Button 
                type="primary" 
                size="large" 
                onClick={handleSearch}
                loading={loading}
              >
                Search
              </Button>
            </div>
          </div>
        </Card>

        {/* Registration Details */}
        {registration && (
          <Card 
            title={
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <UserOutlined className="mr-2" />
                  Registration Details
                </span>
                <div className="flex space-x-2">
                  {renderStatusTag(registration.status)}
                  {renderPaymentStatus(registration.paymentStatus)}
                </div>
              </div>
            }
            className="mb-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Personal Information */}
              <div className="lg:col-span-2">
                <Descriptions 
                  title="Personal Information" 
                  column={1}
                  labelStyle={{ fontWeight: 'bold', width: '150px' }}
                >
                  <Descriptions.Item label="Name">
                    {`${registration.personalInfo?.firstName || ''} ${registration.personalInfo?.lastName || ''}`}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    <span className="flex items-center">
                      <MailOutlined className="mr-1" />
                      {registration.personalInfo?.email || 'N/A'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Phone">
                    <span className="flex items-center">
                      <PhoneOutlined className="mr-1" />
                      {registration.personalInfo?.phone || 'N/A'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Organization">
                    {registration.personalInfo?.organization || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Designation">
                    {registration.personalInfo?.designation || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Country">
                    {registration.personalInfo?.country || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider />

                <Descriptions 
                  title="Registration Information" 
                  column={1}
                  labelStyle={{ fontWeight: 'bold', width: '150px' }}
                >
                  <Descriptions.Item label="Registration ID">
                    <Tag color="blue">{registration.registrationId}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Category">
                    <Tag color={registration.category?.color || 'blue'}>
                      {registration.category?.name || 'N/A'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Registration Type">
                    <Tag>{registration.registrationType || 'pre-registered'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Registration Date">
                    <span className="flex items-center">
                      <CalendarOutlined className="mr-1" />
                      {formatDate(registration.createdAt)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Check-in Status">
                    {registration.checkIn?.isCheckedIn ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>
                        Checked In ({formatDate(registration.checkIn?.checkedInAt)})
                      </Tag>
                    ) : (
                      <Tag color="default" icon={<ClockCircleOutlined />}>
                        Not Checked In
                      </Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Badge Status">
                    <Tag color={registration.badgePrinted ? 'green' : 'default'}>
                      {registration.badgePrinted ? 'Printed' : 'Not Printed'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>

                {/* Sponsor Information */}
                {registration.sponsoredBy && (
                  <>
                    <Divider />
                    <Descriptions 
                      title="Sponsor Information" 
                      column={1}
                      labelStyle={{ fontWeight: 'bold', width: '150px' }}
                    >
                      <Descriptions.Item label="Sponsored By">
                        <Tag color="gold">
                          {registration.sponsoredBy?.companyName || registration.sponsoredBy?.name || 'Sponsor'}
                        </Tag>
                      </Descriptions.Item>
                      {registration.sponsoredBy?.contactPerson && (
                        <Descriptions.Item label="Contact Person">
                          {registration.sponsoredBy.contactPerson}
                        </Descriptions.Item>
                      )}
                      {registration.sponsoredBy?.sponsorshipLevel && (
                        <Descriptions.Item label="Sponsorship Level">
                          <Tag color="purple">{registration.sponsoredBy.sponsorshipLevel}</Tag>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </>
                )}
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-4">Registration QR Code</h3>
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  <QRCode 
                    value={registration.registrationId} 
                    size={180}
                    level="M"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Show this QR code at the event for quick check-in
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* No Registration Found */}
        {searchAttempted && !registration && !loading && (
          <Card>
            <div className="text-center py-8">
              <FileTextOutlined className="text-4xl text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Registration Found
              </h3>
              <p className="text-gray-600 mb-4">
                We couldn't find a registration with the ID "{registrationId}". Please check your registration ID and try again.
              </p>
              <p className="text-sm text-gray-500">
                If you continue to have trouble, please contact the event organizers.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PublicRegistrationLookup; 