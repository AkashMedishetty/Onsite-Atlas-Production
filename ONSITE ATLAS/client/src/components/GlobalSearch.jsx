import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  UserGroupIcon,
  CogIcon,
  BookOpenIcon,
  TrophyIcon,
  CurrencyDollarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useActiveEvent } from '../contexts/ActiveEventContext';
import debounce from 'lodash/debounce';

const GlobalSearch = ({ visible, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const navigate = useNavigate();
  const activeEventContext = useActiveEvent();
  const activeEventId = activeEventContext?.activeEventId || null;
  const searchInputRef = useRef(null);

  // Search categories with icons and colors
  const searchCategories = {
    registrations: { 
      icon: <UserOutlined />, 
      color: '#1890ff', 
      label: 'Registrations',
      searchFields: ['registrationId', 'personalInfo.firstName', 'personalInfo.lastName', 'personalInfo.email']
    },
    events: { 
      icon: <CalendarOutlined />, 
      color: '#52c41a', 
      label: 'Events',
      searchFields: ['name', 'description', 'venue']
    },
    abstracts: { 
      icon: <FileTextOutlined />, 
      color: '#722ed1', 
      label: 'Abstracts',
      searchFields: ['title', 'authors', 'keywords']
    },
    emails: { 
      icon: <MailOutlined />, 
      color: '#eb2f96', 
      label: 'Emails',
      searchFields: ['subject', 'content', 'recipients']
    },
    categories: { 
      icon: <TeamOutlined />, 
      color: '#fa8c16', 
      label: 'Categories',
      searchFields: ['name', 'description']
    },
    sponsors: { 
      icon: <TrophyOutlined />, 
      color: '#faad14', 
      label: 'Sponsors',
      searchFields: ['companyName', 'contactPerson', 'email']
    },
    payments: { 
      icon: <DollarCircleOutlined />, 
      color: '#13c2c2', 
      label: 'Payments',
      searchFields: ['transactionId', 'paymentMethod', 'status']
    },
    settings: { 
      icon: <SettingOutlined />, 
      color: '#595959', 
      label: 'Settings',
      searchFields: ['name', 'description', 'category']
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
        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [activeEventId]
  );

  // Perform the actual search across different data types
  const performGlobalSearch = async (searchQuery) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const results = [];

    try {
      // Search in parallel across different endpoints
      const searchPromises = [];

      // Search registrations
      if (activeEventId) {
        searchPromises.push(
          fetch(`${apiUrl}/api/events/${activeEventId}/registrations?search=${encodeURIComponent(searchQuery)}&limit=5`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          }).then(res => res.ok ? res.json() : null)
        );
      }

      // Search events
      searchPromises.push(
        fetch(`${apiUrl}/api/events?search=${encodeURIComponent(searchQuery)}&limit=5`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.ok ? res.json() : null)
      );

      // Search abstracts
      if (activeEventId) {
        searchPromises.push(
          fetch(`${apiUrl}/api/events/${activeEventId}/abstracts?search=${encodeURIComponent(searchQuery)}&limit=5`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          }).then(res => res.ok ? res.json() : null)
        );
      }

      // Search categories
      if (activeEventId) {
        searchPromises.push(
          fetch(`${apiUrl}/api/events/${activeEventId}/categories?search=${encodeURIComponent(searchQuery)}&limit=5`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          }).then(res => res.ok ? res.json() : null)
        );
      }

      const responses = await Promise.allSettled(searchPromises);

      // Process registration results
      if (responses[0]?.status === 'fulfilled' && responses[0].value?.data) {
        responses[0].value.data.forEach(item => {
          results.push({
            id: item._id,
            type: 'registrations',
            title: `${item.personalInfo?.firstName || ''} ${item.personalInfo?.lastName || ''}`.trim(),
            subtitle: `Registration ID: ${item.registrationId} • ${item.personalInfo?.email || ''}`,
            description: `Category: ${item.category?.name || 'N/A'} • Status: ${item.status || 'active'}`,
            url: `/events/${activeEventId}/registrations`,
            data: item
          });
        });
      }

      // Process event results
      if (responses[1]?.status === 'fulfilled' && responses[1].value?.data) {
        responses[1].value.data.forEach(item => {
          results.push({
            id: item._id,
            type: 'events',
            title: item.name,
            subtitle: `${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}`,
            description: item.description || item.venue || 'Event details',
            url: `/events/${item._id}/dashboard`,
            data: item
          });
        });
      }

      // Process abstract results
      if (responses[2]?.status === 'fulfilled' && responses[2].value?.data) {
        responses[2].value.data.forEach(item => {
          results.push({
            id: item._id,
            type: 'abstracts',
            title: item.title,
            subtitle: `By: ${item.authors?.map(a => a.name).join(', ') || 'Unknown'}`,
            description: `Status: ${item.status || 'submitted'} • ${item.keywords?.join(', ') || ''}`,
            url: `/events/${activeEventId}/abstracts/${item._id}`,
            data: item
          });
        });
      }

      // Process category results
      if (responses[3]?.status === 'fulfilled' && responses[3].value?.data) {
        responses[3].value.data.forEach(item => {
          results.push({
            id: item._id,
            type: 'categories',
            title: item.name,
            subtitle: `Registration Category`,
            description: item.description || `Price: ₹${item.basePrice || 0}`,
            url: `/events/${activeEventId}/categories/${item._id}`,
            data: item
          });
        });
      }

      return results;
    } catch (error) {
      console.error('Global search error:', error);
      return [];
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    debouncedSearch(value);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
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
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  // Handle result click
  const handleResultClick = (result) => {
    // Add to recent searches
    const newRecentSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecentSearches);
    localStorage.setItem('globalSearchRecent', JSON.stringify(newRecentSearches));

    // Navigate to result
    navigate(result.url);
    handleClose();
  };

  // Handle close
  const handleClose = () => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    onClose();
  };

  // Load recent searches on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('globalSearchRecent');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (visible && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
    }
  }, [visible]);

  // Render search result item
  const renderResultItem = (result, index) => {
    const category = searchCategories[result.type];
    const isSelected = selectedIndex === index;

    return (
      <div
        key={`${result.type}-${result.id}`}
        className={`p-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 mb-2 ${
          isSelected 
            ? 'bg-blue-50 border-l-4 border-blue-500' 
            : 'hover:bg-gray-50'
        }`}
        onClick={() => handleResultClick(result)}
        onMouseEnter={() => setSelectedIndex(index)}
      >
        <div className="flex items-start space-x-3">
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
            style={{ backgroundColor: category.color }}
          >
            {category.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {result.title}
              </h4>
              <Tag size="small" color={category.color}>
                {category.label}
              </Tag>
            </div>
            <p className="text-xs text-gray-600 mb-1">
              {result.subtitle}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {result.description}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render recent searches
  const renderRecentSearches = () => {
    if (recentSearches.length === 0) return null;

    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Searches</h3>
        <div className="space-y-2">
          {recentSearches.map((search, index) => (
            <div
              key={index}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                setQuery(search);
                debouncedSearch(search);
              }}
            >
              <SearchOutlined className="text-gray-400 text-sm" />
              <span className="text-sm text-gray-700">{search}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render search suggestions/shortcuts
  const renderSearchSuggestions = () => {
    const suggestions = [
      { text: 'Search registrations by name or email', icon: <UserOutlined /> },
      { text: 'Find events by title or date', icon: <CalendarOutlined /> },
      { text: 'Look up abstracts by title or author', icon: <FileTextOutlined /> },
      { text: 'Search categories and pricing', icon: <TeamOutlined /> }
    ];

    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Search Tips</h3>
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="text-gray-400">{suggestion.icon}</span>
              <span>{suggestion.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={700}
      className="global-search-modal"
      styles={{
        body: { padding: 0 },
        mask: { backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)' }
      }}
      closable={false}
      centered
    >
      <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
        {/* Search Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <Input
            ref={searchInputRef}
            placeholder="Search anything... (registrations, events, abstracts, etc.)"
            value={query}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            prefix={<SearchOutlined className="text-gray-400" />}
            className="border-0 shadow-none bg-transparent text-lg"
            style={{ fontSize: '16px' }}
          />
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spin size="large" />
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="py-8">
              <Empty 
                description="No results found"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => renderResultItem(result, index))}
            </div>
          )}

          {!query && (
            <>
              {renderRecentSearches()}
              {recentSearches.length > 0 && <Divider className="my-2" />}
              {renderSearchSuggestions()}
            </>
          )}
        </div>

        {/* Search Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>ESC Close</span>
            </div>
            <div>
              {results.length > 0 && `${results.length} result${results.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GlobalSearch; 