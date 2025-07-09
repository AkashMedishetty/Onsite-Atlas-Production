import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const EventCardSkeleton = () => {
  const { resolvedTheme } = useTheme();
  
  const shimmerClass = `
    relative overflow-hidden
    before:absolute before:inset-0
    before:-translate-x-full
    before:animate-[shimmer_2s_infinite]
    before:bg-gradient-to-r
    before:from-transparent
    ${resolvedTheme === 'dark' 
      ? 'before:via-gray-600/10' 
      : 'before:via-gray-200/60'
    }
    before:to-transparent
  `;

  return (
    <div className={`h-full overflow-hidden border-2 rounded-lg ${
      resolvedTheme === 'dark' 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      {/* Banner Skeleton */}
      <div className={`w-full h-48 ${
        resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
      } ${shimmerClass}`}>
        {/* Status Badge Skeleton */}
        <div className="absolute top-3 left-3">
          <div className={`h-6 w-16 rounded-full ${
            resolvedTheme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
          } ${shimmerClass}`} />
        </div>
        
        {/* Action Buttons Skeleton */}
        <div className="absolute top-3 right-3 flex space-x-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-8 w-8 rounded-lg ${
                resolvedTheme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
              } ${shimmerClass}`}
            />
          ))}
        </div>
      </div>
      
      {/* Content Skeleton */}
      <div className="p-6">
        {/* Title Skeleton */}
        <div className="mb-3">
          <div className={`h-6 w-3/4 rounded ${
            resolvedTheme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
          } ${shimmerClass} mb-2`} />
        </div>
        
        {/* Description Skeleton */}
        <div className="mb-4 space-y-2">
          <div className={`h-4 w-full rounded ${
            resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          } ${shimmerClass}`} />
          <div className={`h-4 w-2/3 rounded ${
            resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          } ${shimmerClass}`} />
        </div>
        
        {/* Event Details Skeleton */}
        <div className="space-y-2 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center">
              <div className={`h-4 w-4 rounded ${
                resolvedTheme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
              } ${shimmerClass} mr-2`} />
              <div className={`h-4 w-32 rounded ${
                resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              } ${shimmerClass}`} />
            </div>
          ))}
        </div>
        
        {/* Analytics Section Skeleton */}
        <div className={`mt-4 pt-4 border-t ${
          resolvedTheme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className={`h-6 w-8 mx-auto rounded ${
                  resolvedTheme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                } ${shimmerClass} mb-1`} />
                <div className={`h-3 w-12 mx-auto rounded ${
                  resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                } ${shimmerClass}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const EventListSkeleton = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: count }, (_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </div>
  );
};

export { EventCardSkeleton, EventListSkeleton };
export default EventCardSkeleton; 