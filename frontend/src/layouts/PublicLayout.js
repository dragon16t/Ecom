import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Navigation from '../components/Navigation';
import NicheCardSwitcher from '../components/NicheCardSwitcher';
import MobileBottomNav from '../components/MobileBottomNav';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import { useTracking } from '../providers/TrackingProvider';

// Lazy load heavy components that aren't immediately visible
const DiscountPopup = lazy(() => import('../components/DiscountPopup'));
const CookieConsent = lazy(() => import('../components/CookieConsent'));

// Niche cards only render on the 3 niche home routes
const NICHE_HOME_ROUTES = ['/', '/skincare', '/cosmetics'];

// Simple loading fallback (empty, so no flash)
const EmptyFallback = () => null;

function PublicLayout({ children }) {
  const [showDiscountPopup, setShowDiscountPopup] = useState(false);
  const { trackAction, trackPageVisit } = useTracking();
  const location = useLocation();
  const showNicheCards = NICHE_HOME_ROUTES.includes(location.pathname);

  // Fire trackPageVisit on every route change so admin live visitors stay accurate
  useEffect(() => {
    try {
      // Normalise some dynamic routes (product/blog detail) so we don't blow up cardinality
      let page = location.pathname || '/';
      if (page.startsWith('/product/')) page = '/product';
      if (page.startsWith('/blog/')) page = '/blog-detail';
      if (page.startsWith('/order-success')) page = '/order-success';
      if (page.startsWith('/landing/')) page = '/landing';
      trackPageVisit(page);
    } catch { /* ignore */ }
  }, [location.pathname, trackPageVisit]);
  
  useEffect(() => {
    // Show discount popup after 8 seconds (after welcome notification finishes)
    // This gives time for: welcome notification (4s delay + 6s display) = 10s
    const discountTimer = setTimeout(() => {
      if (!localStorage.getItem('discountClaimed') && !sessionStorage.getItem('discountPopupShown')) {
        setShowDiscountPopup(true);
        sessionStorage.setItem('discountPopupShown', 'true');
        trackAction('popup_shown', { popup_type: 'discount_popup' });
      }
    }, 12000); // 12 seconds - after welcome notification
    
    return () => {
      clearTimeout(discountTimer);
    };
  }, [trackAction]);
  
  const handleClaimDiscount = (code) => {
    localStorage.setItem('discountClaimed', 'true');
    localStorage.setItem('claimedDiscountCode', code);
    setShowDiscountPopup(false);
    trackAction('discount_claimed', { code });
  };
  
  return (
    <div className="app-container min-h-screen">
      {/* Navigation - always visible */}
      <Navigation />

      {/* Top 3-card niche switcher — only visible on niche home routes */}
      {showNicheCards && <NicheCardSwitcher />}
      
      {/* Main content */}
      <main className="pb-20 lg:pb-0">
        {children}
      </main>
      
      {/* Mobile bottom nav (Home / Categories / Routine / Account / Cart) */}
      <MobileBottomNav />
      
      {/* Footer - site-wide */}
      <Footer />
      
      {/* WhatsApp floating button - always visible */}
      <WhatsAppButton phoneNumber="919446125745" />
      
      {/* Lazy loaded components */}
      <Suspense fallback={<EmptyFallback />}>
        {/* Discount Popup */}
        {showDiscountPopup && (
          <DiscountPopup
            onClaim={handleClaimDiscount}
            onClose={() => setShowDiscountPopup(false)}
          />
        )}
        
        {/* Cookie Consent - handled internally */}
        <CookieConsent />
      </Suspense>
    </div>
  );
}

export default PublicLayout;
