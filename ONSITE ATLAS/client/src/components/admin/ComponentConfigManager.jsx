import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, X, Calendar, DollarSign, Settings, BarChart3 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const ComponentConfigManager = ({ eventId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    dailyConfiguration: { enabled: false, days: [] },
    workshopComponents: [],
    sessionComponents: [],
    packageDeals: []
  });
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch current configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/events/${eventId}/component-config`);
        if (response.data.success) {
          setConfig(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
        toast.error('Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [eventId]);

  // Save configuration
  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await axios.put(`/api/events/${eventId}/component-config`, config);
      if (response.data.success) {
        toast.success('Configuration saved successfully');
        setConfig(response.data.data);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Toggle component registration
  const toggleComponentRegistration = async (enabled) => {
    try {
      const response = await axios.patch(`/api/events/${eventId}/component-config/toggle`, { enabled });
      if (response.data.success) {
        setConfig(prev => ({ ...prev, enabled }));
        toast.success(enabled ? 'Component registration enabled' : 'Component registration disabled');
      }
    } catch (error) {
      console.error('Error toggling registration:', error);
      toast.error('Failed to update setting');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Component-Based Registration
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="enabled">Enable Component Registration</label>
              <input
                type="checkbox"
                id="enabled"
                checked={config.enabled}
                onChange={(e) => toggleComponentRegistration(e.target.checked)}
                className="rounded"
              />
            </div>
            <button 
              onClick={saveConfig} 
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Settings className="h-4 w-4 mt-0.5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">Component-Based Registration</h4>
              <p className="text-blue-700">Allow attendees to register for specific days, workshops, or sessions instead of the full event.</p>
            </div>
          </div>
        </div>
      </div>

      {config.enabled && (
        <>
          {/* Navigation Tabs */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-2">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'daily', label: 'Daily Access', icon: Calendar },
                { id: 'workshops', label: 'Workshops', icon: Settings },
                { id: 'packages', label: 'Package Deals', icon: DollarSign }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-2">Daily Components</h3>
                <div className="text-2xl font-bold">{config.dailyConfiguration.days.length}</div>
                <p className="text-sm text-gray-600">Available days</p>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    config.dailyConfiguration.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {config.dailyConfiguration.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-2">Workshop Components</h3>
                <div className="text-2xl font-bold">{config.workshopComponents.length}</div>
                <p className="text-sm text-gray-600">Available workshops</p>
                <div className="mt-2">
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {config.workshopComponents.filter(w => w.active).length} Active
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-2">Package Deals</h3>
                <div className="text-2xl font-bold">{config.packageDeals.length}</div>
                <p className="text-sm text-gray-600">Available packages</p>
                <div className="mt-2">
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                    {config.packageDeals.filter(p => p.active).length} Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Daily Access Tab */}
          {activeTab === 'daily' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Daily Access Configuration</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label>Enable Daily Access</label>
                      <input
                        type="checkbox"
                        checked={config.dailyConfiguration.enabled}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          dailyConfiguration: { ...prev.dailyConfiguration, enabled: e.target.checked }
                        }))}
                        className="rounded"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const newDay = {
                          dayId: `day${config.dailyConfiguration.days.length + 1}`,
                          name: `Day ${config.dailyConfiguration.days.length + 1}`,
                          date: '',
                          description: '',
                          componentPricing: [{
                            componentType: 'daily',
                            audience: 'general',
                            priceCents: 0,
                            currency: 'INR',
                            entitlements: {
                              sessions: [],
                              meals: { breakfast: false, lunch: false, dinner: false, snacks: false },
                              kitItems: [],
                              networking: { welcomeReception: false, networkingBreaks: false, dinnerBanquet: false },
                              certificates: []
                            },
                            active: true
                          }],
                          maxAttendees: null,
                          requiresMainEvent: false,
                          active: true
                        };
                        setConfig(prev => ({
                          ...prev,
                          dailyConfiguration: {
                            ...prev.dailyConfiguration,
                            days: [...prev.dailyConfiguration.days, newDay]
                          }
                        }));
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Day
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {config.dailyConfiguration.days.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No daily components configured</p>
                    <p className="text-sm">Add daily access options to allow partial registrations.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {config.dailyConfiguration.days.map((day, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{day.name || 'Unnamed Day'}</h4>
                            <p className="text-sm text-gray-600">{day.description}</p>
                            <p className="text-xs text-gray-500">
                              {day.date ? new Date(day.date).toLocaleDateString() : 'No date set'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              day.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {day.active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={() => {
                                const newDays = [...config.dailyConfiguration.days];
                                newDays.splice(index, 1);
                                setConfig(prev => ({
                                  ...prev,
                                  dailyConfiguration: { ...prev.dailyConfiguration, days: newDays }
                                }));
                              }}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workshop Components Tab */}
          {activeTab === 'workshops' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Workshop Components</h3>
                  <button 
                    onClick={() => {
                      const newWorkshop = {
                        workshopId: `workshop_${Date.now()}`,
                        componentType: 'workshop-addon',
                        name: 'New Workshop',
                        description: '',
                        pricing: [{
                          audience: 'general',
                          priceCents: 0,
                          currency: 'INR'
                        }],
                        entitlements: { 
                          materials: [], 
                          certificates: [], 
                          recordings: false, 
                          followUpSessions: false 
                        },
                        prerequisites: { 
                          requiresMainEvent: false, 
                          requiredDays: [], 
                          maxPerRegistrant: 1 
                        },
                        active: true
                      };
                      setConfig(prev => ({
                        ...prev,
                        workshopComponents: [...prev.workshopComponents, newWorkshop]
                      }));
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Workshop
                  </button>
                </div>
              </div>
              <div className="p-6">
                {config.workshopComponents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No workshop components configured</p>
                    <p className="text-sm">Add workshop options for additional registration components.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {config.workshopComponents.map((workshop, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{workshop.name || 'Unnamed Workshop'}</h4>
                            <p className="text-sm text-gray-600">{workshop.description}</p>
                            <div className="flex gap-2 mt-1">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                workshop.componentType === 'workshop-standalone' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {workshop.componentType === 'workshop-standalone' ? 'Standalone' : 'Add-on'}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                workshop.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {workshop.active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const newWorkshops = [...config.workshopComponents];
                              newWorkshops.splice(index, 1);
                              setConfig(prev => ({ ...prev, workshopComponents: newWorkshops }));
                            }}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Package Deals Tab */}
          {activeTab === 'packages' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Package Deals</h3>
                  <button 
                    onClick={() => {
                      const newPackage = {
                        name: 'New Package Deal',
                        description: '',
                        includedComponents: [],
                        pricing: [{
                          audience: 'general',
                          priceCents: 0,
                          currency: 'INR',
                          discountPercentage: 10
                        }],
                        constraints: { 
                          minComponents: 2, 
                          maxComponents: null, 
                          validityPeriod: {} 
                        },
                        active: true
                      };
                      setConfig(prev => ({
                        ...prev,
                        packageDeals: [...prev.packageDeals, newPackage]
                      }));
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Package
                  </button>
                </div>
              </div>
              <div className="p-6">
                {config.packageDeals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No package deals configured</p>
                    <p className="text-sm">Create package deals to offer discounts on component combinations.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {config.packageDeals.map((pkg, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{pkg.name || 'Unnamed Package'}</h4>
                            <p className="text-sm text-gray-600">{pkg.description}</p>
                            <div className="flex gap-2 mt-1">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                pkg.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {pkg.active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                {pkg.includedComponents.length} Components
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const newPackages = [...config.packageDeals];
                              newPackages.splice(index, 1);
                              setConfig(prev => ({ ...prev, packageDeals: newPackages }));
                            }}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ComponentConfigManager;
