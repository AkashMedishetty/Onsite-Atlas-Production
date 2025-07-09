import React from 'react';
import { motion } from 'framer-motion';

const DashboardStatsCard = ({ 
  title, 
  value, 
  icon, 
  loading = false, 
  trend = null, // { direction: 'up' | 'down', percentage: 12.5, label: 'vs last month' }
  color = 'blue',
  className = ''
}) => {
  // ClickUp-inspired color themes
  const colorThemes = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
      iconBg: 'bg-blue-500',
      iconText: 'text-white',
      accent: 'text-blue-600',
      trend: 'text-blue-600',
      border: 'border-blue-200/50',
      hover: 'hover:shadow-blue-100'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50',
      iconBg: 'bg-purple-500',
      iconText: 'text-white',
      accent: 'text-purple-600',
      trend: 'text-purple-600',
      border: 'border-purple-200/50',
      hover: 'hover:shadow-purple-100'
    },
    green: {
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
      iconBg: 'bg-emerald-500',
      iconText: 'text-white',
      accent: 'text-emerald-600',
      trend: 'text-emerald-600',
      border: 'border-emerald-200/50',
      hover: 'hover:shadow-emerald-100'
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50',
      iconBg: 'bg-orange-500',
      iconText: 'text-white',
      accent: 'text-orange-600',
      trend: 'text-orange-600',
      border: 'border-orange-200/50',
      hover: 'hover:shadow-orange-100'
    }
  };

  const theme = colorThemes[color] || colorThemes.blue;

  // Loading skeleton component
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border ${theme.border} dark:border-gray-600
          p-6 shadow-sm ${className}
        `}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-100/80 dark:via-gray-700/80 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -2,
        transition: { duration: 0.2 }
      }}
      className={`
        relative group cursor-pointer rounded-2xl bg-white dark:bg-gray-800 border ${theme.border} dark:border-gray-600
        p-6 shadow-sm hover:shadow-lg ${theme.hover} transition-all duration-300
        ${theme.bg} dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-700 ${className}
      `}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/40 to-transparent dark:from-gray-700/30 dark:via-gray-600/20 dark:to-transparent rounded-2xl" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          {/* Title and Value */}
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-200 mb-2 tracking-wide">
              {title}
            </h3>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </span>
            </div>
          </div>

          {/* Icon */}
          <div className={`
            flex-shrink-0 p-3 rounded-xl ${theme.iconBg} ${theme.iconText}
            shadow-lg group-hover:scale-110 transition-transform duration-300
          `}>
            {React.cloneElement(icon, { className: 'h-6 w-6' })}
          </div>
        </div>

        {/* Subtle bottom accent line */}
        <div className={`
          absolute bottom-0 left-6 right-6 h-0.5 ${theme.iconBg} rounded-full
          transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300
        `} />
      </div>
    </motion.div>
  );
};

export default DashboardStatsCard; 