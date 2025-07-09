import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, message, Space, Modal, Descriptions, Empty } from 'antd';
import { 
  DownloadOutlined, 
  EyeOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  CalendarOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import moment from 'moment';
import registrantPortalService from '../../services/registrantPortalService';

const CertificatesPage = () => {
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [previewModal, setPreviewModal] = useState({ visible: false, certificate: null });
  const [downloadLoading, setDownloadLoading] = useState({});

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const response = await registrantPortalService.getCertificates();
      setCertificates(response.data.certificates || []);
    } catch (error) {
      console.error('Error loading certificates:', error);
      message.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (certificate) => {
    try {
      setDownloadLoading(prev => ({ ...prev, [certificate.id]: true }));
      
      const response = await registrantPortalService.downloadCertificate(certificate.id);
      
      if (response.success) {
        // In production, this would trigger actual PDF download
        // For now, show success message with certificate data
        message.success('Certificate download prepared successfully!');
        
        // Simulate file download (in production, this would be handled by the backend)
        const link = document.createElement('a');
        link.href = `data:text/plain;charset=utf-8,Certificate for ${response.data.certificateData.participantName}`;
        link.download = `Certificate-${certificate.registrationId}.pdf`;
        link.click();
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      message.error('Failed to download certificate');
    } finally {
      setDownloadLoading(prev => ({ ...prev, [certificate.id]: false }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'issued':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'processing':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'pending':
        return <ExclamationCircleOutlined style={{ color: '#d46b08' }} />;
      default:
        return <FileTextOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'issued':
        return 'success';
      case 'processing':
        return 'warning';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: 'Event',
      key: 'event',
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.eventName}</div>
          <div className="text-sm text-gray-500 flex items-center mt-1">
            <CalendarOutlined className="mr-1" />
            {moment(record.eventDate).format('MMM DD, YYYY')}
          </div>
          {record.categoryName && (
            <Tag color="blue" size="small" className="mt-1">
              {record.categoryName}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Registration ID',
      dataIndex: 'registrationId',
      key: 'registrationId',
      render: (text) => (
        <code className="bg-gray-100 px-2 py-1 rounded text-sm">
          {text}
        </code>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <div>
          <Tag 
            icon={getStatusIcon(status)} 
            color={getStatusColor(status)}
            className="mb-1"
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Tag>
          {record.message && (
            <div className="text-xs text-gray-500 mt-1">
              {record.message}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Issued Date',
      dataIndex: 'issuedDate',
      key: 'issuedDate',
      render: (date, record) => (
        record.status === 'issued' && date ? (
          <div className="text-sm">
            {moment(date).format('MMM DD, YYYY')}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'issued' && (
            <>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="small"
                loading={downloadLoading[record.id]}
                onClick={() => handleDownload(record)}
              >
                Download
              </Button>
              <Button
                icon={<EyeOutlined />}
                size="small"
                onClick={() => setPreviewModal({ visible: true, certificate: record })}
              >
                Preview
              </Button>
            </>
          )}
          {record.status !== 'issued' && (
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => setPreviewModal({ visible: true, certificate: record })}
            >
              View Details
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const issuedCertificates = certificates.filter(cert => cert.status === 'issued');
  const processingCertificates = certificates.filter(cert => cert.status === 'processing');
  const pendingCertificates = certificates.filter(cert => cert.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <TrophyOutlined className="mr-3 text-yellow-500" />
            My Certificates
          </h1>
          <p className="text-gray-600 mt-1">
            Download and manage your event certificates
          </p>
        </div>
        <Button onClick={loadCertificates} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">{issuedCertificates.length}</div>
          <div className="text-gray-600">Available to Download</div>
          <CheckCircleOutlined className="text-3xl text-green-500 mt-2" />
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{processingCertificates.length}</div>
          <div className="text-gray-600">Being Processed</div>
          <ClockCircleOutlined className="text-3xl text-yellow-500 mt-2" />
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-gray-600">{pendingCertificates.length}</div>
          <div className="text-gray-600">Pending (Event Incomplete)</div>
          <ExclamationCircleOutlined className="text-3xl text-gray-500 mt-2" />
        </Card>
      </div>

      {/* Certificates Table */}
      <Card title="All Certificates" extra={<span className="text-sm text-gray-500">{certificates.length} total</span>}>
        {certificates.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                No certificates found. <br />
                Certificates will appear here after you complete events.
              </span>
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={certificates}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} certificates`,
            }}
            scroll={{ x: 800 }}
          />
        )}
      </Card>

      {/* Certificate Preview/Details Modal */}
      <Modal
        title="Certificate Details"
        visible={previewModal.visible}
        onCancel={() => setPreviewModal({ visible: false, certificate: null })}
        footer={[
          <Button key="close" onClick={() => setPreviewModal({ visible: false, certificate: null })}>
            Close
          </Button>,
          previewModal.certificate?.status === 'issued' && (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              loading={downloadLoading[previewModal.certificate?.id]}
              onClick={() => handleDownload(previewModal.certificate)}
            >
              Download Certificate
            </Button>
          )
        ]}
        width={600}
      >
        {previewModal.certificate && (
          <div className="space-y-4">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Event Name">
                {previewModal.certificate.eventName}
              </Descriptions.Item>
              <Descriptions.Item label="Event Date">
                {moment(previewModal.certificate.eventDate).format('MMMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {previewModal.certificate.categoryName}
              </Descriptions.Item>
              <Descriptions.Item label="Registration ID">
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {previewModal.certificate.registrationId}
                </code>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag 
                  icon={getStatusIcon(previewModal.certificate.status)} 
                  color={getStatusColor(previewModal.certificate.status)}
                >
                  {previewModal.certificate.status.charAt(0).toUpperCase() + previewModal.certificate.status.slice(1)}
                </Tag>
              </Descriptions.Item>
              {previewModal.certificate.issuedDate && (
                <Descriptions.Item label="Issued Date">
                  {moment(previewModal.certificate.issuedDate).format('MMMM DD, YYYY')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {previewModal.certificate.message && (
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm text-blue-800">
                  <strong>Note:</strong> {previewModal.certificate.message}
                </div>
              </div>
            )}

            {previewModal.certificate.status === 'issued' && (
              <div className="bg-green-50 p-4 rounded-md">
                <div className="flex items-center mb-2">
                  <CheckCircleOutlined className="text-green-500 mr-2" />
                  <span className="font-medium text-green-800">Certificate Ready!</span>
                </div>
                <div className="text-sm text-green-700">
                  Your certificate is ready for download. Click the download button to save it to your device.
                </div>
              </div>
            )}

            {previewModal.certificate.status === 'processing' && (
              <div className="bg-yellow-50 p-4 rounded-md">
                <div className="flex items-center mb-2">
                  <ClockCircleOutlined className="text-yellow-500 mr-2" />
                  <span className="font-medium text-yellow-800">Certificate Processing</span>
                </div>
                <div className="text-sm text-yellow-700">
                  Your certificate is currently being generated. You will receive an email notification when it's ready for download.
                </div>
              </div>
            )}

            {previewModal.certificate.status === 'pending' && (
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-2">
                  <ExclamationCircleOutlined className="text-gray-500 mr-2" />
                  <span className="font-medium text-gray-800">Certificate Pending</span>
                </div>
                <div className="text-sm text-gray-700">
                  The certificate will be available after the event is completed. Please check back after the event ends.
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CertificatesPage; 