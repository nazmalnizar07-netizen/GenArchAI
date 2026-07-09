const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiChatService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.isConfigured = !!this.apiKey;
        if (this.isConfigured) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            // using gemini-2.5-flash for chat because it supports multi-turn effectively and is very fast
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        }
    }

    async chat(messages, projectContext = {}) {
        if (!this.isConfigured) {
            return this._getMockResponse(messages[messages.length - 1]?.content || '');
        }

        try {
            const systemPrompt = this._buildSystemPrompt(projectContext);

            // Format messages for Gemini Chat API
            // Gemini expects "user" or "model" roles
            const geminiHistory = messages.slice(-20, -1).map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            // The last message is the current user prompt
            const currentPrompt = messages[messages.length - 1]?.content || '';

            const chat = this.model.startChat({
                history: geminiHistory,
                // System instructions are supported in newer SDK versions,
                // but we can prepend it to the first user message if needed,
                // or use the systemInstruction field if supported.
                systemInstruction: { parts: [{ text: systemPrompt }] }
            });

            const result = await chat.sendMessage(currentPrompt);
            const responseText = result.response.text();

            return {
                success: true,
                message: responseText || 'I apologize, I could not generate a response.',
                model: 'gemini-2.5-flash',
                isMock: false,
            };
        } catch (err) {
            console.error('Gemini API error:', err.message);
            // Fallback to mock if API fails
            return this._getMockResponse(messages[messages.length - 1]?.content || '');
        }
    }

    _buildSystemPrompt(ctx) {
        let prompt = `You are GenArchAI, an expert AI architectural assistant. You help users design buildings, estimate costs, choose materials, and optimize their construction budgets. You provide specific, actionable advice.

Your responses should be:
- Professional yet friendly
- Specific with numbers and recommendations
- Structured with clear sections
- Focused on practical architecture and construction advice

Always format responses with markdown for readability. Use bullet points, headers, and bold text.`;

        if (ctx && Object.keys(ctx).length > 0) {
            prompt += `\n\nCurrent Project Context:`;
            if (ctx.projectName) prompt += `\n- Project: ${ctx.projectName}`;
            if (ctx.area) prompt += `\n- Area: ${ctx.area} sq ft`;
            if (ctx.floors) prompt += `\n- Floors: ${ctx.floors}`;
            if (ctx.style) prompt += `\n- Style: ${ctx.style}`;
            if (ctx.budget) prompt += `\n- Budget: ₹${ctx.budget?.toLocaleString()}`;
            if (ctx.qualityLevel) prompt += `\n- Quality: ${ctx.qualityLevel}`;
            if (ctx.rooms) prompt += `\n- Rooms: ${ctx.rooms}`;
            prompt += `\n\nUse this context to provide relevant, project-specific suggestions.`;
        }

        return prompt;
    }

    _getMockResponse(userMessage) {
        const lower = userMessage.toLowerCase();
        let response = '';

        if (lower.includes('cost') || lower.includes('budget') || lower.includes('price')) {
            response = `## 💰 Cost Analysis\n\nBased on typical construction costs, here are some insights:\n\n**Cost Breakdown Estimates:**\n- **Foundation & Structure**: 25-30% of total budget\n- **Electrical & Plumbing**: 15-20%\n- **Interior Finishing**: 20-25%\n- **Exterior & Landscaping**: 10-15%\n- **Contingency**: 10%\n\n### 💡 Cost Reduction Tips\n- Consider **prefabricated components** to save 15-20%\n- Use **local materials** to reduce transportation costs\n- **Phase construction** to manage cash flow\n- Choose **energy-efficient designs** for long-term savings\n\n*Configure your Gemini API key for personalized AI-powered advice!*`;
        } else if (lower.includes('material') || lower.includes('recommend')) {
            response = `## 🧱 Material Recommendations\n\n### Sustainable & Cost-Effective Options:\n\n| Material | Best For | Cost Rating |\n|----------|----------|-------------|\n| **Engineered Wood** | Framing | ⭐⭐⭐ |\n| **Fiber Cement Siding** | Exterior | ⭐⭐⭐ |\n| **Polished Concrete** | Flooring | ⭐⭐ |\n| **Recycled Steel** | Structure | ⭐⭐⭐⭐ |\n| **Bamboo** | Flooring/Accents | ⭐⭐ |\n\n### 💡 Pro Tips\n- **Bamboo flooring** is 40% cheaper than hardwood with similar aesthetics\n- **Green roofs** add 5-10% upfront but save 25% on energy costs\n- **Triple-glazed windows** pay for themselves in 5-7 years\n\n*Configure your Gemini API key for personalized AI-powered advice!*`;
        } else if (lower.includes('eco') || lower.includes('green') || lower.includes('sustain')) {
            response = `## 🌿 Eco-Friendly Design Suggestions\n\n### Key Sustainability Features:\n\n1. **Solar Panel Integration**\n   - Roof-mounted PV system (6-8kW for avg home)\n   - Estimated savings: $1,200-1,800/year\n\n2. **Rainwater Harvesting**\n   - Collection system for garden irrigation\n   - Save 30-40% on water bills\n\n3. **Passive Solar Design**\n   - South-facing windows for natural heating\n   - Thermal mass walls for temperature regulation\n\n4. **Green Insulation**\n   - Recycled denim or cellulose insulation\n   - R-value comparable to fiberglass\n\n### 🏆 Sustainability Score Impact\nThese features can boost your sustainability score to **85+/100**\n\n*Configure your Gemini API key for personalized AI-powered advice!*`;
        } else {
            response = `## 🏗️ Architectural Guidance\n\nGreat question! Here are some recommendations:\n\n### Design Principles\n- **Orientation**: Align the building with natural light patterns\n- **Ventilation**: Cross-ventilation reduces cooling costs by up to 30%\n- **Proportion**: Follow the golden ratio for aesthetically pleasing facades\n- **Materials**: Mix textures for visual interest (e.g., stone + wood + glass)\n\n### Space Planning Tips\n- **Open floor plans** feel 20% larger than compartmentalized designs\n- **Ceiling height** of 10ft+ creates a premium feel\n- **Natural light** should reach 75%+ of living spaces\n\n### Next Steps\n1. Define your primary lifestyle needs\n2. Set a realistic budget range\n3. Choose 2-3 reference styles you love\n4. Consider future expansion possibilities\n\n*Configure your Gemini API key for personalized AI-powered advice!*`;
        }

        return {
            success: true,
            message: response,
            model: 'mock',
            isMock: true,
        };
    }
}

module.exports = new GeminiChatService();
