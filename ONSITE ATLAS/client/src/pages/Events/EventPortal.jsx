import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistance } from 'date-fns';
import {
  ChartBarIcon,
  UserPlusIcon,
  TagIcon,
  CubeIcon,
  DocumentTextIcon,
  BookmarkIcon,
  ChartPieIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  CalendarIcon,
  MapPinIcon,
  LinkIcon,
  ClipboardIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  QrCodeIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { Card, Tabs, Badge, Button, Spinner, Alert, SafeCard } from '../../components/common';
import eventService from '../../services/eventService';
import { FiUsers, FiTag, FiPackage, FiFileText, FiPrinter, FiBarChart2, FiSettings, FiMail } from 'react-icons/fi';
import { FaBullhorn } from 'react-icons/fa';
import { formatDate, formatDateTimeRelative } from '../../utils/dateUtils';
import RegistrationsTab from './registrations/RegistrationsTab';
import CategoriesTab from './categories/CategoriesTab';
import EmailsTab from './tabs/EmailsTab';
import { useAuth } from '../../contexts/AuthContext';
import AbstractsPage from '../Abstracts/AbstractsPage'; // Ensure this import exists or add it
import BadgePrintingPage from '../BadgePrinting/BadgePrintingPage'; // Import the correct page
import BadgeDesigner from '../BadgePrinting/BadgeDesigner'; // Add this import
import BadgesPage from '../Badges/BadgesPage'; // Add this import for the main /badges landing
import { ResourceList, ScannerStation, FoodTracking, KitBagDistribution, CertificateIssuance, CertificatePrinting, CertificatePrintingScanner } from '../Resources'; // Ensure ScannerStation is imported here

// Import the new ReportsTab component
import ReportsTab from './reports/ReportsTab';
import LandingPagesManager from '../LandingPages/LandingPagesManager'; // Import the component
import AbstractDetail from '../Abstracts/AbstractDetail'; // Added import

// Import tab components from settings folder - RESTORING THESE
import { 
  GeneralTab, 
  RegistrationTab, 
  BadgesTab, 
  EmailTab, 
  PaymentTab,
  SettingsTab, // This is the main wrapper for settings sub-tabs
  ResourcesTab as ResourcesSettingsTab, // Alias to avoid conflict
  AbstractsTab as AbstractsSettingsTab,  // Alias to avoid conflict
  ScheduleTab  // Add the new ScheduleTab import
} from './settings';
// import SponsorsSettingsTab from './settings/SponsorsSettingsTab'; // Import the new Sponsors settings tab

// Import dedicated tab components
import ResourcesTab from './resources/ResourcesTab';
import AbstractsTab from './abstracts/AbstractsTab';
import AuthorsTab from './abstracts/AuthorsTab';
import EventUserManagementTab from './settings/EventUserManagementTab'; // Import the component
import SponsorsList from '../../pages/SponsorManagement/SponsorsList'; // Added for Sponsors Tab
import SponsorForm from '../../pages/SponsorManagement/SponsorForm'; // Import SponsorForm
import AnnouncementsTab from './announcements/AnnouncementsTab'; // Import the AnnouncementsTab component
import EventClientTab from './tabs/EventClientTab'; // To be created

// Simple error boundary component for tabs - RESTORING THIS
const TabErrorBoundary = ({ children, tabName }) => {
  try {
    // Attempt to render children, a common source of errors if props are missing
    // or if a child component throws an error during its render.
    return children;
  } catch (error) {
    console.error(`Error rendering ${tabName} tab:`, error);
    // Basic fallback UI, consider a more styled component
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-700">Tab Error</h3>
        <p className="text-red-600 mb-2">There was an error rendering the {tabName} tab.</p>
        <p className="text-sm text-red-500">Details: {error.message}</p>
        {/* Optionally, log stack in dev mode or provide a refresh button */}
        {import.meta.env.MODE === 'development' && (
          <pre className="text-xs text-red-500 bg-red-50 p-2 rounded overflow-auto mt-2">
            {error.stack}
          </pre>
        )}
      </div>
    );
  }
};

// Check if we're in development mode
const isDevelopment = import.meta.env.MODE === 'development';

/**
 * EventPortal Component
 * 
 * Complete rebuild with:
 * - Robust data handling with default values
 * - Clear error states and loading states
 * - Consistent navigation between tabs and sections
 * - Proper data transformation and handling
 */

// Event navigation items
const eventNavItems = [
  { id: "dashboard", label: "Dashboard", icon: <FiBarChart2 /> },
  { id: "registrations", label: "Registrations", icon: <FiUsers /> },
  { id: "sponsors", label: "Sponsors", icon: <BookmarkIcon className="w-5 h-5" /> },
  { id: "categories", label: "Categories", icon: <FiTag /> },
  { id: "resources", label: "Resources", icon: <FiPackage /> },
  { id: "abstracts", label: "Abstracts", icon: <FiFileText /> },
  { id: "authors", label: "Authors", icon: <UserGroupIcon className="w-5 h-5" /> },
  { id: "badges", label: "Badges", icon: <FiPrinter /> },
  { id: "announcements", label: "Announcements", icon: <FaBullhorn /> },
  { id: "landing-pages", label: "Landing Pages", icon: <LinkIcon className="w-5 h-5" /> },
  { id: "emails", label: "Emails", icon: <FiMail /> },
  { id: "reports", label: "Reports", icon: <FiBarChart2 /> },
  { id: "user-management", label: "User Management", icon: <UserGroupIcon className="w-5 h-5" /> },
  { id: "client", label: "Client", icon: <UserIcon className="w-5 h-5" /> },
  { id: "settings", label: "Settings", icon: <FiSettings /> }
];

