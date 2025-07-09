import React, { useState, useEffect } from 'react';
import { Card, Switch, Input, Button, message, Tabs, Form, Select, Modal, Table, Space, Tag } from 'antd';
import { 
  MessageOutlined, 
  SendOutlined, 
  SettingOutlined, 
  TestTubeOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;

const WhatsAppConfiguration = ({ eventId, eventData }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [configuration, setConfiguration] = useState({
    enabled: false,
    businessApiUrl: '',
    apiToken: '',
    phoneNumberId: '',
    templates: {
      registrationConfirmation: '',
      paymentLink: '',
      eventReminder: '',
      customMessage: ''
    }
  });
  const [testModal, setTestModal] = useState({ visible: false, loading: false });
  const [campaignModal, setCampaignModal] = useState({ visible: false, loading: false });
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    loadConfiguration();
    checkConnectionStatus();
  }, [eventId]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/whatsapp-config`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfiguration(data.config || configuration);
        form.setFieldsValue(data.config || configuration);
      }
    } catch (error) {
      console.error('Error loading WhatsApp configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch(`/api/whatsapp/validate`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const data = await response.json();
      setConnectionStatus(data.isValid ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('error');
    }
  };

  const saveConfiguration = async (values) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/whatsapp-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('WhatsApp configuration saved successfully');
        setConfiguration(values);
        checkConnectionStatus();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || 'Failed to save configuration');
      }
    } catch (error) {
      message.error('Error saving configuration');
    } finally {
      setLoading(false);
    }
  };

  const testWhatsAppMessage = async (values) => {
    try {
      setTestLoading(true);
      const response = await fetch(`/api/whatsapp/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: values.testPhoneNumber,
          message: values.testMessage,
          eventId
        })
      });

      const data = await response.json();
      if (data.success) {
        message.success('Test message sent successfully!');
        setTestModal({ visible: false, loading: false });
      } else {
        message.error(data.message || 'Failed to send test message');
      }
    } catch (error) {
      message.error('Error sending test message');
    } finally {
      setTestLoading(false);
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'disconnected':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'checking':
        return <span className="animate-spin">⟳</span>;
      default:
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    }
  };

  const templateVariables = [
    '{{firstName}}', '{{lastName}}', '{{email}}', '{{phone}}',
    '{{registrationId}}', '{{eventName}}', '{{eventDate}}', '{{venue}}',
    '{{categoryName}}', '{{amount}}', '{{paymentLink}}'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <MessageOutlined className="mr-2" />
            WhatsApp Configuration
          </h2>
          <p className="text-gray-600 mt-1">
            Configure WhatsApp Business API for automated messaging
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {getConnectionStatusIcon()}
            <span className="text-sm font-medium">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'disconnected' ? 'Disconnected' : 
               connectionStatus === 'checking' ? 'Checking...' : 'Error'}
            </span>
          </div>
          <Button 
            type="primary" 
            icon={<TestTubeOutlined />}
            onClick={() => setTestModal({ visible: true, loading: false })}
            disabled={!configuration.enabled}
          >
            Test Message
          </Button>
        </div>
      </div>

      <Tabs defaultActiveKey="1">
        <TabPane tab="Basic Configuration" key="1">
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={saveConfiguration}
              initialValues={configuration}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Form.Item
                    label="Enable WhatsApp Integration"
                    name="enabled"
                    valuePropName="checked"
                  >
                    <Switch 
                      checkedChildren="Enabled" 
                      unCheckedChildren="Disabled"
                      onChange={(checked) => setConfiguration(prev => ({ ...prev, enabled: checked }))}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Business API URL"
                    name="businessApiUrl"
                    rules={[
                      { type: 'url', message: 'Please enter a valid URL' },
                      { required: configuration.enabled, message: 'API URL is required when enabled' }
                    ]}
                  >
                    <Input 
                      placeholder="https://graph.facebook.com/v17.0"
                      disabled={!configuration.enabled}
                    />
                  </Form.Item>

                  <Form.Item
                    label="API Token"
                    name="apiToken"
                    rules={[
                      { required: configuration.enabled, message: 'API token is required when enabled' }
                    ]}
                  >
                    <Input.Password 
                      placeholder="Enter your WhatsApp Business API token"
                      disabled={!configuration.enabled}
                    />
                  </Form.Item>
                </div>

                <div>
                  <Form.Item
                    label="Phone Number ID"
                    name="phoneNumberId"
                    rules={[
                      { required: configuration.enabled, message: 'Phone Number ID is required when enabled' }
                    ]}
                  >
                    <Input 
                      placeholder="Enter your WhatsApp Business phone number ID"
                      disabled={!configuration.enabled}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Webhook Verification Token"
                    name="webhookToken"
                  >
                    <Input.Password 
                      placeholder="Optional: For webhook verification"
                      disabled={!configuration.enabled}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Rate Limit (messages per minute)"
                    name="rateLimit"
                  >
                    <Input 
                      type="number"
                      placeholder="60"
                      min={1}
                      max={1000}
                      disabled={!configuration.enabled}
                    />
                  </Form.Item>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button onClick={() => checkConnectionStatus()}>
                  Test Connection
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save Configuration
                </Button>
              </div>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Message Templates" key="2">
          <div className="space-y-4">
            <Card title="Registration Confirmation Template" size="small">
              <Form.Item
                name={['templates', 'registrationConfirmation']}
                label="Template Message"
              >
                <TextArea
                  rows={4}
                  placeholder="🎉 Welcome {{firstName}}! Your registration for {{eventName}} is confirmed. Registration ID: {{registrationId}}"
                  disabled={!configuration.enabled}
                />
              </Form.Item>
              <div className="text-xs text-gray-500">
                Available variables: {templateVariables.join(', ')}
              </div>
            </Card>

            <Card title="Payment Link Template" size="small">
              <Form.Item
                name={['templates', 'paymentLink']}
                label="Template Message"
              >
                <TextArea
                  rows={4}
                  placeholder="💳 Hi {{firstName}}, complete your payment for {{eventName}}. Amount: ₹{{amount}}. Pay now: {{paymentLink}}"
                  disabled={!configuration.enabled}
                />
              </Form.Item>
            </Card>

            <Card title="Event Reminder Template" size="small">
              <Form.Item
                name={['templates', 'eventReminder']}
                label="Template Message"
              >
                <TextArea
                  rows={4}
                  placeholder="⏰ Reminder: {{eventName}} is tomorrow at {{venue}}. See you there!"
                  disabled={!configuration.enabled}
                />
              </Form.Item>
            </Card>

            <Card title="Custom Message Template" size="small">
              <Form.Item
                name={['templates', 'customMessage']}
                label="Template Message"
              >
                <TextArea
                  rows={4}
                  placeholder="Hello {{firstName}}, we have an important update about {{eventName}}..."
                  disabled={!configuration.enabled}
                />
              </Form.Item>
            </Card>
          </div>
        </TabPane>

        <TabPane tab="Bulk Campaigns" key="3">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">WhatsApp Campaigns</h3>
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={() => setCampaignModal({ visible: true, loading: false })}
                disabled={!configuration.enabled}
              >
                New Campaign
              </Button>
            </div>
            
            <Table
              size="small"
              columns={[
                { title: 'Campaign Name', dataIndex: 'name', key: 'name' },
                { title: 'Recipients', dataIndex: 'recipientCount', key: 'recipientCount' },
                { title: 'Sent', dataIndex: 'sentCount', key: 'sentCount' },
                { title: 'Status', dataIndex: 'status', key: 'status', 
                  render: (status) => (
                    <Tag color={status === 'completed' ? 'green' : status === 'running' ? 'blue' : 'orange'}>
                      {status}
                    </Tag>
                  )
                },
                { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
                { title: 'Actions', key: 'actions',
                  render: () => (
                    <Space>
                      <Button size="small">View</Button>
                      <Button size="small" danger>Cancel</Button>
                    </Space>
                  )
                }
              ]}
              dataSource={[]} // Will be populated from API
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Test Message Modal */}
      <Modal
        title="Test WhatsApp Message"
        visible={testModal.visible}
        onCancel={() => setTestModal({ visible: false, loading: false })}
        footer={null}
      >
        <Form onFinish={testWhatsAppMessage} layout="vertical">
          <Form.Item
            label="Phone Number"
            name="testPhoneNumber"
            rules={[
              { required: true, message: 'Please enter a phone number' },
              { pattern: /^[+]?[\d\s-()]+$/, message: 'Please enter a valid phone number' }
            ]}
          >
            <Input 
              placeholder="+91 9876543210" 
              prefix={<PhoneOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="Test Message"
            name="testMessage"
            rules={[{ required: true, message: 'Please enter a test message' }]}
          >
            <TextArea
              rows={4}
              placeholder="Hello! This is a test message from your event management system."
            />
          </Form.Item>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setTestModal({ visible: false, loading: false })}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={testLoading}>
              Send Test Message
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Bulk Campaign Modal */}
      <Modal
        title="Create WhatsApp Campaign"
        visible={campaignModal.visible}
        onCancel={() => setCampaignModal({ visible: false, loading: false })}
        width={600}
        footer={null}
      >
        <Form layout="vertical">
          <Form.Item
            label="Campaign Name"
            name="campaignName"
            rules={[{ required: true, message: 'Please enter a campaign name' }]}
          >
            <Input placeholder="Event Reminder Campaign" />
          </Form.Item>

          <Form.Item
            label="Target Recipients"
            name="recipients"
            rules={[{ required: true, message: 'Please select recipients' }]}
          >
            <Select mode="multiple" placeholder="Select recipient groups">
              <Option value="all">All Registrations</Option>
              <Option value="pending_payment">Pending Payment</Option>
              <Option value="confirmed">Confirmed Registrations</Option>
              <Option value="speakers">Speakers</Option>
              <Option value="sponsors">Sponsors</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Message Template"
            name="messageTemplate"
            rules={[{ required: true, message: 'Please select a template' }]}
          >
            <Select placeholder="Select a message template">
              <Option value="registration">Registration Confirmation</Option>
              <Option value="payment">Payment Link</Option>
              <Option value="reminder">Event Reminder</Option>
              <Option value="custom">Custom Message</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Custom Message (if custom template selected)"
            name="customMessage"
          >
            <TextArea
              rows={4}
              placeholder="Enter your custom message here..."
            />
          </Form.Item>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setCampaignModal({ visible: false, loading: false })}>
              Cancel
            </Button>
            <Button type="primary" loading={campaignModal.loading}>
              Launch Campaign
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default WhatsAppConfiguration; 