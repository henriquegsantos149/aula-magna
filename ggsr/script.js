// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  initHeader();
  initMobileMenu();
  initSmoothScroll();
  initAccordions();
  initScrollReveal();
  initCarousels();
  initLightbox();
  initFormControls();

  // Disparo de ViewContent para a página principal da Aula Magna
  trackMeta('ViewContent', {
    customData: {
      content_name: 'Aula Magna GGSR',
      content_category: 'aula-magna'
    }
  });
});

// 1. Sticky Header
function initHeader() {
  const header = document.getElementById('main-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Check once on load
}

// 2. Mobile Menu Toggle
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.getElementById('site-nav');
  const navLinks = document.querySelectorAll('.nav-link');

  if (!toggleBtn || !navMenu) return;

  const toggleMenu = () => {
    const isOpen = navMenu.classList.toggle('open');
    
    // Update icon
    if (typeof lucide !== 'undefined') {
      if (isOpen) {
        toggleBtn.innerHTML = '<i data-lucide="x"></i>';
      } else {
        toggleBtn.innerHTML = '<i data-lucide="menu"></i>';
      }
      lucide.createIcons();
    }
  };

  toggleBtn.addEventListener('click', toggleMenu);

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (navMenu.classList.contains('open')) {
        toggleMenu();
      }
    });
  });
}

// 3. Accordions (Disciplines & FAQ)
function initAccordions() {
  // Curriculum Accordions
  const curriculumItems = document.querySelectorAll('.curriculum-section .accordion-item');
  curriculumItems.forEach(item => {
    const toggle = item.querySelector('.accordion-toggle');
    const content = item.querySelector('.accordion-content');

    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Collapse all other items
      curriculumItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          const otherToggle = otherItem.querySelector('.accordion-toggle');
          const otherContent = otherItem.querySelector('.accordion-content');
          if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
          if (otherContent) {
            otherContent.setAttribute('aria-hidden', 'true');
            otherContent.style.maxHeight = '0px';
          }
        }
      });

      if (isActive) {
        item.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        content.setAttribute('aria-hidden', 'true');
        content.style.maxHeight = '0px';
      } else {
        item.classList.add('active');
        toggle.setAttribute('aria-expanded', 'true');
        content.setAttribute('aria-hidden', 'false');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });

  // FAQ Accordions
  const faqItems = document.querySelectorAll('.faq-section .faq-item');
  faqItems.forEach(item => {
    const toggle = item.querySelector('.faq-toggle');
    const content = item.querySelector('.faq-content');

    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Collapse all other items
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          const otherToggle = otherItem.querySelector('.faq-toggle');
          const otherContent = otherItem.querySelector('.faq-content');
          if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
          if (otherContent) {
            otherContent.setAttribute('aria-hidden', 'true');
            otherContent.style.maxHeight = '0px';
          }
        }
      });

      if (isActive) {
        item.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        content.setAttribute('aria-hidden', 'true');
        content.style.maxHeight = '0px';
      } else {
        item.classList.add('active');
        toggle.setAttribute('aria-expanded', 'true');
        content.setAttribute('aria-hidden', 'false');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

// 4. Scroll Reveal Observer
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length === 0) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  reveals.forEach(el => observer.observe(el));
}

