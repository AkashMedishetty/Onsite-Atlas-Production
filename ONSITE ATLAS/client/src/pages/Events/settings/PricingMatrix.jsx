import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { Input, Button, Spinner, Select } from '../../../components/common';
import eventService from '../../../services/eventService';
import pricingService from '../../../services/pricingService';
import Papa from 'papaparse';
import dayjs from 'dayjs';

// Default tiers if no rules exist (time-based pricing)
const DEFAULT_TIERS = ['early-bird', 'regular', 'onsite'];
const DEFAULT_BASE_AUDIENCES = ['individual', 'member', 'student'];
const GROUP_AUDIENCE = 'group';

const PricingMatrix = ({ eventId, rules, onReload }) => {
  console.log('[PricingMatrix] rules prop:', rules);
  const [categories, setCategories] = useState([]);
  const [matrix, setMatrix] = useState({}); // { [audience]: { [categoryId]: { [tier]: { priceCents, ruleId } } } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [newTier, setNewTier] = useState('');
  const [audiences, setAudiences] = useState(DEFAULT_BASE_AUDIENCES);
  const [newAudience, setNewAudience] = useState('');
  const [selectedAudience, setSelectedAudience] = useState(DEFAULT_BASE_AUDIENCES[0]);
  const [csvText, setCsvText] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [tierEndDates, setTierEndDates] = useState({}); // { [tier]: endDate }
  const [editingTierIdx, setEditingTierIdx] = useState(null);
  const [editingTierValue, setEditingTierValue] = useState('');
  const [editingAudienceIdx, setEditingAudienceIdx] = useState(null);
  const [editingAudienceValue, setEditingAudienceValue] = useState('');
  
  // NEW: Enhanced event-based partial day registration
  const [event, setEvent] = useState(null);
  const [partialDayEnabled, setPartialDayEnabled] = useState(false);
  const [dayConfigOpen, setDayConfigOpen] = useState(false);
  const [eventDays, setEventDays] = useState([]); // Will be populated from real event dates
  const [dayEntitlements, setDayEntitlements] = useState({}); // For future entitlement configuration
  
  // NEW: Custom combinations builder
  const [customCombinations, setCustomCombinations] = useState([]); // Array of { id, name, selectedDays, enabled }
  const [newComboName, setNewComboName] = useState('');
  const [newComboSelectedDays, setNewComboSelectedDays] = useState([]);
  
  // NEW: Group registration settings
  const [groupSettings, setGroupSettings] = useState({
    enabled: false,
    minGroupSize: 5,
    maxGroupSize: 50,
    discountType: 'percentage', // 'percentage' or 'fixed'
    discountValue: 10,
    requireContactPerson: true,
    allowMixedCategories: false
  });

  // Load event data to get real dates
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) return;
      
      try {
        const response = await eventService.getEventById(eventId);
        if (response && response.success) {
          setEvent(response.data);
          
          // Calculate event days from actual dates
          const startDate = dayjs(response.data.startDate);
          const endDate = dayjs(response.data.endDate);
          const daysDiff = endDate.diff(startDate, 'days') + 1; // +1 to include both start and end dates
          
          // Generate event days based on real dates
          const generatedDays = [];
          const generatedEntitlements = {};
          
          for (let i = 0; i < daysDiff; i++) {
            const currentDate = startDate.add(i, 'days');
            const dayId = `day${i + 1}`;
            const dayName = `Day ${i + 1}`;
            
            generatedDays.push({
              id: dayId,
              name: dayName,
              date: currentDate.format('YYYY-MM-DD'),
              description: i === 0 ? 'Opening & Keynotes' : 
                          i === daysDiff - 1 ? 'Closing & Networking' : 
                          'Sessions & Activities',
              enabled: true,
              actualDate: currentDate
            });
            
            // Set default entitlements for each day (for future use)
            generatedEntitlements[dayId] = {
              food: { 
                breakfast: i > 0,
                lunch: true, 
                coffeeBreaks: true, 
                dinner: i === daysDiff - 1
              },
              materials: { 
                sessionMaterials: true, 
                welcomeKit: i === 0,
                access: i === 0 ? 'main-auditorium' : 'all-areas'
              },
              certificates: { 
                dayAttendance: true, 
                eventCompletion: i === daysDiff - 1
              }
            };
          }
          
          setEventDays(generatedDays);
          setDayEntitlements(generatedEntitlements);
          
          console.log('[PricingMatrix] Generated event days:', generatedDays);
          console.log('[PricingMatrix] Event duration:', daysDiff, 'days');
        }
      } catch (error) {
        console.error('Error fetching event data:', error);
      }
    };
    
    fetchEventData();
  }, [eventId]);

  // Generate audience options including group and day combinations
  const generatedAudiences = useMemo(() => {
    let allAudiences = [...DEFAULT_BASE_AUDIENCES];
    
    // Add group audience if enabled
    if (groupSettings.enabled) {
      allAudiences.push(GROUP_AUDIENCE);
    }
    
    // Add day combinations as audience options
    if (partialDayEnabled && eventDays.length > 0) {
      customCombinations.forEach(combo => {
        if (combo.enabled && combo.selectedDays.length > 0) {
          allAudiences.push(`combo-${combo.id}`);
        }
      });
    }
    
    return allAudiences;
  }, [groupSettings.enabled, partialDayEnabled, eventDays, customCombinations]);

  // Update audiences when generated audiences change
  useEffect(() => {
    const uniqueAudiences = Array.from(new Set((rules||[]).map(r => r.audience).filter(Boolean)));
    const baseAudiences = uniqueAudiences.length ? uniqueAudiences : generatedAudiences;
    
    // Only update if audiences actually changed
    if (JSON.stringify(audiences) !== JSON.stringify(baseAudiences)) {
      setAudiences(baseAudiences);
      if (!baseAudiences.includes(selectedAudience)) {
        setSelectedAudience(baseAudiences[0] || DEFAULT_BASE_AUDIENCES[0]);
      }
    }
  }, [generatedAudiences, rules]);

  // Helper function to get combination display name for audiences
  const getComboDisplayName = (audience) => {
    if (audience.startsWith('combo-')) {
      const comboId = audience.replace('combo-', '');
      const combo = customCombinations.find(c => c.id === comboId);
      if (combo) {
        const selectedDayNames = combo.selectedDays
          .map(dayIndex => {
            const day = eventDays[dayIndex];
            return day ? dayjs(day.date).format('MMM DD') : `Day ${dayIndex + 1}`;
          })
          .join(' + ');
        return `${combo.name} (${selectedDayNames})`;
      }
      return audience;
    }
    return audience;
  };

  // Helper function to get tier display name with date range
  const getTierDisplayName = (tier) => {
    const endDate = tierEndDates[tier];
    const startDate = tierStartDates[tier];
    
    let tierName = tier.charAt(0).toUpperCase() + tier.slice(1).replace('-', ' ');
    
    if (startDate && endDate) {
      return `${tierName} (${startDate.format('DD MMM')} - ${dayjs(endDate).format('DD MMM YYYY')})`;
    } else if (endDate) {
      return `${tierName} (till ${dayjs(endDate).format('DD MMM YYYY')})`;
    } else if (startDate) {
      return `${tierName} (from ${startDate.format('DD MMM YYYY')})`;
    }
    
    return tierName;
  };

  // Helper function to get audience display name
  const getAudienceDisplayName = (audience) => {
    const audienceNames = {
      individual: 'Individual',
      member: 'Members', 
      student: 'Students',
      group: `Group (≥${groupSettings.minGroupSize} people)`
    };
    
    // Handle custom day combinations
    if (audience.startsWith('combo-')) {
      return getComboDisplayName(audience);
    }
    
    return audienceNames[audience] || audience.charAt(0).toUpperCase() + audience.slice(1);
  };

  // Custom combination management functions (optimized with useCallback)
  const addCustomCombination = useCallback(() => {
    if (!newComboName.trim() || newComboSelectedDays.length === 0) {
      alert('Please enter a combination name and select at least one day.');
      return;
    }
    
    const newCombo = {
      id: Date.now().toString(), // Simple ID generation
      name: newComboName.trim(),
      selectedDays: [...newComboSelectedDays].sort((a, b) => a - b), // Sort day indices
      enabled: true
    };
    
    setCustomCombinations(prev => [...prev, newCombo]);
    setNewComboName('');
    setNewComboSelectedDays([]);
  }, [newComboName, newComboSelectedDays]);

  const removeCustomCombination = useCallback((comboId) => {
    setCustomCombinations(prev => prev.filter(c => c.id !== comboId));
  }, []);

  const toggleCustomCombination = useCallback((comboId) => {
    setCustomCombinations(prev =>
      prev.map(c => c.id === comboId ? { ...c, enabled: !c.enabled } : c)
    );
  }, []);

  // Optimized toggle for day selection without full re-render
  const handleDayToggleOptimized = useCallback((dayIndex) => {
    setNewComboSelectedDays(prev => {
      const newSelection = prev.includes(dayIndex) 
        ? prev.filter(i => i !== dayIndex)
        : [...prev, dayIndex];
      return newSelection;
    });
  }, []);

  const handleDayToggle = useCallback((dayIndex) => {
    setNewComboSelectedDays(prev => {
      if (prev.includes(dayIndex)) {
        return prev.filter(i => i !== dayIndex);
      } else {
        return [...prev, dayIndex];
      }
    });
  }, []);

