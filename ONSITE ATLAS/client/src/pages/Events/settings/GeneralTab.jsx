import React, { useState, useEffect } from 'react';
import { Card, Input, Select, Textarea, Button } from '../../../components/common';
import { PhotoIcon } from '@heroicons/react/24/outline';

const GeneralTab = ({ event, setEvent, id, setFormChanged }) => {
  // Log received props on initial render and re-renders
  console.log("[GeneralTab Props] Received:", { event, setEvent, id, setFormChanged });
  console.log("[GeneralTab Props] typeof setEvent:", typeof setEvent);
  console.log("[GeneralTab Props] typeof setFormChanged:", typeof setFormChanged);

  const [generalSettings, setGeneralSettings] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    timezone: 'UTC',
    status: 'draft',
    registrationPrefix: 'REG',
    maxAttendees: '',
    landingPageUrl: '',
    eventWebsite: '',
    eventHashtag: '',
    eventCode: '',
    bannerImage: ''
  });

  // Initialize settings from the event data
  useEffect(() => {
    if (event) {
      setGeneralSettings({
        name: event.name || '',
        description: event.description || '',
        startDate: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '',
        endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '',
        location: event.location || event.venue?.name || '',
        timezone: event.timezone || 'UTC',
        status: event.status || 'draft',
        registrationPrefix: event.registrationSettings?.idPrefix || 'REG',
        maxAttendees: event.maxAttendees || '',
        landingPageUrl: event.landingPageUrl || '',
        eventWebsite: event.eventWebsite || '',
        eventHashtag: event.eventHashtag || '',
        eventCode: event.eventCode || '',
        bannerImage: event.bannerImage || ''
      });
    }
  }, [event]);

  // Handle input changes - Update local state and notify parent via props
  const handleInputChange = (eOrName, valueArg) => {
    // If called from a standard input event
    if (eOrName && eOrName.target) {
      const { name, value } = eOrName.target;
      setGeneralSettings(prev => ({
        ...prev,
        [name]: value
      }));
      if (name === 'registrationPrefix') {
        setEvent(prevEvent => ({
          ...prevEvent,
          registrationSettings: {
            ...(prevEvent?.registrationSettings || {}),
            idPrefix: value
          }
        }));
      } else if (name === 'location') {
        setEvent(prevEvent => ({
          ...prevEvent,
          location: value,
          venue: {
            ...(prevEvent?.venue || {}),
            name: value
          }
        }));
      } else {
        setEvent(prevEvent => ({
          ...prevEvent,
          [name]: value
        }));
      }
      if (typeof setFormChanged === 'function') {
        setFormChanged(true);
      }
    } else if (typeof eOrName === 'string') {
      // Called as (name, value) from custom Select
      const name = eOrName;
      const value = valueArg;
      setGeneralSettings(prev => ({
        ...prev,
        [name]: value
      }));
      if (name === 'registrationPrefix') {
        setEvent(prevEvent => ({
          ...prevEvent,
          registrationSettings: {
            ...(prevEvent?.registrationSettings || {}),
            idPrefix: value
          }
        }));
      } else if (name === 'location') {
        setEvent(prevEvent => ({
          ...prevEvent,
          location: value,
          venue: {
            ...(prevEvent?.venue || {}),
            name: value
          }
        }));
      } else {
        setEvent(prevEvent => ({
          ...prevEvent,
          [name]: value
        }));
      }
      if (typeof setFormChanged === 'function') {
        setFormChanged(true);
      }
    }
  };

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' }
  ];

  return (
    <div className="space-y-6">
      <Card title="Basic Information">
        <div className="space-y-4">
          <Input
            label="Event Name"
            name="name"
            value={generalSettings.name}
            onChange={handleInputChange}
            placeholder="Enter event name"
            required
          />
          
          <Textarea
            label="Description"
            name="description"
            value={generalSettings.description}
            onChange={handleInputChange}
            placeholder="Provide a short description of your event"
            rows={4}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Start Date"
              name="startDate"
              value={generalSettings.startDate}
              onChange={handleInputChange}
            />
            
            <Input
              type="date"
              label="End Date"
              name="endDate"
              value={generalSettings.endDate}
              onChange={handleInputChange}
            />
          </div>
          
          <Input
            label="Location"
            name="location"
            value={generalSettings.location}
            onChange={handleInputChange}
            placeholder="Enter event location"
          />
          
          <Select
            label="Status"
            name="status"
            value={generalSettings.status}
            onChange={value => handleInputChange('status', value)}
            options={statusOptions}
          />
        </div>
      </Card>
      
      <Card title="Registration Settings">
        <div className="space-y-4">
          <Input
            label="Registration ID Prefix"
            name="registrationPrefix"
            value={generalSettings.registrationPrefix}
            onChange={handleInputChange}
            placeholder="e.g., REG, CONF, etc."
            helperText="This prefix will be used for all registration IDs (e.g., REG-0001)"
          />
          
          <Input
            type="number"
            label="Maximum Attendees"
            name="maxAttendees"
            value={generalSettings.maxAttendees}
            onChange={handleInputChange}
            placeholder="Leave empty for unlimited"
            helperText="Set a limit for the total number of registrations"
          />
        </div>
      </Card>

      <Card title="Visual Settings">
        <div className="space-y-4">
          {/* Banner Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Banner Image
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <div className="space-y-1 text-center">
                {generalSettings.bannerImage ? (
                  <div className="relative">
                    <img
                      src={generalSettings.bannerImage}
                      alt="Banner preview"
                      className="mx-auto h-32 w-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setGeneralSettings(prev => ({ ...prev, bannerImage: '' }));
                        setEvent(prevEvent => ({ ...prevEvent, bannerImage: '' }));
                        if (typeof setFormChanged === 'function') {
                          setFormChanged(true);
                        }
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label
                        htmlFor="banner-upload"
                        className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="banner-upload"
                          name="banner-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                const imageUrl = e.target.result;
                                setGeneralSettings(prev => ({ ...prev, bannerImage: imageUrl }));
                                setEvent(prevEvent => ({ ...prevEvent, bannerImage: imageUrl }));
                                if (typeof setFormChanged === 'function') {
                                  setFormChanged(true);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Upload a banner image to display on event cards. If not provided, a gradient based on your theme colors will be used.
            </p>
          </div>
        </div>
      </Card>

      <Card title="External Integration">
        <div className="space-y-4">
          <Input
            label="Landing Page URL"
            name="landingPageUrl"
            value={generalSettings.landingPageUrl}
            onChange={handleInputChange}
            placeholder="https://yourcompany.com/event-landing-page"
            helperText="URL of your custom landing page where users will be redirected for registration"
            type="url"
          />
          
          <Input
            label="Event Website"
            name="eventWebsite"
            value={generalSettings.eventWebsite}
            onChange={handleInputChange}
            placeholder="https://yourconference.com"
            helperText="Official website for this event"
            type="url"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Event Hashtag"
              name="eventHashtag"
              value={generalSettings.eventHashtag}
              onChange={handleInputChange}
              placeholder="#YourEvent2024"
              helperText="Social media hashtag for the event"
            />
            
            <Input
              label="Event Code"
              name="eventCode"
              value={generalSettings.eventCode}
              onChange={handleInputChange}
              placeholder="CONF2024"
              helperText="Short code for referencing this event"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GeneralTab; 