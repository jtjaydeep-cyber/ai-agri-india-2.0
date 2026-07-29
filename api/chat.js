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
  // Always return JSON content type
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

    // 3. POST AGNI Chat Guidance Query (Using Groq API)
    if (req.method === 'POST') {
      const { query, language } = req.body || {};

      if (!query) {
        return res.status(400).json({ success: false, error: "Please enter a valid question." });
      }

      const apiKey = process.env.GROQ_API_KEY;

      // Fallback response if GROQ_API_KEY environment variable is not set in Vercel
      if (!apiKey) {
        return res.status(200).json({
          success: true,
          reply: `[Demo Guidance for "${query}"]:\n` +
                 `• Basal dose: Apply DAP (50 kg/acre) and MOP (25 kg/acre) during land preparation.\n` +
                 `• Top dressing: Apply Urea (45-50 kg/acre) in 2-3 split doses at tillering and panicle initiation stage.\n` +
                 `• Note: Add GROQ_API_KEY in your Vercel project environment settings for live AI responses.`
        });
      }

      // Standard Fetch Call to Groq API (OpenAI-compatible Chat Completions)
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
            {
              role: "system",
              content: "You are AGNI, an AI agricultural expert for Indian farmers in Assam and North-East India. Provide clear, actionable farming guidance under 120 words."
            },
            {
              role: "user",
              content: `Language requested: ${language || 'English'}\nFarmer Query: ${query}`
            }
          ],
          temperature: 0.5,
          max_tokens: 300
        })
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error("Groq API error:", data);
        return res.status(200).json({
          success: true,
          reply: `Groq API Error (${data.error?.message || 'API error'}). Check your GROQ_API_KEY in Vercel.`
        });
      }

      const replyText = data?.choices?.[0]?.message?.content || "No specific advice generated. Please try again.";

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
