import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Spinner } from '../common';
import { BarChart3, TrendingUp, Users, DollarSign, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const ComponentAnalyticsDashboard = ({ eventId }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    overview: {},
    componentBreakdown: [],
    performanceMetrics: {}
  });

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/events/${eventId}/component-analytics`);
      
      if (response.data.success) {
        setAnalytics(response.data.data);
      } else {
        toast.error('Failed to load analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load component analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchAnalytics();
    }
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const { overview, componentBreakdown, performanceMetrics } = analytics;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Component Registration Analytics</h2>
        <div className="flex space-x-2">
          <Button onClick={fetchAnalytics} variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Registrations</p>
              <p className="text-2xl font-bold text-gray-900">{overview.totalRegistrations || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">${overview.totalRevenue || 0}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Components/Registration</p>
              <p className="text-2xl font-bold text-purple-600">{overview.avgComponentsPerRegistration || 0}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Most Popular Component</p>
              <p className="text-xl font-bold text-orange-600">{overview.mostPopularComponent || 'N/A'}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Performance Breakdown</h3>
        <div className="space-y-4">
          {componentBreakdown && componentBreakdown.length > 0 ? (
            componentBreakdown.map((component, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Badge className="bg-blue-100 text-blue-800">
                    {component.type}
                  </Badge>
                  <div>
                    <p className="font-medium text-gray-900">{component.name}</p>
                    <p className="text-sm text-gray-500">{component.audience} audience</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{component.registrations} registrations</p>
                  <p className="text-sm text-green-600">${component.revenue}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No component data available</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ComponentAnalyticsDashboard; 