// 5. Custom Carousels / Sliders (Mentores & Depoimentos)
function initCarousels() {
  setupCarousel('mentors-track', 'mentors-prev', 'mentors-next', 'mentors-dots');
  setupCarousel('testimonials-track', 'testimonials-prev', 'testimonials-next', 'testimonials-dots');

  function setupCarousel(trackId, prevBtnId, nextBtnId, dotsContainerId) {
    const track = document.getElementById(trackId);
    const prevBtn = document.getElementById(prevBtnId);
    const nextBtn = document.getElementById(nextBtnId);
    const dotsContainer = document.getElementById(dotsContainerId);

    if (!track || !prevBtn || !nextBtn || !dotsContainer) return;

    const originalSlides = Array.from(track.children);
    if (originalSlides.length === 0) return;

    const cloneCount = 3;
    let currentIndex = 0;
    let isTransitioning = false;

    // Clone slides
    const firstClones = [];
    const lastClones = [];

    for (let i = 0; i < cloneCount; i++) {
      firstClones.push(originalSlides[i % originalSlides.length].cloneNode(true));
      lastClones.push(originalSlides[(originalSlides.length - 1 - i + originalSlides.length) % originalSlides.length].cloneNode(true));
    }
    lastClones.reverse();

    // Prepend last clones
    lastClones.forEach(clone => {
      track.insertBefore(clone, track.firstChild);
    });

    // Append first clones
    firstClones.forEach(clone => {
      track.appendChild(clone);
    });

    const updateSlider = (withTransition = true) => {
      const slideWidth = originalSlides[0].getBoundingClientRect().width;
      const gap = 24; // grid gap in CSS
      
      if (!withTransition) {
        track.style.transition = 'none';
        const offset = (currentIndex + cloneCount) * (slideWidth + gap);
        track.style.transform = `translateX(-${offset}px)`;
        track.offsetHeight; // force reflow
        track.style.transition = '';
      } else {
        track.style.transition = '';
        const offset = (currentIndex + cloneCount) * (slideWidth + gap);
        track.style.transform = `translateX(-${offset}px)`;
      }

      // Update active dot
      const dots = Array.from(dotsContainer.children);
      if (dots.length > 0) {
        let activeDotIndex = currentIndex;
        if (currentIndex < 0) {
          activeDotIndex = originalSlides.length - 1;
        } else if (currentIndex >= originalSlides.length) {
          activeDotIndex = 0;
        }
        dots.forEach((dot, index) => {
          if (index === activeDotIndex) {
            dot.classList.add('active');
          } else {
            dot.classList.remove('active');
          }
        });
      }
    };

    const handleNext = () => {
      if (isTransitioning) return;
      isTransitioning = true;
      currentIndex++;
      updateSlider(true);
    };

    const handlePrev = () => {
      if (isTransitioning) return;
      isTransitioning = true;
      currentIndex--;
      updateSlider(true);
    };

    track.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return;
      isTransitioning = false;
      
      if (currentIndex >= originalSlides.length) {
        currentIndex = 0;
        updateSlider(false);
      } else if (currentIndex < 0) {
        currentIndex = originalSlides.length - 1;
        updateSlider(false);
      }
    });

    const buildDots = () => {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < originalSlides.length; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot-indicator');
        if (i === currentIndex) dot.classList.add('active');
        dot.addEventListener('click', () => {
          if (isTransitioning) return;
          currentIndex = i;
          updateSlider(true);
        });
        dotsContainer.appendChild(dot);
      }
    };

    // Button click listeners
    nextBtn.addEventListener('click', handleNext);
    prevBtn.addEventListener('click', handlePrev);

    // Initialize dots & initial position
    buildDots();
    updateSlider(false);

    let lastInnerWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth !== lastInnerWidth) {
        lastInnerWidth = window.innerWidth;
        updateSlider(false);
      }
    });
  }
}

// 6. Image Lightbox Modal
function initLightbox() {
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.querySelector('.lightbox-close');
  const triggers = document.querySelectorAll('.lightbox-trigger');

  if (!lightbox || !lightboxImg || triggers.length === 0) return;

  const openLightbox = (imgSrc) => {
    lightboxImg.src = imgSrc;
    lightbox.style.display = 'flex';
    lightbox.offsetHeight; // force reflow
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (!lightbox.classList.contains('active')) {
        lightbox.style.display = 'none';
      }
    }, 300);
  };

  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const img = trigger.querySelector('img') || trigger;
      if (img) {
        openLightbox(img.src);
      }
    });
  });

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target === closeBtn) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });
}

