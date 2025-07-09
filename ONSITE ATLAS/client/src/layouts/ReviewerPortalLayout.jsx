import React, { useEffect, useState } from 'react';
import { Outlet, Link, useParams } from 'react-router-dom';
// You might want to import a specific Navbar/Header for the reviewer portal if needed
// import ReviewerNavbar from '../components/Navbars/ReviewerNavbar'; 
import { useAuth } from '../contexts/AuthContext'; // Assuming AuthContext is in this path
import eventService from '../services/eventService'; // Changed to default import

const ReviewerPortalLayout = () => {
  const { eventId: urlEventId } = useParams(); // Get eventId from URL
  const { currentEventId, setCurrentEventId } = useAuth();
  const [eventName, setEventName] = useState('Reviewer Portal');
  
  // Determine which eventId to use - URL takes precedence
  const activeEventId = urlEventId || currentEventId;

  // Sync AuthContext eventId with URL eventId
  useEffect(() => {
    if (urlEventId && urlEventId !== currentEventId) {
      console.log('[ReviewerPortalLayout] Syncing eventId from URL to AuthContext:', urlEventId);
      setCurrentEventId(urlEventId);
      localStorage.setItem('currentEventId', urlEventId);
    }
  }, [urlEventId, currentEventId, setCurrentEventId]);

  useEffect(() => {
    if (activeEventId) {
      const fetchEventName = async () => {
        try {
          // Ensure getEventById returns an object with a data property, which contains the event details
          const response = await eventService.getEventById(activeEventId);
          if (response && response.success && response.data && response.data.name) {
            setEventName(response.data.name);
            document.title = `${response.data.name} - Reviewer Portal`;
          } else {
            // Fallback if event name is not found in the response
            setEventName('Reviewer Portal');
            document.title = 'Reviewer Portal';
            console.warn('Event details or name not found for ID:', activeEventId, 'Response:', response);
          }
        } catch (error) {
          console.error('Failed to fetch event name:', error);
          setEventName('Reviewer Portal'); // Fallback on error
          document.title = 'Reviewer Portal';
        }
      };
      fetchEventName();
    } else {
      // Reset if no activeEventId (e.g., after logout)
      setEventName('Reviewer Portal');
      document.title = 'Reviewer Portal';
    }
  }, [activeEventId]);

  return (
    <div className="reviewer-portal-layout min-h-screen bg-gray-100 flex flex-col">
      {/* <ReviewerNavbar /> Optional: A specific navbar for reviewers */}
      <header className="bg-indigo-600 text-white shadow-md">
        <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
          <Link 
            to={activeEventId ? `/reviewer/${activeEventId}/dashboard` : "/reviewer/dashboard"} 
            className="text-xl font-bold hover:text-indigo-200"
          >
            {eventName}
          </Link>
          <div>
            {/* Display event context info */}
            {activeEventId && (
              <span className="text-sm text-indigo-200 mr-4">
                Event ID: {activeEventId.substring(0, 8)}...
              </span>
            )}
            {/* Add logout button or other relevant links here later */}
            {/* Example: <button onClick={handleLogout} className="text-sm hover:text-indigo-200">Logout</button> */}
          </div>
        </nav>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        <Outlet />
      </main>
      <footer className="bg-gray-700 text-white text-center p-4 mt-auto">
        <p>&copy; {new Date().getFullYear()} <span className="font-bold text-purple-400">Purple</span><span className="font-bold !text-white">Hat</span> Tech™ - Reviewer System</p>
      </footer>
    </div>
  );
};

export default ReviewerPortalLayout; 