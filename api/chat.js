export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  try {
    const { action } = req.query || {};

    // 1. GET Marketplace Listings (Fetch from Supabase)
    if (req.method === 'GET' && action === 'get_market') {
      if (!supabaseUrl || !supabaseKey) {
        // Fallback to static data if Supabase keys aren't added yet
        return res.status(200).json({
          success: true,
          listings: [
            { item_type: "Crop Offer", title: "Paddy / Rice Buying (Local Mandi)", price_per_unit: "₹2,200 / Qtl", district: "Kamrup", contact_phone: "9876543210" },
            { item_type: "Equipment Hire", title: "Tractor with Rotavator for Rent", price_per_unit: "₹750 / hr", district: "Nalbari", contact_phone: "9123456789" }
          ]
        });
      }

      const dbResponse = await fetch(`${supabaseUrl}/rest/v1/listings?select=*&order=created_at.desc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const listings = await dbResponse.json();
      return res.status(200).json({ success: true, listings });
    }

    // 2. POST New Marketplace Listing (Save into Supabase)
    if (req.method === 'POST' && action === 'post_market') {
      const { item_type, title, price_per_unit, district, contact_phone } = req.body || {};
      
      if (!title || !price_per_unit || !district || !contact_phone) {
        return res.status(400).json({ success: false, error: "All fields are required." });
      }

      const newListing = {
        item_type: item_type || "Crop Offer",
        title,
        price_per_unit,
        district,
        contact_phone
      };

      if (!supabaseUrl || !supabaseKey) {
        return res.status(200).json({ success: true, listing: newListing });
      }

      const dbResponse = await fetch(`${supabaseUrl}/rest/v1/listings`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newListing)
      });

      const savedData = await dbResponse.json();
      return res.status(200).json({ success: true, listing: savedData[0] || newListing });
    }

    // 3. POST AGNI Chat Guidance Query (Groq Multilingual Engine)
    if (req.method === 'POST') {
      const { query, language } = req.body || {};

      if (!query) {
        return res.status(400).json({ success: false, error: "Please enter a valid question." });
      }

      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          reply: `[Demo Mode - ${language || 'English'}]: Set GROQ_API_KEY in Vercel settings for live AI replies.`
        });
      }

      const systemPrompt = `You are AGNI, an expert AI agricultural advisor for farmers in Assam and North-East India.
Provide concise guidance (under 130 words).

CRITICAL LANGUAGE RULE:
- You MUST respond ENTIRELY in the target language and script requested.
- Assamese / অসমীয়া -> ASSAMESE script (অসমীয়া লিপি).
- Hindi / हिंदी -> DEVANAGARI script (हिंदी देवनागरी).
- Bengali / বাংলা -> BENGALI script (বাংলা লিপি).
- English -> English script.`;

      const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

      const apiResponse = await fetch(groqUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Target Language Selected: ${language || 'English'}\nFarmer Query: ${query}` }
          ],
          temperature: 0.3,
          max_tokens: 400
        })
      });

      const data = await apiResponse.json();
      const replyText = data?.choices?.[0]?.message?.content || "No advice generated. Please try again.";

      return res.status(200).json({ success: true, reply: replyText });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });

  } catch (err) {
    console.error("Vercel Serverless Function Catch:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