// 7. Form Controls (Graduation Toggle, Phone Validation, GTM Tracking, Redirection)
function initFormControls() {
  const form = document.getElementById('enrollment-form');
  const gradSelect = document.getElementById('user-graduation');
  const areaGroup = document.getElementById('education-area-group');
  const areaInput = document.getElementById('user-education-area');
  const phoneInput = document.getElementById('user-whatsapp');

  if (!form || !gradSelect || !areaGroup || !phoneInput) return;

  // Initial State for graduation area
  areaGroup.classList.add('hidden');
  if (areaInput) areaInput.removeAttribute('required');

  // Show/Hide Area Input based on select value
  gradSelect.addEventListener('change', () => {
    if (gradSelect.value === 'Sim') {
      areaGroup.classList.remove('hidden');
      if (areaInput) areaInput.setAttribute('required', 'required');
    } else {
      areaGroup.classList.add('hidden');
      if (areaInput) {
        areaInput.removeAttribute('required');
        areaInput.value = ''; // Reset value
      }
    }
  });

  // Initialize intl-tel-input
  const iti = window.intlTelInput(phoneInput, {
    initialCountry: "br",
    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/18.2.1/js/utils.js",
  });

  // Phone validation function
  const validatePhone = () => {
    const rawValue = phoneInput.value.trim();
    if (rawValue === '') {
      return { isValid: true, message: '' }; // Required attribute handles empty field
    }

    const countryData = iti.getSelectedCountryData();
    if (countryData.iso2 === 'br') {
      let digits = rawValue.replace(/\D/g, '');
      if (digits.startsWith('55') && digits.length > 11) {
        digits = digits.substring(2);
      }
      if (digits.length !== 11) {
        return { isValid: false, message: 'Por favor, insira o DDD e o número com o 9 na frente (11 dígitos).' };
      }
      return { isValid: true, message: '' };
    }

    if (iti.isValidNumber()) {
      return { isValid: true, message: '' };
    }
    return { isValid: false, message: 'Número de telefone inválido para o país selecionado.' };
  };

  // Clean and format input
  phoneInput.addEventListener('input', (e) => {
    const countryData = iti.getSelectedCountryData();
    if (countryData.iso2 === 'br') {
      let value = e.target.value.replace(/\D/g, '');
      if (value.startsWith('55') && value.length > 11) value = value.substring(2);
      if (value.length > 11) value = value.substring(0, 11);
      
      let formattedValue = value;
      if (value.length > 2) {
        formattedValue = '(' + value.substring(0, 2) + ') ' + value.substring(2);
      }
      if (value.length > 7) {
        formattedValue = '(' + value.substring(0, 2) + ') ' + value.substring(2, 7) + '-' + value.substring(7);
      }
      e.target.value = formattedValue;
    } else {
      let value = e.target.value.replace(/[^\d+\s-]/g, ''); 
      e.target.value = value;
    }
    phoneInput.setCustomValidity('');
  });

  // Validate on blur (quietly, without reporting)
  phoneInput.addEventListener('blur', () => {
    const validation = validatePhone();
    if (!validation.isValid) {
      phoneInput.setCustomValidity(validation.message);
    } else {
      phoneInput.setCustomValidity('');
    }
  });

  // Form Submission
  const REDIRECT_TALLY_LINK = "https://tally.so/r/D4Q4bp";

  form.addEventListener('submit', (e) => {
    const validation = validatePhone();
    if (!validation.isValid) {
      e.preventDefault(); // Block submit
      phoneInput.setCustomValidity(validation.message);
      phoneInput.reportValidity(); // Show native bubble
      return;
    }

    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;

    // Loading State
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Registrando sua vaga...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Prepare Lead Data
    const formData = new FormData(form);
    const rawTelefone = formData.get('telefone') || '';
    const cleanTelefone = rawTelefone.replace(/\D/g, '');

    const leadData = {
      name: formData.get('nome'),
      email: formData.get('email'),
      whatsapp: cleanTelefone,
      graduation: formData.get('graduacao'),
      education_area: formData.get('area_formacao') || ''
    };

    // Grab UTM params from URL
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = new URL(REDIRECT_TALLY_LINK);
    
    urlParams.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith('utm_') || lowerKey.startsWith('l19psggsr_utm_') || lowerKey.startsWith('l20psggsr_utm_')) {
        let normalizedKey = lowerKey;
        if (lowerKey.startsWith('l19psggsr_')) {
          normalizedKey = lowerKey.replace('l19psggsr_', '');
        } else if (lowerKey.startsWith('l20psggsr_')) {
          normalizedKey = lowerKey.replace('l20psggsr_', '');
        }
        
        // Passar os UTMs limpos para o Tally também
        redirectUrl.searchParams.append(normalizedKey, val);
        leadData[normalizedKey] = val;
      }
    });

    // GTM DataLayer Push
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'formSubmission',
        formId: 'enrollment-form',
        leadEmail: leadData.email,
        leadGraduation: leadData.graduation
      });
    }

    // Meta Tracking (Pixel + Conversions API)
    const metaOptions = {
      customData: {
        content_name: 'Aula Magna GGSR',
        content_category: 'aula-magna'
      },
      userData: {
        nome: leadData.name,
        email: leadData.email,
        telefone: leadData.whatsapp
      }
    };

    // Lead para todo submit de formulário
    trackMeta('Lead', metaOptions);

    // lead_qualificado se possuir formação
    if (leadData.graduation && leadData.graduation.toString().toLowerCase() === 'sim') {
      trackMeta('lead_qualificado', metaOptions);
    }

    // Call subscribe API (like Curso webgis)
    fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    })
    .then(res => {
      if (!res.ok) {
        console.warn('API subscription warning. Proceeding to VIP group.');
      }
    })
    .catch(err => {
      console.error('Network error during API subscription:', err);
    })
    .finally(() => {
      window.location.href = redirectUrl.toString();
    });
  });
}

