import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { loadNicheBrands } from './utils/brand';
import ScrollToTop from './components/ScrollToTop';
import { TrackingProvider } from './providers/TrackingProvider';
import PublicLayout from './layouts/PublicLayout';

// Eagerly loaded pages (critical for first paint)
import Homepage from './pages/Homepage';
import DelayedLoader from './components/DelayedLoader';

// Lazy loaded public pages
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ConcernCategoryPage = lazy(() => import('./pages/ConcernCategoryPage'));
const SkincareHome = lazy(() => import('./pages/SkincareHome'));
const CosmeticsHome = lazy(() => import('./pages/CosmeticsHome'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const RoutinePage = lazy(() => import('./pages/RoutinePage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));

// Lazy loaded public pages (loaded on demand)
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const BlogList = lazy(() => import('./pages/BlogList'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const LocationPage = lazy(() => import('./pages/LocationPage'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const ConsultationPage = lazy(() => import('./pages/ConsultationPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'));
const ShippingPolicyPage = lazy(() => import('./pages/ShippingPolicyPage'));

// Lazy loaded admin pages (separate chunk, only loaded when visiting admin)
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminBlogs = lazy(() => import('./pages/admin/AdminBlogs'));
const AdminBlogEditor = lazy(() => import('./pages/admin/AdminBlogEditor'));
const AdminLocations = lazy(() => import('./pages/admin/AdminLocations'));
const AdminLocationEditor = lazy(() => import('./pages/admin/AdminLocationEditor'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminAIStudio = lazy(() => import('./pages/admin/AdminAIStudio'));
const AdminConsultations = lazy(() => import('./pages/admin/AdminConsultations'));
const AdminUserJourney = lazy(() => import('./pages/admin/AdminUserJourney'));
const AdminLiveVisitors = lazy(() => import('./pages/admin/AdminLiveVisitors'));
const AdminWhatsApp = lazy(() => import('./pages/admin/AdminWhatsApp'));
const AdminReferrals = lazy(() => import('./pages/admin/AdminReferrals'));
const AdminLandingPages = lazy(() => import('./pages/admin/AdminLandingPages'));
const AdminEmployees = lazy(() => import('./pages/admin/AdminEmployees'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminConcerns = lazy(() => import('./pages/admin/AdminConcerns'));
const AdminNiches = lazy(() => import('./pages/admin/AdminNiches'));
const AdminRetention = lazy(() => import('./pages/admin/AdminRetention'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminRoutines = lazy(() => import('./pages/admin/AdminRoutines'));

// Employee Pages
const EmployeeLogin = lazy(() => import('./pages/employee/EmployeeLogin'));
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard'));
const EmployeeLayout = lazy(() => import('./layouts/EmployeeLayout'));
const EmployeeOrders = lazy(() => import('./pages/employee/EmployeeOrders'));
const EmployeeCustomers = lazy(() => import('./pages/employee/EmployeeCustomers'));
const EmployeeBlogs = lazy(() => import('./pages/employee/EmployeeBlogs'));
const EmployeeAnalytics = lazy(() => import('./pages/employee/EmployeeAnalytics'));
const EmployeeLandingPages = lazy(() => import('./pages/employee/EmployeeLandingPages'));
const EmployeeConsultations = lazy(() => import('./pages/employee/EmployeeConsultations'));
const EmployeeProducts = lazy(() => import('./pages/employee/EmployeeProducts'));
const EmployeeRetention = lazy(() => import('./pages/employee/EmployeeRetention'));

// Landing Page Funnel removed (per user request)

// Legacy Landing Page (for backward compatibility with /lp/ URLs)
const LandingPage = lazy(() => import('./pages/LandingPage'));

// Loading spinner for lazy loaded pages (delayed — only appears for slow chunk loads)
const PageLoader = () => <DelayedLoader delay={280} />;

// Admin layout wrapper (no tracking, minimal overhead)
const AdminLayout = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

function App() {
  useEffect(() => {
    // Detect referral code from URL on any page load and store in sessionStorage
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      sessionStorage.setItem('referralCode', refCode);
      console.log('[Referral] Code detected in URL:', refCode);
    }
    // Warm per-niche brand cache so ProductCard renders the right brand on first paint
    loadNicheBrands();
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Admin Routes - No tracking provider, lazy loaded */}
        <Route path="/admin" element={<AdminLayout><AdminLogin /></AdminLayout>} />
        <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/blogs" element={<AdminLayout><AdminBlogs /></AdminLayout>} />
        <Route path="/admin/blogs/new" element={<AdminLayout><AdminBlogEditor /></AdminLayout>} />
        <Route path="/admin/blogs/edit/:id" element={<AdminLayout><AdminBlogEditor /></AdminLayout>} />
        <Route path="/admin/locations" element={<AdminLayout><AdminLocations /></AdminLayout>} />
        <Route path="/admin/locations/new" element={<AdminLayout><AdminLocationEditor /></AdminLayout>} />
        <Route path="/admin/locations/edit/:id" element={<AdminLayout><AdminLocationEditor /></AdminLayout>} />
        <Route path="/admin/orders" element={<AdminLayout><AdminOrders /></AdminLayout>} />
        <Route path="/admin/ai-studio" element={<AdminLayout><AdminAIStudio /></AdminLayout>} />
        <Route path="/admin/consultations" element={<AdminLayout><AdminConsultations /></AdminLayout>} />
        <Route path="/admin/user-journey" element={<AdminLayout><AdminUserJourney /></AdminLayout>} />
        <Route path="/admin/live-visitors" element={<AdminLayout><AdminLiveVisitors /></AdminLayout>} />
        <Route path="/admin/whatsapp" element={<AdminLayout><AdminWhatsApp /></AdminLayout>} />
        <Route path="/admin/referrals" element={<AdminLayout><AdminReferrals /></AdminLayout>} />
        <Route path="/admin/landing-pages" element={<AdminLayout><AdminLandingPages /></AdminLayout>} />
        <Route path="/admin/employees" element={<AdminLayout><AdminEmployees /></AdminLayout>} />
        <Route path="/admin/customers" element={<AdminLayout><AdminCustomers /></AdminLayout>} />
        <Route path="/admin/products" element={<AdminLayout><AdminProducts /></AdminLayout>} />
        <Route path="/admin/concerns" element={<AdminLayout><AdminConcerns /></AdminLayout>} />
        <Route path="/admin/niches" element={<AdminLayout><AdminNiches /></AdminLayout>} />
        <Route path="/admin/retention" element={<AdminLayout><AdminRetention /></AdminLayout>} />
        <Route path="/admin/reviews" element={<AdminLayout><AdminReviews /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
        <Route path="/admin/routines" element={<AdminLayout><AdminRoutines /></AdminLayout>} />
        
        {/* Employee Routes */}
        <Route path="/employee/login" element={
          <Suspense fallback={<PageLoader />}><EmployeeLogin /></Suspense>
        } />
        <Route path="/employee/dashboard" element={
          <Suspense fallback={<PageLoader />}><EmployeeDashboard /></Suspense>
        } />
        <Route path="/employee/orders" element={
          <Suspense fallback={<PageLoader />}>
            <EmployeeLayout requiredPermission="orders"><EmployeeOrders /></EmployeeLayout>
          </Suspense>
        } />
        <Route path="/employee/customers" element={
          <Suspense fallback={<PageLoader />}>
            <EmployeeLayout requiredPermission="customers"><EmployeeCustomers /></EmployeeLayout>
          </Suspense>
        } />
        <Route path="/employee/blogs" element={
          <Suspense fallback={<PageLoader />}>
            <EmployeeLayout requiredPermission="blogs"><EmployeeBlogs /></EmployeeLayout>
          </Suspense>
        } />
        <Route path="/employee/analytics" element={
          <Suspense fallback={<PageLoader />}>
            <EmployeeLayout requiredPermission="analytics"><EmployeeAnalytics /></EmployeeLayout>
          </Suspense>
        } />
        <Route path="/employee/landing-pages" element={
          <Suspense fallback={<PageLoader />}>
            <EmployeeLayout requiredPermission="landing_pages"><EmployeeLandingPages /></EmployeeLayout>
          </Suspense>
        } />
        <Route path="/employee/consultations" element={
          <Suspense fallback={<PageLoader />}>
            <EmployeeLayout requiredPermission="consultations"><EmployeeConsultations /></EmployeeLayout>
          </Suspense>
        } />
        <Route path="/employee/*" element={
          <Suspense fallback={<PageLoader />}><EmployeeDashboard /></Suspense>
        } />
        
        {/* Public Routes - With tracking provider */}
        <Route path="/*" element={
          <TrackingProvider>
            <Routes>
              {/* Consultation Route (full screen, no navigation) */}
              <Route path="/consultation" element={
                <Suspense fallback={<PageLoader />}>
                  <ConsultationPage />
                </Suspense>
              } />
              
              {/* Legal Pages */}
              <Route path="/terms" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><TermsPage /></Suspense>
                </PublicLayout>
              } />
              <Route path="/privacy" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>
                </PublicLayout>
              } />
              <Route path="/refund-policy" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><RefundPolicyPage /></Suspense>
                </PublicLayout>
              } />
              <Route path="/shipping-policy" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><ShippingPolicyPage /></Suspense>
                </PublicLayout>
              } />
              <Route path="/contact" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><ContactPage /></Suspense>
                </PublicLayout>
              } />
              <Route path="/about" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><AboutPage /></Suspense>
                </PublicLayout>
              } />
              
              {/* Legacy Landing Pages (backward compatibility with /lp/ URLs) */}
              <Route path="/lp/:slug" element={
                <Suspense fallback={<PageLoader />}>
                  <LandingPage />
                </Suspense>
              } />
              
              {/* Track Order Page */}
              <Route path="/track-order" element={
                <Suspense fallback={<PageLoader />}><TrackOrder /></Suspense>
              } />
              
              {/* Main Public Routes */}
              <Route path="/" element={<PublicLayout><Homepage /></PublicLayout>} />
              <Route path="/shop" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><ShopPage /></Suspense></PublicLayout>
              } />
              <Route path="/skincare" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><SkincareHome /></Suspense></PublicLayout>
              } />
              <Route path="/cosmetics" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><CosmeticsHome /></Suspense></PublicLayout>
              } />
              <Route path="/categories" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense></PublicLayout>
              } />
              <Route path="/routine" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><RoutinePage /></Suspense></PublicLayout>
              } />
              <Route path="/account" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><AccountPage /></Suspense></PublicLayout>
              } />
              <Route path="/concern/:slug" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><ConcernCategoryPage mode="concern" /></Suspense></PublicLayout>
              } />
              <Route path="/category/:slug" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><ConcernCategoryPage mode="category" /></Suspense></PublicLayout>
              } />
              <Route path="/product/:slug" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><ProductDetailPage /></Suspense></PublicLayout>
              } />
              <Route path="/cart" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><CartPage /></Suspense></PublicLayout>
              } />
              <Route path="/checkout" element={
                <PublicLayout><Suspense fallback={<PageLoader />}><CheckoutPage /></Suspense></PublicLayout>
              } />
              <Route path="/order-success/:orderId" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><OrderSuccessPage /></Suspense>
                </PublicLayout>
              } />
              <Route path="/blog" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><BlogList /></Suspense>
                </PublicLayout>
              } />
              <Route path="/blog/:slug" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><BlogPost /></Suspense>
                </PublicLayout>
              } />
              <Route path="/search" element={
                <PublicLayout>
                  <Suspense fallback={<PageLoader />}><SearchResults /></Suspense>
                </PublicLayout>
              } />
              
              {/* Landing Page Funnel route removed — was matching every unmatched
                  path and conflicting with real routes. */}
            </Routes>
          </TrackingProvider>
        } />
      </Routes>
    </Router>
  );
}

export default App;
