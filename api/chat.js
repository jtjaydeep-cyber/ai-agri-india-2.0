const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // 1. FETCH MARKETPLACE LISTINGS
  if (action === 'get_market') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    const fallbackListings = [
      { item_type: 'Crop Offer', title: 'Paddy / Rice Buying (Local Mandi)', price_per_unit: '₹2,200 / Qtl', district: 'Kamrup', contact_phone: '9876543210' },
      { item_type: 'Equipment Hire', title: 'Tractor with Rotavator for Rent', price_per_unit: '₹750 / hr', district: 'Nalbari', contact_phone: '9123456789' }
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

  // 2. POST NEW MARKETPLACE LISTING
  if (action === 'post_market' && req.method === 'POST') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({ error: "Supabase credentials missing on Vercel" });
    }

    try {
      const { item_type, title, price_per_unit, district, contact_phone } = req.body;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase.from('market_listings').insert([
        { item_type, title, price_per_unit, district, contact_phone }
      ]);

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 3. AGNI AI CHAT QUERY
  if (req.method === 'POST') {
    const { query, language } = req.body;
    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY environment variable is not set!' });

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
};
