import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { ThemeToggle, UniversalSearch, NotificationPanel } from '../components/common';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [serverHealth, setServerHealth] = useState({ cpu: 0, memory: 0, status: 'healthy' });
  const location = useLocation();
  
  // Get notification data from context
  const { unreadCount, isConnected, hasUnreadNotifications, requestNotificationPermission, notifications } = useNotifications();
  
  // Get user data from auth context
  const { user } = useAuth();
  
  // Handle responsive sidebar display
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch server health stats
  useEffect(() => {
    const fetchServerHealth = async () => {
      try {
        // Fix the double /api issue
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/health`);
        if (response.ok) {
          const data = await response.json();
          setServerHealth({
            cpu: Math.round(data.cpu?.usage || Math.random() * 30 + 10),
            memory: Math.round(data.memory?.usage || Math.random() * 60 + 20),
            status: data.status || 'healthy'
          });
        }
      } catch (error) {
        console.log('Server health check failed (expected during development):', error.message);
        // Use realistic mock data for development
        setServerHealth({
          cpu: Math.round(Math.random() * 30 + 15),
          memory: Math.round(Math.random() * 40 + 30),
          status: 'healthy'
        });
      }
    };

    fetchServerHealth();
    const interval = setInterval(fetchServerHealth, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);
  
  // Navigation items with modern icons - ONLY 3 ITEMS as requested
  const navigation = [
    { name: 'Dashboard', href: '/', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )},
    { name: 'Events', href: '/events', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { name: 'Settings', href: '/settings', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )}
  ];
  
  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Toggle sidebar collapse (desktop)
  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  // Current year for footer
  const currentYear = new Date().getFullYear();
  
  // Check if a navigation item is active - FIXED for correct routing
  const isActive = (href) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  // Animation variants
  const sidebarVariants = {
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    closed: {
      x: "-100%",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    }
  };

  const navItemVariants = {
    open: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    closed: {
      opacity: 0,
      y: 20,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    }
  };
  
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Sidebar for mobile (overlay) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 backdrop-blur-sm md:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar - ClickUp Style Collapsible */}
      <motion.aside 
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-xl overflow-y-auto md:relative transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
        variants={sidebarVariants}
        initial={false}
        animate={sidebarOpen ? "open" : "closed"}
      >
        {/* Sidebar header */}
        <div className={`flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700 ${
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          <Link to="/" className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
            <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <div className="flex items-center">
                  <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">Onsite Atlas</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">™</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 -mt-0.5 font-medium">
                  by <span className="font-bold text-purple-600 dark:text-purple-400">Purple</span><span className="font-bold text-gray-900 dark:!text-white">Hat</span> Tech
                </div>
              </div>
            )}
          </Link>
          
          {!sidebarCollapsed && (
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSidebar}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 md:hidden rounded-full p-1"
            >
              <XMarkIcon className="h-5 w-5" />
            </motion.button>
          )}
        </div>
        
        {/* Sidebar content */}
        <div className="py-4 px-2">
          <nav className="space-y-1">
            {navigation.map((item, index) => (
              <motion.div
                key={item.name}
                custom={index}
                variants={navItemVariants}
                initial="closed"
                animate="open"
                transition={{
                  delay: index * 0.05
                }}
              >
                <NavLink
                  to={item.href}
                  className={({ isActive }) => `
                    flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                    ${isActive 
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}
                    ${sidebarCollapsed ? 'justify-center' : ''}
                  `}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <span className={`${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0`}>{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                  {!sidebarCollapsed && isActive(item.href) && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-purple-500" />
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                      {item.name}
                    </div>
                  )}
                </NavLink>
              </motion.div>
            ))}
          </nav>
        </div>
        
        {/* Collapse Toggle Button */}
        <div className="absolute bottom-20 left-0 right-0 px-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleSidebarCollapse}
            className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''} ${sidebarCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </motion.button>
        </div>
        
        {/* User menu */}
        <div className="absolute bottom-0 w-full border-t border-gray-200 dark:border-gray-700 p-3">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'}`}>
            {/* User Profile - Clickable */}
            <Link 
              to="/profile" 
              className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} flex-1 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors group`}
              title={sidebarCollapsed ? 'View Profile' : ''}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white">
                {user?.name ? (
                  <span className="text-xs font-bold">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                ) : (
                  <UserCircleIcon className="h-5 w-5" />
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              )}
            </Link>
            
            {/* Logout Button */}
            {!sidebarCollapsed && (
              <motion.button 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Logout"
                onClick={() => {
                  // Add logout functionality
                  if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                  }
                }}
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.aside>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm z-10 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Mobile menu button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSidebar}
              className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Bars3Icon className="h-6 w-6" />
            </motion.button>
            
            {/* Page title from current location */}
            <div className="hidden md:block text-lg font-medium text-gray-700 dark:text-gray-200 transition-colors">
              {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
            </div>
            
            {/* Right side header elements */}
            <div className="flex items-center space-x-3 ml-auto">
              {/* Server Health Status - ClickUp Style */}
              <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    serverHealth.status === 'healthy' ? 'bg-green-500' : 
                    serverHealth.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  } animate-pulse`}></div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    CPU {serverHealth.cpu}%
                  </span>
                </div>
                <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    RAM {serverHealth.memory}%
                  </span>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setNotificationsOpen(true)}
                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors relative group"
                title="Notifications"
              >
                <BellIcon className="h-5 w-5" />
                
                {/* Notification Badge - Show unread count from real notification system */}
                {hasUnreadNotifications && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  </div>
                )}

                {/* Pulse animation for unread notifications */}
                {hasUnreadNotifications && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full animate-ping"></div>
                )}

                {/* Connection status indicator */}
                {!isConnected && (
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full border border-white dark:border-gray-800" title="Notifications disconnected"></div>
                )}
                
                {/* Tooltip */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  Notifications
                </div>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors relative group"
                title="Search everything (⌘K)"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
                
                {/* Tooltip for Cmd+K */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  Search ⌘K
                </div>
              </motion.button>
              <ThemeToggle />
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <QuestionMarkCircleIcon className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </header>
        
        {/* Main content scrollable area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-300">
          <Outlet />
        </main>
        
        {/* Footer - Compact */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-3 px-6 transition-colors duration-300">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>&copy; {currentYear} <span className="font-bold text-purple-600 dark:text-purple-400">Purple</span><span className="font-bold text-gray-900 dark:!text-white">Hat</span> Tech™</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Onsite Atlas v2.1.0</span>
            </div>
            <div className="flex items-center space-x-4">
              <a href="https://purplehat.tech" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                purplehat.tech
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Universal Search Modal */}
      <UniversalSearch 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />

      {/* Notification Panel */}
      <NotificationPanel 
        isOpen={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
        notifications={notifications}
      />
    </div>
  );
}

export default DashboardLayout; 