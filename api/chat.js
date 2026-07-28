import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ACTION 1: FETCH MARKETPLACE LISTINGS
  if (action === 'get_market') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ 
        listings: [
          { item_type: 'Crop Offer', title: 'Paddy Buying (Local Mandi)', price_per_unit: '₹2,180 / Qtl', district: 'Kamrup', contact_phone: '9876543210' },
          { item_type: 'Equipment Hire', title: 'Tractor with Rotavator', price_per_unit: '₹800 / hr', district: 'Nalbari', contact_phone: '9123456789' }
        ]
      });
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('market_listings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ listings: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ACTION 2: FETCH WEATHER FOR ASSAM REGION
  if (action === 'get_weather') {
    try {
      // Fetch weather for Guwahati / Kamrup region via Open-Meteo (Free, no key required)
      const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=26.1445&longitude=91.7362&current_weather=true&daily=temperature_2m_max,temperature_2m_min,rain_sum&timezone=Asia%2FKolkata");
      const weatherData = await weatherRes.json();
      return res.status(200).json({ weather: weatherData.current_weather, daily: weatherData.daily });
    } catch (err) {
      return res.status(500).json({ error: "Weather fetch failed" });
    }
  }

  // ACTION 3: AGNI AI CHAT QUERY (DEFAULT)
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
}