function EventPortal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isAuthenticated, loading: authLoading, currentEventId: contextEventId, setCurrentEventId } = useAuth();
  
  // State variables
  const [event, setEvent] = useState(null);
  const [statistics, setStatistics] = useState({
    totalRegistrations: { total: 0, checkedIn: 0, printed: 0 },
    registrationsToday: 0,
    checkedIn: 0,
    categories: [],
    categoriesDetailed: [],
    resourcesDistributed: { food: 0, kits: 0, certificates: 0 },
    abstractsSubmitted: 0,
    abstractsApproved: 0
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSettingsTab, setActiveSettingsTab] = useState(0);
  const [renderKey, setRenderKey] = useState(0);
  const [formChanged, setFormChanged] = useState(false);
  const [categoriesKey, setCategoriesKey] = useState(Date.now());
  
  // --- Add new state for dashboard-specific stats ---
  const [dashboardAbstractStats, setDashboardAbstractStats] = useState({ total: 0, approved: 0, underReview: 0 });
  const [dashboardResourceStats, setDashboardResourceStats] = useState({ food: 0, kits: 0, certificates: 0, certificatePrinting: 0 });
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false);
  const [dashboardStatsError, setDashboardStatsError] = useState(null);
  
  // Memoize the setEvent function to prevent unnecessary re-renders
  const updateEvent = useMemo(() => {
    return (newEventData) => {
      if (typeof newEventData === 'function') {
        setEvent(newEventData);
      } else {
        setEvent(prev => ({
          ...prev,
          ...newEventData
        }));
      }
    };
  }, []);
  
  // Create a specialized function for updating abstract settings
  const updateAbstractSettings = useMemo(() => {
    return (settings) => {
      setEvent(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          abstractSettings: {
            ...prev.abstractSettings,
            ...settings
          }
        };
      });
    };
  }, []);
  
  // Create a mapping between tab index and tab ID
  const tabIndexToId = useMemo(() => {
    const mapping = {};
    eventNavItems.forEach((item, index) => {
      mapping[index] = item.id;
    });
    return mapping;
  }, []);
  
  // And the reverse mapping (ID to index)
  const tabIdToIndex = useMemo(() => {
    const mapping = {};
    eventNavItems.forEach((item, index) => {
      mapping[item.id] = index;
    });
    return mapping;
  }, []);
  
  // Define a refresh handler function for the entire portal
  const handleRefresh = useCallback(async () => {
    console.log(`Refreshing portal data for event ${id}...`);
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch fresh event data
      const eventData = await eventService.getEventById(id, { forceRefresh: true });
      
      if (eventData && eventData.success) {
        console.log('Refresh: Got updated event data:', eventData.data);
        setEvent(eventData.data);
        
        // Force a re-render by updating the render key
        setRenderKey(prevKey => prevKey + 1);
        
        // Reset any form changed flags
        setFormChanged(false);
      } else {
        throw new Error(eventData?.message || 'Failed to refresh event data');
      }
      
      // Also refresh statistics if needed
      try {
        const statsResponse = await eventService.getEventStatistics(id);
        if (statsResponse && statsResponse.success) {
          const stats = statsResponse.data;
          const regStats = stats?.registrations || stats?.totalRegistrations || { total: 0, checkedIn: 0, printed: 0 };
          setStatistics({
            totalRegistrations: {
              total: regStats.total || 0,
              checkedIn: regStats.checkedIn || 0,
              printed: regStats.printed || 0,
            },
            registrationsToday: stats.registrationsToday || 0,
            checkedIn: regStats.checkedIn || 0,
            categories: stats.categories || [],
            categoriesDetailed: stats.categoriesDetailed || regStats.categoriesDetailed || [],
            resourcesDistributed: stats.resourcesDistributed || stats.resources || { food: 0, kits: 0, certificates: 0 },
            abstractsSubmitted: stats.abstractsSubmitted || 0,
            abstractsApproved: stats.abstractsApproved || 0
          });
        }
      } catch (statsError) {
        console.warn('Error refreshing statistics:', statsError);
        // Continue regardless of statistics refresh error
      }
      
      console.log('Portal data refresh completed successfully');
    } catch (error) {
      console.error('Error refreshing portal data:', error);
      setError(`Failed to refresh: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Use this effect to refresh when triggered by location state
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('Refresh signal detected from navigation state. Refreshing portal data...');
      handleRefresh(); // Call the existing refresh handler
      // Clear the state so it doesn't refresh again on subsequent renders/navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, handleRefresh]);
  
  // Get the current tab index for the Tabs component
  const currentTabIndex = tabIdToIndex[activeTab] || 0;
  
  // Handle navigation back from the location state more robustly
  useEffect(() => {
    const locationState = location.state || {};
    
    if (!id || id === "undefined") {
      // console.warn("EventPortal: Tab management useEffect skipped due to invalid id:", id);
      return;
    }

    if (locationState.activeTab && eventNavItems.some(item => item.id === locationState.activeTab)) {
      setActiveTab(locationState.activeTab);
      // Clear location state to prevent re-application on refresh
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    
    // If we have a subSection in state, don't change the active tab - it's a sub-navigation
    if (locationState.subSection) {
      // Ensure the main tab associated with the subSection is active
      const mainTab = location.pathname.split('/')[3]; // e.g., 'settings' from /events/123/settings
      if (mainTab && activeTab !== mainTab && eventNavItems.some(item => item.id === mainTab)) {
         setActiveTab(mainTab);
      }
      return;
    }
    
    // Try to extract the tab from the URL path
    const pathSegments = location.pathname.split('/');
    let determinedTab = 'dashboard'; // Default to dashboard

    if (pathSegments.length >= 4) { // Check for /events/:id/:tabId or longer
      const possibleTab = pathSegments[3];
      if (eventNavItems.some(item => item.id === possibleTab)) {
        determinedTab = possibleTab;
        // Check for sub-path like /resources/scanner
        if (possibleTab === 'resources' && pathSegments.length >= 5 && pathSegments[4] === 'scanner') {
          determinedTab = 'scanner'; // Treat scanner as its own tab for rendering logic
        }
      } else if (possibleTab === 'scanner' && pathSegments.length === 4) {
         // Allow direct navigation to /events/:id/scanner if needed, though less likely
         determinedTab = 'scanner';
      }
    } // If path is just /events/:id (length 3), it defaults to 'dashboard' anyway

    // Check localStorage only if URL didn't provide a valid tab
    if (determinedTab === 'dashboard' && pathSegments.length <= 3) {
      const savedTab = localStorage.getItem(`event_${id}_active_tab`);
      if (savedTab && eventNavItems.some(item => item.id === savedTab)) {
        determinedTab = savedTab;
        // Update URL to match the saved tab if we are on the base path
        if (location.pathname === `/events/${id}`) {
             navigate(`/events/${id}/${determinedTab}`, { replace: true });
        }
      }
    }
    
    // Set the active tab state
    if (activeTab !== determinedTab) {
        setActiveTab(determinedTab);
      }
    
    // Ensure localStorage is consistent with the final determined tab
    localStorage.setItem(`event_${id}_active_tab`, determinedTab);

  }, [id, location.pathname, location.state, navigate, eventNavItems, activeTab]); // Added activeTab to dependencies
  
  // Main data loading effect and active tab synchronization
  useEffect(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    // Expected: ["events", eventIdFromUrl, (tabName), (itemId), (action)]

    if (id && id !== 'undefined') {
      if (contextEventId !== id) {
        setCurrentEventId(id); // Update context if URL's eventId differs
      }
      loadEventData(); // Uses 'id' from useParams() directly

      let newActiveTab = 'dashboard'; // Default tab
      if (pathSegments.length > 2 && eventNavItems.some(item => item.id === pathSegments[2])) {
        newActiveTab = pathSegments[2];
      }
      // Special handling if the third segment is 'sponsors' and there's more, like 'new' or 'edit'
      // This ensures the 'sponsors' tab remains active when on /events/:id/sponsors/new or /events/:id/sponsors/edit/:sponsorId
      if (pathSegments.length > 3 && pathSegments[2] === 'sponsors' && (pathSegments[3] === 'new' || pathSegments[3] === 'edit')) {
        newActiveTab = 'sponsors';
      }
      // Add similar specific handlers if other tabs have deep-linking that should keep parent tab active
      
      setActiveTab(newActiveTab);
    } else {
      // Only set error or clear data if auth is done and ID is genuinely missing/invalid
      if (isAuthenticated && !authLoading) {
        console.error('EventPortal: useEffect found invalid id from useParams():', id, 'Current Path:', location.pathname);
        setError('Event ID is missing or invalid. Please select an event.');
        setEvent(null); // Clear event data
        setStatistics({}); // Clear stats
        setLoading(false);
        if (contextEventId) {
          setCurrentEventId(null); // Clear context if it holds an old ID
        }
      }
    }
  }, [id, location.pathname, isAuthenticated, authLoading, contextEventId, setCurrentEventId]); // Added contextEventId and setCurrentEventId

  // Load event data function - now uses 'id' from useParams directly from its scope
  const loadEventData = async () => {
    // The 'id' from useParams() is directly available in this function's scope
    if (!id || id === 'undefined') {
      console.error(`EventPortal: loadEventData aborted due to invalid id from scope: ${id}`);
      // Clear event related state if ID is invalid
      setEvent(null);
      setStatistics(prev => ({ ...prev, totalRegistrations: { total: 0, checkedIn: 0 }, registrationsToday: 0, checkedIn: 0, categories: [], resourcesDistributed: { food: 0, kits: 0, certificates: 0 }, abstractsSubmitted: 0, abstractsApproved: 0 }));
      setError('No valid event ID provided to loadEventData.');
      setLoading(false);
      return;
    }

    console.log(`EventPortal: Loading event data for ID: ${id}`);
    setLoading(true);
    setError(null);

    try {
      const eventData = await eventService.getEventById(id);
      
      if (!eventData) {
        throw new Error('Event data is empty');
      }
      
      if (eventData && eventData.success) {
        setEvent(eventData.data); // Store only the event data object, not the entire response
      } else {
        throw new Error(eventData.message || 'Failed to load event data');
      }
      
      // Load statistics and dashboard data
      try {
        const statsResponse = await eventService.getEventStatistics(id);
        
        if (statsResponse && statsResponse.success) {
          const stats = statsResponse.data;
          const regStats = stats?.registrations || stats?.totalRegistrations || { total: 0, checkedIn: 0, printed: 0 };
          setStatistics({
            totalRegistrations: {
              total: regStats.total || 0,
              checkedIn: regStats.checkedIn || 0,
              printed: regStats.printed || 0,
            },
            registrationsToday: stats.registrationsToday || 0,
            checkedIn: regStats.checkedIn || 0,
            categories: stats.categories || [],
            categoriesDetailed: stats.categoriesDetailed || regStats.categoriesDetailed || [],
            resourcesDistributed: stats.resourcesDistributed || stats.resources || { food: 0, kits: 0, certificates: 0 },
            abstractsSubmitted: stats.abstractsSubmitted || 0,
            abstractsApproved: stats.abstractsApproved || 0
          });
        } else {
          console.warn('Statistics data not in expected format:', statsResponse);
          setStatistics({
            totalRegistrations: { total: 0, checkedIn: 0 },
            registrationsToday: 0,
            checkedIn: 0,
            categories: [],
            resourcesDistributed: { food: 0, kits: 0, certificates: 0 },
            abstractsSubmitted: 0,
            abstractsApproved: 0
          });
        }
      } catch (statsError) {
        console.error('Error loading statistics:', statsError);
        // Use default values if statistics fail to load
        setStatistics({
          totalRegistrations: { total: 0, checkedIn: 0 },
          registrationsToday: 0,
          checkedIn: 0,
          categories: [],
          resourcesDistributed: { food: 0, kits: 0, certificates: 0 },
          abstractsSubmitted: 0,
          abstractsApproved: 0
        });
      }
      
      try {
        const dashboardResponse = await eventService.getEventDashboard(id);
        
        if (dashboardResponse && dashboardResponse.success) {
          setActivities(dashboardResponse.data.recentActivities || []);
        } else {
          console.warn('Dashboard data not in expected format:', dashboardResponse);
          setActivities([]);
        }
      } catch (dashboardError) {
        console.error('Error loading dashboard:', dashboardError);
        setActivities([]);
      }
      
      // --- Fetch dashboard-specific stats for Abstracts and Resources ---
      setDashboardStatsLoading(true);
      setDashboardStatsError(null);
      try {
        // Abstracts
        const absStatsResp = await import('../../services/abstractService').then(m => m.default.getAbstractStatistics(id));
        if (absStatsResp && absStatsResp.success && absStatsResp.data) {
          const absData = absStatsResp.data;
          setDashboardAbstractStats({
            total: absData.totalAbstracts || 0,
            approved: absData.byStatus?.approved || 0,
            underReview: (absData.byStatus?.['under-review'] || 0) + (absData.byStatus?.pending || 0)
          });
        } else {
          setDashboardAbstractStats({ total: 0, approved: 0, underReview: 0 });
        }
        // Resources
        const [foodStats, kitStats, certStats, certPrintStats] = await Promise.all([
          import('../../services/eventService').then(m => m.default.getResourceTypeStatistics(id, 'food')),
          import('../../services/eventService').then(m => m.default.getResourceTypeStatistics(id, 'kitBag')),
          import('../../services/eventService').then(m => m.default.getResourceTypeStatistics(id, 'certificate')),
          import('../../services/eventService').then(m => m.default.getResourceTypeStatistics(id, 'certificatePrinting')),
        ]);
        setDashboardResourceStats({
          food: foodStats?.totalIssued || 0,
          kits: kitStats?.totalIssued || 0,
          certificates: certStats?.totalIssued || 0,
          certificatePrinting: certPrintStats?.totalIssued || 0
        });
      } catch (err) {
        setDashboardStatsError('Failed to load dashboard resource/abstract stats: ' + (err.message || err.toString()));
        setDashboardAbstractStats({ total: 0, approved: 0, underReview: 0 });
        setDashboardResourceStats({ food: 0, kits: 0, certificates: 0, certificatePrinting: 0 });
      } finally {
        setDashboardStatsLoading(false);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error in loadEventData:', err);
      setError(err.message || 'Failed to load event data');
      setLoading(false);
    }
  };
  
  // Log formChanged state changes
  useEffect(() => {
    console.log('Form changed state updated:', formChanged);
  }, [formChanged]);
  
  // Get status badge variant
  const getStatusBadgeVariant = (status) => {
    if (!status) return 'secondary';
    
    switch (status.toLowerCase()) {
      case 'draft':
        return 'info';
      case 'published':
        return 'success';
      case 'active':
        return 'success';
      case 'completed':
        return 'primary';
      case 'archived':
        return 'warning';
      default:
        return 'secondary';
    }
  };
  
  // Get activity icon
  const getActivityIcon = (type) => {
    if (!type) return <div className="h-5 w-5" />;
    
    switch (type.toLowerCase()) {
      case 'registration':
        return <UserPlusIcon className="h-5 w-5" />;
      case 'abstract':
        return <DocumentTextIcon className="h-5 w-5" />;
      case 'category':
        return <TagIcon className="h-5 w-5" />;
      case 'resource':
        return <CubeIcon className="h-5 w-5" />;
      default:
        return <div className="h-5 w-5" />;
    }
  };

  // Navigate to event section
  const navigateToSection = (sectionPath) => {
    // Only reset categories key if we're explicitly requesting a categories refresh
    // For example, after a category has been added or edited
    if (sectionPath === 'categories/refresh') {
      setCategoriesKey(Date.now());
      sectionPath = 'categories'; // Set to the normal tab path after handling special action
    }
    
    // Define sections that should be handled as external routes
    const externalRoutes = [
      'registrations/new',
      'registrations/bulk-import',
      'resources/scanner'
    ];
    
    // If this is an external route that needs full navigation
    if (externalRoutes.includes(sectionPath)) {
      navigate(`/events/${id}/${sectionPath}`);
      return;
    }
    
    // If the path indicates a resource sub-tab, 
    // ensure the main 'resources' tab is active, but DO NOT navigate.
    // The ResourcesTab component itself handles the sub-path internally.
    if (sectionPath.startsWith('resources/')) {
      if (activeTab !== 'resources') {
      setActiveTab('resources');
      }
      // We don't navigate here because ResourcesTab handles its own URL updates.
      // The URL change will trigger the useEffect in ResourcesTab to set its internal active state.
      return;
    }
    
    // For other paths with slashes (e.g., settings sub-tabs), update the tab and pass state
    if (sectionPath.includes('/')) {
      const [mainSection, action] = sectionPath.split('/');
      
      // Update the active tab to the main section
      if (eventNavItems.some(item => item.id === mainSection)) {
        setActiveTab(mainSection);
      }
      
      // Update URL without forcing navigation - usually for sub-sections within a main tab
      navigate(`/events/${id}/${mainSection}`, { 
        replace: true,
        state: { subSection: action }
      });
      return;
    }
    
    // For regular tabs, update the active tab
    const tabId = typeof sectionPath === 'number' 
      ? (tabIndexToId[sectionPath] || 'dashboard')
      : sectionPath;
    
    if (activeTab !== tabId) { 
    setActiveTab(tabId);
    }

    // Update the URL to reflect the main tab, but stay within the event portal
    // Use the sectionPath (which is the tabId here) in the URL
    navigate(`/events/${id}/${tabId}`, { 
      replace: true
    });
    
    // Store the selected tab in local storage
    localStorage.setItem(`event_${id}_active_tab`, tabId);
  };
  
  // Handle sections that require navigation to another page
  const handleSectionNavigation = (section) => {
    setActiveTab(section);
    localStorage.setItem(`event_${id}_active_tab`, section);
    
    // Handle navigation to different sections based on the section ID
    if (section === 'registrations') {
      navigate(`/events/${id}/registrations`);
    } else if (section === 'categories') {
      navigate(`/events/${id}/categories`);  
    } else if (section === 'resources') {
      navigate(`/events/${id}/resources`);
    } else if (section === 'abstracts') {
      navigate(`/events/${id}/abstracts`);
    } else if (section === 'badges') {
      navigate(`/events/${id}/badges`);
    } else if (section === 'landing-pages') {
      navigate(`/events/${id}/landing-pages`);
    } else if (section === 'emails') {
      // For emails, we'll stay on the portal page but show the emails tab
      setActiveTab('emails');
    } else if (section === 'reports') {
      navigate(`/events/${id}/reports`);
    } else if (section === 'settings') {
      setActiveTab('settings');
    } else if (section === 'authors') {
      navigate(`/events/${id}/authors`);
    } else {
      // For other sections, just stay on the portal and show the appropriate tab
      setActiveTab(section);
    }
  };

  // Handle external portal link copying
  const copyToClipboard = (link) => {
    if (!link) return;
    
    try {
    navigator.clipboard.writeText(link);
    // Here you would typically show a toast notification
    alert(`Link copied to clipboard: ${link}`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy link to clipboard');
    }
  };
  
  // The tab content - render all tabs but only show the active one
  const renderAllTabContents = () => {
    // Check for scanner route first
    const scannerPathRegex = /^\/events\/([^\/]+)\/resources\/scanner\/([^\/]+)$/;
    const scannerMatch = location.pathname.match(scannerPathRegex);

    if (scannerMatch && scannerMatch[1] === id) { // Ensure it's for the current event
      const scanType = scannerMatch[2];
      // Potentially pass scanType to ScannerStation if it needs it, or ScannerStation can get it from URL
      return (
        <TabErrorBoundary tabName="Scanner Station">
          <ScannerStation eventId={id} />
        </TabErrorBoundary>
      );
    }

    // First check if we have any error or loading state
    if (error) {
      return (
        <div className="p-8">
          <Alert variant="danger" title="Error Loading Event" description={error} />
        </div>
      );
    }
    
    if (loading || !event) {
      return (
        <div className="flex justify-center items-center p-12">
          <Spinner size="lg" />
        </div>
      );
    }
    
    // Check for abstract detail view
    const abstractDetailPathRegex = /^\/events\/[^\/]+\/abstracts\/([^\/]+)$/;
    const pathMatch = location.pathname.match(abstractDetailPathRegex);

    if (activeTab === "abstracts" && pathMatch && pathMatch[1]) {
      const abstractIdFromUrl = pathMatch[1];
      return (
        <TabErrorBoundary tabName="Abstract Detail">
          <AbstractDetail eventId={id} abstractId={abstractIdFromUrl} />
        </TabErrorBoundary>
      );
    }
    
    let activeTabContent = null;

    // Determine the content based on the activeTab state
    // Note: The TabErrorBoundary wraps the content for each case
    switch (activeTab) {
      case "dashboard":
        activeTabContent = <TabErrorBoundary tabName="Dashboard">{renderDashboard()}</TabErrorBoundary>;
        break;
      case "registrations":
        // Check for /registrations/new, /registrations/:regId, /registrations/:regId/edit
        // This logic should ideally be handled by React Router's <Outlet /> within a layout route for registrations
        // For now, keeping it simple here, but this can become complex.
        activeTabContent = <TabErrorBoundary tabName="Registrations"><RegistrationsTab eventId={id} /></TabErrorBoundary>; 
        break;
      case "sponsors":

  // Add support for edit route
  const sponsorEditMatch = location.pathname.match(/^\/events\/([^/]+)\/sponsors\/([^/]+)\/edit$/);
  if (sponsorEditMatch && sponsorEditMatch[1] === id) {
    activeTabContent = <SponsorForm />;
  } else {
    activeTabContent = <TabErrorBoundary tabName="Sponsors"><SponsorsList event={event} /></TabErrorBoundary>;
  }
  
       break;
      case "categories":
        activeTabContent = <TabErrorBoundary tabName="Categories"><CategoriesTab eventId={id} key={categoriesKey} /></TabErrorBoundary>;
        break;
      case "resources":
        activeTabContent = <TabErrorBoundary tabName="Resources"><ResourcesTab eventId={id} onUpdated={() => setRenderKey(prev => prev + 1)} /></TabErrorBoundary>;
        break;
      case "abstracts":
        activeTabContent = <TabErrorBoundary tabName="Abstracts"><AbstractsTab event={event} /></TabErrorBoundary>;
        break;
      case "authors":
        activeTabContent = <TabErrorBoundary tabName="Authors"><AuthorsTab eventId={id} /></TabErrorBoundary>;
        break;
      case "badges":
        const pathSegments = location.pathname.split('/');
        if (pathSegments.length > 4 && pathSegments[3] === 'badges') {
          if (pathSegments[4] === 'designer') {
            activeTabContent = <TabErrorBoundary tabName="Badge Designer"><BadgeDesigner eventId={id} /></TabErrorBoundary>;
          } else if (pathSegments[4] === 'print') {
            activeTabContent = <TabErrorBoundary tabName="Badge Printing"><BadgePrintingPage eventId={id} /></TabErrorBoundary>;
          } else {
            activeTabContent = <TabErrorBoundary tabName="Badges"><BadgePrintingPage eventId={id} /></TabErrorBoundary>;
          }
        } else {
          activeTabContent = <TabErrorBoundary tabName="Badges"><BadgePrintingPage eventId={id} /></TabErrorBoundary>;
        }
        break;
      case "announcements":
        activeTabContent = <TabErrorBoundary tabName="Announcements"><AnnouncementsTab eventId={id} /></TabErrorBoundary>;
        break;
      case "landing-pages":
        activeTabContent = (
          <TabErrorBoundary tabName="Landing Pages">
            <LandingPagesManager eventId={id} />
          </TabErrorBoundary>
        );
        break;
      case "emails":
         activeTabContent = <TabErrorBoundary tabName="Emails"><EmailsTabWrapper event={event} /></TabErrorBoundary>;
         break;
      case "reports":
        activeTabContent = <TabErrorBoundary tabName="Reports"><ReportsTab eventId={id} /></TabErrorBoundary>;
        break;
      case "user-management":
        activeTabContent = (
          <TabErrorBoundary tabName="User Management">
            <EventUserManagementTab eventId={id} />
          </TabErrorBoundary>
        );
        break;
      case "client":
        activeTabContent = (
          <TabErrorBoundary tabName="Client">
            <EventClientTab eventId={id} />
          </TabErrorBoundary>
        );
        break;
      case "settings":
        activeTabContent = (
          <TabErrorBoundary tabName="Settings">
            <div className="p-2">
              {/* Tabs for different settings categories */}
              <Tabs
                tabs={[
                  { label: "General", component: GeneralTab, icon: <Cog6ToothIcon className="w-5 h-5 mr-2" /> },
                  { label: "Registration", component: RegistrationTab, icon: <UserPlusIcon className="w-5 h-5 mr-2" /> },
                  // { label: "Sponsors", component: SponsorsSettingsTab, icon: <BookmarkIcon className="w-5 h-5 mr-2" /> }, // Removed Sponsors
                  { label: "Badges", component: BadgesTab, icon: <CheckBadgeIcon className="w-5 h-5 mr-2" /> },
                  { label: "Email", component: EmailTab, icon: <EnvelopeIcon className="w-5 h-5 mr-2" /> },
                  { label: "Payment", component: PaymentTab, icon: <ChartPieIcon className="w-5 h-5 mr-2" /> },
                  { label: "Resources", component: ResourcesSettingsTab, icon: <CubeIcon className="w-5 h-5 mr-2" /> },
                  { label: "Abstracts", component: AbstractsSettingsTab, icon: <DocumentTextIcon className="w-5 h-5 mr-2" /> },
                  { label: "Schedule", component: ScheduleTab, icon: <CalendarIcon className="w-5 h-5 mr-2" /> },
                ]}
                activeTab={activeSettingsTab}
                onChange={setActiveSettingsTab}
              />
              <div className="mt-4">
                {(() => {
                  switch (activeSettingsTab) {
                    case 0: // General
                      return <GeneralTab event={event} setEvent={updateEvent} setFormChanged={setFormChanged} id={id} />;
                    case 1: // Registration
                      return <RegistrationTab event={event} setEvent={updateEvent} setFormChanged={setFormChanged} id={id} />;
                    // Case 2 (Sponsors) removed
                    case 2: // Badges (was 3)
                      return <BadgesTab event={event} setEvent={updateEvent} setFormChanged={setFormChanged} id={id} />;
                    case 3: // Email (was 4)
                      return <EmailTab event={event} eventId={id} setEvent={updateEvent} setFormChanged={setFormChanged} />;
                    case 4: // Payment (was 5)
                      return <PaymentTab event={event} setEvent={updateEvent} setFormChanged={setFormChanged} />;
                    case 5: // Resources (was 6)
                      return <ResourcesSettingsTab event={event} setEvent={updateEvent} setFormChanged={setFormChanged} />;
                    case 6: // Abstracts (was 7)
                      return <AbstractsSettingsTab event={event} setEvent={updateEvent} setFormChanged={setFormChanged} updateAbstractSettings={updateAbstractSettings} />;
                    case 7: // Schedule (was 8)
                      return <ScheduleTab event={event} setEvent={updateEvent} setFormChanged={setFormChanged} />;
                    default:
                      return <div>Select a settings category.</div>;
                  }
                })()}
              </div>
              
              {/* Add this at the bottom - Restoring Save/Cancel buttons */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                {/* Save/Cancel buttons */}
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="light"
                    onClick={() => {
                      // Reset by fetching the event data again
                      loadEventData(); // Make sure loadEventData is defined and accessible
                      setFormChanged(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!formChanged || loading} // Disable if not changed or if loading
                    onClick={async () => {
                      try {
                        console.log("Saving event settings...");
                        setLoading(true); // Indicate loading state
                        // Ensure eventService.updateEvent is correctly defined and imported
                        await eventService.updateEvent(id, event); 
                        setFormChanged(false);
                        // Optionally, trigger a full portal refresh or just show success
                        // await handleRefresh(); // If you want to refresh everything
                        console.log("Event settings saved successfully");
                         // Consider adding a success toast notification here
                      } catch (err) {
                        console.error("Error saving event settings:", err);
                        // Consider adding an error toast notification here
                      } finally {
                        setLoading(false); // End loading state
                      }
                    }}
                  >
                    {loading ? <Spinner size="sm" /> : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </TabErrorBoundary>
        );
        break;
      default:
        activeTabContent = <div>Tab content not found for '{activeTab}'</div>;
    }

    // Render AnimatePresence with only ONE direct child: the motion.div
    // keyed by the activeTab state AND the full path to ensure re-renders on sub-path changes
    return (
                <AnimatePresence mode="wait">
                    <motion.div
          key={`${activeTab}-${location.pathname}`} // Change key to include pathname
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
                    >
          {activeTabContent} 
                    </motion.div>
      </AnimatePresence>
    );
  };
  
  // Dashboard tab content
  const renderDashboard = () => {
    try {
      return (
        <div className="space-y-6">
          {/* Quick Actions Section */}
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center"
                  leftIcon={<UserPlusIcon className="h-5 w-5" />}
                  onClick={() => navigateToSection('registrations/new')}
                >
                  New Registration
                </Button>
              </div>
              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center"
                  leftIcon={<DocumentDuplicateIcon className="h-5 w-5" />}
                  onClick={() => navigateToSection('registrations/bulk-import')}
                >
                  Import Registrations
                </Button>
              </div>
              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center"
                  leftIcon={<CheckBadgeIcon className="h-5 w-5" />}
                  onClick={() => navigate(`/events/${id}/resources/scanner/food`)}
                >
                  Scanner Station
                </Button>
              </div>
              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center"
                  leftIcon={<ChartPieIcon className="h-5 w-5" />}
                  onClick={() => navigateToSection('reports')}
                >
                  Reports
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Registrations Card */}
            <Card className="h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Registrations</h3>
                <a href="#" onClick={(e) => { e.preventDefault(); navigateToSection('registrations'); }} className="text-sm text-primary-600 hover:underline">View All</a>
              </div>
              <div className="flex flex-col items-center justify-center py-6">
                <h2 className="text-4xl font-bold">
                  {typeof statistics?.totalRegistrations === 'object' 
                    ? (statistics?.totalRegistrations?.total || 0) 
                    : (statistics?.totalRegistrations || 0)}
                </h2>
                <p className="text-sm text-gray-500">Total Registrations</p>
                
                {statistics?.registrationsToday > 0 && (
                  <div className="mt-2 bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                    +{statistics.registrationsToday} Today
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="primary"
                  size="sm"
                  onClick={() => navigateToSection('registrations/new')}
                >
                  New Registration
                </Button>
              </div>
            </Card>
            
            {/* Abstracts Card */}
            <Card className="h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Abstracts</h3>
                <a href="#" onClick={(e) => { e.preventDefault(); navigateToSection('abstracts'); }} className="text-sm text-primary-600 hover:underline">View All</a>
              </div>
              <div className="flex flex-col items-center justify-center py-6">
                {dashboardStatsLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : dashboardStatsError ? (
                  <span className="text-red-500 text-xs">{dashboardStatsError}</span>
                ) : (
                  <h2 className="text-4xl font-bold">{dashboardAbstractStats.total}</h2>
                )}
                <p className="text-sm text-gray-500">Total Submissions</p>
              </div>
              <div className="mt-2 flex justify-center gap-4">
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                  <span className="text-xs">Approved: {dashboardAbstractStats.approved}</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                  <span className="text-xs">Under Review: {dashboardAbstractStats.underReview}</span>
                </div>
              </div>
            </Card>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Resources Card */}
            <Card className="h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Resources</h3>
                <a href="#" onClick={(e) => { e.preventDefault(); navigateToSection('resources'); }} className="text-sm text-primary-600 hover:underline">View All</a>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center py-4">
                {dashboardStatsLoading ? (
                  <span className="col-span-4 text-gray-400">Loading...</span>
                ) : dashboardStatsError ? (
                  <span className="col-span-4 text-red-500 text-xs">{dashboardStatsError}</span>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xl font-bold">{dashboardResourceStats.food}</h3>
                      <p className="text-xs text-gray-500">Food</p>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{dashboardResourceStats.kits}</h3>
                      <p className="text-xs text-gray-500">Kit Bags</p>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{dashboardResourceStats.certificates}</h3>
                      <p className="text-xs text-gray-500">Certificates Issued</p>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{dashboardResourceStats.certificatePrinting}</h3>
                      <p className="text-xs text-gray-500">Certificates Printed</p>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  leftIcon={<QrCodeIcon className="h-4 w-4" />}
                  onClick={() => navigate(`/events/${id}/resources/scanner/food`)}
                >
                  Scan
                </Button>
              </div>
            </Card>
            
            {/* Categories Card */}
            <Card className="h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Categories</h3>
                <a href="#" onClick={(e) => { e.preventDefault(); navigateToSection('categories'); }} className="text-sm text-primary-600 hover:underline">View All</a>
              </div>
              {statistics?.categories && statistics.categories.length > 0 ? (
                <div className="space-y-2 py-2">
                  {statistics.categories.map((category, index) => (
                    <div key={category.id || index} className="flex justify-between items-center">
                      <span>{category.name}</span>
                      <span className="font-medium">{category.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No categories found</p>
                </div>
              )}
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="primary"
                  size="lg"
                  onClick={() => navigateToSection('categories')}
                >
                  Manage Categories
                </Button>
              </div>
            </Card>
          </div>
          
          {/* --- Registration / Badge Progress Card --- */}
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <h3 className="text-lg font-medium mb-4">Registration Progress</h3>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Check-ins</h4>
                  <div className="text-3xl font-bold">{statistics?.totalRegistrations?.checkedIn || 0}</div>
                  <p className="text-xs text-gray-500">Done / Total: {statistics?.totalRegistrations?.checkedIn || 0} / {statistics?.totalRegistrations?.total || 0}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Badges Printed</h4>
                  <div className="text-3xl font-bold">{statistics?.totalRegistrations?.printed || 0}</div>
                  <p className="text-xs text-gray-500">Printed / Total: {statistics?.totalRegistrations?.printed || 0} / {statistics?.totalRegistrations?.total || 0}</p>
                </div>
              </div>

              {/* Category table */}
              {(() => {
                const catRows = (statistics.categoriesDetailed && statistics.categoriesDetailed.length)
                  ? statistics.categoriesDetailed
                  : (statistics.categories || []).map(c => ({ name: c.name, count: c.count, checkedIn: c.checkedIn || 0, printed: c.printed || 0 }));

                if (!catRows.length) return (<p className="text-xs text-gray-500 italic">No data</p>);

                return (
                  <>
                    <div className="grid grid-cols-4 gap-2 font-medium mb-1">
                      <span>Category</span>
                      <span className="text-center">Checked-in</span>
                      <span className="text-center">Printed</span>
                      <span className="text-right">Total</span>
                    </div>

                    {catRows.map((cat, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2 items-center text-sm">
                        <span className="truncate" title={cat.name}>{cat.name}</span>
                        <span className="text-center text-green-600">{cat.checkedIn}</span>
                        <span className="text-center text-blue-600">{cat.printed}</span>
                        <span className="text-right">{cat.count}</span>
                      </div>
                    ))}

                    <div className="grid grid-cols-4 gap-2 font-medium border-t pt-1 mt-1">
                      <span>Total</span>
                      <span className="text-center text-green-600">{statistics.totalRegistrations.checkedIn}</span>
                      <span className="text-center text-blue-600">{statistics.totalRegistrations.printed}</span>
                      <span className="text-right">{statistics.totalRegistrations.total}</span>
                    </div>
                  </>
                );
              })()}
            </Card>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {/* Event Details Card */}
            <Card>
              <h3 className="text-lg font-medium mb-4">Event Details</h3>
              <p>{event.description || 'Join us for the biggest tech conference of the year featuring leading experts and cutting-edge innovations.'}</p>
              
              <div className="grid grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Registration ID Format</h4>
                  <p>{event.registrationSettings?.idPrefix || 'TEC2023'}-XXXX</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Current Sequence</h4>
                  <p>{typeof statistics?.totalRegistrations === 'object' 
                      ? (statistics?.totalRegistrations?.total || 0) 
                      : (statistics?.totalRegistrations || 0)}</p>
                </div>
              </div>
            </Card>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {/* External Portals Card */}
            <Card>
              <h3 className="text-lg font-medium mb-4">External Portals</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Registration Portal</label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/portal/register/${id}`}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${window.location.origin}/portal/register/${id}`)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 text-gray-700 sm:text-sm"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Registrant Portal</label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/registrant-portal?event=${id}`}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${window.location.origin}/registrant-portal?event=${id}`)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 text-gray-700 sm:text-sm"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Abstract Portal</label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/portal/abstract/${id}?event=${id}`}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${window.location.origin}/portal/abstract/${id}?event=${id}`)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 text-gray-700 sm:text-sm"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Reviewer Portal</label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/portal/reviewer/${id}?event=${id}`}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${window.location.origin}/portal/reviewer/${id}?event=${id}`)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 text-gray-700 sm:text-sm"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Sponsor Portal</label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/portal/sponsor-login/${id}`}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${window.location.origin}/portal/sponsor-login/${id}`)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 text-gray-700 sm:text-sm"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Client Portal</label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/portal/client-login/${id}`}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${window.location.origin}/portal/client-login/${id}`)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 text-gray-700 sm:text-sm"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

              </div>
              
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-2">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    leftIcon={<DocumentDuplicateIcon className="h-4 w-4" />}
                    onClick={() => navigateToSection('registrations/bulk-import')}
                  >
                    Import
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    leftIcon={<CheckBadgeIcon className="h-4 w-4" />}
                    onClick={() => navigate(`/events/${id}/resources/scanner/food`)}
                  >
                    Scan
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    leftIcon={<TagIcon className="h-4 w-4" />}
                    onClick={() => navigateToSection('badges')}
                  >
                    Badges
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    leftIcon={<ChartBarIcon className="h-4 w-4" />}
                    onClick={() => navigateToSection('reports')}
                  >
                    Reports
                  </Button>
                </div>
              </div>
            </Card>
            
            {/* Recent Activity Card */}
            <Card>
              <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
              
              {activities && activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity, index) => (
                    <div 
                      key={activity?._id || index}
                      className="flex items-start space-x-3 py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="h-6 w-6 flex-shrink-0 flex items-center justify-center">
                        {getActivityIcon(activity?.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{activity?.details || activity?.description || 'Activity logged'}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDateTimeRelative(activity?.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No recent activities</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error rendering dashboard:', error);
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-700 mb-2">Error Rendering Dashboard</h3>
          <p className="text-red-600 mb-4">{error.message}</p>
          <pre className="text-xs text-red-500 bg-red-50 p-2 rounded overflow-auto mt-2">
            {error.stack}
          </pre>
          <Button variant="primary" onClick={handleRefresh} className="mt-4">
            Try Again
          </Button>
        </div>
      );
    }
  };
  
  // Simple EmailsTab wrapper component
  const EmailsTabWrapper = ({ event }) => {
    return <EmailsTab eventId={id} event={event} />;
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-700">Error Loading Event</h2>
          <p className="text-red-600 mb-4">{error}</p>
          {isDevelopment && (
            <div className="mt-4 text-left bg-gray-800 text-white p-4 rounded overflow-auto max-h-64">
              <h3 className="text-sm font-mono mb-2">Debug Information:</h3>
              <p className="text-xs font-mono whitespace-pre-wrap">
                Event ID: {id}
                <br />
                Request URL: {`${import.meta.env.VITE_API_URL || '/api'}/events/${id}`}
              </p>
            </div>
          )}
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => navigate('/events')}
          >
            Back to Events List
          </Button>
        </div>
      </div>
    );
  }
  
  // If event data is missing, show error
  if (!event) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert 
          variant="error" 
          title="Event Not Found" 
          description="The requested event could not be found or loaded." 
        />
        <div className="mt-4">
          <Link to="/events">
            <Button variant="primary">
              Back to Events
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Event header */}
      <div className="mb-6 flex flex-row justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-900 mr-3">{event?.name || 'Event Details'}</h1>
          <Badge variant={getStatusBadgeVariant(event?.status)} className="ml-2">
            {event?.status || 'Status Unknown'}
          </Badge>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/events/${id}/edit`)}
          >
            Edit Event
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/events')}
          >
            Back to Events
          </Button>
        </div>
      </div>
      
      <p className="text-sm text-gray-500 mb-6">
        {formatDate(event?.startDate)} - {formatDate(event?.endDate)} | {event?.venue?.name || event?.location || 'No location specified'}
      </p>
      
      {/* Event navigation tabs - simplified horizontal style */}
      <div className="mb-8 border-b border-gray-200">
        <div className="flex space-x-1 overflow-x-auto">
          {eventNavItems.map(item => (
            <button
              key={item.id}
              className={`py-3 px-4 flex items-center text-sm font-medium ${
                activeTab === item.id
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={(e) => {
                e.preventDefault(); // Prevent default navigation behavior
                navigateToSection(item.id);
              }}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* The tab content */}
      <div>
        {renderAllTabContents()}
      </div>
    </div>
  );
}

export default EventPortal; 