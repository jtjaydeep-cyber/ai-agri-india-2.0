const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  // 1. WEATHER API ROUTE
  if (action === 'get_weather') {
    try {
      // Guwahati / Kamrup region weather (Open-Meteo API)
      const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=26.1445&longitude=91.7362&current_weather=true");
      const weatherData = await weatherRes.json();
      return res.status(200).json({ weather: weatherData.current_weather });
    } catch (err) {
      return res.status(200).json({ weather: { temperature: "28", windspeed: "12" } });
    }
  }

  // 2. SAMPARK MARKETPLACE API ROUTE
  if (action === 'get_market') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    // Default fallback sample listings if Supabase isn't linked yet
    const fallbackListings = [
      { item_type: 'Crop Offer', title: 'Paddy / Rice Buying (Local Mandi)', price_per_unit: '₹2,200 / Qtl', district: 'Kamrup', contact_phone: '9876543210' },
      { item_type: 'Equipment Hire', title: 'Tractor with Rotavator for Rent', price_per_unit: '₹750 / hr', district: 'Nalbari', contact_phone: '9123456789' },
      { item_type: 'Inputs', title: 'Organic Fertilizer (50kg Bag)', price_per_unit: '₹380 / bag', district: 'Barpeta', contact_phone: '9000011122' }
    ];

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ listings: fallbackListings });
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('market_listings').select('*').order('created_at', { ascending: false });
      
      if (error || !data || data.length === 0) {
        return res.status(200).json({ listings: fallbackListings });
      }
      return res.status(200).json({ listings: data });
    } catch (err) {
      return res.status(200).json({ listings: fallbackListings });
    }
  }

  // 3. AGNI AI CHAT QUERY (POST)
  if (req.method === 'POST') {
    const { query, language } = req.body;
    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY environment variable is not set in Vercel!' });
    }

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_KEY.trim()}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `You are AGNI, an expert agricultural assistant in India. Give direct, practical farming guidance in 2 short sentences in ${language || 'English'}.` 
            },
            { role: "user", content: query }
          ],
          temperature: 0.5
        })
      });

      const data = await response.json();
      if (data.error) return res.status(400).json({ error: data.error.message });

      return res.status(200).json({ reply: data.choices[0].message.content });
    } catch (err) {
      return res.status(500).json({ error: "Server Error: " + err.message });
    }
  }

  return res.status(400).json({ error: 'Invalid request' });
};
