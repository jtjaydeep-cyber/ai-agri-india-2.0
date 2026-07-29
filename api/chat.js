// In-memory fallback listings array
let localListings = [
  { item_type: "Crop Offer", title: "Paddy / Rice Buying (Local Mandi)", price_per_unit: "₹2,200 / Qtl", district: "Kamrup", contact_phone: "9876543210" },
  { item_type: "Equipment Hire", title: "Tractor with Rotavator for Rent", price_per_unit: "₹750 / hr", district: "Nalbari", contact_phone: "9123456789" }
];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  try {
    const { action } = req.query || {};

    // 1. GET Marketplace Listings
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
          console.error("Supabase fetch failed, fallback to local:", dbErr);
        }
      }
      return res.status(200).json({ success: true, listings: localListings });
    }

    // 2. POST New Marketplace Listing
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

    // 3. POST AGNI Guidance & Vision Query
    if (req.method === 'POST') {
      const { query, language, imageBase64 } = req.body || {};
      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          reply: `[Demo Mode]: Set GROQ_API_KEY in Vercel settings for live AI responses.`
        });
      }

      const systemPrompt = `You are AGNI, an AI agricultural advisor for farmers in Assam and North-East India. 
Respond ENTIRELY in the target language requested (${language || 'English'}) in native script. Keep answers under 140 words.`;

      const modelName = imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
      let userContent = [];

      if (imageBase64) {
        userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
      }
      userContent.push({ type: "text", text: `Target Language Selected: ${language || 'English'}\nFarmer Query: ${query}` });

      const apiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
          temperature: 0.2,
          max_tokens: 450
        })
      });

      const data = await apiResponse.json();
      return res.status(200).json({
        success: true,
        reply: data?.choices?.[0]?.message?.content || "Could not generate advice. Try again."
      });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });

  } catch (err) {
    console.error("Vercel Serverless Function Catch:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
