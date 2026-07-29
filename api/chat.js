import { GoogleGenerativeAI } from "@google/genai";

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
  // Ensure response headers are always JSON
  res.setHeader('Content-Type', 'application/json');

  try {
    const { action } = req.query;

    // 1. GET Marketplace Listings
    if (req.method === 'GET' && action === 'get_market') {
      return res.status(200).json({ success: true, listings: marketListings });
    }

    // 2. POST New Marketplace Listing
    if (req.method === 'POST' && action === 'post_market') {
      const { item_type, title, price_per_unit, district, contact_phone } = req.body || {};
      
      if (!title || !price_per_unit || !district || !contact_phone) {
        return res.status(400).json({ success: false, error: "All listing fields are required." });
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

    // 3. POST AGNI Chat Guidance Query
    if (req.method === 'POST') {
      const { query, language } = req.body || {};

      if (!query) {
        return res.status(400).json({ success: false, error: "Please provide a valid query." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      
      // Fallback response if API Key is missing on Vercel environment
      if (!apiKey) {
        return res.status(200).json({
          reply: `[Demo Mode] For ${query}, recommended standard fertilizer split for rice/paddy is:\n` +
                 `1. Basal dose: DAP (50 kg/acre) + MOP (25 kg/acre) during land preparation.\n` +
                 `2. Top dressing: Urea (45-50 kg/acre) in 2-3 split applications (tillering & panicle initiation).\n` +
                 `(Note: Add GEMINI_API_KEY in Vercel settings for live AI replies).`
        });
      }

      const ai = new GoogleGenerativeAI({ apiKey });
      const prompt = `You are AGNI, an expert agricultural advisor for Indian farmers, specifically in Assam and North-East regions. 
Answer the following farmer query concisely (under 120 words), clearly stating practical recommendations, fertilizer doses, or crop protection advice.
Language requested: ${language || 'English'}.
Query: ${query}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const replyText = response.text || "Sorry, no guidance generated. Please try again.";

      return res.status(200).json({ success: true, reply: replyText });
    }

    return res.status(405).json({ success: false, error: "Method Not Allowed" });

  } catch (error) {
    console.error("Server API Error:", error);
    // Return structured JSON even on crash/exception
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected server error occurred."
    });
  }
}
