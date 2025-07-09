import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Input,
  Select,
  Button,
  Alert,
  Spinner,
  Checkbox
} from '../../components/common';
import eventService from '../../services/eventService';
import registrationService from '../../services/registrationService';
import paymentService from '../../services/paymentService';
import toast from 'react-hot-toast';

/**
 * Enhanced Registration Portal Component
 * Features:
 * - Responsive design for all devices
 * - Improved error handling
 * - Better user experience
 */
const RegistrationPortal = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organization: '',
    title: '',
    categoryId: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    dietaryRestrictions: '',
    emergencyContact: '',
    emergencyPhone: '',
    specialRequirements: '',
    agreeToTerms: false
  });
  const [status, setStatus] = useState(null);
  const [formConfig, setFormConfig] = useState({
    requiredFields: [],
    visibleFields: [],
    fieldOrder: []
  });
  const [registrationSuccess, setRegistrationSuccess] = useState(null);
  const [quote, setQuote] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  
  // Load event data and form configuration
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        
        // Fetch event details
        const eventResponse = await eventService.getEventById(eventId);
        if (!eventResponse.success) {
          throw new Error(eventResponse.message || 'Failed to fetch event details');
        }
        
        // Fetch categories for the event
        const categoriesResponse = await eventService.getEventCategoriesPublic(eventId);
        if (!categoriesResponse.success) {
          throw new Error(categoriesResponse.message || 'Failed to fetch categories');
        }
        
        // Fetch form configuration
        const formConfigResponse = await eventService.getRegistrationFormConfig(eventId);
        
        // Set event data
        setEvent(eventResponse.data);
        
        // Set categories
        setCategories(categoriesResponse.data);
        
        // Set form configuration (or use defaults if not available)
        if (formConfigResponse && formConfigResponse.success && formConfigResponse.data) {
          setFormConfig(formConfigResponse.data);
        } else {
          console.warn('Using default form configuration');
          setFormConfig({
            requiredFields: ['firstName', 'lastName', 'email', 'categoryId', 'agreeToTerms'],
            visibleFields: [
              'firstName', 'lastName', 'email', 'phone', 'organization', 'title',
              'categoryId', 'address', 'city', 'state', 'country', 'postalCode',
              'dietaryRestrictions', 'emergencyContact', 'emergencyPhone', 'specialRequirements',
              'agreeToTerms'
            ],
            fieldOrder: [
              // Personal Info
              'firstName', 'lastName', 'email', 'phone',
              // Professional Info
              'organization', 'title', 'categoryId',
              // Address
              'address', 'city', 'state', 'country', 'postalCode',
              // Additional Info
              'dietaryRestrictions', 'emergencyContact', 'emergencyPhone', 'specialRequirements',
              // Terms
              'agreeToTerms'
            ]
          });
        }
        
        // Set initial category if available
        if (categoriesResponse.data && categoriesResponse.data.length > 0) {
          setFormData(prev => ({
            ...prev,
            categoryId: categoriesResponse.data[0]._id
          }));
        }
        
        // Extend formData with custom fields on event load
        if (eventResponse.data && eventResponse.data.registrationSettings && Array.isArray(eventResponse.data.registrationSettings.customFields)) {
          const customFieldDefaults = {};
          eventResponse.data.registrationSettings.customFields.forEach(field => {
            if (field && field.name) {
              customFieldDefaults[field.name] = '';
            }
          });
          setFormData(prev => ({ ...customFieldDefaults, ...prev }));
        }
        
        // LOGGING: Output registrationSettings and formConfig for debugging
        console.log('[RegistrationPortal] registrationSettings:', eventResponse.data.registrationSettings);
        console.log('[RegistrationPortal] formConfig:', formConfigResponse?.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching event data:', error);
        setStatus({
          type: 'error',
          message: 'Failed to load registration form: ' + error.message
        });
        setLoading(false);
      }
    };
    
    fetchEventData();
  }, [eventId]);
  
  // Fetch quote whenever category changes (simple demo)
  useEffect(() => {
    if (!eventId || !formData.categoryId) return;
    const fetchQuote = async () => {
      try {
        setCalculating(true);
        const res = await registrationService.quoteRegistration(eventId, {
          category: formData.categoryId,
          workshopIds: [],
        });
        if (res.success) {
          setQuote(res.data);
        }
      } catch (err) {
        console.error('Quote error', err);
        toast.error('Failed to calculate quote');
      } finally {
        setCalculating(false);
      }
    };
    fetchQuote();
  }, [eventId, formData.categoryId]);
  
  // Helper to get custom field config by name
  const getCustomFieldConfig = (name) => {
    if (!event || !event.registrationSettings || !Array.isArray(event.registrationSettings.customFields)) return null;
    return event.registrationSettings.customFields.find(f => f.name === name);
  };
  
  const handleChange = (e) => {
    // Handle both direct events (from inputs) and values (from select components)
    const name = e.target ? e.target.name : e.name;
    const value = e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e.value;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const validateForm = () => {
    const errors = {};
    
    formConfig.requiredFields.forEach(field => {
      if (formConfig.visibleFields.includes(field) && !formData[field]) {
        errors[field] = 'This field is required';
      }
    });
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (formData.phone && !/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    return errors;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setStatus({
        type: 'error',
        message: 'Please fix the errors in the form',
        errors
      });
      return;
    }
    
    setSubmitting(true);
    try {
      // Create registration with payment info
      const regPayload = {
        ...formData,
        eventId,
        categoryId: formData.categoryId,
        seatHoldIds: quote?.seatHoldIds || [],
        amountCents: quote?.amountCents || 0,
        currency: 'INR',
      };

      const regRes = await registrationService.createRegistrationPublic(eventId, regPayload);
      if (!regRes.success && !regRes.data?.success) {
        throw new Error(regRes.message || 'Registration failed');
      }

      const registrationId = regRes.data?._id || regRes.data?.data?._id;

      const payCfg = event?.paymentConfig || {};
      const paymentsEnabled = payCfg.extra?.paymentsEnabled !== false; // default true
      let paymentRequired = payCfg.extra?.paymentRequired !== false; // default true
      const prCats = payCfg.extra?.paymentRequiredCategories || [];
      if(prCats.length){
        // if list specified, payment required only if category in list
        paymentRequired = prCats.includes(formData.categoryId);
      }

      if (paymentsEnabled && paymentRequired) {
        // create payment link with configured provider
        const provider = payCfg.provider || 'razorpay';
        const linkRes = await paymentService.createPaymentLink(eventId, {
          amountCents: quote?.amountCents || 0,
          provider,
          registrationId,
        });

        const redirectUrl = linkRes.data?.url || linkRes.url;
        if (redirectUrl) {
          window.location.href = redirectUrl;
          return; // stop execution, redirecting
        }
      }

      toast.success('Registration submitted successfully.');
      setRegistrationSuccess({ registrationId, ...formData });

    } catch (error) {
      console.error('Registration error:', error);
      // If error is from backend and has a response with a message, show that
      let errorMessage = error.message || 'Failed to submit registration. Please try again.';
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.data && error.data.message) {
        errorMessage = error.data.message;
      }
      setStatus({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const getFieldLabel = (field) => {
    const labelMap = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone Number',
      organization: 'Organization/Institution',
      title: 'Job Title/Position',
      categoryId: 'Registration Category',
      address: 'Address',
      city: 'City',
      state: 'State/Province',
      country: 'Country',
      postalCode: 'Postal Code',
      dietaryRestrictions: 'Dietary Restrictions',
      emergencyContact: 'Emergency Contact Name',
      emergencyPhone: 'Emergency Contact Phone',
      specialRequirements: 'Special Requirements',
      agreeToTerms: 'I agree to the terms and conditions'
    };
    
    return labelMap[field] || field;
  };
  
  // Enhanced renderField to support custom fields
  const renderField = (field) => {
    if (!formConfig.visibleFields.includes(field)) return null;
    const isRequired = formConfig.requiredFields.includes(field);
    const error = status?.errors?.[field];
    // Check if this is a custom field
    const customField = getCustomFieldConfig(field);
    if (customField) {
      // Render based on type
      switch (customField.type) {
        case 'text':
        case 'number':
        case 'date':
          return (
            <div className="mb-4" key={field}>
              <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
                {customField.label || field} {isRequired && <span className="text-red-500">*</span>}
              </label>
              <Input
                id={field}
                name={field}
                value={formData[field] || ''}
                onChange={handleChange}
                placeholder={customField.placeholder || ''}
                error={error}
                required={isRequired}
                type={customField.type === 'number' ? 'number' : customField.type === 'date' ? 'date' : 'text'}
              />
              {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
            </div>
          );
        case 'select':
          return (
            <div className="mb-4" key={field}>
              <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
                {customField.label || field} {isRequired && <span className="text-red-500">*</span>}
              </label>
              <Select
                id={field}
                name={field}
                value={formData[field] || ''}
                onChange={(value) => handleChange({ name: field, value })}
                options={Array.isArray(customField.options) ? customField.options.map(opt => ({ value: opt, label: opt })) : []}
                error={error}
                required={isRequired}
              />
              {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
            </div>
          );
        case 'checkbox':
          return (
            <div className="mb-4" key={field}>
              <div className="flex items-center">
                <Checkbox
                  id={field}
                  name={field}
                  checked={!!formData[field]}
                  onChange={(e) => handleChange({ target: { name: field, type: 'checkbox', checked: e.target ? e.target.checked : e } })}
                  error={error}
                  required={isRequired}
                />
                <label htmlFor={field} className="ml-2 text-sm font-medium text-gray-700">
                  {customField.label || field} {isRequired && <span className="text-red-500">*</span>}
                </label>
              </div>
              {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
            </div>
          );
        default:
          return null;
      }
    }
    // Special handling for categoryId field
    if (field === 'categoryId') {
      return (
        <div className="mb-4" key={field}>
          <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
            {getFieldLabel(field)} {isRequired && <span className="text-red-500">*</span>}
          </label>
          <Select
            id={field}
            name={field}
            value={formData[field]}
            onChange={(value) => handleChange({ name: field, value })}
            options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
            error={error}
            required={isRequired}
          />
          {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
        </div>
      );
    }
    // ...existing standard field rendering logic...
    return (
      <div className="mb-4" key={field}>
        <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
          {getFieldLabel(field)} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <Input
          id={field}
          name={field}
          value={formData[field]}
          onChange={handleChange}
          placeholder={`Enter ${getFieldLabel(field).toLowerCase()}`}
          error={error}
          required={isRequired}
          type={field === 'email' ? 'email' : field === 'phone' || field === 'emergencyPhone' ? 'tel' : 'text'}
        />
        {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
      </div>
    );
  };
  
  // Render all fields in fieldOrder
  const renderAllFields = () => {
    if (!formConfig.fieldOrder || formConfig.fieldOrder.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {formConfig.fieldOrder.map(field => renderField(field))}
      </div>
    );
  };
  
  // After registrationSuccess is set, fetch payment status/link
  useEffect(() => {
    if (!registrationSuccess) return;
    // Fetch payment status for this registration
    (async () => {
      try {
        const res = await paymentService.getPayments(eventId, { registrationId: registrationSuccess._id });
        const payments = res.payments || res.data?.payments || [];
        const paid = payments.find(p => p.status === 'paid');
        if (paid) {
          setPaymentStatus('paid');
        } else {
          setPaymentStatus('pending');
          const link = payments.find(p => p.status === 'initiated' && p.provider !== 'offline');
          if (link) setPaymentLink(link.invoiceUrl || link.meta?.paymentLink || null);
        }
      } catch (err) {
        setPaymentStatus(null);
      }
    })();
  }, [registrationSuccess, eventId]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // Check if registration is enabled
  if (event && event.registrationSettings && !event.registrationSettings.isOpen) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">{event.name}</h2>
              <p className="text-gray-500 mb-4">{event.description}</p>
              <Alert 
                type="info" 
                message="Registration for this event is currently closed." 
              />
            </div>
          </Card>
        </div>
      </div>
    );
  }
  
  // Registration Success Screen
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{event.name}</h2>
              <div className="inline-flex items-center justify-center mt-4 mb-6 bg-green-100 text-green-800 rounded-full px-4 py-2">
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span className="font-medium">Registration Successful</span>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <h3 className="text-lg font-medium mb-2">Registration Details</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-sm text-gray-500">Registration ID</p>
                  <p className="font-medium">{registrationSuccess.registrationId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{registrationSuccess.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{registrationSuccess.email}</p>
                </div>
              </div>
            </div>
            
            {paymentStatus === 'pending' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
                <div className="font-semibold text-yellow-800 mb-2">Payment Pending</div>
                {paymentLink ? (
                  <Button onClick={()=>window.open(paymentLink, '_blank')} className="bg-indigo-600 text-white">Pay Now</Button>
                ) : (
                  <div className="text-yellow-700">Please check your email for the payment link or contact the event organizer.</div>
                )}
              </div>
            )}
            
            <div className="text-center space-y-4">
              <p className="text-gray-600">
                A confirmation email with your registration details has been sent to your email address.
              </p>
              
              <div className="mt-6 flex flex-col space-y-3">
                <Button 
                  variant="outline" 
                  onClick={() => setRegistrationSuccess(null)}
                >
                  Register Another Person
                </Button>
                
                <Button 
                  variant="link" 
                  onClick={() => navigate(`/portal/abstract/${eventId}`)}
                >
                  Submit an Abstract
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  
  // Main Registration Form
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">{event.name}</h2>
            <p className="mt-2 text-gray-600">Registration Form</p>
            {event.startDate && event.endDate && (
              <p className="mt-1 text-sm text-gray-500">
                {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                {event.venue?.name && ` | ${event.venue.name}`}
              </p>
            )}
          </div>
          
          {status?.type === 'error' && (
            <Alert 
              type="error" 
              message={status.message}
              className="mb-6"
              onClose={() => setStatus(null)}
            />
          )}
          
          <form onSubmit={handleSubmit}>
            {renderAllFields()}
            
            <div className="mt-8 flex justify-end">
              <Button 
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? <Spinner size="sm" className="mr-2" /> : null}
                Complete Registration
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default RegistrationPortal; 