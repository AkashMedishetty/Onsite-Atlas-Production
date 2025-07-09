import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SunIcon, 
  MoonIcon, 
  ComputerDesktopIcon 
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { uiTheme, resolvedTheme, toggleTheme } = useTheme();

  // Theme configuration
  const themes = [
    {
      key: 'light',
      icon: SunIcon,
      label: 'Light',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      hoverColor: 'hover:bg-yellow-100'
    },
    {
      key: 'dark',
      icon: MoonIcon,
      label: 'Dark',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100'
    },
    {
      key: 'system',
      icon: ComputerDesktopIcon,
      label: 'System',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100'
    }
  ];

  const currentTheme = themes.find(t => t.key === uiTheme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={toggleTheme}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          relative group p-2.5 rounded-xl transition-all duration-300
          bg-white dark:bg-gray-800 
          hover:bg-gray-50 dark:hover:bg-gray-700
          border border-gray-200 dark:border-gray-600
          shadow-sm hover:shadow-md
          ${className}
        `}
        title={`Current: ${currentTheme.label} (Click to cycle)`}
      >
        {/* Icon container with smooth transitions */}
        <div className="relative w-5 h-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={uiTheme}
              initial={{ scale: 0, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 180, opacity: 0 }}
              transition={{ 
                duration: 0.3,
                type: "spring",
                stiffness: 300,
                damping: 20
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <CurrentIcon 
                className={`
                  w-5 h-5 transition-colors duration-200
                  ${resolvedTheme === 'dark' 
                    ? 'text-gray-300 group-hover:text-white' 
                    : 'text-gray-600 group-hover:text-gray-900'
                  }
                `} 
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pulse effect on theme change */}
        <motion.div
          key={`pulse-${uiTheme}`}
          initial={{ scale: 1, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className={`
            absolute inset-0 rounded-xl border-2
            ${resolvedTheme === 'dark' 
              ? 'border-purple-400' 
              : 'border-blue-400'
            }
          `}
        />

        {/* Active theme indicator */}
        <div className={`
          absolute -top-1 -right-1 w-3 h-3 rounded-full
          ${resolvedTheme === 'dark' 
            ? 'bg-purple-500' 
            : 'bg-blue-500'
          }
          ring-2 ring-white dark:ring-gray-800
          transition-colors duration-300
        `} />
      </motion.button>

      {/* Tooltip */}
      <div className={`
        absolute top-full mt-2 left-1/2 transform -translate-x-1/2
        bg-gray-900 dark:bg-gray-700 text-white text-xs
        px-3 py-1.5 rounded-lg shadow-lg
        opacity-0 group-hover:opacity-100 transition-opacity duration-200
        pointer-events-none z-50
        whitespace-nowrap
      `}>
        <div className="flex items-center gap-2">
          <CurrentIcon className="w-3 h-3" />
          <span>{currentTheme.label} Mode</span>
        </div>
        <div className="text-gray-300 dark:text-gray-400 text-[10px] mt-0.5">
          {uiTheme === 'system' 
            ? `Following system (${resolvedTheme})` 
            : 'Click to cycle themes'
          }
        </div>
        {/* Tooltip arrow */}
        <div className={`
          absolute -top-1 left-1/2 transform -translate-x-1/2
          w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45
        `} />
      </div>
    </div>
  );
};

export default ThemeToggle; 