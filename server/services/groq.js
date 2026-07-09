const Groq = require('groq-sdk');

class GroqService {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.isConfigured = !!this.apiKey;
        this.client = this.isConfigured ? new Groq({ apiKey: this.apiKey }) : null;
        this.model = 'llama-3.1-8b-instant';
    }

    async chat(messages, projectContext = {}) {
        const systemPrompt = this._buildSystemPrompt(projectContext);
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-20), // keep last 20 messages for context
        ];

        if (!this.isConfigured) {
            return this._getMockResponse(messages[messages.length - 1]?.content || '');
        }

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: fullMessages,
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 0.9,
            });

            return {
                success: true,
                message: completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.',
                model: this.model,
                usage: completion.usage,
            };
        } catch (err) {
            console.error('Groq API error:', err.message);
            return this._getMockResponse(messages[messages.length - 1]?.content || '');
        }
    }

    _buildSystemPrompt(ctx) {
        let prompt = `You are GenArchAI, an expert AI architectural assistant specializing in Indian residential and commercial construction. You help users design buildings, estimate costs, choose materials, and optimize their construction budgets.

IMPORTANT CONTEXT — INDIAN MARKET:
- All costs must be in Indian Rupees (₹)
- Use Indian numbering: lakhs (₹1,00,000) and crores (₹1,00,00,000)
- Typical Indian construction rates:
  • Economy: ₹1,000–₹1,400 per sqft
  • Standard: ₹1,400–₹1,800 per sqft
  • Premium: ₹1,800–₹2,400 per sqft
  • Luxury: ₹2,400–₹3,500 per sqft
- Always say "₹80 lakhs" not "$100,000" or "₹8,000,000"
- Reference Indian materials, brands, and construction practices

Your responses should be:
- Professional yet friendly
- Specific with numbers and recommendations in ₹ (lakhs/crores)
- Structured with clear sections
- Focused on practical architecture and construction advice

Always format responses with markdown for readability. Use bullet points, headers, and bold text.`;

        if (ctx && Object.keys(ctx).length > 0) {
            prompt += `\n\nCurrent Project Context:`;
            if (ctx.projectName) prompt += `\n- Project: ${ctx.projectName}`;
            if (ctx.area) prompt += `\n- Area: ${ctx.area} sq ft`;
            if (ctx.floors) prompt += `\n- Floors: ${ctx.floors}`;
            if (ctx.style) prompt += `\n- Style: ${ctx.style}`;
            if (ctx.budget) prompt += `\n- Budget: $${ctx.budget?.toLocaleString()}`;
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
            response = `## 💰 Cost Analysis

Based on typical Indian construction costs, here are some insights:

**Cost Breakdown Estimates (Standard Quality):**
- **Foundation & Structure**: 25-30% of total budget (~₹20-25 lakhs for a 2000 sqft home)
- **Electrical & Plumbing**: 15-20% (~₹12-15 lakhs)
- **Interior Finishing**: 20-25% (~₹16-20 lakhs)
- **Exterior & Landscaping**: 10-15% (~₹8-12 lakhs)
- **Contingency**: 8-10% (~₹6-8 lakhs)

### 💡 Cost Reduction Tips
- Consider **prefabricated components** to save ₹5-10 lakhs
- Use **locally sourced materials** (Birla/UltraTech cement, local stone) to reduce costs
- **Phase construction** over 2-3 stages to manage cash flow
- Choose **energy-efficient designs** for long-term savings on electricity bills

*Rate: ₹1,400-₹1,800 per sqft for standard quality construction*`;
        } else if (lower.includes('material') || lower.includes('recommend')) {
            response = `## 🧱 Material Recommendations

### Sustainable & Cost-Effective Options:

| Material | Best For | Cost Rating |
|----------|----------|-------------|
| **Engineered Wood** | Framing | ⭐⭐⭐ |
| **Fiber Cement Siding** | Exterior | ⭐⭐⭐ |
| **Polished Concrete** | Flooring | ⭐⭐ |
| **Recycled Steel** | Structure | ⭐⭐⭐⭐ |
| **Bamboo** | Flooring/Accents | ⭐⭐ |

### 💡 Pro Tips
- **Bamboo flooring** is 40% cheaper than hardwood with similar aesthetics
- **Green roofs** add 5-10% upfront but save 25% on energy costs
- **Triple-glazed windows** pay for themselves in 5-7 years

*Configure your Groq API key for personalized AI-powered advice!*`;
        } else if (lower.includes('eco') || lower.includes('green') || lower.includes('sustain')) {
            response = `## 🌿 Eco-Friendly Design Suggestions

### Key Sustainability Features:

1. **Solar Panel Integration**
   - Roof-mounted PV system (6-8kW for avg home)
   - Estimated savings: $1,200-1,800/year

2. **Rainwater Harvesting**
   - Collection system for garden irrigation
   - Save 30-40% on water bills

3. **Passive Solar Design**
   - South-facing windows for natural heating
   - Thermal mass walls for temperature regulation

4. **Green Insulation**
   - Recycled denim or cellulose insulation
   - R-value comparable to fiberglass

### 🏆 Sustainability Score Impact
These features can boost your sustainability score to **85+/100**

*Configure your Groq API key for personalized AI-powered advice!*`;
        } else {
            response = `## 🏗️ Architectural Guidance

Great question! Here are some recommendations:

### Design Principles
- **Orientation**: Align the building with natural light patterns
- **Ventilation**: Cross-ventilation reduces cooling costs by up to 30%
- **Proportion**: Follow the golden ratio for aesthetically pleasing facades
- **Materials**: Mix textures for visual interest (e.g., stone + wood + glass)

### Space Planning Tips
- **Open floor plans** feel 20% larger than compartmentalized designs
- **Ceiling height** of 10ft+ creates a premium feel
- **Natural light** should reach 75%+ of living spaces

### Next Steps
1. Define your primary lifestyle needs
2. Set a realistic budget range
3. Choose 2-3 reference styles you love
4. Consider future expansion possibilities

*Configure your Groq API key for personalized AI-powered advice!*`;
        }

        return {
            success: true,
            message: response,
            model: 'mock',
            isMock: true,
        };
    }
}

module.exports = new GroqService();
