import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import RegistrantPortalLayout from './layouts/RegistrantPortalLayout';
import ReviewerPortalLayout from './layouts/ReviewerPortalLayout';

// Import pages
import Dashboard from './pages/Dashboard';
import Timeline from './pages/Timeline';

// Import components using barrel exports
import { EventList, EventForm, EventPortal, ResourcesTab } from './pages/Events';
import { CategoryList, CategoryForm, CategoryDetail, CategoryResources } from './pages/Categories';
import { RegistrationList, RegistrationForm } from './pages/Registration';
import { AbstractList, AbstractSubmissionForm, AbstractDetail } from './pages/Abstracts';
import { BadgePrintingPage, BadgeDesigner } from './pages/BadgePrinting';

// Import enhanced registration detail component
import RegistrationDetail from './pages/Events/registrations/RegistrationDetail';

// Import resource components
import { ResourceList, ScannerStation, FoodTracking, KitBagDistribution, CertificateIssuance, CertificatePrinting, CertificatePrintingScanner } from './pages/Resources';

// Import new components
import BulkImportWizard from './pages/Registrations/BulkImportWizard';
import LandingPagesManager from './pages/LandingPages/LandingPagesManager';
import LandingPageEditor from './pages/LandingPages/LandingPageEditor';
import LandingPagePreview from './pages/LandingPages/LandingPagePreview';
import PublicLandingPage from './pages/Public/PublicLandingPage';
import AbstractManagementDashboard from './pages/AbstractManagement/AbstractManagementDashboard';
import AbstractReview from './pages/AbstractManagement/AbstractReview';
import ClientLoginPage from './pages/ClientPortal/ClientLoginPage';
import ClientPortalRoutes from './pages/ClientPortal/ClientPortalRoutes';

// Import Component Registration Components (Internal Settings Only)
import ComponentConfigManager from './components/admin/ComponentConfigManager';
import ComponentAnalyticsDashboard from './components/admin/ComponentAnalyticsDashboard';
import ComponentRegistration from './pages/Events/registrations/ComponentRegistration';

// Import Resource Blocking Components (commented out until components are created)
// const ResourceBlockingManager = lazy(() => import('./components/admin/ResourceBlockingManager'));
// const BulkResourceBlocking = lazy(() => import('./components/admin/BulkResourceBlocking'));

