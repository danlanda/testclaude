// Content script for extracting places from webpage content

// Place categories and their keywords
const CATEGORY_PATTERNS = {
  accommodation: {
    keywords: ['hotel', 'hostel', 'airbnb', 'resort', 'motel', 'inn', 'lodge', 'guesthouse', 'b&b', 'bed and breakfast', 'stay', 'accommodation', 'booking', 'villa', 'apartment rental'],
    bookingDomains: ['booking.com', 'airbnb.com', 'hotels.com', 'expedia.com', 'agoda.com', 'hostelworld.com', 'vrbo.com']
  },
  activities: {
    keywords: ['tour', 'museum', 'park', 'beach', 'hiking', 'adventure', 'attraction', 'landmark', 'temple', 'church', 'castle', 'monument', 'gallery', 'zoo', 'aquarium', 'excursion', 'experience', 'visit', 'explore', 'sightseeing'],
    bookingDomains: ['viator.com', 'getyourguide.com', 'tripadvisor.com', 'klook.com', 'tiqets.com']
  },
  food: {
    keywords: ['restaurant', 'cafe', 'bar', 'food', 'dining', 'eat', 'cuisine', 'bistro', 'eatery', 'pizzeria', 'steakhouse', 'seafood', 'brunch', 'dinner', 'lunch', 'breakfast spot', 'street food', 'food market'],
    bookingDomains: ['opentable.com', 'yelp.com', 'thefork.com', 'resy.com']
  },
  transportation: {
    keywords: ['airport', 'train station', 'bus station', 'ferry', 'car rental', 'taxi', 'uber', 'metro', 'subway', 'transfer', 'shuttle', 'flight', 'train', 'bus'],
    bookingDomains: ['skyscanner.com', 'kayak.com', 'rome2rio.com', 'rentalcars.com', 'flixbus.com']
  }
};

// Extract places from the current page
function extractPlaces() {
  const places = [];
  const seenNames = new Set();

  // Get all text content
  const bodyText = document.body.innerText;

  // Extract from links with place-related context
  const links = document.querySelectorAll('a[href]');
  links.forEach(link => {
    const place = extractPlaceFromLink(link);
    if (place && !seenNames.has(place.name.toLowerCase())) {
      seenNames.add(place.name.toLowerCase());
      places.push(place);
    }
  });

  // Extract from structured data (JSON-LD)
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const extractedPlaces = extractFromJsonLd(data);
      extractedPlaces.forEach(place => {
        if (!seenNames.has(place.name.toLowerCase())) {
          seenNames.add(place.name.toLowerCase());
          places.push(place);
        }
      });
    } catch (e) {
      // Invalid JSON, skip
    }
  });

  // Extract from common travel blog patterns
  const articleContent = document.querySelector('article, .post-content, .entry-content, main, .content');
  if (articleContent) {
    const headings = articleContent.querySelectorAll('h2, h3, h4');
    headings.forEach(heading => {
      const place = extractPlaceFromHeading(heading);
      if (place && !seenNames.has(place.name.toLowerCase())) {
        seenNames.add(place.name.toLowerCase());
        places.push(place);
      }
    });
  }

  return places;
}

// Extract place information from a link element
function extractPlaceFromLink(link) {
  const href = link.href;
  const text = link.innerText.trim();

  if (!text || text.length < 3 || text.length > 100) return null;

  // Check if it's a booking link
  const bookingInfo = getBookingInfo(href);
  if (!bookingInfo) {
    // Check if the link text contains place-related keywords
    const category = detectCategory(text + ' ' + (link.title || ''));
    if (!category) return null;
  }

  const category = bookingInfo?.category || detectCategory(text);
  if (!category) return null;

  // Try to extract location from surrounding context
  const location = extractLocation(link);

  // Generate Google Maps search link
  const mapsLink = generateMapsLink(text, location);

  return {
    name: cleanPlaceName(text),
    description: extractDescription(link),
    category: category,
    location: location,
    bookingLink: href,
    mapsLink: mapsLink,
    extractedAt: new Date().toISOString()
  };
}

// Extract place from heading elements (common in travel blogs)
function extractPlaceFromHeading(heading) {
  const text = heading.innerText.trim();

  // Skip generic headings
  const skipPatterns = [/^[0-9]+\.?\s*$/, /^conclusion/i, /^introduction/i, /^summary/i, /^tips/i, /^how to/i];
  if (skipPatterns.some(pattern => pattern.test(text))) return null;

  // Check for numbered lists like "1. Place Name" or "Place Name - Description"
  const cleanedText = text.replace(/^[0-9]+\.?\s*/, '').replace(/\s*[-–—]\s*.*$/, '').trim();

  if (cleanedText.length < 3 || cleanedText.length > 80) return null;

  const category = detectCategory(cleanedText + ' ' + getContextText(heading));
  if (!category) return null;

  const location = extractLocationFromContext(heading);
  const description = extractDescriptionFromContext(heading);
  const bookingLink = findNearbyBookingLink(heading);

  return {
    name: cleanPlaceName(cleanedText),
    description: description,
    category: category,
    location: location,
    bookingLink: bookingLink,
    mapsLink: generateMapsLink(cleanedText, location),
    extractedAt: new Date().toISOString()
  };
}

