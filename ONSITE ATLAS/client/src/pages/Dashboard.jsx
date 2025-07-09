import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  UserGroupIcon, 
  CalendarIcon, 
  DocumentTextIcon, 
  ServerIcon,
  PlusIcon,
  ClockIcon, 
  MapPinIcon,
  CheckBadgeIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  EyeIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend
} from 'recharts';
import { Card, Badge, Button, Spinner, DashboardStatsCard } from '../components/common';
import TestNotificationGenerator from '../components/common/TestNotificationGenerator';
import eventService from '../services/eventService';
import registrationService from '../services/registrationService';
import resourceService from '../services/resourceService';
import api from '../services/api';



const Dashboard = () => {
  const [stats, setStats] = useState({
    events: 0,
    registrations: 0,
    resources: 0,
    abstracts: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [resourceUsage, setResourceUsage] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [performanceIndicators, setPerformanceIndicators] = useState([]);
  const [registrationTrends, setRegistrationTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testNotificationOpen, setTestNotificationOpen] = useState(false);

  // Generate REAL analytics based on actual data (NO MOCK DATA)
  const generateRealAnalytics = (dashboardData) => {
    // Use REAL revenue data from backend instead of mock calculations
    if (dashboardData.revenue?.monthlyData) {
      setRevenueData(dashboardData.revenue.monthlyData);
    } else {
      setRevenueData([]);
    }

    // Generate REAL performance indicators based on actual KPIs from database
    const kpis = dashboardData.kpis || {};
    const indicators = [
      {
        title: 'Check-in Rate',
        current: kpis.checkInRate || 0,
        target: 85,
        format: 'percentage'
      },
      {
        title: 'Payment Completion Rate', 
        current: kpis.paymentCompletionRate || 0,
        target: 95,
        format: 'percentage'
      },
      {
        title: 'Badge Distribution Rate',
        current: kpis.badgeDistributionRate || 0,
        target: 90,
        format: 'percentage'
      },
      {
        title: 'Event Attendance Rate',
        current: Math.max(0, 100 - (kpis.cancellationRate || 0)),
        target: 85,
        format: 'percentage'
      }
    ];
    setPerformanceIndicators(indicators);

    // Use REAL registration trends data from backend (last 7 days)
    if (dashboardData.registrationTrends) {
      console.log('📈 Using real registration trends data:', dashboardData.registrationTrends);
      setRegistrationTrends(dashboardData.registrationTrends);
    } else {
      console.log('⚠️ No registration trends data available, setting empty array');
      setRegistrationTrends([]);
    }
  };

  // Fetch dashboard data from API with improved error handling
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check authentication status
        const token = localStorage.getItem('token');
        console.log('🔐 Auth status:', { 
          hasToken: !!token, 
          tokenLength: token?.length || 0
        });
        
        if (!token) {
          console.warn('⚠️ No authentication token found');
          setError('Please log in to view dashboard data');
          return;
        }

        console.log('🚀 Starting optimized dashboard data fetch...');

        // Use the new global dashboard endpoint - SINGLE API call instead of 27!
        const response = await api.get('/dashboard/global');
        
        if (!response?.data?.success) {
          throw new Error('Failed to fetch dashboard data');
        }

        const dashboardData = response.data.data;
        console.log('✅ Global dashboard data received:', dashboardData);

        // Set statistics from aggregated data
        setStats({
          events: dashboardData.stats.events,
          registrations: dashboardData.stats.registrations,
          resources: dashboardData.stats.resources,
          abstracts: dashboardData.stats.abstracts
        });

        // Set recent events
        setRecentEvents(dashboardData.recent.events || []);

        // Set recent registrations
        setRecentRegistrations(dashboardData.recent.registrations || []);

        // Set resource usage data
        setResourceUsage(dashboardData.breakdown.resources || []);

        // Generate analytics based on real data from backend
        generateRealAnalytics(dashboardData);
        
        console.log('✅ Optimized dashboard loading completed with real data:', {
          events: dashboardData.stats.events,
          registrations: dashboardData.stats.registrations, 
          resources: dashboardData.stats.resources,
          revenue: dashboardData.revenue?.totalRevenue || 0,
          kpis: dashboardData.kpis
        });
        
      } catch (error) {
        console.error('❌ Dashboard data loading failed:', error);
        setError('Failed to load dashboard data. Please try again.');
        
        // Set everything to zero on complete failure (NO MOCK DATA)
        setStats({
          events: 0,
          registrations: 0,
          resources: 0,
          abstracts: 0
        });
        setRecentEvents([]);
        setResourceUsage([]);
        setRevenueData([]);
        setPerformanceIndicators([]);
        setRegistrationTrends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);
  
  // ClickUp-inspired chart colors (Purple/Blue theme)
  const COLORS = ['#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'draft': return 'warning';
      case 'published': return 'success';
      case 'archived': return 'danger';
      default: return 'info';
    }
  };

  return (
    <div className="space-y-8 min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Welcome back! 👋
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2 text-lg">
                Here's what's happening with your events today
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-3">
              <Link to="/events/new">
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={<PlusIcon className="h-5 w-5" />}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Create Event
                </Button>
              </Link>
              
              {/* Test Notification Button */}
              <Button
                variant="secondary"
                size="lg"
                leftIcon={<BellIcon className="h-5 w-5" />}
                onClick={() => setTestNotificationOpen(true)}
                className="border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Test Notifications
              </Button>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-purple-100/50 to-blue-100/50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-blue-100/40 to-purple-100/40 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full blur-2xl opacity-40" />
      </div>
      
      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardStatsCard
          title="Total Events" 
          value={stats.events} 
          icon={<CalendarIcon className="h-6 w-6" />} 
          loading={loading} 
          color="blue"
        />
        <DashboardStatsCard
          title="Total Registrations" 
          value={stats.registrations} 
          icon={<UserGroupIcon className="h-6 w-6" />} 
          loading={loading} 
          color="purple"
        />
        <DashboardStatsCard
          title="Resources Distributed" 
          value={stats.resources} 
          icon={<ServerIcon className="h-6 w-6" />} 
          loading={loading} 
          color="green"
        />
        <DashboardStatsCard
          title="Abstracts Submitted" 
          value={stats.abstracts} 
          icon={<DocumentTextIcon className="h-6 w-6" />} 
          loading={loading} 
          color="orange"
        />
      </div>
      
      {/* Advanced Analytics Dashboard */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Revenue Analytics */}
        <div className="xl:col-span-2">
          <Card className="p-6 border-0 shadow-lg bg-white dark:bg-gray-800 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Revenue Analytics</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Monthly revenue vs targets</p>
              </div>
              <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8B5CF6" 
                    fillOpacity={1} 
                    fill="url(#revenueGradient)" 
                    strokeWidth={3}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="target" 
                    stroke="#10B981" 
                    strokeDasharray="5 5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Performance Indicators */}
        <div className="xl:col-span-2">
          <Card className="p-6 border-0 shadow-lg bg-white dark:bg-gray-800 rounded-2xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Performance Indicators</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Key performance metrics</p>
              </div>
              <ChartBarIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              {performanceIndicators.map((metric, index) => (
                <div key={metric.title} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{metric.title}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{metric.current}{metric.format === 'percentage' ? '%' : ''}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        metric.current >= metric.target ? 'bg-green-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${(metric.current / 100) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">0%</span>
                    <span className="text-xs text-gray-500">Target: {metric.target}%</span>
                    <span className="text-xs text-gray-500">100%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Registration Trends Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Registration Trends */}
        <div>
          <Card className="p-6 border-0 shadow-lg bg-white dark:bg-gray-800 rounded-2xl h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registration Trends</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Daily registration patterns</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={registrationTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#666"
                    tickFormatter={(value) => value}
                  />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                    labelFormatter={(value) => value}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="registrations" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Resource Analytics */}
        <div>
          <Card className="p-6 border-0 shadow-lg bg-white dark:bg-gray-800 rounded-2xl h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Resource Analytics</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Distribution overview</p>
              </div>
              <ServerIcon className="h-5 w-5 text-green-600" />
            </div>
            
            <div className="space-y-4 flex-1">
              {resourceUsage.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ServerIcon className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-gray-600 font-medium mb-2">No resources yet</h3>
                  <p className="text-gray-400 text-sm">Resources will appear here once distributed</p>
                </div>
              ) : (
                resourceUsage.map((item, index) => (
                  <div key={item.name} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${item.percentage}%`, 
                          backgroundColor: COLORS[index % COLORS.length] 
                        }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total Resources</span>
                <span className="font-bold text-gray-900 dark:text-white">{stats.resources}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Events Section - Enhanced */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Events */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0 overflow-hidden">
            {/* Seamless Header */}
            <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Events</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your latest event activities</p>
                </div>
              <Link to="/events">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button 
                      variant="text" 
                      size="sm"
                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg px-3 py-2 transition-all duration-200"
                    >
                      View All →
                    </Button>
                  </motion.div>
            </Link>
              </div>
          </div>
          
            {/* Enhanced Card Content */}
            <div className="p-6">
            {loading ? (
                // Enhanced Skeletal Loading
                <div className="space-y-4">
                  {[...Array(5)].map((_, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="animate-pulse"
                    >
                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-3">
                            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded-lg w-3/4"></div>
                            <div className="flex items-center space-x-2">
                              <div className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-40"></div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                            </div>
                          </div>
                          <div className="h-6 w-16 bg-gray-300 dark:bg-gray-600 rounded-full ml-3"></div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            ) : error ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <EyeIcon className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="text-red-500 font-medium">Failed to load events</p>
                  <p className="text-gray-500 text-sm mt-1">{error}</p>
                </motion.div>
            ) : recentEvents.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                    className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  >
                    <CalendarIcon className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                  </motion.div>
                  <h3 className="text-gray-600 dark:text-gray-300 font-semibold mb-2">No events yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by creating your first event</p>
                <Link to="/events/new">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                  <Button
                    variant="primary"
                    leftIcon={<PlusIcon className="h-5 w-5" />}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Create Event
                  </Button>
                    </motion.div>
                </Link>
                </motion.div>
            ) : (
                <div className="space-y-3">
                {recentEvents.map((event, index) => (
                  <motion.div
                key={event._id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        delay: index * 0.1,
                        type: "spring",
                        stiffness: 100
                      }}
                      whileHover={{ 
                        y: -2,
                        transition: { duration: 0.2 }
                      }}
              >
                    <Link 
                      to={`/events/${event._id}`} 
                        className="block p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-700/20 hover:bg-white dark:hover:bg-gray-700/40 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg dark:hover:shadow-purple-500/10 transition-all duration-300 group relative overflow-hidden"
                      >
                        {/* Animated background gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-blue-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:via-blue-500/5 group-hover:to-purple-500/5 dark:group-hover:from-purple-500/10 dark:group-hover:via-blue-500/10 dark:group-hover:to-purple-500/10 transition-all duration-500"></div>
                        
                        <div className="relative z-10 flex justify-between items-start">
                          <div className="flex-1">
                            <motion.h3 
                              className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors duration-200"
                              whileHover={{ x: 4 }}
                              transition={{ duration: 0.2 }}
                            >
                              {event.name}
                            </motion.h3>
                            
                            <motion.div 
                              className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-3 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-200"
                              whileHover={{ x: 2 }}
                              transition={{ duration: 0.2, delay: 0.05 }}
                            >
                              <ClockIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                            <span>
                              {format(new Date(event.startDate), 'MMM d, yyyy')} - 
                              {format(new Date(event.endDate), 'MMM d, yyyy')}
                            </span>
                            </motion.div>
                            
                          {event.venue?.city && event.venue?.country && (
                              <motion.div 
                                className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-2 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-200"
                                whileHover={{ x: 2 }}
                                transition={{ duration: 0.2, delay: 0.1 }}
                              >
                                <MapPinIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                              <span>{event.venue.city}, {event.venue.country}</span>
                              </motion.div>
                          )}
                        </div>
                          
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.2 }}
                            className="ml-4"
                          >
                        <Badge 
                          variant={getStatusBadgeColor(event.status)}
                          size="sm"
                              className="shadow-sm"
                        >
                          {event.status}
                        </Badge>
                          </motion.div>
                        </div>
                        
                        {/* Subtle shine effect on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
        
            
                </div>

      {/* Recent Registrations - Enhanced */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0 overflow-hidden">
        {/* Seamless Header */}
        <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Registrations</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Latest event registrations</p>
              </div>
            <Link to="/registrations">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  variant="text" 
                  size="sm"
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg px-3 py-2 transition-all duration-200"
                >
                  View All →
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Enhanced Card Content */}
        <div className="p-6">
        {loading ? (
            // Enhanced Skeletal Loading for Table
            <div className="space-y-4">
              {/* Table Header Skeleton */}
              <div className="grid grid-cols-5 gap-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                {['Registration ID', 'Name', 'Event', 'Status', 'Date'].map((header, index) => (
                  <motion.div
                    key={header}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="animate-pulse"
                  >
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                  </motion.div>
                ))}
              </div>
              
              {/* Table Rows Skeleton */}
              {[...Array(5)].map((_, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index + 5) * 0.05 }}
                  className="animate-pulse grid grid-cols-5 gap-4 py-4"
                >
                  <div className="h-4 bg-blue-300 dark:bg-blue-600 rounded w-20"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
                  </div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                  <div className="h-6 bg-green-300 dark:bg-green-600 rounded-full w-16"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                </motion.div>
              ))}
            </div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <EyeIcon className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-red-500 font-medium">Failed to load registrations</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
            </motion.div>
          ) : recentRegistrations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 3, -3, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <UserGroupIcon className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </motion.div>
              <h3 className="text-gray-600 dark:text-gray-300 font-semibold mb-2">No registrations yet</h3>
              <p className="text-gray-500 dark:text-gray-400">New registrations will appear here</p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Enhanced Table Header */}
                <div className="grid grid-cols-5 gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  {[
                    { label: 'Registration ID', width: 'w-auto' },
                    { label: 'Name', width: 'w-auto' },
                    { label: 'Event', width: 'w-auto' },
                    { label: 'Status', width: 'w-auto' },
                    { label: 'Date', width: 'w-auto' }
                  ].map((header, index) => (
                    <motion.div
                      key={header.label}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ${header.width}`}
                    >
                      {header.label}
                    </motion.div>
                  ))}
                </div>
                
                {/* Enhanced Table Body */}
                <div className="space-y-2 mt-4">
                  {recentRegistrations.map((registration, index) => (
                    <motion.div
                      key={registration.id || registration._id || `reg-${index}`}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        delay: index * 0.05,
                        type: "spring",
                        stiffness: 100
                      }}
                      whileHover={{ 
                        y: -1,
                        transition: { duration: 0.2 }
                      }}
                      className="grid grid-cols-5 gap-4 p-4 bg-gray-50/50 dark:bg-gray-700/20 hover:bg-white dark:hover:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md dark:hover:shadow-purple-500/10 transition-all duration-300 group relative overflow-hidden"
                    >
                      {/* Animated background gradient */}
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-blue-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:via-blue-500/5 group-hover:to-purple-500/5 dark:group-hover:from-purple-500/10 dark:group-hover:via-blue-500/10 dark:group-hover:to-purple-500/10 transition-all duration-500"></div>
                      
                      {/* Registration ID - No hyperlink */}
                      <div className="relative z-10">
                        <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                          {registration.registrationId || 'N/A'}
                        </span>
                      </div>
                      
                      {/* Name and Email */}
                      <div className="relative z-10">
                        <motion.div 
                          className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors duration-200"
                          whileHover={{ x: 2 }}
                          transition={{ duration: 0.2 }}
                        >
                          {registration.name || 'Name not provided'}
                        </motion.div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs mt-1">
                          {registration.email || 'Email not provided'}
                        </div>
                      </div>
                      
                      {/* Event Name */}
                      <motion.div 
                        className="relative z-10 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-200"
                        whileHover={{ x: 2 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                      >
                        {registration.event || 'Event not assigned'}
                      </motion.div>
                      
                      {/* Status */}
                      <motion.div
                        className="relative z-10"
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.2 }}
                      >
                        {(() => {
                          const status = registration.status || 'pending';
                          const variant = status === 'checked-in' || status === 'confirmed' || status === 'active' ? 'success' 
                                        : status === 'pending' ? 'warning'
                                        : status === 'cancelled' ? 'danger'
                                        : 'info';
                          
                          return (
                      <Badge 
                              variant={variant} 
                        size="sm"
                              className="shadow-sm"
                            >
                              {status}
                            </Badge>
                          );
                        })()}
                      </motion.div>
                      
                      <motion.div 
                        className="relative z-10 text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-200"
                        whileHover={{ x: 2 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                      >
                      {registration.createdAt ? format(new Date(registration.createdAt), 'MMM d, yyyy') : 'N/A'}
                      </motion.div>
                      
                      {/* Subtle shine effect on hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
          </div>
        )}
        </div>
      </div>
      
      {/* Test Notification Generator Modal */}
      <TestNotificationGenerator
        isOpen={testNotificationOpen}
        onClose={() => setTestNotificationOpen(false)}
      />
    </div>
  );
};

export default Dashboard; 