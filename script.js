var recognition = null;
var isListening = false;

document.addEventListener("DOMContentLoaded", function() {
  fetchLiveWeather();
  loadMarketplace();
});

function openModal() {
  document.getElementById('postModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('postModal').style.display = 'none';
}

function fetchLiveWeather() {
  fetch("https://api.open-meteo.com/v1/forecast?latitude=26.1445&longitude=91.7362&current_weather=true")
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && data.current_weather) {
        document.getElementById('tempVal').innerText = Math.round(data.current_weather.temperature) + "°C";
        document.getElementById('windVal').innerText = "Wind: " + Math.round(data.current_weather.windspeed) + " km/h";
      }
    })
    .catch(function(e) {});
}

function toggleVoiceInput() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
    return;
  }

  var micBtn = document.getElementById('micBtn');
  var queryInput = document.getElementById('textQuery');
  var lang = document.getElementById('langSelect').value;

  if (isListening) {
    if (recognition) recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  if (lang === 'Hindi') recognition.lang = 'hi-IN';
  else if (lang === 'Bengali') recognition.lang = 'bn-IN';
  else if (lang === 'Assamese') recognition.lang = 'as-IN';
  else recognition.lang = 'en-IN';

  recognition.onstart = function() {
    isListening = true;
    micBtn.innerText = "🔴 Listening...";
    micBtn.style.background = "#d32f2f";
  };

  recognition.onresult = function(event) {
    var transcript = event.results[0][0].transcript;
    queryInput.value = transcript;
  };

  recognition.onerror = function(event) {
    alert("Could not recognize voice cleanly. Please try speaking again.");
  };

  recognition.onend = function() {
    isListening = false;
    micBtn.innerText = "🎤 Speak";
    micBtn.style.background = "#0288d1";
  };

  recognition.start();
}

function loadMarketplace() {
  var listEl = document.getElementById('marketList');
  fetch('/api/chat?action=get_market', { method: 'GET' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.listings && data.listings.length > 0) {
        var html = '';
        for (var i = 0; i < data.listings.length; i++) {
          var item = data.listings[i];
          html += '<div class="listing-card">' +
                    '<span class="badge">' + (item.item_type || 'Market Listing') + '</span>' +
                    '<div class="item-title">' + item.title + '</div>' +
                    '<div class="item-meta">📍 ' + item.district + ' | 💰 ' + item.price_per_unit + '</div>' +
                    '<a class="call-btn" href="tel:' + item.contact_phone + '">📞 Call (' + item.contact_phone + ')</a>' +
                  '</div>';
        }
        listEl.innerHTML = html;
      }
    })
    .catch(function(e) {
      console.log("Using fallback market listings");
    });
}

function submitNewListing() {
  var item_type = document.getElementById('postType').value;
  var title = document.getElementById('postTitle').value.trim();
  var price_per_unit = document.getElementById('postPrice').value.trim();
  var district = document.getElementById('postDistrict').value.trim();
  var contact_phone = document.getElementById('postPhone').value.trim();
  var btn = document.getElementById('submitListingBtn');

  if (!title || !price_per_unit || !district || !contact_phone) {
    return alert("Please fill in all fields!");
  }

  btn.disabled = true;
  btn.innerText = "Publishing...";

  fetch('/api/chat?action=post_market', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_type: item_type, title: title, price_per_unit: price_per_unit, district: district, contact_phone: contact_phone })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      alert("Listing published successfully!");
      closeModal();
      loadMarketplace();
    } else {
      alert("Failed to publish listing: " + (data.error || "Unknown error"));
    }
  })
  .catch(function(err) {
    alert("Network Error: " + err.message);
  })
  .finally(function() {
    btn.disabled = false;
    btn.innerText = "Publish Listing 🚀";
  });
}

function submitTextQuery() {
  var query = document.getElementById('textQuery').value.trim();
  var language = document.getElementById('langSelect').value;
  var responseBox = document.getElementById('response');
  var askBtn = document.getElementById('askBtn');

  if (!query) return alert("Please type or speak a question!");

  askBtn.disabled = true;
  askBtn.innerText = "AGNI is thinking...";
  responseBox.innerText = "Consulting AGNI Engine...";

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query, language: language })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) {
      responseBox.innerText = "Error: " + data.error;
    } else if (data.reply) {
      responseBox.innerText = data.reply;
      speakText(data.reply, language);
    }
  })
  .catch(function(err) {
    responseBox.innerText = "Network Error: " + err.message;
  })
  .finally(function() {
    askBtn.disabled = false;
    askBtn.innerText = "Ask AGNI 🌾";
  });
}

function speakText(text, lang) {
  if ('speechSynthesis' in window) {
    var utterance = new SpeechSynthesisUtterance(text);
    if (lang === 'Hindi') utterance.lang = 'hi-IN';
    else if (lang === 'Bengali') utterance.lang = 'bn-IN';
    else if (lang === 'Assamese') utterance.lang = 'as-IN';
    else utterance.lang = 'en-IN';
    window.speechSynthesis.speak(utterance);
  }
    }