// Extract from JSON-LD structured data
function extractFromJsonLd(data) {
  const places = [];

  if (Array.isArray(data)) {
    data.forEach(item => places.push(...extractFromJsonLd(item)));
    return places;
  }

  const placeTypes = ['Hotel', 'Restaurant', 'TouristAttraction', 'LocalBusiness', 'LodgingBusiness', 'FoodEstablishment', 'Place'];

  if (data['@type'] && placeTypes.some(type => data['@type'].includes(type))) {
    const category = mapJsonLdTypeToCategory(data['@type']);
    const location = data.address ?
      (typeof data.address === 'string' ? data.address : data.address.addressLocality || data.address.name) : null;

    places.push({
      name: data.name,
      description: data.description || '',
      category: category,
      location: location,
      bookingLink: data.url || null,
      mapsLink: generateMapsLink(data.name, location),
      extractedAt: new Date().toISOString()
    });
  }

  // Check for nested items
  if (data.itemListElement) {
    data.itemListElement.forEach(item => {
      if (item.item) places.push(...extractFromJsonLd(item.item));
    });
  }

  return places;
}

// Detect category based on text content
function detectCategory(text) {
  const lowerText = text.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    // Check keywords
    if (patterns.keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }

  return null;
}

// Get booking info from URL
function getBookingInfo(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');

    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      if (patterns.bookingDomains.some(domain => hostname.includes(domain))) {
        return { category, isBooking: true };
      }
    }
  } catch (e) {
    // Invalid URL
  }
  return null;
}

// Map JSON-LD type to our categories
function mapJsonLdTypeToCategory(type) {
  const typeStr = Array.isArray(type) ? type.join(' ') : type;

  if (/hotel|lodging|hostel/i.test(typeStr)) return 'accommodation';
  if (/restaurant|food|cafe|bar/i.test(typeStr)) return 'food';
  if (/attraction|museum|park|landmark/i.test(typeStr)) return 'activities';

  return 'activities'; // Default
}

// Extract location from link context
function extractLocation(element) {
  // Look for location in nearby elements
  const parent = element.closest('li, p, div, article');
  if (!parent) return null;

  // Common location patterns
  const locationPatterns = [
    /(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+)?)/g,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)/g
  ];

  const text = parent.innerText;
  for (const pattern of locationPatterns) {
    const match = pattern.exec(text);
    if (match) return match[1];
  }

  return null;
}

// Extract location from broader context
function extractLocationFromContext(heading) {
  // Check page title
  const pageTitle = document.title;
  const locationFromTitle = extractLocationPattern(pageTitle);
  if (locationFromTitle) return locationFromTitle;

  // Check meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const locationFromMeta = extractLocationPattern(metaDesc.content);
    if (locationFromMeta) return locationFromMeta;
  }

  // Check h1
  const h1 = document.querySelector('h1');
  if (h1) {
    const locationFromH1 = extractLocationPattern(h1.innerText);
    if (locationFromH1) return locationFromH1;
  }

  return null;
}

// Extract location from text using patterns
function extractLocationPattern(text) {
  const patterns = [
    /(?:in|visit|explore|guide to|things to do in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:travel guide|city guide|travel tips)/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match[1];
  }

  return null;
}

// Get context text around an element
function getContextText(element) {
  const parent = element.closest('section, article, div');
  if (!parent) return '';

  const nextSibling = element.nextElementSibling;
  if (nextSibling) {
    return nextSibling.innerText.substring(0, 200);
  }

  return '';
}

// Extract description from link context
function extractDescription(link) {
  // Look for description in title attribute
  if (link.title) return link.title;

  // Look in parent element
  const parent = link.closest('li, p');
  if (parent) {
    const text = parent.innerText.replace(link.innerText, '').trim();
    if (text.length > 10 && text.length < 300) {
      return text.substring(0, 200);
    }
  }

  return '';
}

// Extract description from context around heading
function extractDescriptionFromContext(heading) {
  const nextElement = heading.nextElementSibling;
  if (nextElement && nextElement.tagName === 'P') {
    return nextElement.innerText.substring(0, 200);
  }
  return '';
}

// Find nearby booking link
function findNearbyBookingLink(heading) {
  const section = heading.closest('section, div, article');
  if (!section) return null;

  // Look for booking-related links
  const links = section.querySelectorAll('a[href]');
  for (const link of links) {
    const bookingInfo = getBookingInfo(link.href);
    if (bookingInfo) return link.href;

    // Check for common booking text
    const linkText = link.innerText.toLowerCase();
    if (/book|reserve|check availability|get tickets/i.test(linkText)) {
      return link.href;
    }
  }

  return null;
}

// Clean place name
function cleanPlaceName(name) {
  return name
    .replace(/^[0-9]+\.?\s*/, '')  // Remove leading numbers
    .replace(/\s*[-–—]\s*.*$/, '') // Remove everything after dash
    .replace(/\s*\([^)]*\)\s*$/, '') // Remove trailing parentheses
    .replace(/\s+/g, ' ')
    .trim();
}

// Generate Google Maps link
function generateMapsLink(placeName, location) {
  const query = location ? `${placeName}, ${location}` : placeName;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Listen for extraction requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanPage') {
    const places = extractPlaces();
    sendResponse({ places });
  }
  return true;
});

// Create floating button for manual scanning
function createScanButton() {
  const button = document.createElement('div');
  button.id = 'travel-planner-scan-btn';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
  `;
  button.title = 'Scan page for travel places';

  button.addEventListener('click', async () => {
    button.classList.add('scanning');
    const places = extractPlaces();

    // Send to background script
    const response = await chrome.runtime.sendMessage({
      action: 'extractPlaces',
      data: {
        places,
        pageUrl: window.location.href,
        pageTitle: document.title
      }
    });

    button.classList.remove('scanning');

    // Show notification
    showNotification(places.length > 0
      ? `Found ${places.length} places!`
      : 'No places found on this page');
  });

  document.body.appendChild(button);
}

// Show notification toast
function showNotification(message) {
  const toast = document.createElement('div');
  toast.className = 'travel-planner-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createScanButton);
} else {
  createScanButton();
}
