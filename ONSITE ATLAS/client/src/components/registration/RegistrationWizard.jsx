import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import PersonalInfoStep from './steps/PersonalInfoStep';
import EventSelectionStep from './steps/EventSelectionStep';
import PackagePricingStep from './steps/PackagePricingStep';
import AccompanyingPersonsStep from './steps/AccompanyingPersonsStep';
import PaymentStep from './steps/PaymentStep';
import ConfirmationStep from './steps/ConfirmationStep';
import { registrationService } from '../../services/registrationService';
import { pricingService } from '../../services/pricingService';

const STEPS = [
  { id: 'personal', title: 'Personal Information', component: PersonalInfoStep },
  { id: 'event', title: 'Event Selection', component: EventSelectionStep },
  { id: 'pricing', title: 'Package & Pricing', component: PackagePricingStep },
  { id: 'companions', title: 'Accompanying Persons', component: AccompanyingPersonsStep },
  { id: 'payment', title: 'Payment', component: PaymentStep },
  { id: 'confirmation', title: 'Confirmation', component: ConfirmationStep }
];

const RegistrationWizard = ({ eventId, onComplete, savedData = null }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    personalInfo: {},
    eventSelection: {},
    pricing: {},
    companions: [],
    payment: {},
    savedProgress: false
  });
  const [validation, setValidation] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [availability, setAvailability] = useState({});
  const [saveToken, setSaveToken] = useState(null);

  // Load saved data on mount
  useEffect(() => {
    if (savedData) {
      setFormData(prev => ({ ...prev, ...savedData }));
      if (savedData.currentStep) {
        setCurrentStep(savedData.currentStep);
      }
    } else {
      // Check for saved progress in localStorage
      const saved = localStorage.getItem(`registration_progress_${eventId}`);
      if (saved) {
        try {
          const parsedData = JSON.parse(saved);
          setFormData(prev => ({ ...prev, ...parsedData }));
          if (parsedData.currentStep) {
            setCurrentStep(parsedData.currentStep);
          }
        } catch (error) {
          console.error('Failed to load saved progress:', error);
        }
      }
    }
  }, [savedData, eventId]);

  // Auto-save progress
  const saveProgress = useCallback(async () => {
    if (!formData.savedProgress) return;

    try {
      const progressData = {
        ...formData,
        currentStep,
        lastSaved: new Date().toISOString()
      };

      // Save to localStorage as backup
      localStorage.setItem(`registration_progress_${eventId}`, JSON.stringify(progressData));

      // Save to server with token
      const response = await registrationService.saveProgress(eventId, progressData, saveToken);
      if (response.data.token) {
        setSaveToken(response.data.token);
      }
    } catch (error) {
      console.warn('Failed to save progress:', error);
    }
  }, [formData, currentStep, eventId, saveToken]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(saveProgress, 30000);
    return () => clearInterval(interval);
  }, [saveProgress]);

  // Real-time pricing calculation
  useEffect(() => {
    const calculatePricing = async () => {
      if (formData.eventSelection.categories && formData.companions) {
        try {
          const pricingData = await pricingService.calculatePrice({
            eventId,
            categories: formData.eventSelection.categories,
            companions: formData.companions,
            discountCode: formData.pricing.discountCode
          });
          setPricing(pricingData);
        } catch (error) {
          console.error('Failed to calculate pricing:', error);
        }
      }
    };

    calculatePricing();
  }, [formData.eventSelection, formData.companions, formData.pricing.discountCode, eventId]);

  // Real-time availability checking
  useEffect(() => {
    const checkAvailability = async () => {
      if (formData.eventSelection.categories) {
        try {
          const availabilityData = await registrationService.checkAvailability(
            eventId,
            formData.eventSelection.categories
          );
          setAvailability(availabilityData);
        } catch (error) {
          console.error('Failed to check availability:', error);
        }
      }
    };

    checkAvailability();
  }, [formData.eventSelection.categories, eventId]);

  const updateFormData = (stepData) => {
    setFormData(prev => ({
      ...prev,
      ...stepData,
      savedProgress: true
    }));
  };

  const validateStep = (stepIndex) => {
    const step = STEPS[stepIndex];
    const stepData = formData[step.id] || {};
    const errors = {};

    switch (step.id) {
      case 'personal':
        if (!stepData.firstName) errors.firstName = 'First name is required';
        if (!stepData.lastName) errors.lastName = 'Last name is required';
        if (!stepData.email) errors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(stepData.email)) errors.email = 'Email is invalid';
        if (!stepData.phone) errors.phone = 'Phone number is required';
        break;

      case 'event':
        if (!stepData.categories || stepData.categories.length === 0) {
          errors.categories = 'Please select at least one category';
        }
        break;

      case 'pricing':
        if (!pricing || pricing.total <= 0) {
          errors.pricing = 'Invalid pricing configuration';
        }
        break;

      case 'companions':
        if (formData.companions) {
          formData.companions.forEach((companion, index) => {
            if (!companion.firstName) errors[`companion_${index}_firstName`] = 'First name required';
            if (!companion.lastName) errors[`companion_${index}_lastName`] = 'Last name required';
          });
        }
        break;

      case 'payment':
        if (pricing && pricing.total > 0) {
          if (!stepData.method) errors.method = 'Payment method is required';
          if (stepData.method === 'card' && !stepData.cardDetails?.valid) {
            errors.cardDetails = 'Valid card details are required';
          }
        }
        break;
    }

    setValidation(prev => ({ ...prev, [step.id]: errors }));
    return Object.keys(errors).length === 0;
  };

  const nextStep = async () => {
    if (!validateStep(currentStep)) {
      toast.error('Please fix the errors before proceeding');
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      await saveProgress();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (stepIndex) => {
    // Validate all previous steps
    for (let i = 0; i < stepIndex; i++) {
      if (!validateStep(i)) {
        toast.error(`Please complete step ${i + 1} first`);
        return;
      }
    }
    setCurrentStep(stepIndex);
  };

  const submitRegistration = async () => {
    setIsLoading(true);
    try {
      // Final validation
      const isValid = STEPS.every((_, index) => validateStep(index));
      if (!isValid) {
        throw new Error('Please fix all validation errors');
      }

      // Submit registration
      const registrationData = {
        eventId,
        personalInfo: formData.personalInfo,
        eventSelection: formData.eventSelection,
        companions: formData.companions,
        pricing: pricing,
        payment: formData.payment,
        saveToken
      };

      const response = await registrationService.submitRegistration(registrationData);
      
      // Clear saved progress
      localStorage.removeItem(`registration_progress_${eventId}`);
      
      toast.success('Registration submitted successfully!');
      onComplete(response.data);

    } catch (error) {
      console.error('Registration submission failed:', error);
      toast.error(error.message || 'Failed to submit registration');
    } finally {
      setIsLoading(false);
    }
  };

  const CurrentStepComponent = STEPS[currentStep].component;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Progress Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Event Registration</h2>
          <div className="text-sm text-gray-500">
            Step {currentStep + 1} of {STEPS.length}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="relative">
          <div className="flex items-center">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div
                  className={`
                    relative flex items-center justify-center w-10 h-10 rounded-full border-2 cursor-pointer
                    transition-all duration-200
                    ${index <= currentStep 
                      ? 'bg-blue-600 border-blue-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-400'
                    }
                    ${index < currentStep ? 'hover:bg-blue-700' : ''}
                  `}
                  onClick={() => goToStep(index)}
                >
                  {index < currentStep ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      flex-1 h-1 mx-2 rounded-full transition-all duration-200
                      ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}
                    `}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Labels */}
        <div className="flex justify-between mt-2">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`
                text-xs text-center flex-1
                ${index <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'}
              `}
            >
              {step.title}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CurrentStepComponent
              data={formData}
              onChange={updateFormData}
              validation={validation[STEPS[currentStep].id] || {}}
              pricing={pricing}
              availability={availability}
              eventId={eventId}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className={`
            flex items-center px-4 py-2 rounded-md font-medium transition-colors
            ${currentStep === 0
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-200'
            }
          `}
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Previous
        </button>

        {/* Validation Errors Summary */}
        {Object.keys(validation[STEPS[currentStep].id] || {}).length > 0 && (
          <div className="flex items-center text-red-600 text-sm">
            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
            Please fix the errors above
          </div>
        )}

        {/* Pricing Summary */}
        {pricing && (
          <div className="text-center">
            <div className="text-sm text-gray-600">Total Amount</div>
            <div className="text-lg font-bold text-blue-600">
              {pricing.currency} {pricing.total.toFixed(2)}
            </div>
          </div>
        )}

        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={nextStep}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Next
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </button>
        ) : (
          <button
            onClick={submitRegistration}
            disabled={isLoading}
            className={`
              px-6 py-2 rounded-md font-medium transition-colors
              ${isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
              } text-white
            `}
          >
            {isLoading ? 'Submitting...' : 'Complete Registration'}
          </button>
        )}
      </div>

      {/* Auto-save Indicator */}
      {formData.savedProgress && (
        <div className="absolute top-4 right-4 bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs">
          Progress saved
        </div>
      )}
    </div>
  );
};

export default RegistrationWizard;