// ==========================================
// Meta Tracking & Conversions API Helpers
// ==========================================
const STANDARD_META_EVENTS = ['Lead', 'ViewContent'];

function readCookie(cookieString, name) {
  if (!cookieString) return undefined;
  for (const part of cookieString.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

function deriveFbc(searchString, cookieString, now) {
  const existing = readCookie(cookieString, '_fbc');
  if (existing) return existing;
  const fbclid = new URLSearchParams(searchString).get('fbclid');
  if (!fbclid) return undefined;
  return `fb.1.${now}.${fbclid}`;
}

function trackMeta(eventName, options = {}) {
  if (typeof window === 'undefined') return;

  try {
    const eventId =
      (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const method = STANDARD_META_EVENTS.includes(eventName) ? 'track' : 'trackCustom';

    try {
      if (typeof window.fbq === 'function') {
        window.fbq(method, eventName, options.customData, { eventID: eventId });
      }
    } catch (e) {
      /* falha no pixel nao deve travar a CAPI */
    }

    const cookieString = typeof document !== 'undefined' ? (document.cookie || '') : '';

    fetch('/api/meta-capi', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_source_url: window.location.href,
        fbp: readCookie(cookieString, '_fbp'),
        fbc: deriveFbc(window.location.search, cookieString, Date.now()),
        custom_data: options.customData,
        ...options.userData,
      }),
    }).catch(() => {
      /* silencioso de proposito */
    });
  } catch (err) {
    /* tracking nunca deve afetar a UX do usuario */
  }
}

// Global Custom styling injector for spinning animations
const inlineStyle = document.createElement('style');
inlineStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .animate-spin {
    display: inline-block;
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(inlineStyle);

// 8. Smooth Scroll without Hash in URL
function initSmoothScroll() {
  const anchors = document.querySelectorAll('a[href^="#"]');
  anchors.forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      
      if (targetId === '#' || targetId === '') {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        return;
      }
      
      try {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      } catch (err) {
        console.warn('Invalid selector for smooth scroll:', targetId);
      }
    });
  });
}
