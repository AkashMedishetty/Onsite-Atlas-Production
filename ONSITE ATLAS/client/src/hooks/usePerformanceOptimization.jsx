import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { message } from 'antd';

// Performance monitoring and optimization hook
export const usePerformanceOptimization = () => {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
    memoryUsage: 0,
    apiCallCount: 0,
    cacheHitRate: 0
  });

  const renderCountRef = useRef(0);
  const renderTimesRef = useRef([]);
  const apiCallsRef = useRef(0);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);

  // Performance observer for monitoring
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          renderTimesRef.current.push(entry.duration);
          if (renderTimesRef.current.length > 100) {
            renderTimesRef.current.shift(); // Keep only last 100 measurements
          }
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['measure', 'navigation'] });
    } catch (error) {
      console.warn('Performance Observer not supported');
    }

    return () => observer.disconnect();
  }, []);

  // Track component renders
  useEffect(() => {
    renderCountRef.current += 1;
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      renderTimesRef.current.push(renderTime);
      
      setPerformanceMetrics(prev => ({
        ...prev,
        renderCount: renderCountRef.current,
        lastRenderTime: renderTime,
        avgRenderTime: renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
      }));
    };
  });

  // Memory usage monitoring
  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        setPerformanceMetrics(prev => ({
          ...prev,
          memoryUsage: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) // MB
        }));
      }
    };

    const interval = setInterval(updateMemoryUsage, 5000);
    updateMemoryUsage();

    return () => clearInterval(interval);
  }, []);

  return {
    performanceMetrics,
    trackApiCall: () => {
      apiCallsRef.current += 1;
      setPerformanceMetrics(prev => ({
        ...prev,
        apiCallCount: apiCallsRef.current
      }));
    },
    trackCacheHit: () => {
      cacheHitsRef.current += 1;
      setPerformanceMetrics(prev => ({
        ...prev,
        cacheHitRate: (cacheHitsRef.current / (cacheHitsRef.current + cacheMissesRef.current) * 100).toFixed(1)
      }));
    },
    trackCacheMiss: () => {
      cacheMissesRef.current += 1;
      setPerformanceMetrics(prev => ({
        ...prev,
        cacheHitRate: (cacheHitsRef.current / (cacheHitsRef.current + cacheMissesRef.current) * 100).toFixed(1)
      }));
    }
  };
};

// Advanced caching hook with LRU implementation
export const useAdvancedCache = (maxSize = 100) => {
  const cache = useRef(new Map());
  const accessOrder = useRef([]);

  const get = useCallback((key) => {
    if (cache.current.has(key)) {
      // Move to front (most recently used)
      const index = accessOrder.current.indexOf(key);
      if (index > -1) {
        accessOrder.current.splice(index, 1);
      }
      accessOrder.current.unshift(key);
      return cache.current.get(key);
    }
    return null;
  }, []);

  const set = useCallback((key, value) => {
    // If cache is full, remove least recently used
    if (cache.current.size >= maxSize && !cache.current.has(key)) {
      const lru = accessOrder.current.pop();
      cache.current.delete(lru);
    }

    cache.current.set(key, value);
    
    // Update access order
    const index = accessOrder.current.indexOf(key);
    if (index > -1) {
      accessOrder.current.splice(index, 1);
    }
    accessOrder.current.unshift(key);
  }, [maxSize]);

  const has = useCallback((key) => cache.current.has(key), []);
  
  const clear = useCallback(() => {
    cache.current.clear();
    accessOrder.current = [];
  }, []);

  const size = useMemo(() => cache.current.size, []);

  return { get, set, has, clear, size };
};

// Optimized API hook with caching and deduplication
export const useOptimizedAPI = () => {
  const cache = useAdvancedCache(200);
  const pendingRequests = useRef(new Map());
  const { trackApiCall, trackCacheHit, trackCacheMiss } = usePerformanceOptimization();

  const fetchWithCache = useCallback(async (url, options = {}, cacheKey = url) => {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && !options.bypassCache) {
      trackCacheHit();
      return cached;
    }

    trackCacheMiss();

    // Check if request is already pending (deduplication)
    if (pendingRequests.current.has(cacheKey)) {
      return pendingRequests.current.get(cacheKey);
    }

    // Make the request
    const requestPromise = fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache successful responses
      cache.set(cacheKey, data);
      return data;
    })
    .catch(error => {
      console.error('API request failed:', error);
      throw error;
    })
    .finally(() => {
      // Remove from pending requests
      pendingRequests.current.delete(cacheKey);
      trackApiCall();
    });

    // Store pending request
    pendingRequests.current.set(cacheKey, requestPromise);

    return requestPromise;
  }, [cache, trackApiCall, trackCacheHit, trackCacheMiss]);

  const clearCache = useCallback((pattern) => {
    if (pattern) {
      // Clear specific pattern
      const keys = Array.from(cache.cache?.current?.keys() || []);
      keys.forEach(key => {
        if (key.includes(pattern)) {
          cache.cache?.current?.delete(key);
        }
      });
    } else {
      cache.clear();
    }
  }, [cache]);

  return { fetchWithCache, clearCache, cacheSize: cache.size };
};

// Optimized list rendering hook
export const useVirtualizedList = (items = [], itemHeight = 50, containerHeight = 400) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState(null);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    const visibleItems = [];
    for (let i = startIndex; i < endIndex; i++) {
      if (items[i]) {
        visibleItems.push({
          index: i,
          item: items[i],
          style: {
            position: 'absolute',
            top: i * itemHeight,
            height: itemHeight,
            width: '100%'
          }
        });
      }
    }

    return visibleItems;
  }, [items, itemHeight, scrollTop, containerHeight]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return {
    containerRef: setContainerRef,
    visibleItems,
    totalHeight,
    handleScroll,
    scrollTop
  };
};

// Debounced search hook for performance
export const useDebouncedSearch = (searchFunction, delay = 300) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  const search = useCallback((searchQuery) => {
    setQuery(searchQuery);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    timeoutRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchFunction(searchQuery);
        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        message.error('Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, delay);
  }, [searchFunction, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { query, results, loading, search };
};

// Performance monitoring component
export const PerformanceMonitor = ({ enabled = false }) => {
  const { performanceMetrics } = usePerformanceOptimization();

  if (!enabled) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999,
        minWidth: '200px'
      }}
    >
      <div><strong>Performance Metrics</strong></div>
      <div>Memory: {performanceMetrics.memoryUsage}MB</div>
      <div>API Calls: {performanceMetrics.apiCallCount}</div>
      <div>Cache Hit Rate: {performanceMetrics.cacheHitRate}%</div>
    </div>
  );
};

// Bundle size analyzer (development only)
export const analyzeBundleSize = () => {
  if (process.env.NODE_ENV !== 'development') return;

  const analyzeImports = () => {
    const modules = Object.keys(window.__webpack_require__.cache || {});
    const modulesSizes = modules.map(id => {
      const module = window.__webpack_require__.cache[id];
      return {
        id,
        size: JSON.stringify(module).length,
        exports: Object.keys(module.exports || {})
      };
    });

    modulesSizes.sort((a, b) => b.size - a.size);
    console.table(modulesSizes.slice(0, 20));
  };

  return { analyzeImports };
};

export default {
  usePerformanceOptimization,
  useAdvancedCache,
  useOptimizedAPI,
  useVirtualizedList,
  useDebouncedSearch,
  PerformanceMonitor,
  analyzeBundleSize
}; 