// Memoized component for day selection checkboxes to prevent re-renders
const DayCheckbox = memo(({ day, index, isSelected, onToggle }) => (
  <label 
    className={`flex items-center space-x-1 px-2 py-1 rounded border text-sm cursor-pointer transition-colors ${
      isSelected 
        ? 'bg-blue-100 border-blue-300 text-blue-800' 
        : 'bg-white border-gray-300 hover:bg-gray-50'
    }`}
  >
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggle(index)}
      className="h-3 w-3"
    />
    <span>{day.name}</span>
    <span className="text-gray-500 text-xs">({dayjs(day.date).format('MMM DD')})</span>
  </label>
));

// Memoized component for custom combination items
const CustomCombinationItem = memo(({ combo, eventDays, onToggle, onRemove, getComboDisplayName }) => (
  <div className="flex items-center justify-between bg-white border rounded-lg p-3">
    <div className="flex items-center space-x-3">
      <input
        type="checkbox"
        checked={combo.enabled}
        onChange={() => onToggle(combo.id)}
        className="h-4 w-4"
      />
      <div>
        <div className="font-medium text-gray-900">{combo.name}</div>
        <div className="text-sm text-gray-600">
          {combo.selectedDays.map(dayIndex => {
            const day = eventDays[dayIndex];
            return day ? `${day.name} (${dayjs(day.date).format('MMM DD')})` : `Day ${dayIndex + 1}`;
          }).join(' + ')}
        </div>
        {combo.enabled && (
          <div className="text-xs text-green-600 mt-1">
            ✅ Will appear as audience option: "{getComboDisplayName(`combo-${combo.id}`)}"
          </div>
        )}
      </div>
    </div>
    <Button
      onClick={() => onRemove(combo.id)}
      variant="danger"
      size="sm"
    >
      Remove
    </Button>
  </div>
));

  // Set tiers from rules or use defaults (time-based only)
  useEffect(() => {
    const uniqueTiers = Array.from(new Set((rules||[]).map(r => r.tier).filter(Boolean)));
    const newTiers = uniqueTiers.length ? uniqueTiers : DEFAULT_TIERS;
    
    // Only update if tiers actually changed
    if (JSON.stringify(tiers) !== JSON.stringify(newTiers)) {
      setTiers(newTiers);
    }
    
    console.log('[PricingMatrix] uniqueTiers:', uniqueTiers);
  }, [rules]);

  // Load categories and build matrix
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const catRes = await eventService.getEventCategories(eventId);
        const cats = catRes.data || catRes.categories || [];
        setCategories(cats);
        console.log('[PricingMatrix] fetched categories:', cats);
        const m = {};
        const tierDates = {};
        
        audiences.forEach(aud => {
          m[aud] = {};
          cats.forEach(cat => {
            m[aud][cat._id] = {};
            tiers.forEach(tier => {
              const rule = (rules||[]).find(r => r.category === cat.name && r.tier === tier && r.audience === aud);
              m[aud][cat._id][tier] = rule ? {
                priceCents: rule.priceCents,
                ruleId: rule._id,
                startDate: rule.startDate ? dayjs(rule.startDate).format('YYYY-MM-DD') : '',
                endDate: rule.endDate ? dayjs(rule.endDate).format('YYYY-MM-DD') : ''
              } : { priceCents: '', ruleId: null, startDate: '', endDate: '' };
              
              // Extract tier-level dates (use the first rule found for each tier)
              if (rule && rule.endDate && !tierDates[tier]) {
                tierDates[tier] = dayjs(rule.endDate).format('YYYY-MM-DD');
              }
            });
          });
        });
        
        setMatrix(m);
        setTierEndDates(tierDates);
        console.log('[PricingMatrix] built matrix:', m);
        console.log('[PricingMatrix] extracted tier dates:', tierDates);
      } catch (e) {
        setError(e.message || 'Failed to load categories');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [eventId, rules, tiers, audiences]);

  // Deep rebuild of matrix to only include valid keys
  const buildCleanMatrix = (categories, tiers, audiences, oldMatrix = {}) => {
    const newMatrix = {};
    for (const aud of audiences) {
      newMatrix[aud] = {};
      for (const cat of categories) {
        newMatrix[aud][cat._id] = {};
        for (const tier of tiers) {
          newMatrix[aud][cat._id][tier] = oldMatrix?.[aud]?.[cat._id]?.[tier] || {};
        }
      }
    }
    return newMatrix;
  };
  // On mount and whenever categories/tiers/audiences change, fully rebuild matrix
  useEffect(() => {
    setMatrix(prev => buildCleanMatrix(categories, tiers, audiences, prev));
    console.log('[PricingMatrix] buildCleanMatrix called', { categories, tiers, audiences });
  }, [categories, tiers, audiences]);

  // Robust getter for matrix cell
  const getCell = (aud, catId, tier) => {
    if (!matrix || !matrix[aud] || !matrix[aud][catId] || !matrix[aud][catId][tier]) return {};
    return matrix[aud][catId][tier];
  };

  // Helper to safely set a cell in the matrix
  const setCell = (matrix, aud, catId, tier, value) => {
    if (!matrix[aud]) matrix[aud] = {};
    if (!matrix[aud][catId]) matrix[aud][catId] = {};
    matrix[aud][catId][tier] = value;
  };

  // Handle price change in a cell
  const handleCellChange = (catId, tier, value) => {
    setMatrix(prev => ({
      ...prev,
      [selectedAudience]: {
        ...prev[selectedAudience],
        [catId]: {
          ...prev[selectedAudience][catId],
          [tier]: {
            ...prev[selectedAudience][catId][tier],
            priceCents: value
          }
        }
      }
    }));
  };

  // Add/remove tier
  const handleAddTier = () => {
    const t = newTier.trim();
    if (!t || tiers.includes(t)) return;
    setTiers(prev => [...prev, t]);
    setMatrix(prev => {
      const m = { ...prev };
      audiences.forEach(aud => {
        categories.forEach(cat => {
          m[aud][cat._id] = { ...m[aud][cat._id], [t]: { priceCents: '', ruleId: null } };
        });
      });
      return m;
    });
    setNewTier('');
  };
  const handleRemoveTier = (tier) => {
    const hasData = categories.some(cat => audiences.some(aud => matrix[aud]?.[cat._id]?.[tier]?.priceCents));
    if (hasData) {
      alert('Cannot remove a tier that has prices set. Clear all prices in this column first.');
      return;
    }
    setTiers(prev => prev.filter(t => t !== tier));
    setMatrix(prev => {
      const m = { ...prev };
      audiences.forEach(aud => {
        categories.forEach(cat => {
          if (m[aud][cat._id]) delete m[aud][cat._id][tier];
        });
      });
      return m;
    });
  };

  // Add/remove audience
  const handleAddAudience = () => {
    const a = newAudience.trim();
    if (!a || audiences.includes(a)) return;
    setAudiences(prev => [...prev, a]);
    setMatrix(prev => {
      const m = { ...prev, [a]: {} };
      categories.forEach(cat => {
        m[a][cat._id] = {};
        tiers.forEach(tier => {
          m[a][cat._id][tier] = { priceCents: '', ruleId: null };
        });
      });
      return m;
    });
    setNewAudience('');
  };
  const handleRemoveAudience = (aud) => {
    const hasData = categories.some(cat => tiers.some(tier => matrix[aud]?.[cat._id]?.[tier]?.priceCents));
    if (hasData) {
      alert('Cannot remove an audience that has prices set. Clear all prices in this audience first.');
      return;
    }
    setAudiences(prev => prev.filter(a => a !== aud));
    setMatrix(prev => {
      const m = { ...prev };
      delete m[aud];
      return m;
    });
    if (selectedAudience === aud && audiences.length > 1) {
      setSelectedAudience(audiences.find(a => a !== aud) || audiences[0]);
    }
  };

  // Bulk fill/clear
  const fillRow = (catId, value) => {
    setMatrix(prev => {
      const newMatrix = { ...prev };
      for (const aud of audiences) {
        for (const tier of tiers) {
          setCell(newMatrix, aud, catId, tier, { ...getCell(aud, catId, tier), priceCents: value });
        }
      }
      return newMatrix;
    });
  };
  const fillCol = (tier, value) => {
    setMatrix(prev => {
      const m = { ...prev };
      categories.forEach(cat => {
        m[selectedAudience][cat._id][tier] = { ...m[selectedAudience][cat._id][tier], priceCents: value };
      });
      return m;
    });
  };
  const clearRow = (catId) => fillRow(catId, '');
  const clearCol = (tier) => fillCol(tier, '');

  // CSV import/export
  const exportCSV = () => {
    const header = ['Category', ...tiers];
    const rows = categories.map(cat => {
      const row = [cat.name];
      tiers.forEach(tier => {
        row.push(matrix[selectedAudience][cat._id][tier]?.priceCents || '');
      });
      return row;
    });
    const csv = Papa.unparse([header, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing-matrix-${selectedAudience}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importCSV = () => {
    const { data } = Papa.parse(csvText.trim());
    if (!data.length) return;
    const header = data[0];
    const csvTiers = header.slice(1);
    setTiers(csvTiers);
    setMatrix(prev => {
      const m = { ...prev };
      data.slice(1).forEach(row => {
        const catName = row[0];
        const cat = categories.find(c => c.name === catName);
        if (!cat) return;
        m[selectedAudience][cat._id] = m[selectedAudience][cat._id] || {};
        row.slice(1).forEach((cell, i) => {
          m[selectedAudience][cat._id][csvTiers[i]] = { priceCents: cell, ruleId: null };
        });
      });
      return m;
    });
    setCsvOpen(false);
    setCsvText('');
  };

  // Add handlers for date changes
  const handleDateChange = (catId, tier, field, value) => {
    setMatrix(prev => ({
      ...prev,
      [selectedAudience]: {
        ...prev[selectedAudience],
        [catId]: {
          ...prev[selectedAudience][catId],
          [tier]: {
            ...prev[selectedAudience][catId][tier],
            [field]: value
          }
        }
      }
    }));
  };

  // Handler for changing a tier's end date
  const handleTierEndDateChange = (tier, date) => {
    setTierEndDates(prev => ({ ...prev, [tier]: date }));
  };

  // Compute tier start dates
  const computeTierStartDates = () => {
    const result = {};
    let prevUntil = dayjs().startOf('day');
    tiers.forEach((tier, idx) => {
      if (idx === 0) {
        result[tier] = prevUntil;
      } else {
        const prevTier = tiers[idx - 1];
        const prevEnd = tierEndDates[prevTier];
        result[tier] = prevEnd ? dayjs(prevEnd).add(1, 'day') : prevUntil;
        prevUntil = result[tier];
      }
    });
    return result;
  };
  const tierStartDates = computeTierStartDates();

  // Handler to move a tier up or down
  const moveTier = (idx, direction) => {
    setTiers(prev => {
      const arr = [...prev];
      if (direction === 'up' && idx > 0) {
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      } else if (direction === 'down' && idx < arr.length - 1) {
        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      }
      return arr;
    });
  };

  // Handler to rename a tier
  const renameTier = (idx, newName) => {
    setTiers(prev => {
      const arr = [...prev];
      arr[idx] = newName;
      return arr;
    });
  };

  // Handler to delete a tier with confirmation
  const deleteTier = idx => {
    const tierName = tiers[idx];
    if (window.confirm(`Are you sure you want to delete the tier "${tierName}"? This will remove all its prices and dates.`)) {
      setTiers(prev => prev.filter((_, i) => i !== idx));
      setTierEndDates(prev => {
        const copy = { ...prev };
        delete copy[tierName];
        return copy;
      });
      setMatrix(prev => {
        const newMatrix = {};
        for (const aud of audiences) {
          newMatrix[aud] = {};
          for (const cat of categories) {
            newMatrix[aud][cat._id] = {};
            for (const t of tiers) {
              if (t !== tierName) {
                newMatrix[aud][cat._id][t] = prev[aud]?.[cat._id]?.[t] || {};
              }
            }
          }
        }
        return newMatrix;
      });
    }
  };

  // Handler to start editing a tier name
  const startEditingTier = (idx, value) => {
    setEditingTierIdx(idx);
    setEditingTierValue(value);
  };

  // Handler to commit tier name change
  const commitTierName = idx => {
    if (editingTierValue.trim() && editingTierValue !== tiers[idx]) {
      renameTier(idx, editingTierValue.trim());
    }
    setEditingTierIdx(null);
    setEditingTierValue('');
  };

  // Reconcile matrix to always match current categories, tiers, and audiences
  const reconcileMatrix = (matrix, categories, tiers, audiences) => {
    const newMatrix = {};
    for (const aud of audiences) {
      newMatrix[aud] = {};
      for (const cat of categories) {
        newMatrix[aud][cat._id] = {};
        for (const tier of tiers) {
          newMatrix[aud][cat._id][tier] = matrix?.[aud]?.[cat._id]?.[tier] || {};
        }
      }
    }
    return newMatrix;
  };
  // Reconcile matrix whenever categories, tiers, or audiences change
  useEffect(() => {
    setMatrix(prev => reconcileMatrix(prev, categories, tiers, audiences));
  }, [categories, tiers, audiences]);

  // Save all changes (create/update rules)
  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      // Collect all rules from the matrix
      const rules = [];
      for (const aud of audiences) {
        for (const cat of categories) {
          for (const tier of tiers) {
            const cell = getCell(aud, cat._id, tier);
            const priceCents = parseInt(cell.priceCents, 10);
            if (!isNaN(priceCents) && priceCents > 0) {
              // Calculate tier-level dates
              const tierIdx = tiers.indexOf(tier);
              const tierStartDate = tierStartDates[tier] ? tierStartDates[tier].format('YYYY-MM-DD') : null;
              const tierEndDate = tierEndDates[tier] || null;
              
              rules.push({
                category: cat.name,
                categoryId: cat._id,
                audience: aud,
                tier,
                priceCents,
                // Use tier-level dates if available, otherwise fall back to cell-level dates
                startDate: tierStartDate || cell.startDate || null,
                endDate: tierEndDate || cell.endDate || null,
                name: `${cat.name} ${aud} ${tier}`.trim(),
                _id: cell.ruleId || undefined
              });
            }
          }
        }
      }
      console.log('[PricingMatrix] saveAll rules with dates:', rules);
      await pricingService.bulkSave(eventId, rules);
      if (onReload) onReload();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Handler to rename an audience
  const handleRenameAudience = (idx, newName) => {
    setAudiences(prev => {
      const arr = [...prev];
      arr[idx] = newName;
      return arr;
    });
  };

  // Handler to start editing an audience name
  const startEditingAudience = (idx, value) => {
    setEditingAudienceIdx(idx);
    setEditingAudienceValue(value);
  };

  // Handler to commit audience name change
  const commitAudienceName = idx => {
    if (editingAudienceValue.trim() && editingAudienceValue !== audiences[idx]) {
      handleRenameAudience(idx, editingAudienceValue.trim());
    }
    setEditingAudienceIdx(null);
    setEditingAudienceValue('');
  };

  if (loading) {
    console.log('[PricingMatrix] loading...');
    return <div className="py-8 text-center"><Spinner size="md" /> Loading matrix…</div>;
  }
  if (error) {
    console.log('[PricingMatrix] error:', error);
    return <div className="text-red-600">{error}</div>;
  }
  if (!categories.length) {
    console.log('[PricingMatrix] No categories found.');
    return <div className="text-gray-500">No categories found.</div>;
  }

  console.log('[PricingMatrix] rendering table with categories:', categories, 'tiers:', tiers, 'audiences:', audiences, 'matrix:', matrix);

  return (
    <div>
      {/* Group Registration Configuration */}
      <div className="mb-8 p-6 border rounded-lg bg-green-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-green-900">Group Registration Settings</h3>
            <p className="text-sm text-green-700">Configure bulk registration options and group discounts</p>
          </div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={groupSettings.enabled}
              onChange={(e) => setGroupSettings(prev => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 text-green-600"
            />
            <span className="text-sm font-medium text-green-900">Enable Group Registration</span>
          </label>
        </div>

        {groupSettings.enabled && (
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Group Size
                </label>
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={groupSettings.minGroupSize}
                  onChange={(e) => setGroupSettings(prev => ({ ...prev, minGroupSize: parseInt(e.target.value) || 5 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <div className="text-xs text-gray-500 mt-1">Minimum people required for group pricing</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Group Size
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={groupSettings.maxGroupSize}
                  onChange={(e) => setGroupSettings(prev => ({ ...prev, maxGroupSize: parseInt(e.target.value) || 50 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <div className="text-xs text-gray-500 mt-1">Maximum group size allowed</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person Required
                </label>
                <select
                  value={groupSettings.requireContactPerson ? 'yes' : 'no'}
                  onChange={(e) => setGroupSettings(prev => ({ ...prev, requireContactPerson: e.target.value === 'yes' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="yes">Yes - Require organizer details</option>
                  <option value="no">No - Direct group registration</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  {groupSettings.requireContactPerson 
                    ? "Groups must provide organizer name, email, phone" 
                    : "Groups can register directly without organizer details"
                  }
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <h4 className="font-medium text-blue-900 mb-2">💰 How to Set Group Rates</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div>1. Scroll down to the <strong>Pricing Matrix</strong> table below</div>
                <div>2. Look for the <strong>"Group (≥{groupSettings.minGroupSize} people)"</strong> row in the audience section</div>
                <div>3. Set different prices for <strong>Early Bird, Regular, Onsite</strong> tiers</div>
                <div>4. Group rates apply per person in the group (automatic bulk discount)</div>
              </div>
            </div>
            
            <div className="text-sm text-green-700 bg-green-100 p-3 rounded">
              <strong>✅ Group Registration Active:</strong> "Group (≥{groupSettings.minGroupSize} people)" appears as an audience option in your pricing matrix.
              {groupSettings.requireContactPerson && (
                <div className="mt-1">📋 <strong>Contact Person Required:</strong> Groups must provide organizer details during registration.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Partial Day Registration Configuration */}
      <div className="mb-8 p-6 border rounded-lg bg-blue-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Partial Day Registration</h3>
            <p className="text-sm text-blue-700">Configure day-based registration options for multi-day events</p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={partialDayEnabled}
                onChange={(e) => setPartialDayEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm font-medium text-blue-900">Enable Partial Day Registration</span>
            </label>
            {partialDayEnabled && (
              <Button
                onClick={() => setDayConfigOpen(!dayConfigOpen)}
                variant={dayConfigOpen ? "primary" : "secondary"}
                size="sm"
              >
                {dayConfigOpen ? "Hide Config" : "Configure Days"}
              </Button>
            )}
          </div>
        </div>

        {partialDayEnabled && (
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <h4 className="font-medium text-blue-900 mb-2">📅 How Day Combinations Work</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div>1. Each enabled day combination becomes an <strong>audience option</strong> (like Individual, Group, etc.)</div>
                <div>2. Set different prices across <strong>Early Bird, Regular, Onsite</strong> time periods</div>
                <div>3. Day combinations appear as separate rows in the pricing matrix below</div>
                <div>4. Participants can choose specific days instead of full event registration</div>
              </div>
            </div>
            
            <div className="text-sm text-green-700 bg-green-100 p-3 rounded mb-3">
              ✅ Partial day registration enabled! Day combinations will appear as audience options in your pricing matrix below.
            </div>
            
            {/* Summary of enabled combinations - only custom combinations */}
            {customCombinations.some(c => c.enabled) && (
              <div className="bg-green-50 rounded-lg p-3 mb-4">
                <h4 className="font-medium text-green-900 mb-2">Active Custom Registration Options ({
                  customCombinations.filter(c => c.enabled).length
                } total)</h4>
                <div className="text-sm text-green-800 space-y-1">
                  {customCombinations.filter(c => c.enabled).map(combo => (
                    <div key={combo.id}>• {combo.name} ({combo.selectedDays.map(dayIndex => {
                      const day = eventDays[dayIndex];
                      return day ? dayjs(day.date).format('MMM DD') : `Day ${dayIndex + 1}`;
                    }).join(' + ')})</div>
                  ))}
                </div>
                <div className="text-xs text-green-600 mt-2">
                  💡 Only admin-configured custom combinations are shown. Attendees will see these options with pricing tiers.
                </div>
              </div>
            )}
            
            {event && eventDays.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">Event Schedule ({eventDays.length} days)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  {eventDays.map((day, index) => (
                    <div key={day.id} className="flex justify-between items-center bg-white rounded px-2 py-1">
                      <span className="font-medium text-blue-800">{day.name}</span>
                      <span className="text-blue-600">{dayjs(day.date).format('MMM DD, YYYY')}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  📅 Using your event's actual dates from {dayjs(event.startDate).format('MMM DD')} to {dayjs(event.endDate).format('MMM DD, YYYY')}
                </div>
              </div>
            )}
            
            

            {/* Custom Combinations Builder */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Custom Day Combinations</h4>
                <div className="text-sm text-gray-600">
                  {customCombinations.length === 0 ? (
                    <span className="text-orange-600">⚠️ No combinations created yet</span>
                  ) : (
                    <span className="text-green-600">✅ {customCombinations.length} combination(s) created</span>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h5 className="font-medium text-gray-800 mb-3">Create New Combination</h5>
                
                {/* Quick Examples */}
                <div className="mb-4 p-3 bg-white rounded border border-gray-200">
                  <div className="text-xs text-gray-600 mb-2">💡 <strong>Quick Examples:</strong></div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Opening + Closing Days</span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Weekend Workshop</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">Executive Track</span>
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">Technical Sessions</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Combination Name*
                    </label>
                    <input
                      type="text"
                      value={newComboName}
                      onChange={(e) => setNewComboName(e.target.value)}
                      placeholder="e.g., Opening + Closing Days"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Days* ({newComboSelectedDays.length} selected)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {eventDays.map((day, index) => (
                        <DayCheckbox
                          key={day.id}
                          day={day}
                          index={index}
                          isSelected={newComboSelectedDays.includes(index)}
                          onToggle={handleDayToggleOptimized}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {newComboName.trim() && newComboSelectedDays.length > 0 && (
                      <span className="text-green-600">✅ Ready to add: "{newComboName.trim()}"</span>
                    )}
                  </div>
                  <Button
                    onClick={addCustomCombination}
                    variant="primary"
                    size="sm"
                    disabled={!newComboName.trim() || newComboSelectedDays.length === 0}
                  >
                    Add Combination
                  </Button>
                </div>
              </div>

              {/* List of Custom Combinations */}
              {customCombinations.length > 0 ? (
                <div>
                  <h5 className="font-medium text-gray-800 mb-2">Your Custom Combinations</h5>
                  <div className="space-y-2">
                    {customCombinations.map(combo => (
                      <CustomCombinationItem
                        key={combo.id}
                        combo={combo}
                        eventDays={eventDays}
                        onToggle={toggleCustomCombination}
                        onRemove={removeCustomCombination}
                        getComboDisplayName={getComboDisplayName}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-lg mb-2">📋 No Custom Combinations Yet</div>
                  <div className="text-sm">Create your first day combination above to get started!</div>
                  <div className="text-xs mt-2 text-gray-400">
                    Only your custom combinations will appear in the registration form
                  </div>
                </div>
              )}
              
              {customCombinations.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-medium text-blue-900 mb-2">🎯 How Audience Pricing Works</h5>
                  <div className="text-sm text-blue-800 space-y-2">
                    <div><strong>✅ Automatic Audiences:</strong> Each enabled custom combination becomes an audience option in the matrix below</div>
                    <div><strong>💰 Set Prices:</strong> Scroll down to see new rows for your combinations - set prices across time tiers</div>
                    <div><strong>📊 Live Preview:</strong> The pricing matrix shows your custom combinations with real dates</div>
                    <div><strong>🔄 Real-time:</strong> Enable/disable combinations to see audience options appear/disappear instantly</div>
                  </div>
                </div>
              )}
            </div>

            {dayConfigOpen && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Event Days Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {eventDays.map((day, index) => (
                    <div key={day.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={day.name}
                          onChange={(e) => {
                            const newDays = [...eventDays];
                            newDays[index].name = e.target.value;
                            setEventDays(newDays);
                          }}
                          className="font-medium bg-transparent border-none p-0 text-sm w-20"
                        />
                        <input
                          type="date"
                          value={day.date}
                          onChange={(e) => {
                            const newDays = [...eventDays];
                            newDays[index].date = e.target.value;
                            setEventDays(newDays);
                          }}
                          className="text-xs border rounded px-1 py-0.5"
                        />
                      </div>
                      <input
                        type="text"
                        value={day.description}
                        onChange={(e) => {
                          const newDays = [...eventDays];
                          newDays[index].description = e.target.value;
                          setEventDays(newDays);
                        }}
                        className="w-full text-xs border rounded px-2 py-1"
                        placeholder="Day description"
                      />
                      
                      <div className="mt-2 text-xs">
                        <div className="font-medium text-gray-700 mb-1">Entitlements:</div>
                        <div className="space-y-1">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={dayEntitlements[day.id]?.food?.lunch || false}
                              onChange={(e) => {
                                setDayEntitlements(prev => ({
                                  ...prev,
                                  [day.id]: {
                                    ...prev[day.id],
                                    food: { ...prev[day.id]?.food, lunch: e.target.checked }
                                  }
                                }));
                              }}
                              className="mr-1 h-3 w-3"
                            />
                            <span>Lunch</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={dayEntitlements[day.id]?.materials?.sessionMaterials || false}
                              onChange={(e) => {
                                setDayEntitlements(prev => ({
                                  ...prev,
                                  [day.id]: {
                                    ...prev[day.id],
                                    materials: { ...prev[day.id]?.materials, sessionMaterials: e.target.checked }
                                  }
                                }));
                              }}
                              className="mr-1 h-3 w-3"
                            />
                            <span>Materials</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={dayEntitlements[day.id]?.certificates?.dayAttendance || false}
                              onChange={(e) => {
                                setDayEntitlements(prev => ({
                                  ...prev,
                                  [day.id]: {
                                    ...prev[day.id],
                                    certificates: { ...prev[day.id]?.certificates, dayAttendance: e.target.checked }
                                  }
                                }));
                              }}
                              className="mr-1 h-3 w-3"
                            />
                            <span>Certificate</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>💡 How it works:</strong> When partial day registration is enabled, additional pricing tiers are automatically added to your matrix below. 
                    Set different prices for each day combination, and the system will enforce entitlements during registration and event access.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Existing Audience Management */}
      <div className="mb-4 flex gap-2 items-center">
        <Input
          value={newAudience}
          onChange={e => setNewAudience(e.target.value)}
          placeholder="Add new audience (e.g. Member of XYZ Org, Student, VIP)"
          className="w-64"
        />
        <Button onClick={handleAddAudience} variant="secondary">Add Audience</Button>
        {audiences.map((aud, idx) => (
          <div key={aud} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1">
            {editingAudienceIdx === idx ? (
              <Input
                value={editingAudienceValue}
                autoFocus
                onChange={e => setEditingAudienceValue(e.target.value)}
                onBlur={() => commitAudienceName(idx)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitAudienceName(idx);
                  if (e.key === 'Escape') { setEditingAudienceIdx(null); setEditingAudienceValue(''); }
                }}
                className="w-40 text-xs px-1 py-0.5"
              />
            ) : (
              <span
                className="w-40 text-xs border-b border-dotted border-gray-400 cursor-pointer px-1 py-0.5"
                onClick={() => startEditingAudience(idx, aud)}
                title="Click to edit audience name"
              >{aud}</span>
            )}
            <Button onClick={() => handleRemoveAudience(aud)} size="xs" variant="danger">×</Button>
          </div>
        ))}
      </div>
      <div className="mb-4 flex gap-2 items-center">
        <Input
          value={newTier}
          onChange={e => setNewTier(e.target.value)}
          placeholder="Add new tier (e.g. super-early)"
          className="w-48"
        />
        <Button onClick={handleAddTier} variant="secondary">Add Tier</Button>
        <span className="text-xs text-gray-400">To remove a tier, clear all prices in that column and click the × button.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border bg-white">
          <thead>
            <tr>
              <th className="border px-2 py-1 bg-gray-50" rowSpan={2}>Category</th>
              {tiers.map((tier, idx) => (
                <th
                  key={tier}
                  className="border px-2 py-1 bg-gray-100 text-center relative"
                  colSpan={audiences.length}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      {editingTierIdx === idx ? (
                        <input
                          value={editingTierValue}
                          autoFocus
                          onChange={e => setEditingTierValue(e.target.value)}
                          onBlur={() => commitTierName(idx)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitTierName(idx);
                            if (e.key === 'Escape') { setEditingTierIdx(null); setEditingTierValue(''); }
                          }}
                          className="w-24 text-center text-xs border rounded px-1 py-0.5"
                          style={{ minWidth: 60 }}
                        />
                      ) : (
                        <span
                          className="w-24 text-center text-xs border-b border-dotted border-gray-400 cursor-pointer px-1 py-0.5"
                          style={{ minWidth: 60 }}
                          onClick={() => startEditingTier(idx, tier)}
                          title="Click to edit tier name"
                        >{getTierDisplayName(tier)}</span>
                      )}
                      <button
                        type="button"
                        className="ml-1 text-xs px-1 py-0.5 border rounded bg-gray-200 hover:bg-gray-300"
                        disabled={idx === 0}
                        onClick={() => moveTier(idx, 'up')}
                        title="Move up"
                      >↑</button>
                      <button
                        type="button"
                        className="text-xs px-1 py-0.5 border rounded bg-gray-200 hover:bg-gray-300"
                        disabled={idx === tiers.length - 1}
                        onClick={() => moveTier(idx, 'down')}
                        title="Move down"
                      >↓</button>
                      <button
                        type="button"
                        className="text-xs px-1 py-0.5 border rounded bg-red-200 hover:bg-red-400 text-red-700"
                        onClick={() => deleteTier(idx)}
                        title="Delete tier"
                      >×</button>
                    </div>
                    <div className="text-xs text-gray-500">Start: {tierStartDates[tier]?.format('DD MMM YYYY')}</div>
                    <input
                      type="date"
                      value={tierEndDates[tier] || ''}
                      onChange={e => handleTierEndDateChange(tier, e.target.value)}
                      className="mt-1 text-xs px-1 py-0.5 border rounded"
                    />
                    <div className="text-xs text-gray-500">
                      {tierEndDates[tier] ? `until ${dayjs(tierEndDates[tier]).format('DD MMM YYYY')}` : ''}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              {tiers.map(tier =>
                audiences.map(aud => (
                  <th key={tier + '-' + aud} className="border px-2 py-1 bg-gray-50 text-center">
                    {getAudienceDisplayName(aud)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat._id}>
                <td className="border px-2 py-1 font-medium">
                  {cat.name}
                  <Button size="xs" variant="light" className="ml-2" onClick={() => fillRow(cat._id, prompt('Fill all prices in this row with:', ''))}>Fill</Button>
                  <Button size="xs" variant="light" className="ml-1" onClick={() => clearRow(cat._id)}>Clear</Button>
                </td>
                {tiers.map(tier =>
                  audiences.map(aud => {
                    const cell = getCell(aud, cat._id, tier);
                    return (
                      <td key={tier + '-' + aud} className="border px-2 py-1">
                        <Input
                          type="number"
                          min={0}
                          value={cell.priceCents ?? ''}
                          onChange={e => setMatrix(prev => ({
                            ...prev,
                            [aud]: {
                              ...prev[aud],
                              [cat._id]: {
                                ...prev[aud]?.[cat._id],
                                [tier]: {
                                  ...prev[aud]?.[cat._id]?.[tier],
                                  priceCents: e.target.value
                                }
                              }
                            }
                          }))}
                          className="w-24"
                          placeholder="₹"
                        />
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Live Preview Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">Live Pricing Preview</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-xs bg-white">
            <thead>
              <tr>
                <th className="border px-2 py-1 bg-gray-50" rowSpan={3}>Category</th>
                {tiers.map(tier => (
                  <th
                    key={tier}
                    className="border px-2 py-1 bg-gray-100 text-center"
                    colSpan={audiences.length}
                  >
                    <div className="font-semibold">{getTierDisplayName(tier)}</div>
                  </th>
                ))}
              </tr>
              <tr>
                {tiers.map(tier => (
                  <th
                    key={tier + '-dates'}
                    className="border px-1 py-1 bg-gray-50 text-center text-xs"
                    colSpan={audiences.length}
                  >
                    <div className="text-blue-600">
                      {tierStartDates[tier] ? tierStartDates[tier].format('DD MMM') : 'No start'} - {' '}
                      {tierEndDates[tier] ? dayjs(tierEndDates[tier]).format('DD MMM YYYY') : 'No end'}
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                {tiers.map(tier =>
                  audiences.map(aud => (
                    <th key={tier + '-' + aud} className="border px-2 py-1 bg-gray-50 text-center">
                      {getAudienceDisplayName(aud)}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat._id}>
                  <td className="border px-2 py-1 font-medium bg-gray-50">{cat.name}</td>
                  {tiers.map(tier =>
                    audiences.map(aud => {
                      const cell = getCell(aud, cat._id, tier);
                      const price = cell.priceCents || '';
                      return (
                        <td key={tier + '-' + aud + '-' + cat._id} className="border px-2 py-1 text-center">
                          <div className="font-semibold">{price ? `₹${price}` : '-'}</div>
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Example of Final Result */}
        {(partialDayEnabled && customCombinations.some(c => c.enabled)) || groupSettings.enabled ? (
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <h4 className="font-semibold text-indigo-900 mb-2">🎯 Registration Options Available to Attendees</h4>
            <div className="text-sm text-indigo-800 space-y-1">
              {groupSettings.enabled && (
                <div>✅ <strong>Group Registration:</strong> Special rates for groups of {groupSettings.minGroupSize}+ people</div>
              )}
              {partialDayEnabled && customCombinations.filter(c => c.enabled).length > 0 && (
                <div>✅ <strong>Admin-Configured Packages:</strong> {customCombinations.filter(c => c.enabled).map(c => c.name).join(', ')}</div>
              )}
              <div className="text-xs text-indigo-600 mt-2">
                💡 <strong>Result:</strong> Only your custom combinations will appear in registration forms with date-based pricing (Early Bird, Regular, etc.)
              </div>
            </div>
          </div>
        ) : null}
        
        <div className="mt-4 flex gap-3">
          <Button onClick={saveAll} loading={saving} disabled={saving} variant="primary">Save All</Button>
          <Button onClick={() => {}} variant="danger">Reset Local Data</Button>
          {saving && <span className="text-gray-500">Saving…</span>}
        </div>
        {csvOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-2">Import Pricing Matrix CSV (for audience: {getAudienceDisplayName(selectedAudience)})</h3>
              <textarea className="w-full h-64 border p-2 text-sm font-mono" value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="Category,Tier1,Tier2" />
              <div className="flex justify-end gap-3 mt-2">
                <Button variant="light" onClick={() => setCsvOpen(false)}>Cancel</Button>
                <Button onClick={importCSV}>Import</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export default memo(PricingMatrix);