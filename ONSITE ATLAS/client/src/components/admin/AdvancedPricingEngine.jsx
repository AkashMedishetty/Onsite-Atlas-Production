import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Select, DatePicker, Switch, Tag, message, Space, Tooltip, Progress, Alert, Statistic, Row, Col } from 'antd';
import { 
  DollarOutlined, 
  PercentageOutlined, 
  TeamOutlined, 
  CalendarOutlined,
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LineChartOutlined,
  TrophyOutlined,
  GiftOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AdvancedPricingEngine = ({ eventId, eventData }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Pricing Rules State
  const [pricingRules, setPricingRules] = useState([]);
  const [ruleModal, setRuleModal] = useState({ visible: false, rule: null });
  
  // Discount Codes State
  const [discountCodes, setDiscountCodes] = useState([]);
  const [discountModal, setDiscountModal] = useState({ visible: false, code: null });
  
  // Group Pricing State
  const [groupPricing, setGroupPricing] = useState({
    enabled: false,
    minGroupSize: 5,
    maxGroupSize: 50,
    discountType: 'percentage',
    discountValue: 10
  });
  
  // Package Deals State
  const [packageDeals, setPackageDeals] = useState([]);
  const [packageModal, setPackageModal] = useState({ visible: false, package: null });
  
  // Analytics State
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    averageTicketPrice: 0,
    discountUsage: 0,
    groupRegistrations: 0,
    pricingEfficiency: 0
  });

  const [simulationModal, setSimulationModal] = useState({ visible: false });
  const [simulationResults, setSimulationResults] = useState(null);

  useEffect(() => {
    loadPricingData();
    loadAnalytics();
  }, [eventId]);

  const loadPricingData = async () => {
    try {
      setLoading(true);
      
      // Load pricing rules
      const rulesResponse = await fetch(`/api/events/${eventId}/pricing-rules`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setPricingRules(rulesData.data || []);
      }

      // Load event data for discount codes and group settings
      const eventResponse = await fetch(`/api/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        const event = eventData.data || eventData;
        setDiscountCodes(event.pricingSettings?.discountCodes || []);
        setPackageDeals(event.registrationComponents?.packageDeals || []);
        
        // Extract group pricing settings
        if (event.groupPricingSettings) {
          setGroupPricing(event.groupPricingSettings);
        }
      }
    } catch (error) {
      console.error('Error loading pricing data:', error);
      message.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/pricing-analytics`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics || analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const createPricingRule = async (values) => {
    try {
      const response = await fetch(`/api/events/${eventId}/pricing-rules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('Pricing rule created successfully');
        setRuleModal({ visible: false, rule: null });
        loadPricingData();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || 'Failed to create pricing rule');
      }
    } catch (error) {
      message.error('Error creating pricing rule');
    }
  };

  const createDiscountCode = async (values) => {
    try {
      const response = await fetch(`/api/events/${eventId}/discount-codes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('Discount code created successfully');
        setDiscountModal({ visible: false, code: null });
        loadPricingData();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || 'Failed to create discount code');
      }
    } catch (error) {
      message.error('Error creating discount code');
    }
  };

  const simulatePricing = async (values) => {
    try {
      const response = await fetch(`/api/events/${eventId}/pricing-simulation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        const data = await response.json();
        setSimulationResults(data.simulation);
      } else {
        const errorData = await response.json();
        message.error(errorData.message || 'Simulation failed');
      }
    } catch (error) {
      message.error('Error running simulation');
    }
  };

  const pricingRulesColumns = [
    {
      title: 'Rule Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier) => <Tag color="blue">{tier}</Tag>
    },
    {
      title: 'Audience',
      dataIndex: 'audience',
      key: 'audience',
      render: (audience) => <Tag color="green">{audience}</Tag>
    },
    {
      title: 'Price',
      dataIndex: 'priceCents',
      key: 'price',
      render: (priceCents, record) => (
        <span className="font-medium">
          ₹{priceCents} {record.currency || 'INR'}
        </span>
      )
    },
    {
      title: 'Valid Period',
      key: 'period',
      render: (_, record) => (
        <div className="text-sm">
          <div>{record.startDate ? moment(record.startDate).format('MMM DD') : 'No start'}</div>
          <div>{record.endDate ? moment(record.endDate).format('MMM DD') : 'No end'}</div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color="purple">{priority}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => setRuleModal({ visible: true, rule: record })}
          />
          <Button 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => deletePricingRule(record._id)}
          />
        </Space>
      )
    }
  ];

  const discountCodesColumns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <code className="bg-gray-100 px-2 py-1 rounded">{code}</code>
    },
    {
      title: 'Type',
      dataIndex: 'discountType',
      key: 'type',
      render: (type) => <Tag color="orange">{type}</Tag>
    },
    {
      title: 'Value',
      dataIndex: 'discountValue',
      key: 'value',
      render: (value, record) => (
        <span className="font-medium">
          {record.discountType === 'percentage' ? `${value}%` : `₹${value}`}
        </span>
      )
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (_, record) => (
        <div className="text-sm">
          <div>{record.usesCount || 0} / {record.maxUses || '∞'}</div>
          <Progress 
            size="small" 
            percent={record.maxUses ? (record.usesCount / record.maxUses) * 100 : 0}
            showInfo={false}
          />
        </div>
      )
    },
    {
      title: 'Valid Period',
      key: 'validity',
      render: (_, record) => (
        <div className="text-sm">
          <div>{record.validFrom ? moment(record.validFrom).format('MMM DD') : 'No start'}</div>
          <div>{record.validUntil ? moment(record.validUntil).format('MMM DD') : 'No end'}</div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (isActive, record) => {
        const now = moment();
        const isValid = isActive && 
          (!record.validFrom || now.isAfter(record.validFrom)) &&
          (!record.validUntil || now.isBefore(record.validUntil)) &&
          (!record.maxUses || record.usesCount < record.maxUses);
        
        return (
          <Tag color={isValid ? 'green' : 'red'}>
            {isValid ? 'Active' : 'Inactive'}
          </Tag>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => setDiscountModal({ visible: true, code: record })}
          />
          <Button 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => deleteDiscountCode(record._id)}
          />
        </Space>
      )
    }
  ];

  const deletePricingRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this pricing rule?')) return;
    
    try {
      const response = await fetch(`/api/events/${eventId}/pricing-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        message.success('Pricing rule deleted successfully');
        loadPricingData();
      }
    } catch (error) {
      message.error('Error deleting pricing rule');
    }
  };

  const deleteDiscountCode = async (codeId) => {
    if (!window.confirm('Are you sure you want to delete this discount code?')) return;
    
    try {
      const response = await fetch(`/api/events/${eventId}/discount-codes/${codeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        message.success('Discount code deleted successfully');
        loadPricingData();
      }
    } catch (error) {
      message.error('Error deleting discount code');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <DollarOutlined className="mr-2" />
            Advanced Pricing Engine
          </h2>
          <p className="text-gray-600 mt-1">
            Manage complex pricing rules, discounts, and revenue optimization
          </p>
        </div>
        <Button 
          type="primary" 
          icon={<LineChartOutlined />}
          onClick={() => setSimulationModal({ visible: true })}
        >
          Price Simulation
        </Button>
      </div>

      {/* Analytics Overview */}
      <Card title="Pricing Analytics Overview">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic 
              title="Total Revenue" 
              value={analytics.totalRevenue} 
              prefix="₹" 
              precision={2}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="Average Ticket Price" 
              value={analytics.averageTicketPrice} 
              prefix="₹" 
              precision={2}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="Discount Usage" 
              value={analytics.discountUsage} 
              suffix="%" 
              precision={1}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="Group Registrations" 
              value={analytics.groupRegistrations} 
              suffix="%" 
              precision={1}
            />
          </Col>
        </Row>
      </Card>

      {/* Main Content */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Pricing Rules" key="rules">
          <Card 
            title="Dynamic Pricing Rules"
            extra={
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setRuleModal({ visible: true, rule: null })}
              >
                Create Rule
              </Button>
            }
          >
            <Table
              columns={pricingRulesColumns}
              dataSource={pricingRules}
              rowKey="_id"
              loading={loading}
              scroll={{ x: 800 }}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Discount Codes" key="discounts">
          <Card 
            title="Discount Codes & Promotions"
            extra={
              <Button 
                type="primary" 
                icon={<GiftOutlined />}
                onClick={() => setDiscountModal({ visible: true, code: null })}
              >
                Create Discount
              </Button>
            }
          >
            <Table
              columns={discountCodesColumns}
              dataSource={discountCodes}
              rowKey="_id"
              loading={loading}
              scroll={{ x: 800 }}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Group Pricing" key="groups">
          <Card title="Group Registration Settings">
            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Enable Group Pricing">
                    <Switch 
                      checked={groupPricing.enabled}
                      onChange={(checked) => setGroupPricing(prev => ({ ...prev, enabled: checked }))}
                      checkedChildren="Enabled"
                      unCheckedChildren="Disabled"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Minimum Group Size">
                    <Input 
                      type="number"
                      value={groupPricing.minGroupSize}
                      onChange={(e) => setGroupPricing(prev => ({ ...prev, minGroupSize: parseInt(e.target.value) }))}
                      disabled={!groupPricing.enabled}
                    />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Maximum Group Size">
                    <Input 
                      type="number"
                      value={groupPricing.maxGroupSize}
                      onChange={(e) => setGroupPricing(prev => ({ ...prev, maxGroupSize: parseInt(e.target.value) }))}
                      disabled={!groupPricing.enabled}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Discount Type">
                    <Select 
                      value={groupPricing.discountType}
                      onChange={(value) => setGroupPricing(prev => ({ ...prev, discountType: value }))}
                      disabled={!groupPricing.enabled}
                    >
                      <Option value="percentage">Percentage</Option>
                      <Option value="fixed">Fixed Amount</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Discount Value">
                    <Input 
                      type="number"
                      value={groupPricing.discountValue}
                      onChange={(e) => setGroupPricing(prev => ({ ...prev, discountValue: parseFloat(e.target.value) }))}
                      disabled={!groupPricing.enabled}
                      suffix={groupPricing.discountType === 'percentage' ? '%' : '₹'}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Package Deals" key="packages">
          <Card 
            title="Package Deals & Bundles"
            extra={
              <Button 
                type="primary" 
                icon={<TrophyOutlined />}
                onClick={() => setPackageModal({ visible: true, package: null })}
              >
                Create Package
              </Button>
            }
          >
            <div className="space-y-4">
              {packageDeals.map((pkg, index) => (
                <Card key={index} size="small" className="border-l-4 border-l-green-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{pkg.name}</h4>
                      <p className="text-sm text-gray-600">{pkg.description}</p>
                      <div className="mt-2">
                        <Tag color="blue">
                          {pkg.includedComponents?.length || 0} Components
                        </Tag>
                        {pkg.active ? (
                          <Tag color="green">Active</Tag>
                        ) : (
                          <Tag color="red">Inactive</Tag>
                        )}
                      </div>
                    </div>
                    <Space>
                      <Button size="small" icon={<EditOutlined />} />
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Space>
                  </div>
                </Card>
              ))}
              
              {packageDeals.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No package deals configured yet
                </div>
              )}
            </div>
          </Card>
        </TabPane>
      </Tabs>

      {/* Pricing Rule Modal */}
      <Modal
        title={ruleModal.rule ? "Edit Pricing Rule" : "Create Pricing Rule"}
        visible={ruleModal.visible}
        onCancel={() => setRuleModal({ visible: false, rule: null })}
        footer={null}
        width={600}
      >
        <Form layout="vertical" onFinish={createPricingRule}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Rule Name" name="name" rules={[{ required: true }]}>
                <Input placeholder="Early Bird Discount" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tier" name="tier" rules={[{ required: true }]}>
                <Select placeholder="Select tier">
                  <Option value="early-bird">Early Bird</Option>
                  <Option value="regular">Regular</Option>
                  <Option value="onsite">On-site</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Audience" name="audience">
                <Select placeholder="Select audience">
                  <Option value="individual">Individual</Option>
                  <Option value="member">Member</Option>
                  <Option value="student">Student</Option>
                  <Option value="group">Group</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Category" name="category">
                <Select placeholder="Select category">
                  {/* Categories will be loaded dynamically */}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Price (in cents)" name="priceCents" rules={[{ required: true }]}>
                <Input type="number" placeholder="5000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Priority" name="priority">
                <Input type="number" placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Start Date" name="startDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="End Date" name="endDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Active" name="active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Exclusive" name="exclusive" valuePropName="checked">
                <Switch checkedChildren="Exclusive" unCheckedChildren="Non-exclusive" />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setRuleModal({ visible: false, rule: null })}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {ruleModal.rule ? 'Update' : 'Create'} Rule
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Discount Code Modal */}
      <Modal
        title={discountModal.code ? "Edit Discount Code" : "Create Discount Code"}
        visible={discountModal.visible}
        onCancel={() => setDiscountModal({ visible: false, code: null })}
        footer={null}
        width={600}
      >
        <Form layout="vertical" onFinish={createDiscountCode}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Discount Code" name="code" rules={[{ required: true }]}>
                <Input placeholder="EARLY20" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Discount Type" name="discountType" rules={[{ required: true }]}>
                <Select>
                  <Option value="percentage">Percentage</Option>
                  <Option value="fixed">Fixed Amount</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Discount Value" name="discountValue" rules={[{ required: true }]}>
                <Input type="number" placeholder="20" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Max Uses" name="maxUses">
                <Input type="number" placeholder="100" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Valid From" name="validFrom">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Valid Until" name="validUntil">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setDiscountModal({ visible: false, code: null })}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {discountModal.code ? 'Update' : 'Create'} Code
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Pricing Simulation Modal */}
      <Modal
        title="Pricing Simulation & Optimization"
        visible={simulationModal.visible}
        onCancel={() => setSimulationModal({ visible: false })}
        footer={null}
        width={800}
      >
        <Form layout="vertical" onFinish={simulatePricing}>
          <Alert
            message="Pricing Simulation"
            description="Test different pricing scenarios to optimize revenue and conversion rates."
            type="info"
            showIcon
            className="mb-4"
          />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Base Price" name="basePrice" rules={[{ required: true }]}>
                <Input type="number" prefix="₹" placeholder="5000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Expected Registrations" name="expectedRegistrations" rules={[{ required: true }]}>
                <Input type="number" placeholder="100" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Early Bird Discount" name="earlyBirdDiscount">
                <Input type="number" suffix="%" placeholder="20" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Group Discount" name="groupDiscount">
                <Input type="number" suffix="%" placeholder="15" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Simulation Period" name="simulationPeriod" rules={[{ required: true }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          {simulationResults && (
            <Card title="Simulation Results" className="mt-4">
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic 
                    title="Projected Revenue" 
                    value={simulationResults.projectedRevenue} 
                    prefix="₹" 
                    precision={2}
                  />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="Conversion Rate" 
                    value={simulationResults.conversionRate} 
                    suffix="%" 
                    precision={1}
                  />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="ROI Improvement" 
                    value={simulationResults.roiImprovement} 
                    suffix="%" 
                    precision={1}
                  />
                </Col>
              </Row>
            </Card>
          )}

          <div className="flex justify-end space-x-3 mt-4">
            <Button onClick={() => setSimulationModal({ visible: false })}>
              Close
            </Button>
            <Button type="primary" htmlType="submit">
              Run Simulation
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AdvancedPricingEngine; 