import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon,
  XMarkIcon,
  UserGroupIcon,
  CalendarIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  TagIcon,
  TrophyIcon,
  CurrencyDollarIcon,
  CogIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useActiveEvent } from '../../contexts/ActiveEventContext';
import debounce from 'lodash/debounce';

const UniversalSearch = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [allResults, setAllResults] = useState([]); // Store all results
  const [showingLimited, setShowingLimited] = useState(true); // Track if showing limited results
  const [recentSearches, setRecentSearches] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hoveredResult, setHoveredResult] = useState(null); // For hover preview
  const navigate = useNavigate();
  const activeEventContext = useActiveEvent();
  const activeEventId = activeEventContext?.activeEventId || null;
  const searchInputRef = useRef(null);

  // Search categories with ClickUp-inspired design
  const searchCategories = {
    registrations: { 
      icon: UserGroupIcon, 
      color: 'bg-blue-500', 
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      label: 'Registrations',
    },
    events: { 
      icon: CalendarIcon, 
      color: 'bg-green-500', 
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      label: 'Events',
    },
    abstracts: { 
      icon: DocumentTextIcon, 
      color: 'bg-purple-500', 
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      label: 'Abstracts',
    },
    emails: { 
      icon: EnvelopeIcon, 
      color: 'bg-pink-500', 
      textColor: 'text-pink-600',
      bgColor: 'bg-pink-50',
      label: 'Emails',
    },
    categories: { 
      icon: TagIcon, 
      color: 'bg-orange-500', 
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      label: 'Categories',
    },
    sponsors: { 
      icon: TrophyIcon, 
      color: 'bg-yellow-500', 
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      label: 'Sponsors',
    },
    payments: { 
      icon: CurrencyDollarIcon, 
      color: 'bg-cyan-500', 
      textColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      label: 'Payments',
    },
    settings: { 
      icon: CogIcon, 
      color: 'bg-gray-500', 
      textColor: 'text-gray-600',
      bgColor: 'bg-gray-50',
      label: 'Settings',
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchResults = await performGlobalSearch(searchQuery);
        setAllResults(searchResults);
        // Show first 10 results initially
        setResults(searchResults.slice(0, 10));
        setShowingLimited(searchResults.length > 10);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setAllResults([]);
        setShowingLimited(false);
      } finally {
        setLoading(false);
      }
    }, 300),
    [activeEventId]
  );

  // Perform the actual search (simplified version focusing on key entities)
  const performGlobalSearch = async (searchQuery) => {
    // Fix API URL - ensure no double /api/
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    // Remove trailing /api if present to avoid double /api/
    if (apiUrl.endsWith('/api')) {
      apiUrl = apiUrl.slice(0, -4);
    }
    
    const results = [];

    try {
      // PRIORITIZE REGISTRATIONS SEARCH FIRST - this is what users most commonly search for
      console.log('Searching for registrations with query:', searchQuery);
      
      // Get all events first to search registrations across them
      const allEventsResponse = await fetch(`${apiUrl}/api/events?limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (allEventsResponse.ok) {
        const allEventsData = await allEventsResponse.json();
        if (allEventsData.data) {
          // Search registrations in all events - PRIORITIZED
          const registrationPromises = allEventsData.data.map(async (event) => {
            try {
              // Try multiple API endpoints and search strategies
              console.log(`Searching registrations in event: ${event.name} (${event._id})`);
              
              // First try with search parameter
              let registrationsResponse = await fetch(`${apiUrl}/api/events/${event._id}/registrations?search=${encodeURIComponent(searchQuery)}&limit=50`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json'
                }
              });

              // If search parameter doesn't work, try getting all registrations and filter client-side
              if (!registrationsResponse.ok) {
                console.log(`Search parameter failed for event ${event.name}, trying to get all registrations...`);
                registrationsResponse = await fetch(`${apiUrl}/api/events/${event._id}/registrations?limit=200`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                  }
                });
              }

              if (registrationsResponse.ok) {
                const registrationsData = await registrationsResponse.json();
                console.log(`Registration data for event ${event.name}:`, registrationsData);
                
                let registrations = [];
                
                // Handle different API response structures
                if (registrationsData.data?.data && Array.isArray(registrationsData.data.data)) {
                  registrations = registrationsData.data.data;
                } else if (registrationsData.data && Array.isArray(registrationsData.data)) {
                  registrations = registrationsData.data;
                } else if (Array.isArray(registrationsData)) {
                  registrations = registrationsData;
                }

                // Client-side filtering if we got all registrations
                const filteredRegistrations = registrations.filter(item => {
                  const searchLower = searchQuery.toLowerCase();
                  const firstName = (item.firstName || item.personalInfo?.firstName || '').toLowerCase();
                  const lastName = (item.lastName || item.personalInfo?.lastName || '').toLowerCase();
                  const email = (item.email || item.personalInfo?.email || '').toLowerCase();
                  const registrationId = (item.registrationId || '').toLowerCase();
                  const fullName = `${firstName} ${lastName}`.trim();
                  
                  return firstName.includes(searchLower) || 
                         lastName.includes(searchLower) || 
                         fullName.includes(searchLower) ||
                         email.includes(searchLower) ||
                         registrationId.includes(searchLower);
                });

                console.log(`Found ${filteredRegistrations.length} matching registrations in event ${event.name}`);

                return filteredRegistrations.map(item => ({
                  ...item,
                  eventName: event.name,
                  eventId: event._id,
                  eventStartDate: event.startDate,
                  eventEndDate: event.endDate
                }));
              } else {
                console.warn(`Failed to fetch registrations for event ${event.name}: ${registrationsResponse.status}`);
              }
            } catch (error) {
              console.warn(`Failed to search registrations in event ${event.name}:`, error);
            }
            return [];
          });

          const allRegistrations = await Promise.all(registrationPromises);
          const flatRegistrations = allRegistrations.flat();
          
          console.log('Found registrations:', flatRegistrations.length);

          // Add registration results FIRST (prioritized)
          flatRegistrations.forEach(item => {
            // Safely extract registration information as strings
            const firstName = typeof item.firstName === 'string' ? item.firstName : 
                            (item.personalInfo?.firstName || '');
            const lastName = typeof item.lastName === 'string' ? item.lastName : 
                           (item.personalInfo?.lastName || '');
            const registrationId = typeof item.registrationId === 'string' ? item.registrationId : 'N/A';
            const email = typeof item.email === 'string' ? item.email : 
                         (item.personalInfo?.email || '');
            const status = typeof item.status === 'string' ? item.status : 'active';
            
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown User';
            
            results.push({
              id: item._id,
              type: 'registrations',
              title: fullName,
              subtitle: `Event: ${item.eventName}`,
              description: `${email} • Registration ID: ${registrationId} • Status: ${status}`,
              url: `/events/${item.eventId}/registrations`,
              registrationId: item._id, // Store registration ID for modal
              eventId: item.eventId,
              eventName: item.eventName,
              data: item,
              priority: 1 // Higher priority for registrations
            });
          });

          // Search events (secondary priority) - but only show if no registrations found
          if (flatRegistrations.length === 0) {
            console.log('No registrations found, searching events as fallback...');
            const eventsResponse = await fetch(`${apiUrl}/api/events?search=${encodeURIComponent(searchQuery)}&limit=5`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
              }
            });

            if (eventsResponse.ok) {
              const eventsData = await eventsResponse.json();
              if (eventsData.data) {
                eventsData.data.forEach(item => {
                  // Safely extract venue information as a string
                  let venueText = 'Event details';
                  if (item.venue) {
                    if (typeof item.venue === 'string') {
                      venueText = item.venue;
                    } else if (typeof item.venue === 'object') {
                      const venueParts = [];
                      if (item.venue.name) venueParts.push(item.venue.name);
                      if (item.venue.city) venueParts.push(item.venue.city);
                      if (item.venue.state) venueParts.push(item.venue.state);
                      venueText = venueParts.length > 0 ? venueParts.join(', ') : 'Event venue';
                    }
                  }

                  results.push({
                    id: item._id,
                    type: 'events',
                    title: item.name,
                    subtitle: `${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}`,
                    description: item.description || venueText,
                    url: `/events/${item._id}/registrations`,
                    eventId: item._id,
                    data: item,
                    priority: 2 // Lower priority for events
                  });
                });
              }
            }
          }
        }
      }

      // Sort by priority (registrations first) and then by relevance
      return results.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Secondary sort by title relevance (exact matches first)
        const aExact = a.title.toLowerCase().includes(searchQuery.toLowerCase());
        const bExact = b.title.toLowerCase().includes(searchQuery.toLowerCase());
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });

    } catch (error) {
      console.error('Global search error:', error);
      return [];
    }
  };

  // Safe string extraction helper function
  const safeStringValue = (value, fallback = '') => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return fallback;
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // Open search - this will be handled by parent component
          return;
        }
      }

      // Only handle these if search is open
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, results]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && isOpen) {
      const selectedElement = document.querySelector(`[data-result-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [selectedIndex, isOpen]);

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    debouncedSearch(value);
  };

  // Handle result click with enhanced navigation
  const handleResultClick = (result) => {
    // Add to recent searches
    const newRecentSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecentSearches);
    localStorage.setItem('universalSearchRecent', JSON.stringify(newRecentSearches));

    console.log('Clicked result:', result);

    // Enhanced navigation based on result type
    if (result.type === 'registrations' && result.registrationId) {
      // Navigate to registrations list and open specific registration modal
      const registrationUrl = `/events/${result.eventId}/registrations?viewRegistration=${result.registrationId}`;
      console.log('Navigating to registration:', registrationUrl);
      navigate(registrationUrl);
    } else if (result.type === 'events') {
      // Navigate to event's registrations list
      navigate(`/events/${result.eventId}/registrations`);
    } else {
      // Default navigation
      navigate(result.url);
    }
    handleClose();
  };

  // Handle close
  const handleClose = () => {
    setQuery('');
    setResults([]);
    setAllResults([]);
    setShowingLimited(true);
    setSelectedIndex(-1);
    setHoveredResult(null);
    onClose();
  };

  // Show all results
  const handleShowAllResults = () => {
    setResults(allResults);
    setShowingLimited(false);
  };

  // Load recent searches on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('universalSearchRecent');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Render grouped results by category with registrations prioritized
  const renderGroupedResults = () => {
    const groupedResults = results.reduce((acc, result, index) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push({ ...result, originalIndex: index });
      return acc;
    }, {});

    // Define priority order - registrations first
    const categoryOrder = ['registrations', 'events', 'abstracts', 'emails', 'categories', 'sponsors', 'payments', 'settings'];
    
    // Sort categories by priority
    const sortedEntries = Object.entries(groupedResults).sort(([typeA], [typeB]) => {
      const indexA = categoryOrder.indexOf(typeA);
      const indexB = categoryOrder.indexOf(typeB);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return sortedEntries.map(([type, typeResults]) => {
      const category = searchCategories[type];
      const IconComponent = category.icon;
      
      return (
        <div key={type} className="mb-6">
          {/* Enhanced Category Header */}
          <div className={`px-6 py-3 ${
            type === 'registrations' 
              ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500' 
              : 'bg-gray-50/30 dark:bg-gray-800/20'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${category.color} shadow-sm`}>
                  <IconComponent className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {category.label}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {typeResults.length} result{typeResults.length !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>
              {type === 'registrations' && (
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">
                    Click to view details
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Results for this category */}
          <div className="space-y-2 pt-2">
            {typeResults.map((result, localIndex) => {
              // Calculate the global index for this result in the displayed results array
              const globalIndex = results.findIndex(r => r.id === result.id && r.type === result.type);
              return renderResultItem(result, globalIndex >= 0 ? globalIndex : result.originalIndex);
            })}
          </div>
        </div>
      );
    });
  };

  // Enhanced result item with more detailed preview
  const renderResultItem = (result, index) => {
    const category = searchCategories[result.type];
    const isSelected = selectedIndex === index;
    const IconComponent = category.icon;

    return (
      <motion.div
        key={`${result.type}-${result.id}`}
        data-result-index={index}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (index % 5) * 0.05 }} // Stagger by position in group
        className={`
          p-4 cursor-pointer transition-all duration-200 rounded-xl mx-3 mb-2 group relative overflow-hidden
          ${isSelected 
            ? 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-600 shadow-lg scale-[1.02]' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-md border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
          }
        `}
        onClick={() => handleResultClick(result)}
        onMouseEnter={() => setSelectedIndex(index)}
      >
        {/* Subtle background gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        <div className="flex items-start space-x-4 relative z-10">
          <div className={`
            flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${category.color}
            shadow-sm group-hover:shadow-md transition-all duration-200 group-hover:scale-110
          `}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                {typeof result.title === 'string' ? result.title : 'Untitled'}
              </h4>
              <span className={`
                px-2 py-0.5 text-xs font-medium rounded-full ${category.bgColor} ${category.textColor}
                group-hover:shadow-sm transition-shadow
              `}>
                {category.label}
              </span>
              {result.type === 'registrations' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  ID: {result.data?.registrationId || 'N/A'}
                </span>
              )}
            </div>
            
            {result.type === 'registrations' ? (
              <>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                  📅 {result.eventName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  ✉️ {typeof result.description === 'string' ? result.description.split(' • ')[0] : 'No email available'}
                </p>
                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>📋 Registration ID: {result.data?.registrationId || 'N/A'}</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    result.data?.status === 'confirmed' 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      : result.data?.status === 'pending'
                      ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                      : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  }`}>
                    {result.data?.status || 'Active'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1 font-medium">
                  {typeof result.subtitle === 'string' ? result.subtitle : ''}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {typeof result.description === 'string' ? result.description : 'No description available'}
                </p>
              </>
            )}
            
            {/* Enhanced Action hints */}
            <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  <span>
                    {result.type === 'registrations' 
                      ? 'Click to view full registration details' 
                      : 'Click to view ' + category.label.toLowerCase()}
                  </span>
                </span>
                {result.type === 'registrations' && (
                  <span className="text-xs text-gray-400">
                    ⌘ + Click for quick preview
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render recent searches
  const renderRecentSearches = () => {
    if (recentSearches.length === 0) return null;

    return (
      <div className="px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center">
          <ClockIcon className="w-4 h-4 mr-2 text-gray-400" />
          Recent Searches
        </h3>
        <div className="space-y-2">
          {recentSearches.map((search, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-all duration-200 group"
              onClick={() => {
                setQuery(search);
                debouncedSearch(search);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/20 transition-colors">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white font-medium">{search}</span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  // Render search suggestions
  const renderSearchSuggestions = () => {
    const suggestions = [
      { text: 'Find registrations by attendee name', icon: UserGroupIcon, shortcut: '⌘K', color: 'blue' },
      { text: 'Search by email address or registration ID', icon: EnvelopeIcon, color: 'purple' },
      { text: 'Look up all registrations for an event', icon: CalendarIcon, color: 'green' },
      { text: 'Search across all events and dates', icon: MagnifyingGlassIcon, color: 'indigo' }
    ];

    const colorClasses = {
      purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
      blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
      green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
      indigo: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
    };

    return (
      <div className="px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Search Tips
        </h3>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => {
            const IconComponent = suggestion.icon;
            return (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-gray-700/20 hover:bg-gray-100/50 dark:hover:bg-gray-700/40 transition-all duration-200"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[suggestion.color]}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{suggestion.text}</span>
                </div>
                {suggestion.shortcut && (
                  <kbd className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 font-mono shadow-sm">
                    {suggestion.shortcut}
                  </kbd>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Search Modal - Responsive Centered */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-full max-w-4xl max-h-[90vh] flex flex-col"
            >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-xl">
              {/* Search Header - Seamless Design */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                      <MagnifyingGlassIcon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search registrations by name, email, or event..."
                    value={query}
                    onChange={handleSearchChange}
                    className="flex-1 bg-transparent border-0 text-lg placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-0"
                    autoComplete="off"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClose}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                  </motion.button>
                </div>
              </div>

              {/* Search Results - Enhanced with better scrolling */}
              <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-300 dark:scrollbar-thumb-purple-600 scrollbar-track-transparent hover:scrollbar-thumb-purple-400 dark:hover:scrollbar-thumb-purple-500">
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16"
                  >
                    <div className="relative">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 dark:border-purple-800"></div>
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-transparent border-t-purple-600 absolute top-0 left-0"></div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 animate-pulse">Searching...</p>
                  </motion.div>
                )}

                {!loading && query && results.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-16 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center mx-auto mb-6">
                      <MagnifyingGlassIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No registrations found</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                      Try searching for attendee names, email addresses, registration IDs, or event names
                    </p>
                  </motion.div>
                )}

                {!loading && results.length > 0 && (
                  <div className="py-2">
                    <div className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {showingLimited ? `Showing ${results.length} of ${allResults.length}` : `${results.length}`} result{results.length !== 1 ? 's' : ''} found
                          </p>
                          {results.filter(r => r.type === 'registrations').length === 0 && results.filter(r => r.type === 'events').length > 0 && (
                            <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-full">
                              No registrations found - showing events instead
                            </span>
                          )}
                          {showingLimited && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleShowAllResults}
                              className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                            >
                              Show all {allResults.length - results.length} more
                            </motion.button>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          {results.filter(r => r.type === 'events').length > 0 && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full font-medium">
                              {results.filter(r => r.type === 'events').length} Events
                            </span>
                          )}
                          {results.filter(r => r.type === 'registrations').length > 0 && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                              {results.filter(r => r.type === 'registrations').length} Registrations
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {renderGroupedResults()}
                    
                    {/* Show More Results Footer */}
                    {showingLimited && (
                      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/20">
                        <div className="text-center">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleShowAllResults}
                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                          >
                            View All {allResults.length} Results
                          </motion.button>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {allResults.length - results.length} more results available
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!query && (
                  <>
                    {renderRecentSearches()}
                    {recentSearches.length > 0 && (
                      <div className="mx-6 border-t border-gray-100 dark:border-gray-700 my-4"></div>
                    )}
                    {renderSearchSuggestions()}
                  </>
                )}
              </div>

              {/* Search Footer - Keyboard Shortcuts */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 font-mono">↑↓</kbd>
                      <span>Navigate</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 font-mono">↵</kbd>
                      <span>Select</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 font-mono">ESC</kbd>
                      <span>Close</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      PurpleHat Registration Search
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UniversalSearch; 