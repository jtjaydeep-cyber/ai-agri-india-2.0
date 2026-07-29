let isListening = false;
let recognition = null;
let selectedImageBase64 = null;

// Initialize Speech Recognition if supported by the browser
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    document.getElementById('textQuery').value = transcript;
    toggleVoiceUI(false);
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
    toggleVoiceUI(false);
  };

  recognition.onend = function() {
    toggleVoiceUI(false);
  };
}

// Handle voice toggle button
function toggleVoice() {
  if (!recognition) {
    alert("Voice speech recognition is not supported in this browser. Please type your query.");
    return;
  }

  const langSelect = document.getElementById('languageSelect').value;
  
  // Set language code for recognition engine
  if (langSelect === 'Assamese') recognition.lang = 'as-IN';
  else if (langSelect === 'Hindi') recognition.lang = 'hi-IN';
  else if (langSelect === 'Bengali') recognition.lang = 'bn-IN';
  else recognition.lang = 'en-US';

  if (isListening) {
    recognition.stop();
    toggleVoiceUI(false);
  } else {
    recognition.start();
    toggleVoiceUI(true);
  }
}

function toggleVoiceUI(listening) {
  isListening = listening;
  const speakBtn = document.getElementById('speakBtn');
  if (listening) {
    speakBtn.classList.remove('btn-primary');
    speakBtn.classList.add('btn-danger');
    speakBtn.innerText = "🛑 Listening...";
  } else {
    speakBtn.classList.remove('btn-danger');
    speakBtn.classList.add('btn-primary');
    speakBtn.innerText = "🎤 Speak";
  }
}

// Convert selected image file to Base64 format
function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('imageFileName').innerText = "Selected: " + file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    // Extract base64 payload without data URL header
    selectedImageBase64 = e.target.result.split(',')[1];
  };
  reader.readAsDataURL(file);
}

// Submit query / image diagnosis to AGNI backend API
async function submitQuery() {
  const query = document.getElementById('textQuery').value;
  const language = document.getElementById('languageSelect').value;
  const responseBox = document.getElementById('response');

  if (!query && !selectedImageBase64) {
    alert("Please enter a query, use voice input, or upload a crop leaf photo.");
    return;
  }

  responseBox.innerText = selectedImageBase64 
    ? "Analyzing leaf photo and evaluating crop health..." 
    : "Consulting AGNI AI Engine...";

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query || "Identify any crop disease or pest in this photo and recommend treatment steps.",
        language: language,
        imageBase64: selectedImageBase64
      })
    });

    const data = await res.json();
    if (data.success) {
      responseBox.innerText = data.reply;
    } else {
      responseBox.innerText = "Error: " + (data.error || "Unable to get advice.");
    }
  } catch (err) {
    responseBox.innerText = "Network Error: " + err.message;
  } finally {
    // Reset image payload and UI label after sending
    selectedImageBase64 = null;
    document.getElementById('imageFileName').innerText = "";
    document.getElementById('cropImageInput').value = "";
  }
}

// Fetch marketplace listings from backend
async function fetchMarketListings() {
  const marketListContainer = document.getElementById('marketList');
  try {
    const res = await fetch('/api/chat?action=get_market');
    const data = await res.json();

    if (data.success && data.listings && data.listings.length > 0) {
      marketListContainer.innerHTML = data.listings.map(item => `
        <div class="listing-card">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">${item.item_type || 'Listing'}</span>
            <span class="fw-bold text-success">${item.price_per_unit}</span>
          </div>
          <div class="fw-bold text-dark mb-1">${item.title}</div>
          <div class="small text-muted d-flex justify-content-between align-items-center">
            <span>📍 ${item.district}</span>
            <a href="tel:${item.contact_phone}" class="btn btn-sm btn-outline-success py-0 px-2">📞 Call (${item.contact_phone})</a>
          </div>
        </div>
      `).join('');
    } else {
      marketListContainer.innerHTML = '<div class="text-muted small text-center">No listings available right now.</div>';
    }
  } catch (err) {
    console.error("Marketplace fetch error:", err);
    marketListContainer.innerHTML = '<div class="text-danger small text-center">Unable to load listings.</div>';
  }
}

// Submit new marketplace listing
async function submitListing() {
  const item_type = document.getElementById('itemType').value;
  const title = document.getElementById('listingTitle').value;
  const price_per_unit = document.getElementById('listingPrice').value;
  const district = document.getElementById('listingDistrict').value;
  const contact_phone = document.getElementById('listingPhone').value;

  if (!title || !price_per_unit || !district || !contact_phone) {
    alert("Please fill in all fields before publishing.");
    return;
  }

  try {
    const res = await fetch('/api/chat?action=post_market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_type, title, price_per_unit, district, contact_phone })
    });

    const data = await res.json();
    if (data.success) {
      // Hide modal
      const modalEl = document.getElementById('postListingModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      // Reset form & reload marketplace
      document.getElementById('listingForm').reset();
      fetchMarketListings();
    } else {
      alert("Failed to publish listing: " + (data.error || "Server error"));
    }
  } catch (err) {
    alert("Error publishing listing: " + err.message);
  }
}

// Load marketplace listings on page load
document.addEventListener('DOMContentLoaded', function() {
  fetchMarketListings();
});
// Trigger direct scheme search from quick selection chips
function askScheme(schemeName) {
  document.getElementById('schemeInput').value = schemeName;
  submitSchemeSearch();
}

async function submitSchemeSearch() {
  const queryText = document.getElementById('schemeInput').value;
  const language = document.getElementById('languageSelect').value;
  const resultBox = document.getElementById('schemeResultBox');
  const detailsContent = document.getElementById('schemeDetailsContent');

  if (!queryText.trim()) return;

  resultBox.classList.remove('d-none');
  detailsContent.innerText = "Consulting government portals and subsidy guidelines...";

  try {
    const res = await fetch('/api/chat?action=scheme_advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemeQuery: queryText, language: language })
    });

    const data = await res.json();
    if (data.success) {
      detailsContent.innerText = data.reply;
    } else {
      detailsContent.innerText = "Could not load scheme details.";
    }
  } catch (err) {
    detailsContent.innerText = "Network Error: " + err.message;
  }
}
