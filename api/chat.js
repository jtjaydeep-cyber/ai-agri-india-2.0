// In-memory array for SAMPARK marketplace listings
let marketListings = [
  {
    item_type: "Crop Offer",
    title: "Paddy / Rice Buying (Local Mandi)",
    price_per_unit: "₹2,200 / Qtl",
    district: "Kamrup",
    contact_phone: "9876543210"
  },
  {
    item_type: "Equipment Hire",
    title: "Tractor with Rotavator for Rent",
    price_per_unit: "₹750 / hr",
    district: "Nalbari",
    contact_phone: "9123456789"
  }
];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const { action } = req.query || {};

    // 1. GET Marketplace Listings
    if (req.method === 'GET' && action === 'get_market') {
      return res.status(200).json({ success: true, listings: marketListings });
    }

    // 2. POST New Marketplace Listing
    if (req.method === 'POST' && action === 'post_market') {
      const { item_type, title, price_per_unit, district, contact_phone } = req.body || {};
      
      if (!title || !price_per_unit || !district || !contact_phone) {
        return res.status(400).json({ success: false, error: "All fields are required." });
      }

      const newListing = {
        item_type: item_type || "Crop Offer",
        title: title,
        price_per_unit: price_per_unit,
        district: district,
        contact_phone: contact_phone
      };

      marketListings.unshift(newListing);
      return res.status(200).json({ success: true, listing: newListing });
    }

    // 3. POST AGNI Chat Guidance Query (Multilingual Support)
    if (req.method === 'POST') {
      const { query, language } = req.body || {};

      if (!query) {
        return res.status(400).json({ success: false, error: "Please enter a valid question." });
      }

      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          reply: `[Demo Mode - ${language || 'English'}]: Please set GROQ_API_KEY in Vercel settings for live multilingual replies.`
        });
      }

      // Build precise dynamic instructions based on chosen language
      const systemPrompt = `You are AGNI, an expert AI agricultural and government scheme advisor for farmers in Assam and North-East India.
Your goal is to provide practical, accurate, and concise guidance (under 130 words).

CRITICAL LANGUAGE & SCRIPT RULE:
- You MUST respond ENTIRELY in the target language and script requested.
- If requested language is "Assamese" or "অসমীয়া", respond strictly in ASSAMESE script (অসমীয়া লিপি).
- If requested language is "Hindi" or "हिंदी", respond strictly in DEVANAGARI script (हिंदी देवनागरी).
- If requested language is "Bengali" or "বাংলা", respond strictly in BENGALI script (বাংলা লিপি).
- If requested language is "English", respond in English.
- Even if the input is written in Roman script (like Hinglish/Assemglish "tamatar ka bhav"), respond strictly in the user's SELECTED output language script.

LOCAL CONTEXT FOCUS:
- Tailor advice to Assam agriculture (e.g., Sali/Boro paddy, Assam climate, Guwahati/Kamrup/Jorhat mandis, local fertilizers, and schemes like PM-KISAN, CMSGUY, or PMFBY).`;

      const userPrompt = `Target Language Selected: ${language || 'English'}\nFarmer Query: ${query}`;

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
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 400
        })
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error("Groq API error:", data);
        return res.status(200).json({
          success: true,
          reply: `Groq API Error (${data.error?.message || 'API Error'}).`
        });
      }

      const replyText = data?.choices?.[0]?.message?.content || "No advice generated. Please try again.";

      return res.status(200).json({ success: true, reply: replyText });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });

  } catch (err) {
    console.error("Vercel Serverless Function Catch:", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error: " + (err.message || "Unknown error")
    });
  }
}
