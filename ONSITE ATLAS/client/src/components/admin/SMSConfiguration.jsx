import React, { useState, useEffect } from 'react';
import { Card, Switch, Input, Button, message, Tabs, Form, Select, Modal, Table, Space, Tag, Radio, Collapse } from 'antd';
import { 
  PhoneOutlined, 
  SendOutlined, 
  SettingOutlined, 
  TestTubeOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;
const { Panel } = Collapse;

const SMSConfiguration = ({ eventId, eventData }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [configuration, setConfiguration] = useState({
    enabled: false,
    provider: 'twilio',
    providers: {
      twilio: {
        accountSid: '',
        authToken: '',
        fromNumber: ''
      },
      textlocal: {
        apiKey: '',
        username: '',
        sender: 'EVENT'
      },
      msg91: {
        apiKey: '',
        senderId: 'EVENT',
        route: '4'
      }
    },
    templates: {
      registrationConfirmation: '',
      paymentLink: '',
      eventReminder: '',
      otp: '',
      customMessage: ''
    },
    rateLimit: 60
  });
  const [testModal, setTestModal] = useState({ visible: false, loading: false });
  const [campaignModal, setCampaignModal] = useState({ visible: false, loading: false });
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [balanceInfo, setBalanceInfo] = useState(null);

  useEffect(() => {
    loadConfiguration();
    checkConnectionStatus();
    loadBalanceInfo();
  }, [eventId]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/sms-config`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfiguration(data.config || configuration);
        form.setFieldsValue(data.config || configuration);
      }
    } catch (error) {
      console.error('Error loading SMS configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch(`/api/sms/validate`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const data = await response.json();
      setConnectionStatus(data.isValid ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('error');
    }
  };

  const loadBalanceInfo = async () => {
    try {
      const response = await fetch(`/api/sms/balance`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBalanceInfo(data.balance);
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const saveConfiguration = async (values) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/sms-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('SMS configuration saved successfully');
        setConfiguration(values);
        checkConnectionStatus();
        loadBalanceInfo();
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

  const testSMSMessage = async (values) => {
    try {
      setTestLoading(true);
      const response = await fetch(`/api/sms/test`, {
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
        message.success('Test SMS sent successfully!');
        setTestModal({ visible: false, loading: false });
        loadBalanceInfo(); // Refresh balance after sending
      } else {
        message.error(data.message || 'Failed to send test SMS');
      }
    } catch (error) {
      message.error('Error sending test SMS');
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

  const getProviderInfo = (provider) => {
    const providerDetails = {
      twilio: {
        name: 'Twilio',
        description: 'Global SMS provider with excellent delivery rates',
        features: ['Global coverage', 'High delivery rates', 'Real-time delivery reports', 'Two-way messaging'],
        pricing: 'Pay-per-message, starting from $0.0075 per SMS'
      },
      textlocal: {
        name: 'TextLocal',
        description: 'UK and India focused SMS provider',
        features: ['Bulk SMS', 'Promotional & Transactional SMS', 'Delivery reports', 'Unicode support'],
        pricing: 'Bulk pricing available, competitive rates for India'
      },
      msg91: {
        name: 'MSG91',
        description: 'India-focused SMS provider with OTP specialization',
        features: ['OTP SMS', 'Bulk messaging', 'Templates', 'India DLT compliance'],
        pricing: 'Competitive rates for Indian market'
      }
    };
    
    return providerDetails[provider] || providerDetails.twilio;
  };

  const templateVariables = [
    '{{firstName}}', '{{lastName}}', '{{email}}', '{{phone}}',
    '{{registrationId}}', '{{eventName}}', '{{eventDate}}', '{{venue}}',
    '{{categoryName}}', '{{amount}}', '{{paymentLink}}', '{{otp}}'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <PhoneOutlined className="mr-2" />
            SMS Configuration
          </h2>
          <p className="text-gray-600 mt-1">
            Configure SMS providers for automated messaging
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {balanceInfo && (
            <div className="bg-blue-50 px-3 py-1 rounded-lg">
              <span className="text-sm font-medium text-blue-700">
                Balance: {balanceInfo.amount} {balanceInfo.currency || 'Credits'}
              </span>
            </div>
          )}
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
            Test SMS
          </Button>
        </div>
      </div>

      <Tabs defaultActiveKey="1">
        <TabPane tab="Provider Configuration" key="1">
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={saveConfiguration}
              initialValues={configuration}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Form.Item
                    label="Enable SMS Integration"
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
                    label="SMS Provider"
                    name="provider"
                    rules={[{ required: configuration.enabled, message: 'Please select a provider' }]}
                  >
                    <Radio.Group 
                      disabled={!configuration.enabled}
                      onChange={(e) => setConfiguration(prev => ({ ...prev, provider: e.target.value }))}
                    >
                      <Space direction="vertical" className="w-full">
                        <Radio value="twilio">
                          <strong>Twilio</strong> - Global provider with excellent reliability
                        </Radio>
                        <Radio value="textlocal">
                          <strong>TextLocal</strong> - UK & India focused, competitive pricing
                        </Radio>
                        <Radio value="msg91">
                          <strong>MSG91</strong> - India specialist, OTP & bulk SMS
                        </Radio>
                      </Space>
                    </Radio.Group>
                  </Form.Item>

                  {/* Provider-specific configuration */}
                  {configuration.provider === 'twilio' && (
                    <Collapse className="mb-4">
                      <Panel header="Twilio Configuration" key="twilio">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Form.Item
                            label="Account SID"
                            name={['providers', 'twilio', 'accountSid']}
                            rules={[{ required: configuration.enabled, message: 'Account SID is required' }]}
                          >
                            <Input 
                              placeholder="AC..."
                              disabled={!configuration.enabled}
                            />
                          </Form.Item>
                          <Form.Item
                            label="Auth Token"
                            name={['providers', 'twilio', 'authToken']}
                            rules={[{ required: configuration.enabled, message: 'Auth Token is required' }]}
                          >
                            <Input.Password 
                              placeholder="Enter auth token"
                              disabled={!configuration.enabled}
                            />
                          </Form.Item>
                          <Form.Item
                            label="From Number"
                            name={['providers', 'twilio', 'fromNumber']}
                            rules={[{ required: configuration.enabled, message: 'From number is required' }]}
                          >
                            <Input 
                              placeholder="+1234567890"
                              disabled={!configuration.enabled}
                            />
                          </Form.Item>
                        </div>
                      </Panel>
                    </Collapse>
                  )}

                  {configuration.provider === 'textlocal' && (
                    <Collapse className="mb-4">
                      <Panel header="TextLocal Configuration" key="textlocal">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Form.Item
                            label="API Key"
                            name={['providers', 'textlocal', 'apiKey']}
                            rules={[{ required: configuration.enabled, message: 'API Key is required' }]}
                          >
                            <Input.Password 
                              placeholder="Enter API key"
                              disabled={!configuration.enabled}
                            />
                          </Form.Item>
                          <Form.Item
                            label="Username"
                            name={['providers', 'textlocal', 'username']}
                          >
                            <Input 
                              placeholder="Enter username (optional)"
                              disabled={!configuration.enabled}
                            />
                          </Form.Item>
                          <Form.Item
                            label="Sender ID"
                            name={['providers', 'textlocal', 'sender']}
                          >
                            <Input 
                              placeholder="EVENT"
                              disabled={!configuration.enabled}
                              maxLength={6}
                            />
                          </Form.Item>
                        </div>
                      </Panel>
                    </Collapse>
                  )}

                  {configuration.provider === 'msg91' && (
                    <Collapse className="mb-4">
                      <Panel header="MSG91 Configuration" key="msg91">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Form.Item
                            label="API Key"
                            name={['providers', 'msg91', 'apiKey']}
                            rules={[{ required: configuration.enabled, message: 'API Key is required' }]}
                          >
                            <Input.Password 
                              placeholder="Enter API key"
                              disabled={!configuration.enabled}
                            />
                          </Form.Item>
                          <Form.Item
                            label="Sender ID"
                            name={['providers', 'msg91', 'senderId']}
                          >
                            <Input 
                              placeholder="EVENT"
                              disabled={!configuration.enabled}
                              maxLength={6}
                            />
                          </Form.Item>
                          <Form.Item
                            label="Route"
                            name={['providers', 'msg91', 'route']}
                          >
                            <Select placeholder="Select route" disabled={!configuration.enabled}>
                              <Option value="1">Promotional</Option>
                              <Option value="4">Transactional</Option>
                            </Select>
                          </Form.Item>
                        </div>
                      </Panel>
                    </Collapse>
                  )}

                  <Form.Item
                    label="Rate Limit (SMS per minute)"
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

                {/* Provider Information Panel */}
                <div className="lg:col-span-1">
                  <Card 
                    title={
                      <span className="flex items-center">
                        <InfoCircleOutlined className="mr-2" />
                        Provider Information
                      </span>
                    }
                    size="small"
                  >
                    {configuration.provider && (
                      <div className="space-y-3">
                        <h4 className="font-semibold">{getProviderInfo(configuration.provider).name}</h4>
                        <p className="text-sm text-gray-600">
                          {getProviderInfo(configuration.provider).description}
                        </p>
                        <div>
                          <h5 className="font-medium mb-2">Features:</h5>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {getProviderInfo(configuration.provider).features.map((feature, index) => (
                              <li key={index} className="flex items-center">
                                <CheckCircleOutlined className="text-green-500 mr-2" style={{ fontSize: '12px' }} />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-blue-50 p-3 rounded">
                          <h5 className="font-medium mb-1">Pricing:</h5>
                          <p className="text-sm text-blue-700">
                            {getProviderInfo(configuration.provider).pricing}
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button onClick={() => { checkConnectionStatus(); loadBalanceInfo(); }}>
                  Refresh Status
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
                  rows={3}
                  placeholder="Welcome {{firstName}}! Your registration for {{eventName}} is confirmed. ID: {{registrationId}}"
                  disabled={!configuration.enabled}
                  showCount
                  maxLength={160}
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
                  rows={3}
                  placeholder="Hi {{firstName}}, complete payment for {{eventName}}. Amount: Rs{{amount}}. Pay: {{paymentLink}}"
                  disabled={!configuration.enabled}
                  showCount
                  maxLength={160}
                />
              </Form.Item>
            </Card>

            <Card title="Event Reminder Template" size="small">
              <Form.Item
                name={['templates', 'eventReminder']}
                label="Template Message"
              >
                <TextArea
                  rows={3}
                  placeholder="Reminder: {{eventName}} is tomorrow at {{venue}}. Registration: {{registrationId}}"
                  disabled={!configuration.enabled}
                  showCount
                  maxLength={160}
                />
              </Form.Item>
            </Card>

            <Card title="OTP Template" size="small">
              <Form.Item
                name={['templates', 'otp']}
                label="Template Message"
              >
                <TextArea
                  rows={2}
                  placeholder="Your OTP for {{eventName}} registration is {{otp}}. Valid for 10 minutes."
                  disabled={!configuration.enabled}
                  showCount
                  maxLength={160}
                />
              </Form.Item>
            </Card>

            <Card title="Custom Message Template" size="small">
              <Form.Item
                name={['templates', 'customMessage']}
                label="Template Message"
              >
                <TextArea
                  rows={3}
                  placeholder="Hello {{firstName}}, important update about {{eventName}}..."
                  disabled={!configuration.enabled}
                  showCount
                  maxLength={160}
                />
              </Form.Item>
            </Card>
          </div>
        </TabPane>

        <TabPane tab="Bulk Campaigns" key="3">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">SMS Campaigns</h3>
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
                { title: 'Delivered', dataIndex: 'deliveredCount', key: 'deliveredCount' },
                { title: 'Status', dataIndex: 'status', key: 'status', 
                  render: (status) => (
                    <Tag color={status === 'completed' ? 'green' : status === 'running' ? 'blue' : 'orange'}>
                      {status}
                    </Tag>
                  )
                },
                { title: 'Cost', dataIndex: 'cost', key: 'cost' },
                { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
                { title: 'Actions', key: 'actions',
                  render: () => (
                    <Space>
                      <Button size="small">View Report</Button>
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

      {/* Test SMS Modal */}
      <Modal
        title="Test SMS Message"
        visible={testModal.visible}
        onCancel={() => setTestModal({ visible: false, loading: false })}
        footer={null}
      >
        <Form onFinish={testSMSMessage} layout="vertical">
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
              rows={3}
              placeholder="Hello! This is a test SMS from your event management system."
              showCount
              maxLength={160}
            />
          </Form.Item>

          <div className="bg-yellow-50 p-3 rounded mb-4">
            <div className="flex items-center text-yellow-800">
              <InfoCircleOutlined className="mr-2" />
              <span className="text-sm">
                SMS charges will be deducted from your account balance for this test message.
              </span>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setTestModal({ visible: false, loading: false })}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={testLoading}>
              Send Test SMS
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Bulk Campaign Modal */}
      <Modal
        title="Create SMS Campaign"
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
            <Input placeholder="Event Reminder SMS Campaign" />
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
              <Option value="incomplete_profiles">Incomplete Profiles</Option>
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
              <Option value="otp">OTP Message</Option>
              <Option value="custom">Custom Message</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Custom Message (if custom template selected)"
            name="customMessage"
          >
            <TextArea
              rows={3}
              placeholder="Enter your custom message here..."
              showCount
              maxLength={160}
            />
          </Form.Item>

          <Form.Item
            label="Schedule Delivery"
            name="scheduleType"
          >
            <Radio.Group>
              <Radio value="immediate">Send Immediately</Radio>
              <Radio value="scheduled">Schedule for Later</Radio>
            </Radio.Group>
          </Form.Item>

          <div className="bg-blue-50 p-4 rounded mb-4">
            <h4 className="font-medium mb-2">Campaign Summary:</h4>
            <div className="text-sm space-y-1">
              <div>Estimated Recipients: <strong>0</strong></div>
              <div>Estimated Cost: <strong>Rs 0.00</strong></div>
              <div>Remaining Balance: <strong>{balanceInfo?.amount || 'N/A'} {balanceInfo?.currency || 'Credits'}</strong></div>
            </div>
          </div>

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

export default SMSConfiguration; 