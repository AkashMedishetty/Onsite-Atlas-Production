import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Button, Modal, Form, Select, Input, message, 
  Space, Tag, Checkbox, Tooltip, Progress, Alert, DatePicker,
  Drawer, List, Avatar, Divider, Descriptions
} from 'antd';
import { 
  BlockOutlined, 
  UnlockOutlined, 
  UserOutlined, 
  SearchOutlined,
  EyeOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const ResourceBlockingManager = ({ eventId }) => {
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [resources, setResources] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkBlockModal, setBulkBlockModal] = useState(false);
  const [bulkUnblockModal, setBulkUnblockModal] = useState(false);
  const [auditDrawer, setAuditDrawer] = useState({ visible: false, registrationId: null });
  const [detailsModal, setDetailsModal] = useState({ visible: false, registration: null });
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    hasBlocks: '',
    searchText: ''
  });
  const [bulkProgress, setBulkProgress] = useState({ visible: false, progress: 0, total: 0 });

  useEffect(() => {
    loadRegistrations();
    loadResources();
  }, [eventId, filters]);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.hasBlocks) queryParams.append('hasBlocks', filters.hasBlocks);
      if (filters.searchText) queryParams.append('search', filters.searchText);

      const response = await fetch(`/api/events/${eventId}/registrations?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRegistrations(data.registrations || []);
      }
    } catch (error) {
      message.error('Error loading registrations');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/resources`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setResources(data.resources || []);
      }
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  const loadBlockingHistory = async (registrationId) => {
    try {
      const response = await fetch(`/api/events/${eventId}/registrations/${registrationId}/blocking-history`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        return data.history || [];
      }
    } catch (error) {
      console.error('Error loading blocking history:', error);
      return [];
    }
  };

  const handleBulkBlock = async (values) => {
    try {
      setBulkProgress({ visible: true, progress: 0, total: selectedRows.length });
      
      const response = await fetch(`/api/events/${eventId}/resources/bulk-block`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registrationIds: selectedRowKeys,
          resourceIds: values.resources,
          reason: values.reason,
          blockUntil: values.blockUntil ? values.blockUntil.toISOString() : null,
          notifyRegistrants: values.notifyRegistrants
        })
      });

      if (response.ok) {
        const data = await response.json();
        message.success(`Successfully blocked ${data.successCount} registrations from ${values.resources.length} resources`);
        setBulkBlockModal(false);
        setSelectedRows([]);
        setSelectedRowKeys([]);
        loadRegistrations();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || 'Failed to block resources');
      }
    } catch (error) {
      message.error('Error blocking resources');
    } finally {
      setBulkProgress({ visible: false, progress: 0, total: 0 });
    }
  };

  const handleBulkUnblock = async (values) => {
    try {
      setBulkProgress({ visible: true, progress: 0, total: selectedRows.length });
      
      const response = await fetch(`/api/events/${eventId}/resources/bulk-unblock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registrationIds: selectedRowKeys,
          resourceIds: values.resources,
          reason: values.reason,
          notifyRegistrants: values.notifyRegistrants
        })
      });

      if (response.ok) {
        const data = await response.json();
        message.success(`Successfully unblocked ${data.successCount} registrations from ${values.resources.length} resources`);
        setBulkUnblockModal(false);
        setSelectedRows([]);
        setSelectedRowKeys([]);
        loadRegistrations();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || 'Failed to unblock resources');
      }
    } catch (error) {
      message.error('Error unblocking resources');
    } finally {
      setBulkProgress({ visible: false, progress: 0, total: 0 });
    }
  };

  const getBlockedResourcesDisplay = (registration) => {
    if (!registration.blockedResources || registration.blockedResources.length === 0) {
      return <Tag color="green">No Blocks</Tag>;
    }

    const activeBlocks = registration.blockedResources.filter(block => 
      !block.blockUntil || moment(block.blockUntil).isAfter(moment())
    );

    if (activeBlocks.length === 0) {
      return <Tag color="orange">Expired Blocks</Tag>;
    }

    return (
      <Space wrap>
        {activeBlocks.slice(0, 3).map((block, index) => (
          <Tag key={index} color="red" style={{ fontSize: '11px' }}>
            {block.resourceName}
          </Tag>
        ))}
        {activeBlocks.length > 3 && (
          <Tag color="red">+{activeBlocks.length - 3} more</Tag>
        )}
      </Space>
    );
  };

  const columns = [
    {
      title: 'Registration',
      key: 'registration',
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.personalInfo?.firstName} {record.personalInfo?.lastName}</div>
          <div className="text-xs text-gray-500">{record.registrationId}</div>
          <div className="text-xs text-gray-500">{record.personalInfo?.email}</div>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: ['category', 'name'],
      key: 'category',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'paymentStatus',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors = {
          'paid': 'green',
          'pending': 'orange',
          'failed': 'red',
          'refunded': 'purple'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Blocked Resources',
      key: 'blockedResources',
      width: 250,
      render: (_, record) => getBlockedResourcesDisplay(record)
    },
    {
      title: 'Last Block',
      key: 'lastBlock',
      width: 120,
      render: (_, record) => {
        if (!record.blockedResources || record.blockedResources.length === 0) {
          return <span className="text-gray-400">Never</span>;
        }
        const lastBlock = record.blockedResources.reduce((latest, current) => 
          moment(current.blockedAt).isAfter(moment(latest.blockedAt)) ? current : latest
        );
        return (
          <div className="text-xs">
            <div>{moment(lastBlock.blockedAt).format('MMM DD')}</div>
            <div className="text-gray-500">{moment(lastBlock.blockedAt).fromNow()}</div>
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              size="small" 
              icon={<EyeOutlined />}
              onClick={() => setDetailsModal({ visible: true, registration: record })}
            />
          </Tooltip>
          <Tooltip title="View History">
            <Button 
              size="small" 
              icon={<HistoryOutlined />}
              onClick={() => setAuditDrawer({ visible: true, registrationId: record._id })}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <StopOutlined className="mr-2" />
            Resource Blocking Manager
          </h2>
          <p className="text-gray-600 mt-1">
            Manage bulk resource access blocking for registrants
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            type="primary"
            danger
            icon={<BlockOutlined />}
            disabled={selectedRows.length === 0}
            onClick={() => setBulkBlockModal(true)}
          >
            Block Resources ({selectedRows.length})
          </Button>
          <Button
            type="primary"
            icon={<UnlockOutlined />}
            disabled={selectedRows.length === 0}
            onClick={() => setBulkUnblockModal(true)}
          >
            Unblock Resources ({selectedRows.length})
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card size="small">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            placeholder="Filter by Status"
            allowClear
            value={filters.status}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <Option value="paid">Paid</Option>
            <Option value="pending">Pending</Option>
            <Option value="failed">Failed</Option>
            <Option value="refunded">Refunded</Option>
          </Select>

          <Select
            placeholder="Filter by Category"
            allowClear
            value={filters.category}
            onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
          >
            {/* Categories will be loaded dynamically */}
          </Select>

          <Select
            placeholder="Filter by Blocks"
            allowClear
            value={filters.hasBlocks}
            onChange={(value) => setFilters(prev => ({ ...prev, hasBlocks: value }))}
          >
            <Option value="yes">Has Active Blocks</Option>
            <Option value="no">No Blocks</Option>
            <Option value="expired">Has Expired Blocks</Option>
          </Select>

          <Input
            placeholder="Search by name, email, or ID"
            prefix={<SearchOutlined />}
            allowClear
            value={filters.searchText}
            onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
          />
        </div>
      </Card>

      {/* Selection Summary */}
      {selectedRows.length > 0 && (
        <Alert
          type="info"
          message={`${selectedRows.length} registrations selected`}
          description="Use the actions above to block or unblock resources for the selected registrations."
          showIcon
          closable
          onClose={() => {
            setSelectedRows([]);
            setSelectedRowKeys([]);
          }}
        />
      )}

      {/* Main Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={registrations}
          rowKey="_id"
          rowSelection={rowSelection}
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            total: registrations.length,
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} registrations`,
          }}
        />
      </Card>

      {/* Bulk Block Modal */}
      <Modal
        title="Block Resources - Bulk Action"
        visible={bulkBlockModal}
        onCancel={() => setBulkBlockModal(false)}
        footer={null}
        width={600}
      >
        <Form layout="vertical" onFinish={handleBulkBlock}>
          <Alert
            message={`You are about to block resources for ${selectedRows.length} registrations`}
            type="warning"
            showIcon
            className="mb-4"
          />

          <Form.Item
            label="Resources to Block"
            name="resources"
            rules={[{ required: true, message: 'Please select resources to block' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select resources"
              style={{ width: '100%' }}
            >
              {resources.map(resource => (
                <Option key={resource._id} value={resource._id}>
                  {resource.name} ({resource.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Reason for Blocking"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <TextArea
              rows={3}
              placeholder="Enter the reason for blocking these resources..."
            />
          </Form.Item>

          <Form.Item
            label="Block Until (Optional)"
            name="blockUntil"
          >
            <DatePicker
              showTime
              placeholder="Select when block should expire"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="notifyRegistrants"
            valuePropName="checked"
          >
            <Checkbox>
              Send notification to registrants about resource blocking
            </Checkbox>
          </Form.Item>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setBulkBlockModal(false)}>
              Cancel
            </Button>
            <Button type="primary" danger htmlType="submit">
              Block Resources
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Bulk Unblock Modal */}
      <Modal
        title="Unblock Resources - Bulk Action"
        visible={bulkUnblockModal}
        onCancel={() => setBulkUnblockModal(false)}
        footer={null}
        width={600}
      >
        <Form layout="vertical" onFinish={handleBulkUnblock}>
          <Alert
            message={`You are about to unblock resources for ${selectedRows.length} registrations`}
            type="info"
            showIcon
            className="mb-4"
          />

          <Form.Item
            label="Resources to Unblock"
            name="resources"
            rules={[{ required: true, message: 'Please select resources to unblock' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select resources"
              style={{ width: '100%' }}
            >
              {resources.map(resource => (
                <Option key={resource._id} value={resource._id}>
                  {resource.name} ({resource.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Reason for Unblocking"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <TextArea
              rows={3}
              placeholder="Enter the reason for unblocking these resources..."
            />
          </Form.Item>

          <Form.Item
            name="notifyRegistrants"
            valuePropName="checked"
          >
            <Checkbox>
              Send notification to registrants about resource unblocking
            </Checkbox>
          </Form.Item>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setBulkUnblockModal(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              Unblock Resources
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Registration Details Modal */}
      <Modal
        title="Registration Details"
        visible={detailsModal.visible}
        onCancel={() => setDetailsModal({ visible: false, registration: null })}
        footer={null}
        width={700}
      >
        {detailsModal.registration && (
          <div className="space-y-4">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Name">
                {detailsModal.registration.personalInfo?.firstName} {detailsModal.registration.personalInfo?.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="Registration ID">
                {detailsModal.registration.registrationId}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {detailsModal.registration.personalInfo?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {detailsModal.registration.personalInfo?.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {detailsModal.registration.category?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag color={detailsModal.registration.paymentStatus === 'paid' ? 'green' : 'orange'}>
                  {detailsModal.registration.paymentStatus}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card title="Current Resource Blocks" size="small">
              {detailsModal.registration.blockedResources && detailsModal.registration.blockedResources.length > 0 ? (
                <List
                  size="small"
                  dataSource={detailsModal.registration.blockedResources}
                  renderItem={(block) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<BlockOutlined />} />}
                        title={block.resourceName}
                        description={
                          <div>
                            <div>Reason: {block.reason}</div>
                            <div>Blocked: {moment(block.blockedAt).format('YYYY-MM-DD HH:mm')}</div>
                            {block.blockUntil && (
                              <div>Expires: {moment(block.blockUntil).format('YYYY-MM-DD HH:mm')}</div>
                            )}
                          </div>
                        }
                      />
                      <Tag color={moment(block.blockUntil).isAfter(moment()) ? 'red' : 'orange'}>
                        {moment(block.blockUntil).isAfter(moment()) ? 'Active' : 'Expired'}
                      </Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No resource blocks found
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>

      {/* Audit History Drawer */}
      <Drawer
        title="Resource Blocking History"
        placement="right"
        width={500}
        visible={auditDrawer.visible}
        onClose={() => setAuditDrawer({ visible: false, registrationId: null })}
      >
        <div className="space-y-4">
          {/* History will be loaded and displayed here */}
          <div className="text-center py-8 text-gray-500">
            Blocking history will be loaded here
          </div>
        </div>
      </Drawer>

      {/* Progress Modal */}
      <Modal
        title="Processing Bulk Action"
        visible={bulkProgress.visible}
        footer={null}
        closable={false}
      >
        <div className="text-center py-4">
          <Progress
            type="circle"
            percent={Math.round((bulkProgress.progress / bulkProgress.total) * 100)}
          />
          <div className="mt-4">
            Processing {bulkProgress.progress} of {bulkProgress.total} registrations...
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ResourceBlockingManager; 