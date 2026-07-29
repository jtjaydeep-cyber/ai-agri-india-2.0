// In-memory fallback listings array if Supabase is offline or unconfigured
let localListings = [
  { item_type: "Crop Offer", title: "Paddy / Rice Buying (Local Mandi)", price_per_unit: "₹2,200 / Qtl", district: "Kamrup", contact_phone: "9876543210" },
  { item_type: "Equipment Hire", title: "Tractor with Rotavator for Rent", price_per_unit: "₹750 / hr", district: "Nalbari", contact_phone: "9123456789" }
];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const apiKey = process.env.GROQ_API_KEY;

  try {
    const { action } = req.query || {};

    // ==========================================
    // 1. GET Marketplace Listings (SAMPARK Hub)
    // ==========================================
    if (req.method === 'GET' && action === 'get_market') {
      if (supabaseUrl && supabaseKey) {
        try {
          const dbResponse = await fetch(`${supabaseUrl}/rest/v1/listings?select=*&order=created_at.desc`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
          });
          const listings = await dbResponse.json();
          if (Array.isArray(listings) && listings.length > 0) {
            return res.status(200).json({ success: true, listings });
          }
        } catch (dbErr) {
          console.error("Supabase fetch error, using local fallback:", dbErr);
        }
      }
      return res.status(200).json({ success: true, listings: localListings });
    }

    // ==========================================
    // 2. POST New Marketplace Listing
    // ==========================================
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

      // Push to in-memory fallback
      localListings.unshift(newListing);

      if (supabaseUrl && supabaseKey) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/listings`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(newListing)
          });
        } catch (dbErr) {
          console.error("Supabase save error:", dbErr);
        }
      }

      return res.status(200).json({ success: true, listing: newListing });
    }

    // ==========================================
    // 3. POST Govt Scheme & Subsidy Advisor
    // ==========================================
    if (req.method === 'POST' && action === 'scheme_advisor') {
      const { schemeQuery, language } = req.body || {};

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          reply: `[Demo Scheme Advice]: Active schemes in Assam include PM-KISAN (₹6,000/yr), CMSGUY (up to 70% Tractor subsidy), and KCC Credit loans. Apply via nearest CSC center with Land Record (Jamabandi), Aadhaar, and Bank Passbook.`
        });
      }

      const schemeSystemPrompt = `You are an expert government agricultural schemes and subsidy advisor for farmers in Assam and North-East India.
Explain eligibility, benefits, required documents, and registration steps (e.g., via CSC, Agri offices, or PM-KISAN portal) clearly.

CRITICAL LANGUAGE & SCRIPT RULE:
- You MUST respond ENTIRELY in the requested target language (${language || 'English'}).
- Assamese / অসমীয়া -> ASSAMESE script.
- Hindi / हिंदी -> DEVANAGARI script.
- Bengali / বাংলা -> BENGALI script.
- English -> English.
Keep answers under 150 words with clear bullet points.`;

      const apiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: schemeSystemPrompt },
            { role: "user", content: `Farmer Query: ${schemeQuery}` }
          ],
          temperature: 0.2,
          max_tokens: 500
        })
      });

      const data = await apiResponse.json();
      return res.status(200).json({
        success: true,
        reply: data?.choices?.[0]?.message?.content || "Scheme details unavailable right now."
      });
    }

    // ==========================================
    // 4. POST AGNI Chat Guidance & Leaf Vision Query
    // ==========================================
    if (req.method === 'POST') {
      const { query, language, imageBase64 } = req.body || {};

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          reply: `[Demo Mode - ${language || 'English'}]: Please set GROQ_API_KEY in Vercel settings for live AI guidance and disease diagnosis.`
        });
      }

      const agniSystemPrompt = `You are AGNI, an expert AI agricultural plant pathologist and advisory engine for farmers in Assam and North-East India.
Provide actionable crop advice, pest/disease diagnosis, and remedies under 140 words.

CRITICAL LANGUAGE & SCRIPT RULE:
- You MUST respond ENTIRELY in the target language requested (${language || 'English'}).
- Assamese / অসমীয়া -> ASSAMESE script (অসমীয়া লিপি).
- Hindi / हिंदी -> DEVANAGARI script (हिंदी देवनागरी).
- Bengali / বাংলা -> BENGALI script (বাংলা লিপি).
- English -> English script.`;

      // Use Groq's multimodal vision model when an image is attached
      const modelName = imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";

      let userContent = [];

      if (imageBase64) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
        });
      }

      userContent.push({
        type: "text",
        text: `Target Language Selected: ${language || 'English'}\nFarmer Query: ${query}`
      });

      const apiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: agniSystemPrompt },
            { role: "user", content: userContent }
          ],
          temperature: 0.2,
          max_tokens: 450
        })
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error("Groq API error:", data);
        return res.status(200).json({
          success: true,
          reply: `Groq API Error (${data.error?.message || 'API error'}).`
        });
      }

      const replyText = data?.choices?.[0]?.message?.content || "Could not generate advice. Please try again.";

      return res.status(200).json({ success: true, reply: replyText });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });

  } catch (err) {
    console.error("Vercel Serverless Function Catch:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
