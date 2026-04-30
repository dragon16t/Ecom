import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * HeroCarousel
 * Auto-scrolling, swipeable banner carousel for homepage hero.
 * Props:
 *  - banners: [{ id, image, title, subtitle, cta_text, cta_link }]
 *  - autoplayMs: number (default 2000)
 *  - className: optional outer classes
 */
function HeroCarousel({ banners = [], autoplayMs = 2000, className = '' }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  const total = banners.length;

  const goTo = useCallback((i) => {
    if (total === 0) return;
    setIndex(((i % total) + total) % total);
  }, [total]);

  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  // Autoplay
  useEffect(() => {
    if (isPaused || total <= 1) return;
    const t = setInterval(() => {
      setIndex(i => (i + 1) % total);
    }, Math.max(1500, autoplayMs || 2000));
    return () => clearInterval(t);
  }, [isPaused, total, autoplayMs]);

  // Touch swipe
  const onTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;
    const dx = touchStartX.current - touchEndX.current;
    if (Math.abs(dx) > 40) dx > 0 ? next() : prev();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (total === 0) return null;

  return (
    <section
      className={`relative w-full overflow-hidden bg-stone-50 ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      data-testid="hero-carousel"
      aria-roledescription="carousel"
    >
      {/* Slides */}
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b, i) => (
          <div
            key={b.id || i}
            className="relative w-full flex-shrink-0"
            style={{ minWidth: '100%' }}
            aria-hidden={i !== index}
          >
            {/* Aspect: phone tall, tablet wide, desktop very wide */}
            <Link
              to={b.cta_link || '/shop'}
              className="relative block w-full aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] lg:aspect-[24/9] max-h-[640px]"
              data-testid={`carousel-slide-${i}`}
              aria-label={b.title || `Banner ${i + 1}`}
            >
              <img
                src={b.image}
                alt={b.title || `Banner ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchpriority={i === 0 ? 'high' : 'auto'}
                decoding={i === 0 ? 'sync' : 'async'}
                draggable={false}
              />
              {/* Subtle bottom gradient for dot indicator legibility only */}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            </Link>
          </div>
        ))}
      </div>

      {/* Prev/Next arrows (visible on tablet+) */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 items-center justify-center rounded-full bg-white/80 hover:bg-white text-gray-900 shadow-md backdrop-blur transition"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 items-center justify-center rounded-full bg-white/80 hover:bg-white text-gray-900 shadow-md backdrop-blur transition"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`transition-all rounded-full ${
                i === index ? 'w-8 h-2 bg-white' : 'w-2 h-2 bg-white/60 hover:bg-white/80'
              }`}
              data-testid={`carousel-dot-${i}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default HeroCarousel;
