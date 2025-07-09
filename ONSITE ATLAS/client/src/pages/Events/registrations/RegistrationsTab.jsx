import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, Button, Spinner, Alert, Badge, Input, Modal, Pagination } from '../../../components/common';
import QRCode from 'react-qr-code';
import { 
  PlusIcon, 
  DocumentDuplicateIcon, 
  ChartBarIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  EnvelopeIcon,
  QrCodeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhoneIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  NoSymbolIcon,
  UserCircleIcon,
  GlobeAltIcon,
  ClipboardDocumentListIcon,
  InformationCircleIcon,
  TicketIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import registrationService from '../../../services/registrationService';
import eventService from '../../../services/eventService';
import resourceService from '../../../services/resourceService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import BadgeTemplate from "../../../components/badges/BadgeTemplate";
import { debounce } from 'lodash';
import {
  Table,
  Space,
  Tag,
  Tooltip,
  Select as AntSelect,
  message,
  Modal as AntdModal,
  Popconfirm,
  Button as AntdButton,
  DatePicker,
  Checkbox,
  Dropdown,
  Menu,
  Collapse,
  Radio,
  Switch,
  InputNumber,
  Divider,
  Tabs,
  Input as AntInput
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MailOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  UserSwitchOutlined,
  UploadOutlined,
  FilterOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  DownOutlined,
  ReloadOutlined,
  SettingOutlined,
  TagOutlined
} from '@ant-design/icons';
import printService from '../../../services/printService';
import RegistrationForm from '../../Registration/RegistrationForm';
import BulkImportWizard from '../../Registrations/BulkImportWizard';
import { usePerformanceOptimization, useOptimizedAPI, PerformanceMonitor } from '../../../hooks/usePerformanceOptimization';

const { Option } = AntSelect;
const { Panel } = Collapse;

// Enhanced Registration List Editor - Phase 3.3 Implementation
// This provides advanced bulk operations, enhanced filtering, and improved UI

const RegistrationsTab = ({ eventId }) => {
  // Enhanced Registration List Editor - State Management
  const [bulkSelection, setBulkSelection] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [quickActions, setQuickActions] = useState({
    sendEmailModal: false,
    bulkStatusModal: false,
    bulkCategoryModal: false
  });
  const [bulkOperation, setBulkOperation] = useState({
    type: '',
    data: {},
    loading: false
  });

  // Add CSS to fix button hover issues
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .registration-action-button {
        opacity: 1 !important;
        visibility: visible !important;
        transition: all 0.2s ease-in-out;
      }
      .registration-action-button:hover {
        transform: scale(1.1);
        opacity: 1 !important;
      }
      tr:hover .registration-action-button {
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Place these at the top of the component, before any JSX
  const dropdownStyle = { background: '#fff', color: '#1a202c' };
  const inputClass = 'bg-white text-gray-900';

  // Existing state variables
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [registrations, setRegistrations] = useState([]);
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState([]);
  
  const [activeAction, setActiveAction] = useState(null);
  
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 1,
  });
  
  const [isSearching, setIsSearching] = useState(false);
  
  const [previewModal, setPreviewModal] = useState(false);
  const [selectedRegistrant, setSelectedRegistrant] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [isPrintModalVisible, setIsPrintModalVisible] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [badgeSettings, setBadgeSettings] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '', lastName: '', email: '', mobile: '', organization: '', designation: '', country: '',
    mciNumber: '', membership: '',
    customFields: {},
    categoryId: '', status: 'active', registrationType: 'pre-registered', sponsoredBy: '',
    paymentStatus: 'pending', notes: '', registrationId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [resourceUsage, setResourceUsage] = useState([]);
  const [resourceConfig, setResourceConfig] = useState({ meals: [], kitItems: [], certificates: [] });
  const [badgePreviewUrl, setBadgePreviewUrl] = useState(null);
  const [isSendingCertificate, setIsSendingCertificate] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('1'); // Tab state for detail modal
  const [resourceBlocks, setResourceBlocks] = useState([]); // Resource blocking state
  const [loadingResourceBlocks, setLoadingResourceBlocks] = useState(false);
  const [isResourceBlockModalOpen, setIsResourceBlockModalOpen] = useState(false);
  
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [registrationTypeFilter, setRegistrationTypeFilter] = useState('');
  const [checkInStatusFilter, setCheckInStatusFilter] = useState(''); // 'checkedIn' | 'notCheckedIn' | ''
  const [badgePrintedFilter, setBadgePrintedFilter] = useState('');   // 'printed' | 'notPrinted' | ''
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(''); // New payment status filter

  // --- Diagnostic State --- 
  const [updateCounter, setUpdateCounter] = useState(0); // Force re-render

  // ADDED: State for event details for the modal
  const [currentEventDetailsForModal, setCurrentEventDetailsForModal] = useState(null);

  // --- Add state for sponsors and event config ---
  const [sponsors, setSponsors] = useState([]);
  const [eventConfig, setEventConfig] = useState(null);

  // --- Fetch sponsors and event config when edit modal opens ---
  useEffect(() => {
    if (isEditModalOpen && eventId) {
      eventService.getEventSponsors(eventId).then(res => {
        setSponsors(res?.results || []);
      }).catch(() => setSponsors([]));
      eventService.getEventById(eventId).then(res => {
        setEventConfig(res?.data?.registrationSettings || null);
      }).catch(() => setEventConfig(null));
    }
  }, [isEditModalOpen, eventId]);

  // Effect to monitor print modal visibility state
  useEffect(() => {
    console.log(`[Effect Log] isPrintModalVisible changed to: ${isPrintModalVisible}`);
  }, [isPrintModalVisible]);

  const [isExporting, setIsExporting] = useState(false); // State for export loading

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    category: '',
    status: '',
    registrationType: '',
    badgePrinted: '',
    startDate: null,
    endDate: null,
    paymentStatus: '',
    workshopId: '',
  });

  const fetchRegistrations = useCallback(async (
      page = 1,
      limit = 25,
      currentSearch = searchTerm,
      currentCategory = categoryFilter,
      currentStatus = statusFilter,
      currentRegType = registrationTypeFilter,
      currentCheckIn = checkInStatusFilter,
      currentPrinted = badgePrintedFilter
    ) => {
    setLoading(true);
    setError(null);
    console.log(`Fetching: Page ${page}, Limit ${limit}, Search: '${currentSearch}', Cat: ${currentCategory}, Status: ${currentStatus}`);
    try {
      const filters = {
        page,
        limit,
        ...(currentSearch && { search: currentSearch }),
        ...(currentCategory && currentCategory !== '' && { category: currentCategory }),
        ...(currentStatus && { status: currentStatus }),
        ...(currentRegType && { registrationType: currentRegType }),
        // Backend supports badgePrinted param; use it
        ...(currentPrinted && { badgePrinted: currentPrinted === 'printed' ? 'true' : 'false' })
      };
      const response = await registrationService.getRegistrations(eventId, filters);
      console.log('API Response (Axios):', response);

      const backendData = response?.data;
      
      console.log('Checking backendData structure:', backendData); 

      if (backendData && backendData.success) { 
        let fetchedData = Array.isArray(backendData.data) ? backendData.data : [];
        setAllRegistrations(fetchedData);
        // Frontend fallback filters
        let filtered = fetchedData;
        if (currentCategory && currentCategory !== '') {
          filtered = filtered.filter(reg => (reg.category && reg.category._id === currentCategory) || reg.category === currentCategory);
        }
        // Front-end fallback filtering (in case backend ignores unknown params)
        if (currentRegType) {
          filtered = filtered.filter(reg => reg.registrationType === currentRegType);
        }
        if (currentCheckIn) {
          const wantChecked = currentCheckIn === 'checkedIn';
          filtered = filtered.filter(reg => !!reg.checkIn?.isCheckedIn === wantChecked);
        }
        if (currentPrinted) {
          const wantPrinted = currentPrinted === 'printed';
          filtered = filtered.filter(reg => !!reg.badgePrinted === wantPrinted);
        }
        setRegistrations(filtered);

        const apiPagination = backendData.pagination || {}; 
        
        const newPaginationState = { 
            currentPage: Number(apiPagination.page) || 1,
            pageSize: Number(apiPagination.limit) || limit,
            totalCount: Number(apiPagination.total) || 0,
            totalPages: Number(apiPagination.totalPages) || 1 
        };
        console.log('Calculated newPaginationState before setting:', newPaginationState);
        
        setPagination(newPaginationState);
        console.log('Pagination state updated (confirming):', newPaginationState);

      } else {
        throw new Error(backendData?.message || response?.statusText || 'Failed to fetch registrations'); 
      }
    } catch (err) {
      console.error('Error fetching registrations:', err);
      setError(`Failed to fetch registrations: ${err.message || err.toString()}`); 
      setRegistrations([]);
      setPagination(prev => ({ ...prev, totalCount: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const isInitialMount = useRef(true);
  
  useEffect(() => {
    if (eventId) {
      console.log("Initial fetch triggered by eventId change or mount");
      fetchRegistrations(1, 25);
      
      const fetchCategories = async () => {
          try {
              const response = await eventService.getEventCategories(eventId);
              setCategories(response.success ? response.data : []);
          } catch (error) { console.error('Error fetching categories:', error); setCategories([]); }
      };
      fetchCategories();
    }
  }, [eventId, fetchRegistrations]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (eventId) { 
        console.log("Filters/search/pageSize changed, re-fetching page 1");
        setPagination(prev => ({ ...prev, currentPage: 1 })); 
        fetchRegistrations(1, pagination.pageSize, searchTerm, categoryFilter, statusFilter, registrationTypeFilter, checkInStatusFilter, badgePrintedFilter);
    }
  }, [searchTerm, categoryFilter, statusFilter, registrationTypeFilter, checkInStatusFilter, badgePrintedFilter, pagination.pageSize, eventId, fetchRegistrations]);


  
  // ===================== ENHANCED BULK OPERATIONS - Phase 3.3 =====================
  
  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (bulkSelection.size === registrations.length) {
      setBulkSelection(new Set());
    } else {
      setBulkSelection(new Set(registrations.map(reg => reg._id)));
    }
  };
  
  const handleSelectRegistration = (registrationId) => {
    const newSelection = new Set(bulkSelection);
    if (newSelection.has(registrationId)) {
      newSelection.delete(registrationId);
    } else {
      newSelection.add(registrationId);
    }
    setBulkSelection(newSelection);
  };
  
  // Bulk Operations
  const handleBulkStatusUpdate = async (newStatus) => {
    setBulkActionLoading(true);
    try {
      const selectedIds = Array.from(bulkSelection);
      await Promise.all(
        selectedIds.map(id => 
          registrationService.updateRegistration(eventId, id, { status: newStatus })
        )
      );
      message.success(`Successfully updated ${selectedIds.length} registrations to ${newStatus}`);
      setBulkSelection(new Set());
      fetchRegistrations(pagination.currentPage, pagination.pageSize);
    } catch (error) {
      message.error('Failed to update registrations');
    }
    setBulkActionLoading(false);
    setQuickActions(prev => ({ ...prev, bulkStatusModal: false }));
  };
  
  const handleBulkCategoryUpdate = async (categoryId) => {
    setBulkActionLoading(true);
    try {
      const selectedIds = Array.from(bulkSelection);
      await Promise.all(
        selectedIds.map(id => 
          registrationService.updateRegistration(eventId, id, { categoryId })
        )
      );
      message.success(`Successfully updated ${selectedIds.length} registrations`);
      setBulkSelection(new Set());
      fetchRegistrations(pagination.currentPage, pagination.pageSize);
    } catch (error) {
      message.error('Failed to update categories');
    }
    setBulkActionLoading(false);
    setQuickActions(prev => ({ ...prev, bulkCategoryModal: false }));
  };
  
  const handleBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      const selectedIds = Array.from(bulkSelection);
      await Promise.all(
        selectedIds.map(id => 
          registrationService.deleteRegistration(eventId, id)
        )
      );
      message.success(`Successfully deleted ${selectedIds.length} registrations`);
      setBulkSelection(new Set());
      fetchRegistrations(pagination.currentPage, pagination.pageSize);
    } catch (error) {
      message.error('Failed to delete registrations');
    }
    setBulkActionLoading(false);
  };
  
  const handleBulkEmail = async (emailData) => {
    if (bulkSelection.size === 0) {
      message.warning('No registrations selected');
      return;
    }

    setBulkActionLoading(true);
    try {
      const selectedIds = Array.from(bulkSelection);
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const cleanApiUrl = apiUrl.replace(/\/api$/, '');
      
      const response = await fetch(`${cleanApiUrl}/api/emails/bulk-send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registrationIds: selectedIds,
          eventId,
          subject: emailData.subject,
          message: emailData.message,
          templateId: emailData.templateId
        })
      });

      if (response.ok) {
        const data = await response.json();
        message.success(`Email sent to ${selectedIds.length} registrations`);
      } else {
        const errorData = await response.json();
        message.error(errorData.message || 'Failed to send emails');
      }
      
      setQuickActions(prev => ({ ...prev, sendEmailModal: false }));
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      message.error('Failed to send emails');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkPaymentLinks = async (method, registrationIds) => {
    setBulkActionLoading(true);
    try {
      const payload = {
        registrationIds,
        method, // 'email', 'sms', or 'whatsapp'
        eventId
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payments/bulk-payment-links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        message.success(`Payment links sent via ${method} to ${registrationIds.length} registrations`);
      } else {
        const errorData = await response.json();
        message.error(errorData.message || `Failed to send payment links via ${method}`);
      }
    } catch (error) {
      console.error('Error sending bulk payment links:', error);
      message.error(`Error sending payment links via ${method}`);
    } finally {
      setBulkActionLoading(false);
    }
  };
  
  // Quick Actions Menu
  const getBulkActionsMenu = () => (
    <Menu>
      <Menu.SubMenu key="status" title="Update Status" icon={<UserSwitchOutlined />}>
        <Menu.Item key="active" onClick={() => handleBulkStatusUpdate('active')}>
          <CheckCircleOutlined className="text-green-500" /> Set to Active
        </Menu.Item>
        <Menu.Item key="cancelled" onClick={() => handleBulkStatusUpdate('cancelled')}>
          <CloseCircleOutlined className="text-red-500" /> Set to Cancelled
        </Menu.Item>
        <Menu.Item key="no-show" onClick={() => handleBulkStatusUpdate('no-show')}>
          <CloseCircleOutlined className="text-gray-500" /> Set to No-Show
        </Menu.Item>
      </Menu.SubMenu>
      
      <Menu.SubMenu key="payment-links" title="Send Payment Links" icon={<div className="w-4 h-4 inline-block">💳</div>}>
        <Menu.Item key="payment-email" onClick={() => {
          const pendingRegistrations = Array.from(bulkSelection).filter(id => {
            const reg = registrations.find(r => r._id === id);
            return reg?.paymentStatus === 'pending';
          });
          if (pendingRegistrations.length === 0) {
            message.warning('No registrations with pending payment status selected');
            return;
          }
          handleBulkPaymentLinks('email', pendingRegistrations);
        }}>
          <MailOutlined className="text-blue-500" /> Via Email
        </Menu.Item>
        
        <Menu.Item key="payment-sms" onClick={() => {
          const pendingRegistrations = Array.from(bulkSelection).filter(id => {
            const reg = registrations.find(r => r._id === id);
            return reg?.paymentStatus === 'pending' && reg?.personalInfo?.phone;
          });
          if (pendingRegistrations.length === 0) {
            message.warning('No registrations with pending payment status and phone numbers selected');
            return;
          }
          handleBulkPaymentLinks('sms', pendingRegistrations);
        }}>
          <div className="w-4 h-4 inline-block text-green-500">📱</div> Via SMS
        </Menu.Item>
        
        <Menu.Item key="payment-whatsapp" onClick={() => {
          const pendingRegistrations = Array.from(bulkSelection).filter(id => {
            const reg = registrations.find(r => r._id === id);
            return reg?.paymentStatus === 'pending' && reg?.personalInfo?.phone;
          });
          if (pendingRegistrations.length === 0) {
            message.warning('No registrations with pending payment status and phone numbers selected');
            return;
          }
          handleBulkPaymentLinks('whatsapp', pendingRegistrations);
        }}>
          <div className="w-4 h-4 inline-block text-green-500">💬</div> Via WhatsApp
        </Menu.Item>
      </Menu.SubMenu>
      
      <Menu.Item key="category" onClick={() => setQuickActions(prev => ({ ...prev, bulkCategoryModal: true }))}>
        <span className="inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Change Category
        </span>
      </Menu.Item>
      
      <Menu.Item key="email" onClick={() => setQuickActions(prev => ({ ...prev, sendEmailModal: true }))}>
        <MailOutlined /> Send Email
      </Menu.Item>
      
      <Menu.Divider />
      
      <Menu.Item key="delete" danger onClick={handleBulkDelete}>
        <DeleteOutlined /> Delete Selected
      </Menu.Item>
    </Menu>
  );
  
  // ===================== END BULK OPERATIONS =====================

  const handleAddRegistration = () => {
    if (!eventId) {
      setError("Cannot add registration: Event ID is missing");
      return;
    }
    
    navigate(`/events/${eventId}/registrations/new`);
  };
  
  const handleBulkImport = () => {
    if (!eventId) {
      setError("Cannot import registrations: Event ID is missing");
      return;
    }
    
    navigate(`/events/${eventId}/registrations/bulk-import`);
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    message.loading({ content: 'Generating export...', key: 'exportReg' });
    
    try {
      const filters = {
        ...(searchTerm && { search: searchTerm }), 
        ...(categoryFilter && { category: categoryFilter }), 
        ...(statusFilter && { status: statusFilter }), 
      };
      
      const response = await registrationService.exportRegistrations(eventId, filters);
      
      // Check if the response is a blob
      if (response && response.data instanceof Blob) {
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Extract filename from content-disposition header if available
        const contentDisposition = response.headers['content-disposition'];
        let filename = `registrations_${eventId}_${new Date().toISOString().split('T')[0]}.xlsx`; // Default filename
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i);
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(filenameMatch[1].replace(/\"/g, ''));
          }
        }
        
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        message.success({ content: 'Export downloaded successfully!', key: 'exportReg', duration: 3 });
      } else {
        // Handle cases where the response might be JSON error
        let errorMessage = 'Failed to generate export file.';
        if (response && response.data && !(response.data instanceof Blob)) {
          try {
            // Attempt to parse JSON error from blob if needed, or check if data is already JSON
            const errorData = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            console.error("Could not parse error response:", response.data);
          }
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error exporting registrations:", error);
      message.error({ content: `Export failed: ${error.message}`, key: 'exportReg', duration: 3 });
    } finally {
      setIsExporting(false);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (err) {
      return 'Invalid date';
    }
  };
  
  const handleViewRegistration = (registrationId) => {
    if (!eventId) {
      setError("Cannot view registration: Event ID is missing");
      return;
    }
    
    navigate(`/events/${eventId}/registrations/${registrationId}`);
  };

  const handlePreviewRegistration = useCallback(async (registration) => {
    console.log('[Preview Modal] handlePreviewRegistration triggered with:', registration);
    setSelectedRegistrant(registration);

    // Fetch badge settings if not already loaded
    if (!badgeSettings) {
      console.log('[Preview Modal] Badge settings not loaded, fetching...');
      try {
        const fetchedSettings = await fetchBadgeSettings(eventId);
        if (fetchedSettings) {
          setBadgeSettings(fetchedSettings); // Update state
          console.log('[Preview Modal] Fetched and set badgeSettings:', fetchedSettings);
        } else {
          console.warn('[Preview Modal] Failed to fetch badge settings for preview.');
          // badgeSettings will remain null, BadgeTemplate will use fallback
        }
      } catch (error) {
        console.error('[Preview Modal] Error fetching badge settings:', error);
        // badgeSettings will remain null
      }
    }
    setPreviewModal(true);
  }, [badgeSettings, eventId]);

  // Handle viewRegistration query parameter - automatically open registration detail modal
  useEffect(() => {
    const viewRegistrationId = searchParams.get('viewRegistration');
    if (viewRegistrationId && registrations.length > 0 && !isDetailModalOpen) {
      console.log('Auto-opening registration detail modal for ID:', viewRegistrationId);
      
      // Find the registration in the current list
      const targetRegistration = registrations.find(reg => reg._id === viewRegistrationId);
      
      if (targetRegistration) {
        // Open the registration detail modal (not badge preview)
        handleViewDetails(targetRegistration);
        // Remove the query parameter from URL without triggering a navigation
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('viewRegistration');
        setSearchParams(newSearchParams, { replace: true });
      } else {
        // If not found in current page, fetch and search all registrations
        console.log('Registration not found in current page, searching all registrations...');
        registrationService.getRegistrations(eventId, { limit: 1000 }).then(response => {
          if (response?.data?.success && response.data.data) {
            const foundRegistration = response.data.data.find(reg => reg._id === viewRegistrationId);
            if (foundRegistration) {
              handleViewDetails(foundRegistration);
              // Remove the query parameter from URL
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.delete('viewRegistration');
              setSearchParams(newSearchParams, { replace: true });
            } else {
              console.warn('Registration not found with ID:', viewRegistrationId);
              // Still remove the parameter to clean up URL
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.delete('viewRegistration');
              setSearchParams(newSearchParams, { replace: true });
            }
          }
        }).catch(error => {
          console.error('Error fetching all registrations:', error);
          // Remove the parameter even on error
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('viewRegistration');
          setSearchParams(newSearchParams, { replace: true });
        });
      }
    }
  }, [searchParams, registrations, isDetailModalOpen, eventId, setSearchParams]);

  // Always fetch the default designer badge template for the event, with detailed logging
  const fetchBadgeSettings = async (eventId) => {
    try {
      console.log('[fetchBadgeSettings] Fetching templates for eventId:', eventId);
      const templatesResponse = await import('../../../services/badgeTemplateService').then(m => m.default.getTemplates(eventId));
      console.log('[fetchBadgeSettings] API response:', templatesResponse);
      if (templatesResponse.success && Array.isArray(templatesResponse.data)) {
        // Log all templates for this event
        console.log('[fetchBadgeSettings] Templates fetched:', templatesResponse.data);
        // Defensive: ensure eventId is string
        const eventIdStr = typeof eventId === 'string' ? eventId : (eventId?.$oid || String(eventId));
        // Pick the default template for this event
        const defaultTemplate = templatesResponse.data.find(t => t.isDefault && (t.event === eventIdStr || t.event?._id === eventIdStr || t.event?.$oid === eventIdStr));
        console.log('[fetchBadgeSettings] Picked default template:', defaultTemplate);
        if (defaultTemplate) {
          return defaultTemplate;
        } else {
          console.warn('[fetchBadgeSettings] No default designer template found for event:', eventIdStr);
          return null;
        }
      } else {
        console.warn('[fetchBadgeSettings] No templates found or API error for event:', eventId);
        return null;
      }
    } catch (err) {
      console.error('[fetchBadgeSettings] Error fetching designer templates:', err);
      return null;
    }
  };

  // Fetch the latest badge template every time before printing
  const handlePrintBadgeClick = async (registration) => {
    console.log('[Action] handlePrintBadgeClick triggered', registration);
    // Always fetch the latest badge template for this event
    let currentBadgeSettings = null;
    try {
      currentBadgeSettings = await fetchBadgeSettings(eventId);
      if (!currentBadgeSettings) {
        message.error('Failed to load badge settings. Cannot open print modal.');
        console.error('[Print Badge] fetchBadgeSettings returned null or failed.');
        return; // Stop if settings failed to load
      }
      setBadgeSettings(currentBadgeSettings); // Always set the latest
      console.log('[Print Badge] Fetched badge settings successfully:', currentBadgeSettings);
    } catch (error) {
      message.error(`Error fetching badge settings: ${error.message}`);
      console.error('[Print Badge] Error in fetchBadgeSettings:', error);
      return; // Stop if fetch errored
    }
    // Prepare registration data
    const registrationWithEvent = {
      ...registration,
      eventId: eventId,
      qrCode: registration.registrationId // Assuming QR code is the registration ID
    };
    setSelectedRegistration(registrationWithEvent);
    setIsPrintModalVisible(true);
    console.log('[State Update] setIsPrintModalVisible called with true'); 
  };

  // Always fetch the latest badge template before printing
  const handlePrintBadge = async () => {
    if (!selectedRegistration) return;
    setIsPrinting(true);
    let currentBadgeSettings = badgeSettings;
    try {
      // Always fetch the latest template before printing
      currentBadgeSettings = await fetchBadgeSettings(eventId);
      if (!currentBadgeSettings) {
        message.error('Failed to load badge settings. Cannot print badge.');
        setIsPrinting(false);
        return;
      }
      setBadgeSettings(currentBadgeSettings); // Update state for consistency
      // Calculate badge pixel size
      const DPIN = 100;
      const size = currentBadgeSettings.size || { width: 3.375, height: 5.375 };
      const unit = currentBadgeSettings.unit || 'in';
      let badgeWidthPx, badgeHeightPx;
      if (unit === 'in') {
        badgeWidthPx = (size.width || 0) * DPIN;
        badgeHeightPx = (size.height || 0) * DPIN;
      } else if (unit === 'cm') {
        badgeWidthPx = (size.width || 0) * (DPIN / 2.54);
        badgeHeightPx = (size.height || 0) * (DPIN / 2.54);
      } else if (unit === 'mm') {
        badgeWidthPx = (size.width || 0) * (DPIN / 25.4);
        badgeHeightPx = (size.height || 0) * (DPIN / 25.4);
      } else {
        badgeWidthPx = (size.width || 0);
        badgeHeightPx = (size.height || 0);
      }
      // Create a hidden container for print (not the modal preview node)
      const hiddenDiv = document.createElement('div');
      hiddenDiv.style.position = 'fixed';
      hiddenDiv.style.left = '-9999px';
      hiddenDiv.style.top = '0';
      hiddenDiv.style.width = `${badgeWidthPx}px`;
      hiddenDiv.style.height = `${badgeHeightPx}px`;
      document.body.appendChild(hiddenDiv);
      // Render only the badge (no modal/buttons)
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(hiddenDiv);
      root.render(
        <BadgeTemplate
          registrationData={normalizeRegistrationData(selectedRegistration)}
          template={currentBadgeSettings}
          previewMode={false}
        />
      );
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(hiddenDiv, { scale: 1, useCORS: true, logging: false, allowTaint: true, width: badgeWidthPx, height: badgeHeightPx });
      const dataUrl = canvas.toDataURL('image/png');
      root.unmount();
      document.body.removeChild(hiddenDiv);
      // Print window
      const printWindow = window.open('', '_blank');
      if (!printWindow) { throw new Error("Could not open print window. Please check your popup blocker settings."); }
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Badge - ${selectedRegistration.personalInfo?.firstName || ''} ${selectedRegistration.personalInfo?.lastName || ''}</title>
            <style>
              @media print {
                @page { size: ${size.width}${unit} ${size.height}${unit}; margin: 0; }
                body { margin: 0; }
                .badge-img { page-break-inside: avoid; width: ${size.width}${unit}; height: ${size.height}${unit}; display: block; }
              }
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #fff; }
              .badge-img { width: ${size.width}${unit}; height: ${size.height}${unit}; object-fit: contain; display: block; box-shadow: none; border: none; }
            </style>
          </head>
          <body onload="window.print(); window.onafterprint = function(){ window.close(); }">
            <img src="${dataUrl}" class="badge-img" alt="Badge" />
          </body>
        </html>
      `);
      printWindow.document.close();
      // --- Mark badge as printed & checked-in in backend ---
      try {
        const resp = await registrationService.checkIn(eventId, selectedRegistration._id);
        if (resp?.data?.success) {
          setRegistrations(prev => prev.map(r => r._id === selectedRegistration._id ? { ...r, badgePrinted: true, checkIn: { ...(r.checkIn||{}), isCheckedIn: true, checkedInAt: new Date() }} : r));
          setSelectedRegistration(prev => prev ? { ...prev, badgePrinted: true, checkIn: { ...(prev.checkIn||{}), isCheckedIn: true, checkedInAt: new Date() }} : prev);
        }
      } catch(err) {
        console.error('[RegistrationsTab] Failed to set badgePrinted after print:', err);
      }
    } catch (error) {
      console.error('Error printing badge:', error);
      message.error(`Failed to print badge: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendCertificate = async (registration) => {
    setIsSendingCertificate(true);
    message.loading({ content: 'Sending certificate...', key: 'sendCert' });
    try {
      const certificateSettings = await eventService.getCertificateSettings(eventId);
      console.log('Certificate settings:', certificateSettings);
      
      if (!certificateSettings || !certificateSettings.data) {
        setError('Certificate settings not found for this event');
        setIsSendingCertificate(false);
        return;
      }
      
      const emailSettings = await eventService.getEmailSettings(eventId);
      console.log('Email settings:', emailSettings);
      
      if (!emailSettings || !emailSettings.data) {
        setError('Email settings not found for this event');
        setIsSendingCertificate(false);
        return;
      }
      
      const response = await registrationService.sendCertificate(
        eventId, 
        registration._id,
        {
          certificateType: certificateSettings.data.defaultType || 'attendance',
          emailTemplate: emailSettings.data.certificateTemplate || 'default',
          includeQR: true
        }
      );
      
      console.log('Certificate sent response:', response);
      
      if (response && response.success) {
        message.success({ content: 'Certificate sent successfully!', key: 'sendCert', duration: 2 });
      } else {
        setError(`Failed to send certificate: ${response?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error sending certificate:', err);
      setError(`Failed to send certificate: ${err.message}`);
    } finally {
      setIsSendingCertificate(false);
    }
  };

  // --- Update handleEditRegistration to populate all fields ---
  const handleEditRegistration = (registration) => {
    setEditFormData({
      _id: registration._id,
      firstName: registration.personalInfo?.firstName || '',
      lastName: registration.personalInfo?.lastName || '',
      email: registration.personalInfo?.email || '',
      mobile: registration.personalInfo?.phone || '',
      organization: registration.personalInfo?.organization || '',
      designation: registration.personalInfo?.designation || '',
      country: registration.personalInfo?.country || '',
      mciNumber: registration.professionalInfo?.mciNumber || '',
      membership: registration.professionalInfo?.membership || '',
      customFields: registration.customFields || {},
      categoryId: registration.category?._id || '',
      status: registration.status || 'active',
      registrationType: registration.registrationType || 'pre-registered',
      sponsoredBy: registration.sponsoredBy || '',
      paymentStatus: registration.paymentStatus || 'pending',
      notes: registration.notes || '',
      registrationId: registration.registrationId || ''
    });
    setValidationErrors({});
    setIsEditModalOpen(true);
  };

  // --- Update handleEditFormChange to support all fields ---
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target || {};
    if (name?.startsWith('customFields.')) {
      const field = name.replace('customFields.', '');
      setEditFormData(prev => ({ ...prev, customFields: { ...prev.customFields, [field]: value } }));
    } else {
      setEditFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const validateEditForm = () => {
    const errors = {};
    
    if (!editFormData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    
    if (!editFormData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    
    if (!editFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(editFormData.email)) {
      errors.email = 'Email is invalid';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // --- Update handleUpdateRegistration to send all fields ---
  const handleUpdateRegistration = async () => {
    if (!validateEditForm()) return;
    setIsSubmitting(true);
    try {
      const updateData = {
        personalInfo: {
          firstName: editFormData.firstName,
          lastName: editFormData.lastName,
          email: editFormData.email,
          phone: editFormData.mobile,
          organization: editFormData.organization,
          designation: editFormData.designation,
          country: editFormData.country
        },
        professionalInfo: {
          mciNumber: editFormData.mciNumber,
          membership: editFormData.membership
        },
        customFields: editFormData.customFields,
        categoryId: editFormData.categoryId,
        status: editFormData.status,
        registrationType: editFormData.registrationType,
        sponsoredBy: editFormData.registrationType === 'sponsored' ? editFormData.sponsoredBy : undefined,
        paymentStatus: editFormData.paymentStatus,
        notes: editFormData.notes,
      };
      const response = await registrationService.updateRegistration(eventId, editFormData._id, updateData);
      if (response?.data?.success) {
        const updatedRegData = response.data.data;
        setRegistrations(prev => {
          const idx = prev.findIndex(r => r._id === editFormData._id);
          if (idx === -1) return [...prev, updatedRegData];
          const newRegs = [...prev];
          newRegs[idx] = updatedRegData;
          return newRegs;
        });
        setIsEditModalOpen(false);
        setError(null);
        message.success('Registration updated successfully!');
      } else {
        setError(`Failed to update registration: ${response?.data?.message || response?.message || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error updating registration: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteRegistration = (registration) => {
    console.log('[Action] confirmDeleteRegistration triggered', registration);
    setSelectedRegistrant(registration);
    setDeleteModal(true);
  };

  const handleDeleteRegistration = async () => {
    if (!selectedRegistrant) return;
    
    setLoading(true);
    try {
      const response = await registrationService.deleteRegistration(eventId, selectedRegistrant._id);
      if (response && response.success) {
        message.success('Registration deleted successfully');
        setDeleteModal(false);
        setSelectedRegistrant(null);

        // Check if we need to adjust the page number
        let pageToFetch = pagination.currentPage;
        if (registrations.length === 1 && pagination.currentPage > 1) {
          // If this was the last item on the current page (and not page 1)
          pageToFetch = pagination.currentPage - 1;
        }
        
        // Fetch with potentially adjusted page number
        fetchRegistrations(pageToFetch, pagination.pageSize, searchTerm, categoryFilter, statusFilter, registrationTypeFilter, checkInStatusFilter, badgePrintedFilter);

      } else {
        throw new Error(response?.message || response?.message || 'Unknown error during deletion');
      }
    } catch (err) {
      console.error("Error deleting registration:", err)
      message.error(`Failed to delete registration: ${err.message}`);
      // setLoading(false); // Already in finally
      setDeleteModal(false);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryChange = (value) => {
    setCategoryFilter(value || '');
  };
  
  const handleStatusChange = (value) => {
    setStatusFilter(value);
  };

  const handlePageChange = (newPage) => {
    console.log(`Changing to page: ${newPage}`);
    fetchRegistrations(newPage, pagination.pageSize, searchTerm, categoryFilter, statusFilter, registrationTypeFilter, checkInStatusFilter, badgePrintedFilter);
  };

  const handlePageSizeChange = (newPageSize) => {
    console.log(`Changing page size to: ${newPageSize}`);
    setPagination(prev => ({ ...prev, pageSize: newPageSize, currentPage: 1 }));
    fetchRegistrations(1, newPageSize, searchTerm, categoryFilter, statusFilter, registrationTypeFilter, checkInStatusFilter, badgePrintedFilter);
  };

  const handleViewDetails = async (registration) => {
    if (!registration) return;
    
    setSelectedRegistrant(registration);
    setIsLoadingResource(true);
    setIsDetailModalOpen(true);
    setActiveDetailTab('1'); // Reset to first tab

    try {
      // Load resource usage data using correct API endpoint
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      
      const resourceResponse = await fetch(`${baseUrl}/events/${eventId}/registrations/${registration._id}/resource-usage`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (resourceResponse.ok) {
        const resourceData = await resourceResponse.json();
        setResourceUsage(resourceData.data || []);
      } else {
        setResourceUsage([]);
        console.warn('Failed to load resource usage');
      }

      // Load resource blocks using correct endpoint
      await loadResourceBlocks(registration._id);
      
    } catch (error) {
      console.error('Error loading registration details:', error);
      setResourceUsage([]);
      setResourceBlocks([]);
      message.warning('Some details could not be loaded');
    } finally {
      setIsLoadingResource(false);
    }
  };

  const loadResourceBlocks = async (registrationId) => {
    if (!eventId || !registrationId) return;
    
    setLoadingResourceBlocks(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      
      const response = await fetch(`${baseUrl}/events/${eventId}/registrations/${registrationId}/resource-blocks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setResourceBlocks(data.data || []);
      } else {
        setResourceBlocks([]);
      }
    } catch (error) {
      console.error('Error loading resource blocks:', error);
      setResourceBlocks([]);
    } finally {
      setLoadingResourceBlocks(false);
    }
  };

  const handleRemoveResourceBlock = async (blockId, resourceType) => {
    if (!selectedRegistrant) return;
    
    try {
      const reason = prompt(`Enter reason for unblocking ${resourceType}:`);
      if (!reason) return;
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      
      const response = await fetch(`${baseUrl}/events/${eventId}/registrations/${selectedRegistrant._id}/resource-blocks/${blockId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      
      if (response.ok) {
        message.success('Resource unblocked successfully');
        loadResourceBlocks(selectedRegistrant._id);
      } else {
        message.error('Failed to unblock resource');
      }
    } catch (error) {
      console.error('Error removing resource block:', error);
      message.error('Error removing resource block');
    }
  };

  const handleVoidResource = async (resourceUsageId) => {
    if (!selectedRegistrant || !resourceUsageId) return;
    
    setIsVoiding(true);
    message.loading({ content: 'Voiding resource...', key: `void-${resourceUsageId}` });
    
    try {
      const response = await registrationService.voidResourceUsage(
        eventId,
        selectedRegistrant._id,
        resourceUsageId
      );
      
      console.log("Void API response:", response);
      
      if (response?.data?.success) {
        message.success({ content: 'Resource usage voided successfully!', key: `void-${resourceUsageId}`, duration: 2 });
        
        setResourceUsage(prevUsage => 
          prevUsage.map(item => 
            item._id === resourceUsageId 
              ? { ...item, isVoided: true, voidedAt: new Date(), voidedBy: response.data.data?.voidedBy }
              : item
          )
        );
      } else {
        throw new Error(response?.data?.message || response?.message || 'Failed to void resource');
      }
      
    } catch (error) {
      console.error('Error voiding resource:', error);
      message.error({ content: `Failed to void resource: ${error.message}`, key: `void-${resourceUsageId}`, duration: 3 });
    } finally {
      setIsVoiding(false);
    }
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [currentRegistration, setCurrentRegistration] = useState(null);

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleOpenViewModal = () => {
    setIsViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
  };

  const handleOpenDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  const handleOpenPrintModal = () => {
    setIsPrintModalOpen(true);
  };

  const handleClosePrintModal = () => {
    setIsPrintModalVisible(false);
  };

  const columns = useMemo(() => [
    {
      title: 'ID',
      dataIndex: 'registrationId',
      key: 'registrationId',
      width: 80,
      render: (text, record) => (
        <a 
          onClick={() => handleViewDetails(record)} 
          className="text-blue-600 hover:text-blue-800 cursor-pointer text-sm"
        >
          {text}
        </a>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'personalInfo.firstName',
      key: 'firstName',
      width: 120,
      render: (text, record) => (
        <span className="text-sm">{`${record.personalInfo?.firstName || ''} ${record.personalInfo?.lastName || ''}`}</span>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'personalInfo.email',
      key: 'email',
      width: 160,
      render: (text, record) => <span className="text-sm">{record.personalInfo?.email || '-'}</span>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category) => <span className="text-sm">{category?.name || '-'}</span>,
    },
    {
      title: 'Mobile',
      dataIndex: 'personalInfo.phone',
      key: 'phone',
      width: 110,
      render: (text, record) => <span className="text-sm">{record.personalInfo?.phone || '-'}</span>,
    },
    {
      title: 'Reg Type',
      dataIndex: 'registrationType',
      key: 'registrationType',
      width: 90,
      render: (type) => (
        <Tag size="small" color={type === 'pre-registered' ? 'blue' : type === 'on-spot' ? 'orange' : 'default'}>
          {type === 'pre-registered' ? 'Pre-Reg' : type === 'on-spot' ? 'On-Spot' : 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Payment',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 80,
      render: (status) => (
        <Tag size="small" color={
          status === 'paid' ? 'green' : 
          status === 'pending' ? 'orange' : 
          status === 'failed' ? 'red' : 'default'
        }>
          {status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending' : status === 'failed' ? 'Failed' : 'Unknown'}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 90,
      render: (text) => <span className="text-sm">{formatDate(text)}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <button
            key={`preview-${record._id}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePreviewRegistration(record);
            }}
            className="registration-action-button text-blue-600 hover:text-blue-900"
            title="Preview"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            key={`print-${record._id}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePrintBadgeClick(record);
            }}
            className="registration-action-button text-green-600 hover:text-green-900"
            title="Print Badge"
          >
            <PrinterIcon className="h-4 w-4" />
          </button>
          <button
            key={`edit-${record._id}`}
            onClick={(e) => {
              e.stopPropagation();
              handleEditRegistration(record);
            }}
            className="registration-action-button text-gray-600 hover:text-gray-900"
            title="Edit"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            key={`delete-${record._id}`}
            onClick={(e) => {
              e.stopPropagation();
              confirmDeleteRegistration(record);
            }}
            className="registration-action-button text-red-600 hover:text-red-900"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </Space>
      ),
    },
  ], [handlePreviewRegistration, handlePrintBadgeClick, handleEditRegistration, confirmDeleteRegistration]);

  // Row selection configuration for bulk operations
  const rowSelection = {
    selectedRowKeys: Array.from(bulkSelection),
    onChange: (selectedRowKeys) => {
      console.log('Row selection changed:', selectedRowKeys);
      setBulkSelection(new Set(selectedRowKeys));
    },
    onSelectAll: (selected, selectedRows, changeRows) => {
      console.log('Select all triggered:', selected, selectedRows.length);
      if (selected) {
        // Add all current page registrations to selection
        const currentKeys = currentRegistrations.map(reg => reg._id);
        setBulkSelection(prev => new Set([...prev, ...currentKeys]));
      } else {
        // Remove all current page registrations from selection
        const currentKeys = new Set(currentRegistrations.map(reg => reg._id));
        setBulkSelection(prev => new Set([...prev].filter(key => !currentKeys.has(key))));
      }
    },
    onSelect: (record, selected) => {
      console.log('Single row selection:', record._id, selected);
      setBulkSelection(prev => {
        const newSelection = new Set(prev);
        if (selected) {
          newSelection.add(record._id);
        } else {
          newSelection.delete(record._id);
        }
        return newSelection;
      });
    }
  };

  // Helper to normalize registration data for badge rendering
  function normalizeRegistrationData(reg) {
    if (!reg) return {};
    const personal = reg.personalInfo || {};
    return {
      ...reg,
      firstName: personal.firstName,
      lastName: personal.lastName,
      name: personal.name || `${personal.firstName || ''} ${personal.lastName || ''}`,
      organization: personal.organization,
      country: personal.country,
      designation: personal.designation,
      email: personal.email,
      phone: personal.phone,
      // Add more fields as needed
    };
  }

  // After fetchRegistrations, if categories is empty, fallback to extracting from registrations
  useEffect(() => {
    if (categories.length === 0 && registrations.length > 0) {
      const uniqueCategories = [];
      const seen = new Set();
      for (const reg of registrations) {
        const cat = reg.category;
        if (cat && cat._id && !seen.has(cat._id)) {
          uniqueCategories.push(cat);
          seen.add(cat._id);
        }
      }
      setCategories(uniqueCategories);
    }
  }, [registrations]);

  // Derive allCategories: combine categories from API and unique categories from registrations
  const allCategories = useMemo(() => {
    const apiCats = Array.isArray(categories) ? categories : [];
    const seen = new Set(apiCats.map(cat => cat._id));
    const cats = [...apiCats];
    for (const reg of allRegistrations) {
      const cat = reg.category;
      // If category is an object and not already in the list
      if (cat && typeof cat === 'object' && cat._id && !seen.has(cat._id)) {
        cats.push(cat);
        seen.add(cat._id);
      }
      // If category is a string (ID) and not already in the list
      if (cat && typeof cat === 'string' && !seen.has(cat)) {
        cats.push({ _id: cat, name: cat }); // Fallback: show ID as name
        seen.add(cat);
      }
    }
    return cats;
  }, [categories, allRegistrations]);

  if (activeAction === 'new') {
    handleAddRegistration();
    return null;
  }
  
  if (activeAction === 'import') {
    handleBulkImport();
    return null;
  }
  
  if (!eventId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Event data is not available.</p>
      </div>
    );
  }

  // Safety check for selectedRegistrant when modals are open
  if (isPrintModalVisible && !selectedRegistration) {
    setIsPrintModalVisible(false);
  }

  if (isDetailModalOpen && !selectedRegistrant) {
    setIsDetailModalOpen(false);
  }

  if (previewModal && !selectedRegistrant) {
    setPreviewModal(false);
  }

  // Use backend pagination instead of frontend slicing
  const currentRegistrations = searchTerm ? searchResults : registrations;
  const totalDisplayed = currentRegistrations.length;

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen bg-gray-50">

      {/* Enhanced Header with Bulk Operations */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-semibold text-gray-800">Registrations</h2>
          {bulkSelection.size > 0 && (
            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {bulkSelection.size} selected
              </Badge>
              <Dropdown overlay={getBulkActionsMenu()} trigger={['click']}>
                <AntdButton 
                  type="primary" 
                  icon={<UserGroupIcon className="w-4 h-4" />}
                  loading={bulkActionLoading}
                >
                  Bulk Actions <DownOutlined />
                </AntdButton>
              </Dropdown>
              <AntdButton 
                size="small" 
                icon={<XMarkIcon className="w-4 h-4" />}
                onClick={() => setBulkSelection(new Set())}
              >
                Clear
              </AntdButton>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <AntdButton 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAddRegistration} 
            style={{ 
              backgroundColor: '#2A4365',
              color: '#ffffff',
              opacity: 1
            }}
          >
            Add Registration
          </AntdButton>
          <AntdButton 
            icon={<ImportOutlined />} 
            onClick={() => navigate(`/events/${eventId}/registrations/bulk-import`)}
          >
            Import
          </AntdButton>
          <AntdButton 
            icon={<ExportOutlined />} 
            onClick={handleExport}
            loading={isExporting}
          >
            Export
          </AntdButton>
          <AntdButton
            icon={<SettingOutlined />}
            onClick={() => setIsExportModalOpen(true)}
          >
            Advanced Export
          </AntdButton>
          <AntdButton
            icon={<ReloadOutlined />}
            onClick={() => fetchRegistrations(pagination.currentPage, pagination.pageSize)}
          >
            Refresh
          </AntdButton>
        </div>
      </div>

      {/* Enhanced Filtering Panel */}
      <Card className="mb-4">
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <Input
              placeholder="Search by name, email, phone, ID..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchTerm}
              onChange={handleSearchChange}
              allowClear
              className="w-full lg:max-w-md"
              size="large"
            />
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Advanced Filters:</span>
              <Switch
                checked={advancedFiltersOpen}
                onChange={setAdvancedFiltersOpen}
                checkedChildren={<FilterOutlined />}
                unCheckedChildren={<FilterOutlined />}
              />
            </div>
          </div>
          
          {/* Basic Filters Row */}
          <div className="flex flex-wrap gap-3">
            <AntSelect
              placeholder="Category"
              allowClear
              style={{ minWidth: 150 }}
              value={categoryFilter || undefined}
              onChange={handleCategoryChange}
            >
              {allCategories.map(cat => (
                <Option key={cat._id} value={cat._id}>{cat.name}</Option>
              ))}
            </AntSelect>
            
            <AntSelect
              placeholder="Status"
              allowClear
              style={{ minWidth: 120 }}
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <Option value="active">Active</Option>
              <Option value="cancelled">Cancelled</Option>
              <Option value="no-show">No-Show</Option>
            </AntSelect>
            
            <AntSelect
              placeholder="Registration Type"
              allowClear
              style={{ minWidth: 160 }}
              value={registrationTypeFilter}
              onChange={setRegistrationTypeFilter}
            >
              <Option value="pre-registered">Pre-Registered</Option>
              <Option value="onsite">Onsite</Option>
              <Option value="imported">Imported</Option>
              <Option value="sponsored">Sponsored</Option>
              <Option value="complementary">Complementary</Option>
            </AntSelect>
            
            <AntSelect
              placeholder="Payment Status"
              allowClear
              style={{ minWidth: 140 }}
              value={paymentStatusFilter}
              onChange={setPaymentStatusFilter}
            >
              <Option value="completed">Completed</Option>
              <Option value="pending">Pending</Option>
              <Option value="failed">Failed</Option>
              <Option value="refunded">Refunded</Option>
            </AntSelect>
            
            <AntSelect
              placeholder="Badge Status"
              allowClear
              style={{ minWidth: 130 }}
              value={badgePrintedFilter}
              onChange={setBadgePrintedFilter}
            >
              <Option value="printed">Printed</Option>
              <Option value="notPrinted">Not Printed</Option>
            </AntSelect>
            
            <AntSelect
              placeholder="Check-in Status"
              allowClear
              style={{ minWidth: 140 }}
              value={checkInStatusFilter}
              onChange={setCheckInStatusFilter}
            >
              <Option value="checkedIn">Checked In</Option>
              <Option value="notCheckedIn">Not Checked In</Option>
            </AntSelect>
          </div>
          
          {/* Advanced Filters Panel */}
          {advancedFiltersOpen && (
            <Collapse defaultActiveKey={['filters']} ghost>
              <Panel header="Advanced Filters" key="filters">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Badge Status</label>
                    <AntSelect
                      placeholder="Badge Printed"
                      allowClear
                      style={{ width: '100%' }}
                      value={badgePrintedFilter}
                      onChange={setBadgePrintedFilter}
                    >
                      <Option value="printed">Printed</Option>
                      <Option value="notPrinted">Not Printed</Option>
                    </AntSelect>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Status</label>
                    <AntSelect
                      placeholder="Check-in Status"
                      allowClear
                      style={{ width: '100%' }}
                      value={checkInStatusFilter}
                      onChange={setCheckInStatusFilter}
                    >
                      <Option value="checkedIn">Checked In</Option>
                      <Option value="notCheckedIn">Not Checked In</Option>
                    </AntSelect>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                    <AntSelect
                      placeholder="Payment Status"
                      allowClear
                      style={{ width: '100%' }}
                      value={paymentStatusFilter}
                      onChange={setPaymentStatusFilter}
                    >
                      <Option value="completed">Completed</Option>
                      <Option value="pending">Pending</Option>
                      <Option value="failed">Failed</Option>
                      <Option value="refunded">Refunded</Option>
                    </AntSelect>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Results Per Page</label>
                    <AntSelect
                      value={pagination.pageSize}
                      onChange={handlePageSizeChange}
                      style={{ width: '100%' }}
                    >
                      <Option value={10}>10 per page</Option>
                      <Option value={25}>25 per page</Option>
                      <Option value={50}>50 per page</Option>
                      <Option value={100}>100 per page</Option>
                    </AntSelect>
                  </div>
                  
                  <div className="flex items-end">
                    <AntdButton 
                      type="default" 
                      block
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter('');
                        setStatusFilter(null);
                        setRegistrationTypeFilter('');
                        setBadgePrintedFilter('');
                        setCheckInStatusFilter('');
                        setPaymentStatusFilter('');
                        setBulkSelection(new Set());
                      }}
                    >
                      Clear All Filters
                    </AntdButton>
                  </div>
                </div>
              </Panel>
            </Collapse>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-2 text-gray-500">Loading registrations...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Failed to fetch registrations</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
                <p className="mt-2">Try refreshing the page or check the API connectivity.</p>
                {eventId && (
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={fetchRegistrations}
                      className="mr-2"
                    >
                      Retry
                    </Button>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={handleAddRegistration}
                    >
                      Add Registration
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card>
          {registrations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No registrations found for this event.</p>
              {eventId && (
                <div className="flex justify-center space-x-2">
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={handleAddRegistration}
                  >
                    Add Registration
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/events/${eventId}/registrations/bulk-import`)}
                  >
                    Import Registrations
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full overflow-visible">
              {/* Registrations Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Mobile-responsive table header */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Registrations ({totalDisplayed} of {pagination.totalCount || 0})
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </span>
                  </div>
                </div>
                
                {/* Responsive table */}
                <Table
                  rowKey="_id"
                  rowSelection={rowSelection}
                  columns={columns}
                  dataSource={currentRegistrations}
                  pagination={false}
                  size="small"
                  rowClassName="hover:bg-gray-50"
                />
              </div>
            </div>
          )}
        </Card>
      )}

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        showPageInfo={false}
      />

      {selectedRegistrant && (
        <Modal
          isOpen={previewModal}
          onClose={() => {
            console.log('[Preview Modal] Closing modal');
            setPreviewModal(false);
          }}
          title={`Badge Preview: ${selectedRegistrant?.personalInfo?.firstName || ''} ${selectedRegistrant?.personalInfo?.lastName || ''}`}
          centered={true}
        >
          <div className="flex flex-col items-center space-y-4">
            {(() => {
              // console.log('[Preview Modal] Rendering badge preview. badgeSettings:', badgeSettings, 'selectedRegistrant:', selectedRegistrant);
              if (badgeSettings) {
                // console.log('[Preview Modal] Rendering BadgeTemplate with badgeSettings.');
                return (
                  <div className="mb-4 p-4 border rounded flex justify-center bg-white">
                    <BadgeTemplate 
                      registrationData={normalizeRegistrationData(selectedRegistrant)}
                      template={badgeSettings}
                      previewMode={true}
                    />
                  </div>
                );
              } else {
                console.log('[Preview Modal] badgeSettings missing, rendering fallback preview.');
                return (
                  <div className="mb-4 p-4 border rounded flex flex-col items-center bg-white">
                    <div className="font-bold text-lg mb-2">{selectedRegistrant.personalInfo?.firstName} {selectedRegistrant.personalInfo?.lastName}</div>
                    <div className="text-gray-600 mb-2">ID: {selectedRegistrant.registrationId}</div>
                    <QRCode value={selectedRegistrant.registrationId || 'no-id'} size={96} />
                  </div>
                );
              }
            })()}
            <div className="flex justify-end space-x-3 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('[Preview Modal] Close button clicked');
                  setPreviewModal(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isEditModalOpen && (
        <AntdModal
          open={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          title={`Edit Registration - ${editFormData.firstName} ${editFormData.lastName} (${editFormData.registrationId || 'Loading...'})`}
          width={1400}
          style={{ top: 20 }}
          footer={[
            <AntdButton key="cancel" onClick={() => setIsEditModalOpen(false)}>Cancel</AntdButton>,
            <AntdButton key="save" type="primary" onClick={handleUpdateRegistration} loading={isSubmitting}>
              Save Changes
            </AntdButton>
          ]}
        >
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: '1',
                label: 'Personal Information',
                children: (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration ID</label>
                        <Input
                          value={editFormData.registrationId || 'Auto-generated'}
                          disabled={true}
                          className="bg-gray-100"
                        />
                        <span className="text-xs text-gray-500">Registration ID cannot be changed</span>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                        <Input
                          name="firstName"
                          value={editFormData.firstName}
                          onChange={handleEditFormChange}
                          placeholder="Enter first name"
                          status={validationErrors.firstName ? 'error' : ''}
                        />
                        {validationErrors.firstName && <span className="text-xs text-red-500">{validationErrors.firstName}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                        <Input
                          name="lastName"
                          value={editFormData.lastName}
                          onChange={handleEditFormChange}
                          placeholder="Enter last name"
                          status={validationErrors.lastName ? 'error' : ''}
                        />
                        {validationErrors.lastName && <span className="text-xs text-red-500">{validationErrors.lastName}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                        <Input
                          name="email"
                          type="email"
                          value={editFormData.email}
                          onChange={handleEditFormChange}
                          placeholder="Enter email address"
                          status={validationErrors.email ? 'error' : ''}
                        />
                        {validationErrors.email && <span className="text-xs text-red-500">{validationErrors.email}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                        <Input
                          name="mobile"
                          value={editFormData.mobile}
                          onChange={handleEditFormChange}
                          placeholder="Enter mobile number"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <Input
                          name="country"
                          value={editFormData.country}
                          onChange={handleEditFormChange}
                          placeholder="Enter country"
                        />
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: '2',
                label: 'Organization Details',
                children: (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                        <Input
                          name="organization"
                          value={editFormData.organization}
                          onChange={handleEditFormChange}
                          placeholder="Enter organization name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                        <Input
                          name="designation"
                          value={editFormData.designation}
                          onChange={handleEditFormChange}
                          placeholder="Enter designation"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">MCI Number</label>
                        <Input
                          name="mciNumber"
                          value={editFormData.mciNumber}
                          onChange={handleEditFormChange}
                          placeholder="Enter MCI number"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Membership</label>
                        <Input
                          name="membership"
                          value={editFormData.membership}
                          onChange={handleEditFormChange}
                          placeholder="Enter membership details"
                        />
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: '3',
                label: 'Registration Settings',
                children: (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <AntSelect 
                          value={editFormData.categoryId}
                          onChange={(value) => handleEditFormChange({ target: { name: 'categoryId', value } })}
                          style={{ width: '100%' }}
                          placeholder="Select category"
                        >
                          {categories.map(cat => (
                            <Option key={cat._id} value={cat._id}>{cat.name}</Option>
                          ))}
                        </AntSelect>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration Type</label>
                        <AntSelect
                          value={editFormData.registrationType}
                          onChange={value => handleEditFormChange({ target: { name: 'registrationType', value } })}
                          style={{ width: '100%' }}
                          placeholder="Select registration type"
                        >
                          <Option value="pre-registered">Pre-Registered</Option>
                          <Option value="onsite">Onsite</Option>
                          <Option value="imported">Imported</Option>
                          <Option value="sponsored">Sponsored</Option>
                          <Option value="complementary">Complementary</Option>
                        </AntSelect>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <AntSelect
                          value={editFormData.status}
                          onChange={value => handleEditFormChange({ target: { name: 'status', value } })}
                          style={{ width: '100%' }}
                          placeholder="Select status"
                        >
                          <Option value="active">Active</Option>
                          <Option value="cancelled">Cancelled</Option>
                          <Option value="no-show">No-Show</Option>
                        </AntSelect>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                        <AntSelect
                          value={editFormData.paymentStatus}
                          onChange={value => handleEditFormChange({ target: { name: 'paymentStatus', value } })}
                          style={{ width: '100%' }}
                          placeholder="Select payment status"
                        >
                          <Option value="pending">Pending</Option>
                          <Option value="completed">Completed</Option>
                          <Option value="failed">Failed</Option>
                          <Option value="refunded">Refunded</Option>
                        </AntSelect>
                      </div>
                      
                      {sponsors && sponsors.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sponsored By</label>
                          <AntSelect
                            value={editFormData.sponsoredBy}
                            onChange={value => handleEditFormChange({ target: { name: 'sponsoredBy', value } })}
                            style={{ width: '100%' }}
                            placeholder="Select sponsor (optional)"
                            allowClear
                          >
                            {sponsors.map(sponsor => (
                              <Option key={sponsor._id} value={sponsor._id}>{sponsor.name}</Option>
                            ))}
                          </AntSelect>
                        </div>
                      )}
                    </div>
                  </div>
                )
              },
              {
                key: '4',
                label: 'Custom Fields & Notes',
                children: (
                  <div className="p-4">
                    <div className="space-y-4">
                      {editFormData.customFields && Object.keys(editFormData.customFields).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Fields</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.keys(editFormData.customFields).map((key) => (
                              <div key={key}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{key}</label>
                                <Input
                                  name={`customFields.${key}`}
                                  value={editFormData.customFields[key] || ''}
                                  onChange={handleEditFormChange}
                                  placeholder={`Enter ${key}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <AntInput.TextArea
                          name="notes"
                          value={editFormData.notes || ''}
                          onChange={handleEditFormChange}
                          placeholder="Enter additional notes"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                )
              }
            ]}
          />
        </AntdModal>
      )}

      {selectedRegistrant && (
        <Modal
          isOpen={deleteModal}
          onClose={() => setDeleteModal(false)}
          title="Confirm Deletion"
          centered={true}
        >
          <p>Are you sure you want to delete registration for 
             <strong> {selectedRegistrant?.personalInfo?.firstName || ''} {selectedRegistrant?.personalInfo?.lastName || ''}</strong> ({selectedRegistrant?.registrationId})?
          </p>
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteRegistration} loading={loading}>Delete</Button>
          </div>
        </Modal>
      )}

      {/* Print Badge Modal */}
      <Modal
        isOpen={isPrintModalVisible}
        onClose={() => setIsPrintModalVisible(false)}
        title={`Print Badge: ${selectedRegistration?.personalInfo?.firstName || ''} ${selectedRegistration?.personalInfo?.lastName || ''}`}
      >
        <div id="badge-preview-container" className="mb-4 p-4 border rounded flex justify-center">
          {(() => {
            console.log('[Print Modal] badgeSettings passed to BadgeTemplate:', badgeSettings);
            if (!badgeSettings) {
              return <div className="text-red-600 font-semibold">No default badge template found for this event. Please set a default template in the Badge Designer.</div>;
            }
            if (!selectedRegistration) {
              return <div className="text-red-600 font-semibold">No registration selected for printing.</div>;
            }
            return (
              <BadgeTemplate 
                registrationData={normalizeRegistrationData(selectedRegistration)}
                template={badgeSettings}
              />
            );
          })()}
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setIsPrintModalVisible(false)}>Cancel</Button>
          <Button 
            variant="primary" 
            onClick={handlePrintBadge} 
            loading={isPrinting ? true : undefined}
            disabled={!badgeSettings || !selectedRegistration}
          >
            Print
          </Button>
        </div>
      </Modal>

      {/* --- Enhanced Detail Modal with Tabs --- */}
      {selectedRegistrant && (
        <AntdModal
          open={isDetailModalOpen}
          onCancel={() => setIsDetailModalOpen(false)}
          title={`Registration Details - ${selectedRegistrant?.personalInfo?.firstName || ''} ${selectedRegistrant?.personalInfo?.lastName || ''}`}
          width={1200}
          footer={[
            <AntdButton key="print" icon={<PrinterOutlined />} onClick={() => handlePrintBadgeClick(selectedRegistrant)} disabled={!badgeSettings}>
              Print Badge
            </AntdButton>,
            <AntdButton key="cert" icon={<MailOutlined />} onClick={() => handleSendCertificate(selectedRegistrant)} loading={isSendingCertificate ? true : undefined}>
              Send Certificate
            </AntdButton>,
            <AntdButton key="payment" type="primary" icon={<div className="w-4 h-4">💳</div>} 
              onClick={async () => {
                try {
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                  const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
                  const response = await fetch(`${baseUrl}/payments/generate-payment-link`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      registrationId: selectedRegistrant._id,
                      eventId: eventId
                    })
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    window.open(data.data?.paymentLink || data.paymentLink, '_blank');
                    message.success('Payment link generated and opened in new tab');
                  } else {
                    const errorData = await response.json();
                    message.error(errorData.message || 'Failed to generate payment link');
                  }
                } catch (error) {
                  console.error('Error generating payment link:', error);
                  message.error('Error generating payment link');
                }
              }}
              disabled={selectedRegistrant?.paymentStatus === 'completed'}
            >
              Generate Payment Link
            </AntdButton>,
            <AntdButton key="invoice" icon={<div className="w-4 h-4">📄</div>} 
              onClick={() => {
                message.info('Send invoice functionality coming soon!');
              }}
            >
              Send Invoice
            </AntdButton>,
            <AntdButton key="close" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </AntdButton>,
          ]}
        >
          {isLoadingResource ? (
            <div className="flex justify-center items-center h-40">
              <Spinner />
              <span className="ml-2">Loading details...</span>
            </div>
          ) : (
            <Tabs
              activeKey={activeDetailTab}
              onChange={setActiveDetailTab}
              items={[
                {
                  key: '1',
                  label: 'Personal Info',
                  children: (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                      <div className="space-y-6">
                        <div className="pb-4 border-b border-gray-200">
                          <h3 className="text-2xl font-bold text-gray-900 leading-tight">
                            {`${selectedRegistrant.personalInfo?.firstName} ${selectedRegistrant.personalInfo?.lastName}`}
                          </h3>
                          <div className="mt-1">
                            <Tag color={selectedRegistrant.category?.color || 'blue'}>
                               {selectedRegistrant.category?.name || 'N/A'}
                            </Tag>
                            <span className="ml-3 text-sm text-gray-500">ID: {selectedRegistrant.registrationId}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Contact & Organization</h4>
                           <div className="flex items-center text-sm text-gray-700">
                             <span className="font-medium w-20">Email:</span>
                             <span>{selectedRegistrant.personalInfo?.email || 'Not provided'}</span>
                           </div>
                           <div className="flex items-center text-sm text-gray-700">
                             <span className="font-medium w-20">Phone:</span>
                             <span>{selectedRegistrant.personalInfo?.phone || 'Not provided'}</span>
                           </div>
                           <div className="flex items-center text-sm text-gray-700">
                             <span className="font-medium w-20">Organization:</span>
                             <span>{selectedRegistrant.personalInfo?.organization || 'Not provided'}</span>
                           </div>
                           <div className="flex items-center text-sm text-gray-700">
                             <span className="font-medium w-20">Designation:</span>
                             <span>{selectedRegistrant.personalInfo?.designation || 'Not provided'}</span>
                           </div>
                           <div className="flex items-center text-sm text-gray-700">
                             <span className="font-medium w-20">Country:</span>
                             <span>{selectedRegistrant.personalInfo?.country || 'Not provided'}</span>
                           </div>
                         </div>
                         
                        {(selectedRegistrant.professionalInfo && (selectedRegistrant.professionalInfo.mciNumber || selectedRegistrant.professionalInfo.membership)) && (
                          <div className="space-y-3 pt-3 border-t border-gray-200">
                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Professional Info</h4>
                            <div className="flex items-center text-sm text-gray-700">
                              <span className="font-medium w-32">MCI Number:</span>
                              <span>{selectedRegistrant.professionalInfo?.mciNumber || 'N/A'}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-700">
                              <span className="font-medium w-32">Membership:</span>
                              <span>{selectedRegistrant.professionalInfo?.membership || 'N/A'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200 shadow">
                          <h4 className="text-base font-semibold mb-4 text-gray-700">Badge Preview</h4>
                          
                          <div className="w-full max-w-xs p-5 border border-gray-300 rounded-xl bg-slate-50 shadow-lg flex flex-col items-center space-y-3 text-center"
                            style={{ minHeight: '320px' }}>
                            {currentEventDetailsForModal?.name && (
                              <div className="text-xs text-gray-500 mb-1 w-full truncate px-2">
                                {currentEventDetailsForModal.name}
                              </div>
                            )}

                            <div className="px-4 py-1.5 rounded-full text-sm font-semibold text-white shadow-md tracking-wide"
                              style={{ backgroundColor: selectedRegistrant.category?.color || '#3B82F6' }}>
                              {selectedRegistrant.category?.name || 'N/A'}
                            </div>

                            <div className="font-bold text-2xl text-gray-800 pt-2">
                              {`${selectedRegistrant.personalInfo?.firstName || ''} ${selectedRegistrant.personalInfo?.lastName || ''}`}
                            </div>

                            <div className="text-md text-gray-600">
                              ID: {selectedRegistrant.registrationId || 'N/A'}
                            </div>

                            <div className="p-2.5 bg-white border-2 border-gray-200 rounded-lg inline-block shadow-md my-3">
                              <QRCode 
                                value={selectedRegistrant.registrationId || 'no-id'} 
                                size={110}
                                level="H"
                              />
                            </div>

                            {selectedRegistrant.personalInfo?.organization && (
                                <div className="text-sm text-gray-500 pt-2 border-t border-gray-200 w-full mt-auto">
                                   {selectedRegistrant.personalInfo?.organization}
                                </div>
                            )}
                             {!selectedRegistrant.personalInfo?.organization && (
                                <div className="text-sm text-gray-400 italic pt-2 border-t border-gray-200 w-full mt-auto">
                                   No Organization
                                </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                },
                {
                  key: '2',
                  label: 'Registration Info',
                  children: (
                    <div className="p-4 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Registration Details</h4>
                          <div className="space-y-2">
                            <div className="flex items-center text-sm">
                              <span className="font-medium w-32">Registered:</span>
                              <span>{formatDate(selectedRegistrant.createdAt)}</span>
                            </div>
                            {selectedRegistrant.updatedAt && selectedRegistrant.updatedAt !== selectedRegistrant.createdAt && (
                              <div className="flex items-center text-sm">
                                <span className="font-medium w-32">Last Updated:</span>
                                <span>{formatDate(selectedRegistrant.updatedAt)}</span>
                              </div>
                            )}
                            <div className="flex items-center text-sm">
                              <span className="font-medium w-32">Status:</span>
                              <Tag color={selectedRegistrant.status === 'active' ? 'green' : 'red'}>
                                {selectedRegistrant.status || 'active'}
                              </Tag>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="font-medium w-32">Type:</span>
                              <Tag color="blue">{selectedRegistrant.registrationType || 'pre-registered'}</Tag>
                            </div>
                            {/* Sponsor Information - NEW */}
                            {selectedRegistrant.sponsoredBy && (
                              <div className="flex items-start text-sm">
                                <span className="font-medium w-32">Sponsored By:</span>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <Tag color="gold" icon={<div className="w-3 h-3">🏢</div>}>
                                      {selectedRegistrant.sponsoredBy?.companyName || selectedRegistrant.sponsoredBy?.name || 'Sponsor'}
                                    </Tag>
                                  </div>
                                  {selectedRegistrant.sponsoredBy?.contactPerson && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Contact: {selectedRegistrant.sponsoredBy.contactPerson}
                                    </div>
                                  )}
                                  {selectedRegistrant.sponsoredBy?.email && (
                                    <div className="text-xs text-gray-500">
                                      Email: {selectedRegistrant.sponsoredBy.email}
                                    </div>
                                  )}
                                  {selectedRegistrant.sponsoredBy?.sponsorshipLevel && (
                                    <div className="text-xs">
                                      <Tag size="small" color="purple">
                                        {selectedRegistrant.sponsoredBy.sponsorshipLevel} Sponsor
                                      </Tag>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center text-sm">
                              <span className="font-medium w-32">Payment Status:</span>
                              <Tag color={
                                selectedRegistrant.paymentStatus === 'completed' ? 'green' :
                                selectedRegistrant.paymentStatus === 'pending' ? 'orange' :
                                selectedRegistrant.paymentStatus === 'failed' ? 'red' : 'default'
                              }>
                                {selectedRegistrant.paymentStatus || 'pending'}
                              </Tag>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Event Participation</h4>
                          <div className="space-y-2">
                            <div className="flex items-center text-sm">
                              <span className="font-medium w-32">Checked In:</span>
                              <Tag color={selectedRegistrant.checkIn?.isCheckedIn ? 'green' : 'red'}>
                                {selectedRegistrant.checkIn?.isCheckedIn ? 
                                  `Yes (${formatDate(selectedRegistrant.checkIn?.checkedInAt)})` : 'No'}
                              </Tag>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="font-medium w-32">Badge Printed:</span>
                              <Tag color={selectedRegistrant.badgePrinted ? 'green' : 'red'}>
                                {selectedRegistrant.badgePrinted ? 'Yes' : 'No'}
                              </Tag>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedRegistrant.notes && (
                        <div className="space-y-2 pt-3 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Notes</h4>
                          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                            <p className="whitespace-pre-wrap">{selectedRegistrant.notes}</p>
                          </div>
                        </div>
                      )}

                      {selectedRegistrant.customFields && Object.keys(selectedRegistrant.customFields).length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Custom Fields</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(selectedRegistrant.customFields).map(([key, value]) => (
                              <div key={key} className="flex items-center text-sm text-gray-700">
                                <span className="font-medium w-32">{key}:</span>
                                <span>{value?.toString() || 'N/A'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: '3',
                  label: 'Resource Usage',
                  children: (
                    <div className="p-4">
                      <h4 className="text-base font-semibold border-b pb-2 mb-3 text-gray-800">Resource Usage History</h4>
                      {resourceUsage.length > 0 ? (
                        <div className="space-y-2 text-sm max-h-96 overflow-y-auto">
                          {resourceUsage.map(item => (
                            <div key={item._id} className={`flex justify-between items-center p-3 rounded border ${
                              item.isVoided ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-300 shadow-sm'
                            }`}>
                              <div>
                                 <span className={`font-medium ${item.isVoided ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                   {item.displayName}
                                 </span>
                                 <span className="block text-xs text-gray-500">
                                   {item.type.charAt(0).toUpperCase() + item.type.slice(1)} - {formatDate(item.actionDate || item.createdAt)}
                                   {item.isVoided && ` (Voided ${formatDate(item.voidedAt)})`}
                                 </span>
                              </div>
                              {!item.isVoided && (
                                <Popconfirm
                                  title="Void this resource usage?"
                                  description="This action cannot be undone."
                                  onConfirm={() => handleVoidResource(item._id)}
                                  okText="Yes, Void"
                                  cancelText="No"
                                  okButtonProps={{ loading: isVoiding, danger: true }}
                                >
                                  <AntdButton 
                                     danger 
                                     size="small" 
                                     disabled={isVoiding}
                                  >
                                    Void
                                  </AntdButton>
                                </Popconfirm>
                              )}
                              {item.isVoided && (
                                  <Tag color="red">Voided</Tag>
                              )}
                            </div>
                          ))}
                        </div>
                       ) : (
                        <p className="text-sm text-gray-500 italic text-center py-8">No resources recorded for this registration</p> 
                      )}
                    </div>
                  )
                },
                {
                  key: '4',
                  label: 'Resource Blocking',
                  children: (
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-base font-semibold text-gray-800">Resource Blocking Status</h4>
                        <AntdButton 
                          type="primary" 
                          size="small"
                          onClick={() => {
                            if (selectedRegistrant) {
                              setIsResourceBlockModalOpen(true);
                            } else {
                              message.warning('Please select a registration first');
                            }
                          }}
                        >
                          Block Resource
                        </AntdButton>
                      </div>
                      
                      {loadingResourceBlocks ? (
                        <div className="flex justify-center py-8">
                          <Spinner />
                        </div>
                      ) : resourceBlocks && resourceBlocks.length > 0 ? (
                        <div className="space-y-3">
                          {resourceBlocks.map((block, index) => (
                            <div key={block._id || index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Tag color="red">BLOCKED</Tag>
                                    <span className="font-medium text-gray-800">
                                      {block.resourceType === 'food' ? '🍽️ Food' :
                                       block.resourceType === 'kit' ? '🎒 Kit' :
                                       block.resourceType === 'certificate' ? '📜 Certificate' : 
                                       block.resourceType}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">
                                    <strong>Reason:</strong> {block.reason}
                                  </p>
                                  <div className="text-xs text-gray-500">
                                    <p>Blocked on: {formatDate(block.createdAt)}</p>
                                    {block.expiresAt && (
                                      <p>Expires: {formatDate(block.expiresAt)}</p>
                                    )}
                                    <p>By: {block.blockedBy?.name || 'System'}</p>
                                  </div>
                                </div>
                                <AntdButton
                                  size="small"
                                  danger
                                  onClick={() => handleRemoveResourceBlock(block._id, block.resourceType)}
                                >
                                  Unblock
                                </AntdButton>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-center py-8">
                            <div className="text-gray-400 mb-2">
                              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-sm text-gray-500">
                              No resource blocks found for this registration.
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              Use resource blocking to prevent access to specific resources like meals, kits, or certificates.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }
              ]}
            />
          )}
        </AntdModal>
      )}

      {/* ===================== BULK OPERATION MODALS ===================== */}
      
      {/* Bulk Status Update Modal */}
      <AntdModal
        open={quickActions.bulkStatusModal}
        onCancel={() => setQuickActions(prev => ({ ...prev, bulkStatusModal: false }))}
        title={`Update Status for ${bulkSelection.size} Registrations`}
        footer={null}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Select a new status to apply to {bulkSelection.size} selected registrations:
          </p>
          <div className="space-y-2">
            <AntdButton 
              block 
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={() => handleBulkStatusUpdate('active')}
              loading={bulkActionLoading}
              className="text-left flex items-center justify-start"
            >
              <div className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
                Set to Active
              </div>
            </AntdButton>
            <AntdButton 
              block 
              size="large"
              icon={<CloseCircleOutlined />}
              onClick={() => handleBulkStatusUpdate('cancelled')}
              loading={bulkActionLoading}
              className="text-left flex items-center justify-start"
            >
              <div className="flex items-center">
                <XCircleIcon className="w-5 h-5 text-red-500 mr-2" />
                Set to Cancelled
              </div>
            </AntdButton>
            <AntdButton 
              block 
              size="large"
              icon={<UserOutlined />}
              onClick={() => handleBulkStatusUpdate('no-show')}
              loading={bulkActionLoading}
              className="text-left flex items-center justify-start"
            >
              <div className="flex items-center">
                <NoSymbolIcon className="w-5 h-5 text-gray-500 mr-2" />
                Set to No-Show
              </div>
            </AntdButton>
          </div>
        </div>
      </AntdModal>

      {/* Bulk Category Update Modal */}
      <AntdModal
        open={quickActions.bulkCategoryModal}
        onCancel={() => setQuickActions(prev => ({ ...prev, bulkCategoryModal: false }))}
        title={`Update Category for ${bulkSelection.size} Registrations`}
        footer={null}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Select a category to apply to {bulkSelection.size} selected registrations:
          </p>
          <AntSelect
            placeholder="Select Category"
            style={{ width: '100%' }}
            size="large"
            onChange={(categoryId) => handleBulkCategoryUpdate(categoryId)}
            loading={bulkActionLoading}
          >
            {allCategories.map(cat => (
              <Option key={cat._id} value={cat._id}>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">🏷️</span>
                  <span>{cat.name}</span>
                </div>
              </Option>
            ))}
          </AntSelect>
        </div>
      </AntdModal>

      {/* Bulk Email Modal */}
      <AntdModal
        open={quickActions.sendEmailModal}
        onCancel={() => setQuickActions(prev => ({ ...prev, sendEmailModal: false }))}
        title={`Send Email to ${bulkSelection.size} Registrations`}
        footer={[
          <AntdButton key="cancel" onClick={() => setQuickActions(prev => ({ ...prev, sendEmailModal: false }))}>
            Cancel
          </AntdButton>,
          <AntdButton 
            key="send" 
            type="primary" 
            icon={<MailOutlined />}
            loading={bulkActionLoading}
            onClick={() => {
              const emailData = {
                subject: document.getElementById('bulk-email-subject')?.value || '',
                body: document.getElementById('bulk-email-body')?.value || ''
              };
              handleBulkEmail(emailData);
            }}
          >
            Send Email
          </AntdButton>
        ]}
        width={600}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Compose an email to send to {bulkSelection.size} selected registrations:
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <Input 
              id="bulk-email-subject"
              placeholder="Enter email subject" 
              size="large"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <AntInput.TextArea 
              id="bulk-email-body"
              placeholder="Enter email message..." 
              rows={6}
              size="large"
            />
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">
              <strong>Recipients:</strong> {Array.from(bulkSelection).length} registrations selected
            </p>
          </div>
        </div>
      </AntdModal>

      {/* Resource Block Modal */}
      <AntdModal
        open={isResourceBlockModalOpen}
        onCancel={() => setIsResourceBlockModalOpen(false)}
        title="Block Resources"
        footer={[
          <AntdButton key="cancel" onClick={() => setIsResourceBlockModalOpen(false)}>
            Cancel
          </AntdButton>,
          <AntdButton 
            key="block" 
            type="primary" 
            onClick={() => {
              // Handle resource blocking logic here
              const selectedResources = document.querySelectorAll('input[name="resourceType"]:checked');
              const reason = document.getElementById('block-reason')?.value;
              
              if (selectedResources.length === 0) {
                message.warning('Please select at least one resource to block');
                return;
              }
              
              if (!reason) {
                message.warning('Please provide a reason for blocking');
                return;
              }
              
              selectedResources.forEach(async (input) => {
                try {
                  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/events/${eventId}/registrations/${selectedRegistrant._id}/resource-blocks`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      resourceType: input.value,
                      reason: reason
                    })
                  });
                  
                  if (response.ok) {
                    message.success(`${input.value} blocked successfully`);
                  } else {
                    message.error(`Failed to block ${input.value}`);
                  }
                } catch (error) {
                  console.error('Error blocking resource:', error);
                  message.error(`Error blocking ${input.value}`);
                }
              });
              
              // Refresh resource blocks
              loadResourceBlocks(selectedRegistrant._id);
              setIsResourceBlockModalOpen(false);
            }}
          >
            Block Resources
          </AntdButton>
        ]}
      >
        <div className="space-y-4">
          <div>
            <p className="text-gray-600 mb-4">
              Select resources to block for {selectedRegistrant?.personalInfo?.firstName} {selectedRegistrant?.personalInfo?.lastName}:
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  name="resourceType" 
                  value="food" 
                  id="block-food"
                  className="mr-2"
                />
                <label htmlFor="block-food" className="flex items-center">
                  <span className="mr-2">🍽️</span>
                  Food & Meals
                </label>
              </div>
              
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  name="resourceType" 
                  value="kit" 
                  id="block-kit"
                  className="mr-2"
                />
                <label htmlFor="block-kit" className="flex items-center">
                  <span className="mr-2">🎒</span>
                  Kit Bag
                </label>
              </div>
              
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  name="resourceType" 
                  value="certificate" 
                  id="block-certificate"
                  className="mr-2"
                />
                <label htmlFor="block-certificate" className="flex items-center">
                  <span className="mr-2">📜</span>
                  Certificates
                </label>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Blocking *
            </label>
            <AntInput.TextArea
              id="block-reason"
              placeholder="Enter reason for blocking these resources..."
              rows={3}
              required
            />
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Blocked resources will prevent this registration from accessing the selected items during check-in.
            </p>
          </div>
        </div>
      </AntdModal>

    </div>
  );
};

export default RegistrationsTab; 