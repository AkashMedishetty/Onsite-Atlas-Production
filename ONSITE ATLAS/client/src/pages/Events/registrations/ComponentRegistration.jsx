import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Button, Spinner, Alert, Badge, Input, Modal } from '../../../components/common';
import {
  Table,
  Tabs,
  Space,
  Tag,
  Tooltip,
  Select,
  message,
  Modal as AntdModal,
  Button as AntdButton,
  Form,
  Row,
  Col,
  Divider,
  Steps,
  Progress,
  Statistic
} from 'antd';
import {
  UserAddOutlined,
  TeamOutlined,
  FileExcelOutlined,
  MailOutlined,
  PhoneOutlined,
  PrinterOutlined,
  DownloadOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import RegistrationsTab from './RegistrationsTab';
import BulkImportWizard from '../../Registrations/BulkImportWizard';
import RegistrationForm from '../../Registration/RegistrationForm';

const ComponentRegistration = () => {
  const { eventId } = useParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [eventDetails, setEventDetails] = useState(null);
  const [registrationStats, setRegistrationStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    completed: 0,
    cancelled: 0
  });

  useEffect(() => {
    if (eventId) {
      loadEventDetails();
      loadRegistrationStats();
    }
  }, [eventId]);

  const loadEventDetails = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEventDetails(data.data);
      }
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrationStats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/events/${eventId}/registrations/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRegistrationStats(data.data || registrationStats);
      }
    } catch (error) {
      console.error('Error loading registration stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
        <span className="ml-2">Loading registration management...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
        <Tabs.TabPane tab="Dashboard" key="dashboard">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Registration Management System
              </h1>
              <p className="text-gray-600">
                {eventDetails?.name || 'Event'} - Comprehensive Registration Interface
              </p>
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card className="text-center">
                  <Statistic
                    title="Total Registrations"
                    value={registrationStats.total}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="text-center">
                  <Statistic
                    title="Active"
                    value={registrationStats.active}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="text-center">
                  <Statistic
                    title="Pending Payment"
                    value={registrationStats.pending}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="text-center">
                  <Statistic
                    title="Completed"
                    value={registrationStats.completed}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>

            <Card>
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <AntdButton 
                  size="large" 
                  icon={<UserAddOutlined />}
                  onClick={() => setActiveTab('add')}
                  className="h-16 flex flex-col items-center justify-center"
                  block
                >
                  Add Registration
                </AntdButton>
                <AntdButton 
                  size="large" 
                  icon={<FileExcelOutlined />}
                  onClick={() => setActiveTab('bulk-import')}
                  className="h-16 flex flex-col items-center justify-center"
                  block
                >
                  Bulk Import
                </AntdButton>
                <AntdButton 
                  size="large" 
                  icon={<MailOutlined />}
                  onClick={() => setActiveTab('communications')}
                  className="h-16 flex flex-col items-center justify-center"
                  block
                >
                  Communications
                </AntdButton>
                <AntdButton 
                  size="large" 
                  icon={<BarChartOutlined />}
                  onClick={() => setActiveTab('analytics')}
                  className="h-16 flex flex-col items-center justify-center"
                  block
                >
                  Analytics
                </AntdButton>
              </div>
            </Card>
          </div>
        </Tabs.TabPane>
        
        <Tabs.TabPane tab="All Registrations" key="registrations">
          <RegistrationsTab eventId={eventId} />
        </Tabs.TabPane>
        
        <Tabs.TabPane tab="Add Registration" key="add">
          <Card>
            <h2 className="text-xl font-semibold mb-4">Add New Registration</h2>
            <Alert
              message="Add Registration Feature"
              description="Use this interface to manually add new registrations to your event."
              type="info"
              showIcon
              className="mb-4"
            />
            <div className="text-center py-8">
              <AntdButton 
                type="primary" 
                size="large" 
                icon={<UserAddOutlined />}
                onClick={() => message.info('Registration form coming soon!')}
              >
                Open Registration Form
              </AntdButton>
            </div>
          </Card>
        </Tabs.TabPane>
        
        <Tabs.TabPane tab="Bulk Import" key="bulk-import">
          <Card>
            <h2 className="text-xl font-semibold mb-4">Bulk Import Registrations</h2>
            <Alert
              message="Bulk Import Feature"
              description="Import multiple registrations from Excel/CSV files."
              type="info"
              showIcon
              className="mb-4"
            />
            <div className="text-center py-8">
              <AntdButton 
                type="primary" 
                size="large" 
                icon={<FileExcelOutlined />}
                onClick={() => message.info('Bulk import wizard coming soon!')}
              >
                Start Bulk Import
              </AntdButton>
            </div>
          </Card>
        </Tabs.TabPane>
        
        <Tabs.TabPane tab="Communications" key="communications">
          <Card>
            <h2 className="text-xl font-semibold mb-4">Communication Center</h2>
            <Alert
              message="Communication Features"
              description="Send emails, SMS, and manage communication templates for your registrations."
              type="info"
              showIcon
              className="mb-4"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AntdButton size="large" icon={<MailOutlined />} block>
                Email Campaign
              </AntdButton>
              <AntdButton size="large" icon={<PhoneOutlined />} block>
                SMS Campaign
              </AntdButton>
              <AntdButton size="large" icon={<PrinterOutlined />} block>
                Print Badges
              </AntdButton>
              <AntdButton size="large" icon={<DownloadOutlined />} block>
                Export Data
              </AntdButton>
            </div>
          </Card>
        </Tabs.TabPane>
        
        <Tabs.TabPane tab="Analytics" key="analytics">
          <Card>
            <h2 className="text-xl font-semibold mb-4">Registration Analytics</h2>
            <Alert
              message="Analytics Dashboard"
              description="Comprehensive analytics and reporting for your event registrations."
              type="info"
              showIcon
              className="mb-4"
            />
            
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Registration Rate"
                    value={85}
                    precision={1}
                    valueStyle={{ color: '#3f8600' }}
                    suffix="%"
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Average Registration Time"
                    value={3.2}
                    precision={1}
                    valueStyle={{ color: '#1890ff' }}
                    suffix="min"
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default ComponentRegistration; 