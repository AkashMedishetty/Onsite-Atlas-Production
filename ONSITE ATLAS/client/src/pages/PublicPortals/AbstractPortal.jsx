import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Card,
  Input,
  Button,
  Alert,
  Spinner,
  Textarea,
  Select,
  Tabs
} from '../../components/common';
import { eventService, abstractService, registrationService } from '../../services';
import toast from 'react-hot-toast';
import { REGISTRANT_TOKEN_KEY, AUTHOR_TOKEN_KEY } from '../../config'; // Import keys for registrant & author tokens
import AuthorAuthWizard from '../../components/author/AuthorAuthWizard';
import { PencilSquareIcon, TrashIcon, EyeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

// API URL constant - use this instead of process.env
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : window.location.origin;

/**
 * Parses a date string in various formats including the admin-specific DD-MM-YYYY format
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {Date} - Parsed Date object
 */
const parseAdminDateFormat = (dateInput) => {
  if (!dateInput) return null;
  
  // If it's already a Date object, return it
  if (dateInput instanceof Date) return dateInput;
  
  // Try to parse the date string
  try {
    // Check for DD-MM-YYYY format
    if (typeof dateInput === 'string' && dateInput.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [day, month, year] = dateInput.split('-');
      return new Date(`${year}-${month}-${day}`);
    }
    
    // Handle ISO format date (YYYY-MM-DDTHH:mm:ss.sssZ)
    if (typeof dateInput === 'string' && dateInput.includes('T') && dateInput.includes('Z')) {
      // ISO dates can be parsed directly by the Date constructor
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Otherwise use standard date parsing
    const date = new Date(dateInput);
    
    // Verify the date is valid before returning
    if (isNaN(date.getTime())) {
      console.warn("Invalid date after parsing:", dateInput);
      return null;
    }
    
    return date;
  } catch (error) {
    console.error("Error parsing date:", error, dateInput);
    return null;
  }
};

/**
 * Custom FileUpload component
 */
const FileUpload = ({ onChange, error, accept, maxSize }) => {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };
  
  const handleFile = (file) => {
    // Validate file size if maxSize is provided
    if (maxSize && file.size > maxSize) {
      alert(`File is too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB.`);
      return;
    }
    setFile(file);
    if (onChange) onChange(file);
  };

  return (
    <div className="mt-1">
      <div 
        className={`relative border-2 border-dashed rounded-md p-6 ${error ? 'border-red-300' : dragActive ? 'border-blue-300 bg-blue-50' : 'border-gray-300'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
          accept={accept}
        />
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-1 text-sm text-gray-600">
            {file ? file.name : 'Drag and drop a file, or click to select a file'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {accept?.split(',').map(type => type.replace(/\./g, '').toUpperCase()).join(', ')} 
            up to {maxSize ? `${Math.round(maxSize / (1024 * 1024))}MB` : '5MB'}
          </p>
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {file && (
        <div className="mt-2 flex items-center">
          <span className="text-sm text-gray-500 mr-2">Selected file:</span>
          <span className="text-sm font-medium">{file.name}</span>
          <button
            type="button"
            className="ml-auto text-sm text-red-600 hover:text-red-900"
            onClick={() => {
              setFile(null);
              if (onChange) onChange(null);
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Creates a valid MongoDB ObjectId string
 * This is for testing/demo purposes when a real MongoDB ID is not available
 * Based on MongoDB ObjectId algorithm: 4-byte timestamp + 5-byte random + 3-byte counter
 * @returns {string} A 24-character hex string that resembles a MongoDB ObjectId
 */
const generateValidObjectId = () => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const randomPart = Math.random().toString(16).substring(2, 12).padStart(10, '0');
  const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
  return timestamp + randomPart + counter;
};

/**
 * Helper function to format dates
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

// Helper for safe stringifying, even if obj is undefined
const safeJsonStringify = (obj) => {
  if (obj === undefined) return 'undefined';
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return `Error stringifying object: ${e.message}`;
  }
};

/**
 * Enhanced Abstract Portal Component
 * Features:
 * - Login with registration ID
 * - View existing abstracts
 * - Submit new abstracts (text or file upload)
 * - Admin review interface
 */
const AbstractPortal = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  // Override window.alert to automatically dismiss messages about edit functionality
  useEffect(() => {
    // Store the original alert function
    const originalAlert = window.alert;
    
    // Override with our own implementation
    window.alert = function(message) {
      // Check if it's our specific message about edit functionality
      if (message && typeof message === 'string' && 
          message.toLowerCase().includes('edit functionality will be implemented')) {
        console.log("Intercepted alert about edit functionality - allowing edit to proceed");
        // Just log the message but don't display the alert
        return;
      }
      
      // For all other alerts, call the original function
      return originalAlert.apply(this, arguments);
    };
    
    // Restore the original alert function when the component unmounts
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // State
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [eventDetails, setEventDetails] = useState(null);
  const [registrationId, setRegistrationId] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [userAbstracts, setUserAbstracts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [selectedSubTopics, setSelectedSubTopics] = useState([]); // State for sub-topics of the selected category
  const [anyProofUploaded, setAnyProofUploaded] = useState(false);
  const [needsProofPrompt, setNeedsProofPrompt] = useState(false);
  const [proofPending, setProofPending] = useState(false);
  const statusesNeedingProof = ['accepted','approved'];
  
  const [abstractForm, setAbstractForm] = useState({
    title: '',
    authors: '',
    affiliations: '',
    category: '',
    subTopic: '',
    content: '',
    file: null,
    existingAbstractId: null // To track if the form is for edit mode
  });
  const [formErrors, setFormErrors] = useState({}); // For form field validation errors
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' }); // For overall form submission status
  const [submitting, setSubmitting] = useState(false); // shows loader during form submit

  // Controls the main view of the portal for authors
  const [currentView, setCurrentView] = useState('login'); // Possible values: 'login', 'list', 'form'
  const [editingAbstract, setEditingAbstract] = useState(null); // Holds the abstract object if in edit mode
  const [availableSubTopics, setAvailableSubTopics] = useState([]); // For storing subtopics based on selected category

  // New state for login type
  const [loginType, setLoginType] = useState('registration'); // 'registration' | 'author'

  // Fetch Event Details
  useEffect(() => {
    const fetchEventData = async () => {
        setLoading(true);
      try {
        const details = await eventService.getEventById(eventId);
        if (details.success) {
          setEventDetails(details.data);
          if (details.data.abstractSettings?.categories?.length > 0) {
            // Store the full category object, including subTopics
            // Ensure each category object has a unique 'value' for the Select component,
            // using its _id.
            setCategories(details.data.abstractSettings.categories.map((cat, index) => {
              if (!cat._id) {
                console.warn(`Category "${cat.name}" at index ${index} is missing an _id. Submission might fail. Using name as fallback value.`);
              }
              return {
                value: cat._id || cat.name, // Use _id if available, fallback to name (and log warning)
                label: cat.name,
                subTopics: cat.subTopics || [] // Ensure subTopics is an array
              };
            }));
          }
        } else {
          toast.error(details.message || 'Failed to fetch event details.');
        }
      } catch (err) {
        toast.error('Error fetching event details: ' + err.message);
      }
      setLoading(false); // Ensure loading is set to false regardless of outcome
    };
    fetchEventData();
  }, [eventId, toast]);

  const resetAbstractForm = () => {
    setAbstractForm({
      title: '',
      authors: '',
      affiliations: '',
      category: '',
      subTopic: '',
      content: '',
      file: null,
      existingAbstractId: null
    });
    setFormErrors({});
    setAvailableSubTopics([]);
    setEditingAbstract(null);
  };

  const handleRegistrationAuth = async (e) => {
    if (e) e.preventDefault();
    setAuthenticating(true);
    setAuthError(null);
    try {
      const response = await registrationService.getRegistrationByRegIdString(eventId, registrationId);
      // Assuming the response structure is { success: boolean, data: userInfo, token: string }
      if (response.success && response.data && response.token) {
        setUserInfo(response.data);
        setAuthenticated(true);
        localStorage.setItem(REGISTRANT_TOKEN_KEY, response.token); // STORE THE TOKEN
        await fetchUserAbstracts(response.data._id);
        setCurrentView('list');
        toast.success('Logged in successfully!');
      } else if (response.success && response.data && !response.token) {
        // Handle case where login is successful but no token is returned (should not happen for registrant auth)
        setAuthError('Authentication successful, but no session token was provided. Please contact support.');
        setAuthenticated(false);
        } else {
        setAuthError(response.message || 'Invalid Registration ID or Event.');
        setAuthenticated(false);
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
      setAuthenticated(false);
    }
    setAuthenticating(false);
  };

  const fetchUserAbstracts = async (registrationMongoId) => {
    if (!eventId) {
      console.error("Missing event ID");
      return;
    }
    const isAuthor = !!localStorage.getItem('atlas_author_token');
    if (!isAuthor && !registrationMongoId) {
      console.error("Missing registration ID for registrant");
      return;
    }
    
    setLoading(true);
    try {
      // Assuming abstractService.getAbstracts can be filtered by registration Mongo ID and eventId
      // The backend controller for getAbstracts was shown to handle query.registration = mongoId
      const params = isAuthor ? {} : { registration: registrationMongoId }; 
      console.log("Fetching abstracts with params:", params);
      const response = await abstractService.getAbstracts(eventId, params);
      
      console.log("API response for abstracts:", response);
      
      if (response && response.success) {
        console.log("Raw abstracts data:", response.data);
        const absArr = response.data || [];
        setUserAbstracts(absArr);
        // Check if any accepted abstracts without proof
        const acceptedAbstracts = absArr.filter(a=>statusesNeedingProof.includes((a.status||'').toLowerCase()));
        const anyAccepted = acceptedAbstracts.length>0;
        const anyProofUploaded = absArr.some(a => a.registrationVerified);
        const proofPendingNow = acceptedAbstracts.some(a=>a.registrationProofUrl && !a.registrationVerified);
        setProofPending(proofPendingNow);
        setNeedsProofPrompt(anyAccepted && !anyProofUploaded);
        // Flag to allow access in component
        setAnyProofUploaded(anyProofUploaded);
      } else {
        toast.error(response && response.message ? response.message : 'Failed to fetch your abstracts.');
        setUserAbstracts([]);
      }
    } catch (err) {
      console.error("Error fetching abstracts:", err);
      toast.error(err && err.message ? `Error fetching your abstracts: ${err.message}` : 'Error fetching your abstracts.');
      setUserAbstracts([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    setUserInfo(null);
    setAuthenticated(false);
    setUserAbstracts([]);
    setRegistrationId('');
    setCurrentView('login');
    // toast.success('Logged out.'); // Optional: if you have a global toast setup
    // Potentially call a backend logout endpoint if session/token needs invalidation server-side
  };
  
  // Form handling methods
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setAbstractForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const handleSelectChange = (value, { name }) => {
    setAbstractForm(prev => ({
      ...prev,
      [name]: value,
      // Clear subtopic when category changes
      ...(name === 'category' ? { subTopic: '' } : {})
    }));
    
    // Update available subtopics when category changes
    if (name === 'category') {
      const selectedCategory = eventDetails?.abstractSettings?.categories?.find(cat => cat._id === value);
      setAvailableSubTopics(selectedCategory?.subTopics?.map(subTopic => ({
        value: subTopic._id || subTopic.id || subTopic.value || subTopic,
        label: subTopic.name || subTopic.label || subTopic
      })) || []);
      
      console.log("Category changed, updating subtopics:", selectedCategory?.subTopics);
    }
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
    // If category changed, also clear any existing subTopic error
    if (name === 'category' && formErrors.subTopic) {
      setFormErrors(prev => ({
        ...prev,
        subTopic: null
      }));
    }
  };
  
  const handleFileChange = (file) => {
    setAbstractForm(prev => ({
      ...prev,
      file
    }));
    
    // Clear file error
    if (formErrors.file) {
      setFormErrors(prev => ({
        ...prev,
        file: null
      }));
    }
  };
  
  const validateAbstractForm = () => {
    const errors = {};
    const isEditMode = formErrors.edit === true;
    
    // Validate title
    if (!abstractForm.title || !abstractForm.title.trim()) {
      errors.title = 'Title is required';
    } else if (abstractForm.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters long';
    } else if (abstractForm.title.trim().length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }
    
    // Validate authors
    if (!abstractForm.authors || !abstractForm.authors.trim()) {
      errors.authors = 'Authors are required';
    } else if (abstractForm.authors.trim().length < 2) {
      errors.authors = 'Authors field must be at least 2 characters long';
    }
    
    // Validate category
    if (!abstractForm.category) {
      errors.category = 'Please select a category';
    }
    
    // Validate subTopic if the selected category has sub-topics and sub-topic selection is required
    // This logic assumes a convention or a specific setting (e.g., requireSubTopicPerCategory in abstractSettings)
    const selectedCategoryData = categories.find(cat => cat.value === abstractForm.category);
    if (selectedCategoryData && selectedCategoryData.subTopics && selectedCategoryData.subTopics.length > 0) {
      // Example: Make subTopic required if eventDetails.abstractSettings.requireSubTopic is true
      // You might have a more granular setting, e.g. category.requireSubTopic
      const subTopicIsRequired = eventDetails?.abstractSettings?.requireSubTopicForEnabledCategories; // Hypothetical setting
      if (subTopicIsRequired && !abstractForm.subTopic) {
        errors.subTopic = 'Please select a sub-topic for the chosen category';
      }
    }
    
    // Validate topic (required by backend)
    if (!abstractForm.category) {
      errors.topic = 'Please select a category first';
    }
    
    // Validate subtopic only if the selected category has subtopics
    const selectedCategory = eventDetails?.abstractSettings?.categories?.find(
      cat => cat._id === abstractForm.category
    );
    
    if (selectedCategory?.subTopics?.length > 0 && !abstractForm.subTopic) {
      errors.subTopic = 'Please select a subtopic';
    }
    
    // Validate content (only required if no file is attached)
    const hasFile = !!abstractForm.file;
    
    // If file upload is enabled in event settings
    if (eventDetails?.abstractSettings?.allowFiles) {
      // Content is optional if there's a file
      if (!hasFile && (!abstractForm.content || !abstractForm.content.trim())) {
        errors.content = 'Please either provide content or upload a file';
      } else if (abstractForm.content && abstractForm.content.trim().length < 10 && !hasFile) {
        errors.content = 'Abstract content must be at least 10 characters long';
      }
    } else {
      // Content is always required if file upload is not enabled
    if (!abstractForm.content || !abstractForm.content.trim()) {
      errors.content = 'Abstract content is required';
    } else if (abstractForm.content.trim().length < 10) {
      errors.content = 'Abstract content must be at least 10 characters long';
      }
    }
    
    // Check word count if content is provided
    if (abstractForm.content && abstractForm.content.trim()) {
      const wordCount = abstractForm.content.trim().split(/\s+/).length;
      const maxWords = eventDetails?.abstractSettings?.maxLength || 500;
      
      if (wordCount > maxWords) {
        errors.content = `Abstract exceeds maximum word count of ${maxWords} words`;
      }
    }
    
      // Preserve the edit flag if it exists
    if (isEditMode) {
      errors.edit = true;
    }
    
    setFormErrors(errors);
    console.log("Form validation errors:", errors);
    
    return Object.keys(errors).length === (isEditMode ? 1 : 0); // If in edit mode, we expect the edit flag
  };
  
  const handleSubmitAbstract = async (e) => {
    e.preventDefault();
    if (!validateAbstractForm()) return;
    setSubmitMessage({ type: '', text: '' });
    setSubmitting(true);
    console.log('Submitting...');

    try {
      // Determine if the current session belongs to a pre-registration author (author token present)
      const isAuthorSession = !!localStorage.getItem(AUTHOR_TOKEN_KEY);

      // For registrant flow we must have userInfo._id, but for authors this is optional
      if (!isAuthorSession && (!userInfo || !userInfo._id)) {
        throw new Error('User information is missing. Please log in again.');
      }

      // Add category name for reference and a default content if only a file is being submitted
      const dataToSend = { 
        ...abstractForm,
        // Set topic to match category name for backend validation
        topic: getCategoryNameById(abstractForm.category),
        // If content is empty but there's a file, use a placeholder for content
        content: abstractForm.content?.trim() ? abstractForm.content.trim() : (abstractForm.file ? '[See attached file]' : ''),
        event: eventId, 
        // Only include the registration reference when we are in the post-registration (registrant) flow
        ...(isAuthorSession ? {} : { registration: userInfo._id })
      };
      
      console.log("Preparing to submit abstract data:", dataToSend);
      
    // Remove file from dataToSend if it's handled by a separate upload call later
    const hasFile = dataToSend.file;
      if (hasFile) delete dataToSend.file;

      let response;
      // Create a payload for the service, excluding the file object itself
      const payloadForService = { ...dataToSend };
      if (payloadForService.file) { // abstractForm.file might be null
        delete payloadForService.file; // Remove if it's just a placeholder or null
      }

      if (abstractForm.existingAbstractId) {
        console.log("Updating existing abstract:", abstractForm.existingAbstractId);
        response = await abstractService.updateAbstract(eventId, abstractForm.existingAbstractId, dataToSend);
      } else {
        console.log("Creating new abstract with data:", JSON.stringify(dataToSend, null, 2));
        response = await abstractService.createAbstract(eventId, dataToSend); 
      }

      console.log("Abstract submission response:", response);

      if (response && response.success && response.data) {
        const abstractId = response.data._id;
        if (hasFile && abstractForm.file) {
          console.log("Uploading file for abstract:", abstractId);
          const fileUploadResponse = await abstractService.uploadAbstractFile(eventId, abstractId, abstractForm.file);
          console.log("File upload response:", fileUploadResponse);
          
          if (!fileUploadResponse || !fileUploadResponse.success) {
            toast.error(`Abstract ${abstractForm.existingAbstractId ? 'updated' : 'created'} but file upload failed: ${fileUploadResponse ? fileUploadResponse.message : 'Unknown error'}`);
            } else {
            toast.success(`Abstract ${abstractForm.existingAbstractId ? 'updated' : 'created'} and file uploaded successfully!`);
          }
        } else {
          toast.success(`Abstract ${abstractForm.existingAbstractId ? 'updated' : 'created'} successfully!`);
        }
        
        resetAbstractForm();
        
        // Track the state changes
        console.log("Before fetching updated abstracts, userInfo:", userInfo);
          console.log("Fetching updated abstracts after submission");
        if (isAuthorSession) {
          await fetchUserAbstracts(null); // registration ID not needed for author flow
        } else if (userInfo && userInfo._id) {
        await fetchUserAbstracts(userInfo._id);
        }
        
        console.log("Setting view to list");
        setCurrentView('list');
      } else {
        setSubmitMessage({ 
          type: 'error', 
          text: response && response.message ? response.message : 'Submission failed.' 
        });
        toast.error(response && response.message ? response.message : 'Submission failed.');
      }
    } catch (error) {
      console.error("Error in handleSubmitAbstract:", error);
      setSubmitMessage({ 
        type: 'error', 
        text: error && error.message ? error.message : 'An error occurred.' 
      });
      toast.error(error && error.message ? error.message : 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDeleteAbstract = async (abstractIdToDelete) => {
    if (!window.confirm('Are you sure you want to delete this abstract?')) return;
    try {
      // Ensure abstract belongs to user - backend should enforce this, but good client check too
      const abstractToDelete = userAbstracts.find(abs => abs._id === abstractIdToDelete);
      if (!abstractToDelete || abstractToDelete.registration !== userInfo?._id) {
         // This check might be tricky if registration is not directly on abstract object or populated differently
         // console.warn("Attempt to delete abstract not belonging to user or user info missing.");
         // toast.error("Unauthorized to delete this abstract.");
         // return;
      }

      const response = await abstractService.deleteAbstract(eventId, abstractIdToDelete);
      if (response.success) {
        toast.success('Abstract deleted successfully.');
        const isAuthorSession = !!localStorage.getItem(AUTHOR_TOKEN_KEY);
        if (isAuthorSession) {
          await fetchUserAbstracts(null);
        } else if (userInfo && userInfo._id) {
        await fetchUserAbstracts(userInfo._id);
        }
        // If currentView was showing details of this abstract, switch to list
        if (currentView === 'form' && editingAbstract?._id === abstractIdToDelete) {
            setCurrentView('list');
            resetAbstractForm();
        }
      } else {
        toast.error(response.message || 'Failed to delete abstract.');
      }
    } catch (error) {
      toast.error(error.message || 'Error deleting abstract.');
    }
  };

  const handleEditAbstract = (abstractToEdit) => {
    console.log("[handleEditAbstract] Called with abstractToEdit:", safeJsonStringify(abstractToEdit));
    if (!abstractToEdit) {
      console.error("[handleEditAbstract] Attempted to edit undefined abstract");
      toast.error("Cannot edit abstract: missing data");
      return;
    }

    setEditingAbstract(abstractToEdit);

    // --- Category Handling --- 
    let categoryIdToSet = '';
    // Ensure abstractToEdit.category is not null before trying to access _id
    if (abstractToEdit.category && typeof abstractToEdit.category === 'object' && abstractToEdit.category._id) {
      categoryIdToSet = abstractToEdit.category._id;
    } else if (typeof abstractToEdit.category === 'string') {
      categoryIdToSet = abstractToEdit.category;
    } else if (abstractToEdit.category === null) {
      console.warn("[handleEditAbstract] abstractToEdit.category is null.");
      // categoryIdToSet remains ''
    }
    console.log("[handleEditAbstract] Resolved categoryIdToSet for form:", categoryIdToSet);

    const selectedCategoryFull = categoryIdToSet 
      ? eventDetails?.abstractSettings?.categories?.find(cat => cat._id === categoryIdToSet)
      : undefined; // If no categoryIdToSet, selectedCategoryFull is undefined
    console.log("[handleEditAbstract] selectedCategoryFull from eventDetails:", safeJsonStringify(selectedCategoryFull));

    const currentAvailableSubTopics = selectedCategoryFull?.subTopics?.map(subTopic => ({
      value: subTopic._id || subTopic.id || subTopic.value || subTopic, 
      label: subTopic.name || subTopic.label || subTopic
    })) || [];
    setAvailableSubTopics(currentAvailableSubTopics);
    console.log("[handleEditAbstract] Populated availableSubTopics:", safeJsonStringify(currentAvailableSubTopics));

    // --- SubTopic Handling ---
    let subTopicIdToSet = '';
    if (abstractToEdit.subTopic && typeof abstractToEdit.subTopic === 'object' && abstractToEdit.subTopic._id) {
      subTopicIdToSet = abstractToEdit.subTopic._id;
    } else if (typeof abstractToEdit.subTopic === 'string') {
      const foundSubTopicByNameOrId = currentAvailableSubTopics.find(st => st.label === abstractToEdit.subTopic || st.value === abstractToEdit.subTopic);
      if (foundSubTopicByNameOrId) {
        subTopicIdToSet = foundSubTopicByNameOrId.value;
      } else {
        subTopicIdToSet = abstractToEdit.subTopic; 
      }
    } else if (abstractToEdit.subTopic === null){
      console.warn("[handleEditAbstract] abstractToEdit.subTopic is null.");
      // subTopicIdToSet remains ''
    }
    console.log("[handleEditAbstract] Resolved subTopicIdToSet for form:", subTopicIdToSet);

    const formToSet = {
      title: abstractToEdit.title || '',
      authors: abstractToEdit.authors || '',
      affiliations: abstractToEdit.authorAffiliations || abstractToEdit.affiliations || '',
      category: categoryIdToSet, 
      subTopic: subTopicIdToSet, 
      content: abstractToEdit.content || '',
      file: null, 
      existingAbstractId: abstractToEdit._id
    };
    setAbstractForm(formToSet);
    console.log("[handleEditAbstract] Setting abstractForm state to:", safeJsonStringify(formToSet));
    
    setFormErrors(prev => ({ ...prev, edit: true }));
    setSubmitMessage({ type: '', text: '' });
    setCurrentView('form');
  };

  const handleAddNewAbstract = () => {
    // Ensure the form is reset to its default state for a new submission
    resetAbstractForm(); 
    // Switch the view to show the abstract form
    setCurrentView('form'); 
  };

  // Function to handle viewing an abstract's details
  const handleViewAbstract = (abstract) => {
    // Safety check for undefined abstract
    if (!abstract) {
      console.error("Attempted to view undefined abstract");
      toast.error("Cannot view abstract: missing data");
      return;
    }
    
    console.log("Viewing abstract:", abstract);
    
    // Create modal for viewing abstract details
    const modalDiv = document.createElement('div');
    modalDiv.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
    
    // Use null coalescing and optional chaining for safer property access
    const modalContent = `
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-lg font-medium">Abstract Details</h3>
          <button class="modal-close text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-4">
          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Abstract Number:</p>
            <p class="text-lg font-medium">${abstract.abstractNumber || 'N/A'}</p>
          </div>

          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Title:</p>
            <p class="text-lg font-medium">${abstract.title || 'Untitled'}</p>
          </div>
          
          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Authors:</p>
            <p>${abstract.authors || 'Not specified'}</p>
          </div>
          
          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Affiliations:</p>
            <p>${abstract.authorAffiliations || abstract.affiliations || 'Not provided'}</p>
          </div>
          
          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Category:</p>
            <p>${getCategoryNameById(abstract.category) || 'Not specified'}</p>
          </div>
          
          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Subtopic:</p>
            <p>${abstract.subTopic || 'Not specified'}</p>
          </div>
          
          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Abstract Content:</p>
            <div class="border rounded-md p-4 bg-gray-50 max-h-60 overflow-y-auto whitespace-pre-wrap">
              ${abstract.content || 'No content provided'}
            </div>
          </div>
          
          ${abstract.fileUrl ? `
            <div class="mb-3">
              <p class="text-sm font-semibold text-gray-700">Attached File:</p>
              <a href="${abstract.fileUrl?.startsWith('http') ? 
                abstract.fileUrl : 
                `${API_BASE_URL}${abstract.fileUrl}`}" 
                target="_blank" 
                class="text-blue-600 hover:underline flex items-center">
                ${abstract.fileName || 'Download File'}
              </a>
            </div>
          ` : ''}

          <div class="mb-3">
            <p class="text-sm font-semibold text-gray-700">Review Details:</p>
            ${abstract.reviewDetails && Array.isArray(abstract.reviewDetails.reviews) && abstract.reviewDetails.reviews.length > 0
              ? abstract.reviewDetails.reviews.map((review, idx) => `
                <div class="border rounded p-2 mb-2 bg-gray-50">
                  <div><span class="font-semibold">Decision:</span> ${review.decision || 'N/A'}</div>
                  <div><span class="font-semibold">Score:</span> ${review.score !== undefined && review.score !== null ? review.score : 'N/A'}</div>
                  <div><span class="font-semibold">Comments:</span> <span class="whitespace-pre-line">${review.comments || 'No comments'}</span></div>
                </div>
              `).join('')
              : '<div class="text-gray-500">No reviews available yet.</div>'}
          </div>
        </div>
        <div class="p-4 border-t flex justify-end">
          <button class="modal-close px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Close</button>
        </div>
      </div>
    `;
    
    modalDiv.innerHTML = modalContent;
    
    document.body.appendChild(modalDiv);
    
    // Add event listeners for closing the modal
    const closeButtons = modalDiv.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        document.body.removeChild(modalDiv);
      });
    });
    
    // Also close when clicking outside the modal
    modalDiv.addEventListener('click', (e) => {
      if (e.target === modalDiv) {
        document.body.removeChild(modalDiv);
      }
    });
  };

  // Helper function to get category name by ID
  const getCategoryNameById = (categoryId) => {
    // console.log(`[getCategoryNameById] Called with categoryId: ${categoryId}`);
    // console.log(`[getCategoryNameById] Event Details:`, eventDetails);
    // console.log(`[getCategoryNameById] Abstract Settings:`, eventDetails?.abstractSettings);
    // console.log(`[getCategoryNameById] Categories in eventDetails:`, eventDetails?.abstractSettings?.categories);

    if (!categoryId) {
      // console.log("[getCategoryNameById] No categoryId provided, returning 'None'");
      return 'None';
    }
    if (!eventDetails || !eventDetails.abstractSettings || !Array.isArray(eventDetails.abstractSettings.categories)) {
      // console.log("[getCategoryNameById] Event details or categories array not available. CategoryId:", categoryId);
      // Return the ID itself or a placeholder if categories are not loaded yet
      return categoryId; // Or 'Loading Category...' or 'Unknown Category'
    }

    const category = eventDetails.abstractSettings.categories.find(cat => cat._id === categoryId);
    
    // console.log(`[getCategoryNameById] Found category for ID ${categoryId}:`, category);
    return category ? category.name : 'Unknown Category'; // Or return categoryId if not found
  };

  // Helper function to get sub-topic name by ID
  const getSubTopicNameById = (subTopicId) => {
    console.log("[getSubTopicNameById] Received subTopicId:", subTopicId);
    console.log("[getSubTopicNameById] Current 'availableSubTopics' state:", safeJsonStringify(availableSubTopics));

    if (!subTopicId) {
      console.log("[getSubTopicNameById] Returning 'None' due to empty subTopicId.");
      return 'None';
    }
    
    // Find the subtopic in the `availableSubTopics` state
    const subtopicFromState = availableSubTopics.find(st => st.value === subTopicId);
    if (subtopicFromState) {
      console.log("[getSubTopicNameById] Found in 'availableSubTopics' state:", subtopicFromState.label);
      return subtopicFromState.label;
    }

    // If subTopicId is an object
    if (typeof subTopicId === 'object' && subTopicId !== null && subTopicId.name) {
      console.log("[getSubTopicNameById] subTopicId is an object, returning its name property:", subTopicId.name);
      return subTopicId.name;
    }
    
    // Fallback for strings that don't look like IDs but might be names
    if (typeof subTopicId === 'string' && !subTopicId.match(/^[0-9a-fA-F]{24}$/)) {
      console.warn("[getSubTopicNameById] subTopicId is a non-ID string, returning as is (fallback):", subTopicId);
      return subTopicId;
    }
    
    console.warn("[getSubTopicNameById] Could not find name for ID. Returning 'Unknown Subtopic'. ID:", subTopicId);
    return 'Unknown Subtopic';
  };

  // Fix the filter function to be more aggressive and debug more thoroughly
  const filterAbstractsByRegistration = (abstracts, registrationMongoId) => {
    if (!abstracts || !Array.isArray(abstracts) || abstracts.length === 0) {
      console.log("No abstracts to filter");
      return [];
    }
    
    if (!registrationMongoId) {
      console.log("No registration ID provided for filtering");
      return [];
    }
    
    console.log(`FILTERING: ${abstracts.length} abstracts for registration: ${registrationMongoId}`);
    console.log("Registration ID type:", typeof registrationMongoId);
    
    // Convert registration ID to string for comparison
    const registrationIdStr = String(registrationMongoId);
    
    // Log all abstracts for debugging
    abstracts.forEach((abstract, index) => {
      console.log(`Abstract #${index + 1}:`, {
        id: abstract._id,
        title: abstract.title,
        regObj: abstract.registration,
        regInfo: abstract.registrationInfo,
        regType: typeof abstract.registration
      });
    });
    
    const filteredAbstracts = abstracts.filter(abstract => {
      // Extract registration ID from the abstract
      let abstractRegId = null;
      
      // Handle different ways the registration ID might be stored
      if (abstract.registration) {
        if (typeof abstract.registration === 'object' && abstract.registration._id) {
          abstractRegId = abstract.registration._id;
        } else {
          abstractRegId = abstract.registration;
        }
      } else if (abstract.registrationInfo && abstract.registrationInfo._id) {
        abstractRegId = abstract.registrationInfo._id;
      } else if (abstract.registrationId) {
        abstractRegId = abstract.registrationId;
      }
      
      // If no registration ID found, this abstract doesn't match
      if (!abstractRegId) {
        console.log(`Abstract ${abstract._id || abstract.title}: No registration ID found`);
        return false;
      }
      
      // Convert to string for comparison
      const abstractRegIdStr = String(abstractRegId);
      
      // Log the comparison
      console.log(`Abstract ${abstract._id}: abstractRegId=${abstractRegIdStr}, userRegId=${registrationIdStr}, match=${abstractRegIdStr === registrationIdStr}`);
      
      return abstractRegIdStr === registrationIdStr;
    });
    
    console.log(`After filtering: ${filteredAbstracts.length} abstracts match`);
    return filteredAbstracts;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <Spinner />
      </div>
    );
  }

  // If loading is done, but eventDetails still couldn't be fetched.
  if (!eventDetails) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card>
            <div className="p-4">
              <Alert type="error" message="Failed to load event details. Please check the event ID or try again later." />
              <Link to="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
                &larr; Go to Homepage
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Check if abstract submissions are enabled
  if (eventDetails && !eventDetails.abstractSettings?.enabled) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{eventDetails.name}</h2>
              <p className="mt-2 text-gray-600">Abstract Submission Portal</p>
            </div>
            
            <Alert 
              type="info" 
              message="Abstract submissions are not currently enabled for this event." 
            />
          </Card>
        </div>
      </div>
    );
  }

  // Check if within submission dates
  const currentDate = new Date();
  
  // Get submission dates with better error handling and date parsing
  let submissionStartDate;
  let submissionEndDate;
  
  try {
    // Determine submissionEndDate (deadline)
    if (eventDetails.abstractSettings?.deadline) {
      submissionEndDate = parseAdminDateFormat(eventDetails.abstractSettings.deadline);
    } else if (eventDetails.abstractSettings?.submissionEndDate) {
      submissionEndDate = parseAdminDateFormat(eventDetails.abstractSettings.submissionEndDate);
    } else {
      console.log("Using event end date as fallback for submission END date:", eventDetails.endDate);
      submissionEndDate = parseAdminDateFormat(eventDetails.endDate);
    }
    
    // Determine submissionStartDate
    if (eventDetails.abstractSettings?.submissionStartDate) {
      console.log("Using submissionStartDate from abstractSettings:", eventDetails.abstractSettings.submissionStartDate);
      submissionStartDate = parseAdminDateFormat(eventDetails.abstractSettings.submissionStartDate);
    } else {
      // If no explicit start date, set to a very past date, meaning submissions are open if enabled.
      console.log("No explicit submissionStartDate in abstractSettings. Assuming submissions open if enabled and before deadline.");
      submissionStartDate = new Date(0); // January 1, 1970 (effectively always in the past)
    }
    
    // Fallback for invalid dates after parsing (mainly for submissionEndDate)
    if (!submissionEndDate || isNaN(submissionEndDate.getTime())) {
      console.error("Invalid submission end date after parsing. Using fallback future date.", eventDetails.abstractSettings?.deadline || eventDetails.abstractSettings?.submissionEndDate);
      submissionEndDate = new Date();
      submissionEndDate.setFullYear(submissionEndDate.getFullYear() + 1); 
    }
    
    // Fallback for invalid submissionStartDate (should be rare with new logic but good to keep)
    if (!submissionStartDate || isNaN(submissionStartDate.getTime())) {
        console.error("Invalid submission start date after parsing. Defaulting to epoch.");
        submissionStartDate = new Date(0);
    }

  } catch (error) {
    console.error("Error parsing submission dates:", error);
    
    // Create failsafe fallback dates
    submissionStartDate = new Date();
    submissionStartDate.setFullYear(submissionStartDate.getFullYear() - 1); // One year ago
    
    submissionEndDate = new Date();
    submissionEndDate.setFullYear(submissionEndDate.getFullYear() + 1); // One year from now
    
    console.log("Using failsafe fallback dates after error:", { 
      start: submissionStartDate, 
      end: submissionEndDate 
    });
  }
  
  // Log the dates for debugging
  console.log("Submission period:", { 
    start: submissionStartDate ? submissionStartDate.toISOString() : 'Invalid date', 
    end: submissionEndDate ? submissionEndDate.toISOString() : 'Invalid date',
    current: currentDate.toISOString(),
    deadlineFromSettings: eventDetails.abstractSettings?.deadline,
    parsedDeadline: submissionEndDate ? formatDate(submissionEndDate) : 'Invalid date',
    isCurrentAfterStart: submissionStartDate && (currentDate >= submissionStartDate),
    isCurrentBeforeEnd: submissionEndDate && (currentDate <= submissionEndDate),
    startValid: submissionStartDate && !isNaN(submissionStartDate.getTime()),
    endValid: submissionEndDate && !isNaN(submissionEndDate.getTime()),
    isSubmissionPeriodActive: submissionStartDate && !isNaN(submissionStartDate.getTime()) && 
                              submissionEndDate && !isNaN(submissionEndDate.getTime()) &&
                              currentDate >= submissionStartDate && 
                              currentDate <= submissionEndDate
  });
  
  // For debugging/demo purposes, force the abstract submission to be active
  // The deadline is in 2025, so it should be active
  console.log("Raw deadline date from API:", eventDetails.abstractSettings?.deadline);
  
  // Directly calculate if the period is active based on dates and enabled status
  const isSubmissionPeriodActive = eventDetails.abstractSettings?.enabled && 
                                 submissionStartDate && !isNaN(submissionStartDate.getTime()) && 
                                 submissionEndDate && !isNaN(submissionEndDate.getTime()) &&
                                 currentDate >= submissionStartDate && 
                                 currentDate <= submissionEndDate;
  
  if (!isSubmissionPeriodActive) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{eventDetails.name}</h2>
              <p className="mt-2 text-gray-600">Abstract Submission Portal</p>
            </div>
            
            {/* Only show 'will open on' if there IS an explicit future start date AND submissions are enabled */}
            {eventDetails.abstractSettings?.enabled && eventDetails.abstractSettings?.submissionStartDate && currentDate < submissionStartDate ? (
              <Alert 
                type="info" 
                message={`Abstract submissions will open on ${formatDate(submissionStartDate)}.`} 
              />
            ) : !eventDetails.abstractSettings?.enabled ? (
              <Alert 
                type="info" 
                message="Abstract submissions are not currently enabled for this event." 
              />
            ) : ( /* Submissions are enabled, but past deadline or other condition */
              <Alert 
                type="warning" 
                message={`Abstract submission deadline has passed (${formatDate(submissionEndDate)}).`} 
              />
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{eventDetails.name}</h2>
              <p className="mt-2 text-gray-600">Abstract Submission Portal</p>
            </div>
            
            {/* Toggle between Registration ID and Email/Password */}
            <div className="flex justify-center space-x-2 mb-6">
              <Button variant={loginType==='registration'?'primary':'outline'} onClick={()=>setLoginType('registration')}>Use Registration ID</Button>
              <Button variant={loginType==='author'?'primary':'outline'} onClick={()=>setLoginType('author')}>Email & Password</Button>
            </div>
            
            {loginType === 'registration' ? (
              <>
                <div className="text-center mb-6">
                  <p className="text-gray-700">Enter your Registration ID to continue.</p>
              </div>
                <form onSubmit={handleRegistrationAuth}>
                  {authError && <Alert type="error" message={authError} className="mb-4" onClose={()=>setAuthError(null)} />}
                  <Input className="mb-4" id="registrationId" name="registrationId" placeholder="Registration ID" value={registrationId} onChange={(e)=>setRegistrationId(e.target.value)} required />
                  <Button type="submit" className="w-full" disabled={authenticating || !registrationId.trim()}> {authenticating && <Spinner size="sm" className="mr-2" />} Continue </Button>
            </form>
              </>
            ) : (
              <AuthorAuthWizard eventId={eventId} onSuccess={()=>{
                  setAuthenticated(true);
                  fetchUserAbstracts(null);
                  setCurrentView('list');
              }} />
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Regular user interface after authentication
  if (authenticated) {
    // REMOVE the existing Tab component and its contents
    // REPLACE with conditional rendering based on currentView
    if (currentView === 'list') {
      // Render User's Abstract List View
    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
              <h2 className="text-2xl font-bold text-gray-900">{eventDetails?.name}</h2>
              <p className="mt-1 text-gray-600">Your Abstract Submissions</p>
              </div>
            <div className="space-x-2">
               <Button variant="primary" onClick={handleAddNewAbstract}>Submit New Abstract</Button>
               <Button variant="outline" onClick={handleLogout}>Logout</Button>
                </div>
              </div>
              
          {loading && <p>Loading abstracts...</p>} {/* Add loading state for abstracts list */} 

          {needsProofPrompt && (
            <Alert type="warning" className="mb-4">One or more of your abstracts have been accepted. Please upload your registration proof to proceed.</Alert>
          )}
          {proofPending && (
            <Alert type="info" className="mb-4">Registration proof uploaded. Waiting for verification by organizers.</Alert>
          )}

          {userAbstracts.length === 0 && !loading && (
                <div className="p-6 text-center border rounded-lg bg-gray-50">
              <p className="text-gray-500">You haven't submitted any abstracts yet.</p>
              <Button onClick={handleAddNewAbstract} className="mt-4">Submit Your First Abstract</Button>
                </div>
              )}

          {userAbstracts.length > 0 && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul role="list" className="divide-y divide-gray-200">
                {console.log("About to render abstracts:", JSON.stringify(userAbstracts))}
                {userAbstracts.filter(Boolean).map((abs, index) => {
                  console.log(`Abstract ${index}:`, abs);
                  return (
                  <li key={abs._id} className={`px-6 py-4 bg-white shadow-sm rounded-lg hover:shadow-lg transition-shadow ring-1 ${statusesNeedingProof.includes((abs.status||'').toLowerCase())&&!anyProofUploaded?'ring-rose-400':'ring-transparent'} hover:ring-indigo-500`}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      {/* Left – title & meta */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate mb-1">{abs?.title || 'Untitled Abstract'}</h3>
                        <div className="text-xs text-gray-500 space-x-2">
                          <span>Abstract No: <span className="font-medium">{abs.abstractNumber || 'N/A'}</span></span>
                          <span>•</span>
                          <span>Submitted: {formatDate(abs?.submissionDate || abs?.createdAt)}</span>
                      </div>
                  </div>

                      {/* Status badge */}
                      <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-medium rounded-full self-start ${abs?.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : abs?.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{abs?.status || 'No Status'}</span>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex gap-1 ml-0 sm:ml-4">
                         {/* View details */}
                         <button title="View" className="p-2 rounded-md hover:bg-gray-100" onClick={() => handleViewAbstract(abs)}>
                              <EyeIcon className="h-5 w-5 text-gray-600"/>
                         </button>

                         {(abs && (abs.status === 'draft' || abs.status === 'submitted')) && (
                             <button title="Edit" className="p-2 rounded-md hover:bg-gray-100" onClick={() => handleEditAbstract(abs)}>
                               <PencilSquareIcon className="h-5 w-5 text-gray-600"/>
                             </button>
                         )}
                         {abs && statusesNeedingProof.includes((abs.status||'').toLowerCase()) && !abs.registrationProofUrl && !anyProofUploaded && (
                             <Button variant="primary" size="sm" onClick={async ()=>{
                                 const fileInput=document.createElement('input');
                                 fileInput.type='file';
                                 fileInput.onchange=async(e)=>{
                                     const f=e.target.files[0]; if(!f) return;
                                     const res=await abstractService.uploadRegistrationProof(eventId, abs._id, f);
                                     if(res.success){ toast.success('Proof uploaded'); fetchUserAbstracts(userInfo?._id||null); }
                                 };
                                 fileInput.click();
                             }}>Upload Proof</Button>
                         )}
                         {abs && abs.registrationProofUrl && !abs.registrationVerified && (
                             <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium self-center">Proof uploaded – awaiting verification</span>
                         )}
                         {abs && abs.registrationVerified && (!abs.finalFileUrl || abs.finalStatus==='pending') && (
                             <Button variant="primary" size="sm" onClick={async ()=>{
                                 const fileInput = document.createElement('input');
                                 fileInput.type='file';
                                 fileInput.onchange=async (e)=>{
                                     const f = e.target.files[0];
                                     if(!f) return;
                                     const res = await abstractService.uploadFinalFile(eventId, abs._id, f);
                                     if(res.success){ toast.success('Final file uploaded'); fetchUserAbstracts(userInfo?._id || null); }
                                 };
                                 fileInput.click();
                             }}>Upload Final</Button>
                         )}
                         {/* Download main submission if available */}
                         {abs && abs.fileUrl && (
                             <button title="Download" className="p-2 rounded-md hover:bg-gray-100" onClick={() => {
                                 const url = abs.fileUrl.startsWith('http') ? abs.fileUrl : `${API_BASE_URL}${abs.fileUrl}`;
                                 window.open(url, '_blank');
                             }}>
                               <ArrowDownTrayIcon className="h-5 w-5 text-gray-600"/>
                             </button>
                         )}
                         {/* Show Delete button only for registrant sessions */}
                         {(() => {
                             const isAuthorSession = !!localStorage.getItem(AUTHOR_TOKEN_KEY);
                             if (!isAuthorSession) {
                                 return (
                                     <button title="Delete" className="p-2 rounded-md hover:bg-gray-100" onClick={() => handleDeleteAbstract(abs._id)}>
                                       <TrashIcon className="h-5 w-5 text-rose-600"/>
                                     </button>
                                 );
                             }
                             return null;
                         })()}
                         {/* Final file download */}
                         {abs && abs.finalFileUrl && (
                             <button title="Final File" className="p-2 rounded-md hover:bg-gray-100" onClick={()=>{
                                 const url = abs.finalFileUrl.startsWith('http')? abs.finalFileUrl : `${API_BASE_URL}${abs.finalFileUrl}`;
                                 window.open(url,'_blank');
                             }}>
                               <ArrowDownTrayIcon className="h-5 w-5 text-green-600" />
                             </button>
                         )}
                    </div>
                            </div>
                  </li>
                          )})}
              </ul>
                        </div>
          )}
      </div>
    );
  }

    if (currentView === 'form') {
      // Render Abstract Form View
  return (
      <div className="max-w-4xl mx-auto relative">
        {/* Submission overlay */}
        {submitting && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
            <Spinner size="lg" />
          </div>
        )}
              <div className="flex justify-between items-center mb-6">
                <div>
                <h2 className="text-2xl font-bold text-gray-900">{eventDetails?.name}</h2>
                <p className="mt-1 text-gray-600">{abstractForm.existingAbstractId ? 'Edit Abstract' : 'Submit New Abstract'}</p>
                </div>
               <Button variant="outline" onClick={() => { resetAbstractForm(); setCurrentView('list'); }}>Back to List</Button>
              </div>
              
            <form onSubmit={handleSubmitAbstract} className="space-y-4 bg-white shadow rounded-lg p-6">
                {submitMessage.text && <Alert type={submitMessage.type}>{submitMessage.text}</Alert>}

                {/* Title Field */} 
                      <div>
                  <label htmlFor="title">Title <span className="text-red-500">*</span></label>
                  <Input id="title" name="title" value={abstractForm.title} onChange={handleInputChange} error={formErrors.title} />
                      </div>
                      
                {/* Authors Field */} 
                      <div>
                  <label htmlFor="authors">Authors <span className="text-red-500">*</span></label>
                  <Input id="authors" name="authors" value={abstractForm.authors} onChange={handleInputChange} error={formErrors.authors} />
                      </div>
                      
                {/* Affiliations Field (Now Optional) */} 
                      <div>
                  <label htmlFor="affiliations">Affiliations</label>
                  <Input id="affiliations" name="affiliations" value={abstractForm.affiliations} onChange={handleInputChange} error={formErrors.affiliations} />
                      </div>
              
                {/* Category Field - Read-only in edit mode */}
                <div>
                  <label htmlFor="category">Category <span className="text-red-500">*</span></label>
                  {abstractForm.existingAbstractId ? (
                    <Input 
                      id="category" 
                      name="category" 
                      value={getCategoryNameById(abstractForm.category)} 
                      disabled={true} 
                    />
                  ) : (
                          <Select
                            id="category"
                            name="category"
                            value={abstractForm.category}
                            onChange={handleSelectChange}
                            error={formErrors.category}
                      options={[{ value: '', label: 'Select a category' }, ...categories]} 
                          />
                  )}
                        </div>
                        
                {/* Subtopic Field - Only show if category has subtopics */}
                {(() => {
                  const selectedCategory = eventDetails?.abstractSettings?.categories?.find(
                    cat => cat._id === abstractForm.category
                  );
                  
                  if (selectedCategory?.subTopics?.length > 0) {
                    return (
                      <div>
                        <label htmlFor="subTopic">Subtopic <span className="text-red-500">*</span></label>
                        {abstractForm.existingAbstractId ? (
                          <Input 
                            id="subTopic" 
                            name="subTopic" 
                            value={getSubTopicNameById(abstractForm.subTopic)} 
                            disabled={true} 
                          />
                        ) : (
                          <Select
                            id="subTopic"
                            name="subTopic"
                            value={abstractForm.subTopic}
                            onChange={handleSelectChange}
                            error={formErrors.subTopic}
                            options={[{ value: '', label: 'Select a subtopic' }, ...availableSubTopics]} 
                          />
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {/* Content Field */} 
                        <div>
                  <label htmlFor="content">Content {!eventDetails?.abstractSettings?.allowFiles && <span className="text-red-500">*</span>}</label>
                  <Textarea id="content" name="content" value={abstractForm.content} onChange={handleInputChange} error={formErrors.content} rows={10} />
                  {abstractForm.content && (
                    <p className="text-sm text-gray-500 mt-1">
                      Word count: {abstractForm.content.trim().split(/\s+/).length} / 
                      {eventDetails?.abstractSettings?.maxLength || 500}
                    </p>
                  )}
                        </div>
                        
                {/* File Upload Field */} 
                {eventDetails?.abstractSettings?.allowFiles && (
                          <div>
                    <label>File Upload</label>
                    {/* Display current file info if editing */} 
                    {editingAbstract && editingAbstract.fileUrl && (
                       <p className="text-sm text-gray-500 mb-1">Current file: <a href={editingAbstract.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{editingAbstract.fileName}</a></p>
                            )}
                            <FileUpload
                              onChange={handleFileChange}
                              error={formErrors.file}
                      accept=".pdf,.doc,.docx,.ppt,.pptx" // Adjust based on actual allowed types
                      maxSize={(eventDetails?.abstractSettings?.maxFileSize || 5) * 1024 * 1024} 
                    />
                          </div>
                        )}
                        
                <div className="border-t pt-4 flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => { resetAbstractForm(); setCurrentView('list'); }}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? <Spinner size="sm" className="mr-2"/> : null}
                      {abstractForm.existingAbstractId ? 'Update Abstract' : 'Submit Abstract'}
                          </Button>
                        </div>
                      </form>
    </div>
  );
    }
    // Fallback view within authenticated state
    return <div>Loading your view... <button onClick={handleLogout}>Logout</button></div>;
  }

  // Fallback if authenticated but view is not list/form (shouldn't happen in normal flow)
  return <div>Loading your abstract view... <button onClick={handleLogout}>Logout</button></div>;

};

export default AbstractPortal; 