// Lazily loaded components
const EventSettings = lazy(() => import('./pages/Events/EventSettings'));
const BulkImport = lazy(() => import('./pages/Registration/BulkImport'));
const ResourceConfiguration = lazy(() => import('./pages/Resources/ResourceConfiguration'));
const AbstractForm = lazy(() => import('./pages/Abstracts/AbstractForm'));
const AbstractPortal = lazy(() => import('./pages/PublicPortals/AbstractPortal'));
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'));
const ReportBuilder = lazy(() => import('./pages/Reports/ReportBuilder'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const UserManagement = lazy(() => import('./pages/Settings/UserManagement'));
const GlobalSettings = lazy(() => import('./pages/Settings/GlobalSettings'));
const EmailTemplates = lazy(() => import('./pages/Settings/EmailTemplates'));
const PaymentGateways = lazy(() => import('./pages/Settings/PaymentGateways'));
const PaymentsPage = lazy(() => import('./pages/Payments/PaymentsPage'));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/Auth/ForgotPasswordPage'));
const RegistrationPortal = lazy(() => import('./pages/PublicPortals/RegistrationPortal'));
const SponsorLoginPortal = lazy(() => import('./pages/PublicPortals/SponsorLoginPortal'));
const SponsorRegistrantManagement = lazy(() => import('./pages/PublicPortals/SponsorRegistrantManagement'));
const PublicRegistrationLookup = lazy(() => import('./pages/PublicPortals/PublicRegistrationLookup'));

// Reviewer Portal Pages (Lazy Load)
const ReviewerLoginPage = lazy(() => import('./pages/ReviewerPortal/ReviewerLoginPage'));
const ReviewerDashboardPage = lazy(() => import('./pages/ReviewerPortal/ReviewerDashboardPage'));
const ReviewerAbstractReviewPage = lazy(() => import('./pages/ReviewerPortal/ReviewerAbstractReviewPage'));

// Authentication
import { AuthProvider } from './contexts/AuthContext';
import { RegistrantAuthProvider } from './contexts/RegistrantAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ActiveEventProvider } from './contexts/ActiveEventContext';
import { NotificationProvider } from './contexts/NotificationContext';
import PrivateRoute from './components/PrivateRoute';
import PublicRoute from './components/PublicRoute';
import RegistrantRoute from './components/RegistrantRoute';
import { ClientAuthProvider } from './contexts/ClientAuthContext';

// Admin pages
import EventsPage from './pages/Events/EventsPage';
import EventCreate from './pages/Events/EventCreate';
import Profile from './pages/Profile/Profile';
import Users from './pages/Users/Users';
import UserCreate from './pages/Users/UserCreate';
import UserEdit from './pages/Users/UserEdit';
import SystemSettings from './pages/Settings/SystemSettings';
import Billing from './pages/Billing/Billing';
import Help from './pages/Help/Help';
import ClientDashboard from './pages/ClientDashboard';
import { SponsorsList, SponsorForm, SponsorView } from './pages/SponsorManagement';

// Event management pages
import RegistrationsPage from './pages/Registrations/RegistrationsPage';
import CategoriesPage from './pages/Categories/CategoriesPage';
import ResourcesPage from './pages/Resources/ResourcesPage';
import BadgesPage from './pages/Badges/BadgesPage';
import EmailsPage from './pages/Emails/EmailsPage';
import AbstractsPage from './pages/Abstracts/AbstractsPage';
import ScheduleManagement from './pages/EventManagement/ScheduleManagement';

// Registrant Portal Pages
import RegistrantHome from './pages/RegistrantPortal/RegistrantHome';
import RegistrantLogin from './pages/RegistrantPortal/RegistrantLogin';
import RegistrantSignup from './pages/RegistrantPortal/RegistrantSignup';
import RegistrantForgotPassword from './pages/RegistrantPortal/RegistrantForgotPassword';
import RegistrantResetPassword from './pages/RegistrantPortal/RegistrantResetPassword';
import RegistrantProfile from './pages/RegistrantPortal/RegistrantProfile';
import RegistrantDashboard from './pages/RegistrantPortal/RegistrantDashboard';
import RegistrantEvents from './pages/RegistrantPortal/RegistrantEvents';
import AbstractsList from './pages/RegistrantPortal/AbstractsList';
import { default as RegistrantAbstractSubmissionForm } from './pages/RegistrantPortal/AbstractSubmissionForm';
import { default as RegistrantAbstractDetail } from './pages/RegistrantPortal/AbstractDetail';

// Public Pages
import HomePage from './pages/Public/HomePage';
import AboutPage from './pages/Public/AboutPage';
import ContactPage from './pages/Public/ContactPage';
import EventsListPage from './pages/Public/EventsListPage';
import EventDetailsPage from './pages/Public/EventDetailsPage';
import PrivacyPolicyPage from './pages/Public/PrivacyPolicyPage';
import TermsOfUsePage from './pages/Public/TermsOfUsePage';

// 404 Page
import NotFoundPage from './pages/NotFound/NotFoundPage';

// Sponsor Portal Components (lazy load for consistency, or import directly if small)
const SponsorPortalLayout = lazy(() => import('./pages/SponsorPortal/SponsorPortalLayout'));
const SponsorProfilePage = lazy(() => import('./pages/SponsorPortal/SponsorProfilePage'));
const SponsorRegistrantListPage = lazy(() => import('./pages/SponsorPortal/SponsorRegistrantListPage'));
const SponsorDashboard = lazy(() => import('./pages/SponsorPortal/SponsorDashboard'));

// Import sponsorAuthService for SponsorRoute
import sponsorAuthService from './services/sponsorAuthService';

// LoadingFallback component for Suspense
const LoadingFallback = ({ error = null }) => (
  <div className="flex items-center justify-center h-screen">
    {error ? (
      <div className="text-center">
        <div className="text-red-600 mb-4">Error loading component</div>
        <div className="text-sm text-gray-600">{error.message}</div>
      </div>
    ) : (
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
    )}
  </div>
);

// Placeholder for SponsorRoute - implement proper auth check later
const SponsorRoute = ({ children }) => {
  const token = sponsorAuthService.getCurrentSponsorToken();
  const sponsorDetails = sponsorAuthService.getCurrentSponsorData();

  // Valid session: token exists, and sponsorDetails (which includes eventId) exist.
  if (token && sponsorDetails && sponsorDetails.eventId) {
    return children;
  }

  // Try to get eventId from sponsorDetails, or from the current URL if missing
  let eventId = sponsorDetails && sponsorDetails.eventId;
  if (!eventId && typeof window !== 'undefined') {
    // Try to extract from /sponsor-portal/events/:eventId or /portal/sponsor-login/:eventId
    const match = window.location.pathname.match(/sponsor-portal(?:\/events)?\/(\w+)/) || window.location.pathname.match(/portal\/sponsor-login\/(\w+)/);
    if (match) eventId = match[1];
  }
  if (eventId) {
    return <Navigate to={`/portal/sponsor-login/${eventId}`} replace />;
  }
  // Fallback
  return <Navigate to="/portal/sponsor-login/" replace />;
};

// Add a wrapper for ScannerStation to inject eventId from params
const ScannerStationWrapper = () => {
  const { id: eventIdFromParams } = useParams();
  return <ScannerStation eventId={eventIdFromParams} />;
};

const BackupRestore = lazy(() => import('./pages/Settings/BackupRestore'));
const SystemLogsPage = lazy(() => import('./pages/Settings/SystemLogs'));

const PayRedirect = lazy(() => import('./pages/Payments/PayRedirect')); 
const PaymentSuccess = lazy(() => import('./pages/Payments/PaymentSuccess')); 
const PaymentCancel = lazy(() => import('./pages/Payments/PaymentCancel')); 

const App = () => {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <RegistrantAuthProvider>
            <ActiveEventProvider>
              <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>

              {/* Public Routes */}
              <Route path="/events/:eventSlug/landing" element={<PublicLandingPage />} />
              <Route path="/go/:shortCode" element={<PublicLandingPage />} />

              {/* Public Portal Routes */}
              <Route path="/portal">
                <Route path="register/:eventId" element={<RegistrationPortal />} />
                <Route path="abstract/:eventId" element={<AbstractPortal />} />
                <Route path="registration-lookup/:eventId" element={<PublicRegistrationLookup />} />
                <Route path="reviewer/:eventId" element={<ReviewerLoginPage />} />
                <Route path="sponsor-login/:eventId" element={<SponsorLoginPortal />} />
                <Route path="sponsor-dashboard/:eventId/:sponsorId/registrants" element={<SponsorRegistrantManagement />} />
                <Route
                  path="client-login/:eventId"
                  element={
                    <ClientAuthProvider>
                      <ClientLoginPage />
                    </ClientAuthProvider>
                  }
                />
              </Route>

              {/* Registrant Portal Routes */}
              <Route path="/registrant-portal/auth" element={<AuthLayout isRegistrantPortal />}>
                <Route path="login" element={<RegistrantLogin />} />
                <Route path="signup" element={<RegistrantSignup />} />
                <Route path="forgot-password" element={<RegistrantForgotPassword />} />
                <Route path="reset-password/:token" element={<RegistrantResetPassword />} />
              </Route>

              <Route path="/registrant-portal" element={<RegistrantRoute><RegistrantPortalLayout /></RegistrantRoute>}>
                <Route index element={<RegistrantDashboard />} />
                <Route path="profile" element={<RegistrantProfile />} />
                <Route path="events" element={<RegistrantEvents />} />
                <Route path="abstracts">
                  <Route index element={<AbstractsList />} />
                  <Route path="new" element={<RegistrantAbstractSubmissionForm />} />
                  <Route path=":abstractId" element={<RegistrantAbstractDetail />} />
                  <Route path=":abstractId/edit" element={<RegistrantAbstractSubmissionForm />} />
                </Route>
                {/* Event-scoped abstract detail and edit routes */}
                <Route path="events/:eventId/abstracts/:abstractId" element={<RegistrantAbstractDetail />} />
                <Route path="events/:eventId/abstracts/:abstractId/edit" element={<RegistrantAbstractSubmissionForm />} />
              </Route>

              {/* Reviewer Portal Routes */}
              <Route path="/reviewer/login" element={<ReviewerLoginPage />} />
              <Route path="/reviewer/:eventId" element={<PrivateRoute><ReviewerPortalLayout /></PrivateRoute>}>
                <Route path="dashboard" element={<ReviewerDashboardPage />} />
                <Route path="abstract/:abstractId/review" element={<ReviewerAbstractReviewPage />} />
              </Route>
              {/* Legacy routes for backward compatibility */}
              <Route element={<PrivateRoute><ReviewerPortalLayout /></PrivateRoute>}>
                <Route path="/reviewer/dashboard" element={<ReviewerDashboardPage />} />
                <Route path="/reviewer/abstract/:abstractId/review" element={<ReviewerAbstractReviewPage />} />
              </Route>

              {/* Sponsor Portal Routes */}
              <Route path="/sponsor-portal" element={<SponsorRoute><SponsorPortalLayout /></SponsorRoute>}>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<SponsorProfilePage />} />
                <Route path="registrants" element={<SponsorRegistrantListPage />} />
                <Route path="dashboard" element={<SponsorDashboard />} />
              </Route>

              {/* Main Dashboard and Management Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Dashboard />} />
                
                {/* Events List & Creation/Edit Forms */}
                <Route path="/events">
                  <Route index element={<EventList />} />
                  <Route path="new" element={<EventForm />} />
                  
                  {/* Specific event routes that should NOT be handled by EventPortal */}
                  <Route path=":id/edit" element={<EventForm />} />
                  <Route path=":id/registrations/new" element={<RegistrationForm />} />
                  <Route path=":id/registrations/bulk-import" element={<BulkImportWizard />} />
                  <Route path=":id/schedule-management" element={<ScheduleManagement />} />
                  
                  {/* Event Portal Route - Handles all other event-specific navigation */}
                  <Route path=":id/*" element={<EventPortal />} />
                </Route>
                
                {/* Global routes (Categories, Registrations, Resources, Abstracts) */}
                <Route path="/categories">
                  <Route index element={<CategoryList />} />
                </Route>
                <Route path="/registrations">
                  <Route index element={<RegistrationList />} />
                </Route>
                <Route path="/resources">
                  <Route index element={<ResourceList />} />
                </Route>
                <Route path="/abstracts">
                  <Route index element={<AbstractList />} />
                </Route>

                {/* Reports */}
                <Route path="/reports">
                  <Route index element={<ReportsPage />} />
                  <Route path="builder" element={<ReportBuilder />} />
                  <Route path=":reportType" element={<ReportsPage />} />
                </Route>

                {/* Settings */}
                <Route path="/settings">
                  <Route index element={<SettingsPage />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="global" element={<GlobalSettings />} />
                  <Route path="email" element={<EmailTemplates />} />
                  <Route path="payment" element={<PaymentGateways />} />
                  <Route path="backup" element={<BackupRestore />} />
                  <Route path="logs" element={<SystemLogsPage />} />
                </Route>
                
                {/* Profile and other main layout routes */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/users">
                    <Route index element={<Users />} />
                    <Route path="new" element={<UserCreate />} />
                    <Route path=":userId/edit" element={<UserEdit />} />
                </Route>
                <Route path="/system-settings" element={<SystemSettings />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/help" element={<Help />} />
                <Route path="/timeline" element={<Timeline />} />
              </Route>

              {/* Client Portal Routes */}
              <Route
                path="/client/*"
                element={
                  <ClientAuthProvider>
                    <ClientPortalRoutes />
                  </ClientAuthProvider>
                }
              />

              {/* Payment Routes */}
              <Route path="/pay/:eventId/:token" element={<PayRedirect />} />
              <Route path="/payment-success/:eventId/:token" element={<PaymentSuccess />} />
              <Route path="/payment-cancel/:eventId/:token" element={<PaymentCancel />} />

              {/* Catch-all 404 Route - Must be last */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
            <Toaster position="top-right" />
            </ActiveEventProvider>
          </RegistrantAuthProvider>
        </NotificationProvider>
      </AuthProvider>
      <ToastContainer position="top-right" autoClose={5000} />
      </ThemeProvider>
    </Router>
  );
};

export default App;

      