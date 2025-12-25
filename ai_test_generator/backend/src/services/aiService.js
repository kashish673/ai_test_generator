const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;

function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  }
  return genAI;
}

// Helper function to extract JSON from markdown code blocks or plain text
function extractJSON(text) {
  if (!text) return null;
  
  // Remove markdown code blocks if present
  // Match ```json ... ``` or ``` ... ```
  let cleaned = text.trim();
  
  // Remove markdown code block markers
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  
  // Try to find JSON array or object
  // Look for the first [ or { and last ] or }
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  
  if (firstBracket !== -1 || firstBrace !== -1) {
    const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace) 
      ? firstBracket 
      : firstBrace;
    
    // Find matching closing bracket/brace
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let end = start;
    
    for (let i = start; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '[' || char === '{') depth++;
        if (char === ']' || char === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
    }
    
    if (depth === 0) {
      cleaned = cleaned.substring(start, end);
    }
  }
  
  return cleaned.trim();
}

async function generateQuestionsAI(notes, opts = {}) {
  const {
    count = 10,
    difficulty = "medium",
    topic = "General",
    description = "",
    questionTypes = []
  } = opts;

  // Build question types list for the prompt
  let questionTypesInstruction = "";
  if (questionTypes && questionTypes.length > 0) {
    const typeDescriptions = {
      "MCQ": "Multiple Choice Questions (MCQ)",
      "Short Answer": "Short Answer questions (requiring brief responses)",
      "Long Answer": "Long Answer/Essay questions (requiring detailed explanations)",
      "True/False": "True/False questions",
      "FillBlank": "Fill in the Blank questions (FillBlank)"
    };
    
    const selectedTypes = questionTypes.map(type => {
      // Handle "Long Answer" or "Essay" both mapping to "Long Answer"
      const normalizedType = type === "Essay" ? "Long Answer" : type;
      return typeDescriptions[normalizedType] || normalizedType;
    }).filter(Boolean);
    
    questionTypesInstruction = `CRITICAL: You MUST ONLY generate the following question types (selected by user):
${selectedTypes.map((desc, idx) => `- ${desc}`).join('\n')}

Distribute these question types evenly across the ${count} questions. Do NOT generate any other question types.`;
  } else {
    // Fallback to all types if none specified
    questionTypesInstruction = `CRITICAL: You MUST generate a VARIETY of question types. Include a good mix of:
- Multiple Choice Questions (MCQ)
- Short Answer questions (requiring brief responses)
- Long Answer/Essay questions (requiring detailed explanations)
- True/False questions
- Fill in the Blank questions (FillBlank)

Do NOT generate only MCQs. Distribute the question types evenly across the ${count} questions.`;
  }

  // Try multiple models if one fails
  // Updated to use newer model names that are actually available
  const modelNames = [
    "gemini-2.5-flash",      // Latest stable flash model
    "gemini-2.0-flash",      // Alternative flash model
    "gemini-pro-latest",     // Latest pro model
    "gemini-flash-latest",   // Latest flash (generic)
    "gemini-1.5-pro",        // Fallback to older models
    "gemini-1.5-flash",
    "gemini-pro"
  ];
  const client = getGenAI();
  
  let lastError = null;
  
  for (const modelName of modelNames) {
    try {
      const model = client.getGenerativeModel({ model: modelName });

  const prompt = `
Generate exactly ${count} exam questions based on the following information.

Topic: ${topic}
Difficulty: ${difficulty}

Source Notes:
${notes}

Extra Instructions:
${description}

IMPORTANT: Return ONLY valid JSON array, no markdown, no code blocks, no explanations. Start with [ and end with ].

${questionTypesInstruction}

JSON Format:
[
  {
    "question": "The question text here",
    "type": "MCQ",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Correct answer text"
  }
]

For question types, use exactly: "MCQ", "Short Answer", "Long Answer", "True/False", or "FillBlank".
- For MCQ questions: provide 4 options as an array
- For True/False questions: provide options as ["True", "False"]
- For Short Answer, Long Answer, and FillBlank: set options to null or []
- For FillBlank questions: use underscores or [blank] in the question text to indicate where the answer goes
- For Long Answer questions: make them require detailed explanations or essays
`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      if (!responseText) {
        throw new Error("Gemini API returned an empty response.");
      }
      
      // Extract JSON from markdown code blocks if present
      const jsonText = extractJSON(responseText);
      
      if (!jsonText) {
        throw new Error("Could not extract JSON from Gemini response.");
      }
      
      try {
        const parsed = JSON.parse(jsonText);
        
        // Validate it's an array
        if (!Array.isArray(parsed)) {
          throw new Error("Gemini response is not a JSON array.");
        }
        
        return parsed;
      } catch (err) {
        console.error("Gemini JSON error:", err);
        console.log("Cleaned text (first 300 chars):", jsonText.substring(0, 300));
        throw new Error(`Gemini returned invalid JSON: ${err.message}`);
      }
    } catch (error) {
      lastError = error;
      
      // Handle network/fetch errors first
      const errorMessage = error.message || '';
      const errorCode = error.code || '';
      
      if (errorMessage.includes('fetch failed') || 
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('network') ||
          errorCode === 'ECONNREFUSED' ||
          errorCode === 'ENOTFOUND' ||
          errorCode === 'ETIMEDOUT') {
        console.error(`❌ Network Error with model "${modelName}":`, errorMessage);
        console.error(`💡 This could be due to:`);
        console.error(`   - No internet connection`);
        console.error(`   - Firewall/proxy blocking the request`);
        console.error(`   - Gemini API endpoint unreachable`);
        console.error(`   Trying next model...`);
        continue; // Try next model
      }
      
      // If it's a 404 (model not found), try the next model
      if (error.status === 404 || errorMessage.includes('404') || errorMessage.includes('not found')) {
        console.log(`⚠️  Model "${modelName}" not available, trying next model...`);
        continue; // Try next model
      }
      
      // If it's an API key error, don't retry
      if (errorMessage.includes('API key') || errorMessage.includes('API_KEY_INVALID')) {
        throw error;
      }
      
      // For other errors, log and try next model
      console.error(`⚠️  Error with model "${modelName}":`, errorMessage);
      continue;
    }
  }
  
  // If all models failed
  const finalErrorMessage = lastError?.message || 'Unknown error';
  if (finalErrorMessage.includes('fetch failed') || 
      finalErrorMessage.includes('ECONNREFUSED') ||
      finalErrorMessage.includes('ENOTFOUND') ||
      finalErrorMessage.includes('ETIMEDOUT')) {
    throw new Error(`❌ Network Connection Failed: Unable to connect to Gemini API.\n\nPossible causes:\n1. No internet connection - Please check your internet connection\n2. Firewall/Proxy blocking - Check if firewall or proxy is blocking requests to Google APIs\n3. VPN issues - Try disabling VPN if active\n4. DNS issues - Check if you can resolve googleapis.com\n\nLast error: ${finalErrorMessage}`);
  }
  throw new Error(`❌ All Gemini models failed. Last error: ${finalErrorMessage}.`);
}

module.exports = {
  generateQuestionsAI
};
