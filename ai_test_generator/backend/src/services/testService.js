const Question = require("../models/Question");
const Test = require("../models/Test");

// Gemini version
const { GoogleGenerativeAI } = require("@google/generative-ai");

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

function getModel(modelName = null) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables. Please check your .env file.");
  }
  
  // Check if API key looks valid (should start with AIza)
  const apiKey = process.env.GEMINI_API_KEY.trim();
  if (!apiKey.startsWith('AIza')) {
    throw new Error("GEMINI_API_KEY format appears invalid. Valid Gemini API keys start with 'AIza'.");
  }
  
  const client = new GoogleGenerativeAI(apiKey);
  
  // Default model name - use the latest available model
  const defaultModel = modelName || "gemini-2.5-flash";
  return client.getGenerativeModel({ model: defaultModel });
}

/* OpenAI version
const OpenAI = require("openai").default;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
*/

const generateQuestionsAI = async (notes, opts = {}) => {
  const { count = 10, difficulty = "medium", topic = "General", description = "", questionTypes = [] } = opts;

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

IMPORTANT FORMAT RULES:
- Use "question" field (not "text") for the question text
- For question types, use exactly: "MCQ", "Short Answer", "Long Answer", "True/False", or "FillBlank"
- For MCQ questions: provide options as an array of strings: ["Option 1", "Option 2", "Option 3", "Option 4"]
- For True/False questions: provide options: ["True", "False"]
- For Short Answer, Long Answer, and FillBlank: set options to null or []
- For FillBlank questions: use underscores or [blank] in the question text to indicate where the answer goes
- For Long Answer questions: make them require detailed explanations or essays
- The "answer" field should contain the correct answer text (this will help match it to options)
`;

  // gemini version - try multiple models if one fails
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
  let lastError = null;
  
  for (const modelName of modelNames) {
    let responseText = null;
    try {
      const model = getModel(modelName);
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
      
      if (!responseText) {
        throw new Error("Gemini API returned an empty response.");
      }
      
      // Extract JSON from markdown code blocks if present
      const jsonText = extractJSON(responseText);
      
      if (!jsonText) {
        throw new Error("Could not extract JSON from Gemini response.");
      }
      
      // Try to parse the JSON
      try {
        const parsed = JSON.parse(jsonText);
        
        // Validate it's an array
        if (!Array.isArray(parsed)) {
          throw new Error("Gemini response is not a JSON array.");
        }
        
        return parsed;
      } catch (parseError) {
        // If parsing fails, log the cleaned text for debugging
        console.log("Failed to parse JSON. Cleaned text:", jsonText.substring(0, 200));
        throw parseError;
      }
    } catch (error) {
      lastError = error;
      
      // Handle JSON parsing errors (SyntaxError from JSON.parse) - don't retry
      if (error instanceof SyntaxError) {
        console.log("Gemini Returned (unparseable):", error.message);
        if (responseText) {
          console.log("Raw response (first 500 chars):", responseText.substring(0, 500));
        }
        throw new Error(`Gemini response is not valid JSON: ${error.message}`);
      }
      
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
      
      // Handle API key errors specifically - don't retry with different models
      const errorDetails = error.errorDetails || [];
      
      if (errorMessage.includes('API key') || 
          errorMessage.includes('API_KEY_INVALID') ||
          errorDetails.some(detail => detail.reason === 'API_KEY_INVALID')) {
        throw new Error(`❌ Invalid API Key Error: Your GEMINI_API_KEY in the .env file is not valid. Please:\n1. Go to https://aistudio.google.com/apikey\n2. Generate a new API key\n3. Update your .env file\n4. Restart your server`);
      }
      
      // If it's a 404 (model not found), try the next model
      if (error.status === 404 || errorMessage.includes('404') || errorMessage.includes('not found')) {
        console.log(`⚠️  Model "${modelName}" not available, trying next model...`);
        continue; // Try next model
      }
      
      // Handle other API errors
      if (error.status === 400 || error.statusText === 'Bad Request') {
        // For 400 errors that aren't model-not-found, don't retry
        if (!errorMessage.includes('not found')) {
          throw new Error(`Google Gemini API Error (400): ${errorMessage || 'Invalid request. Please verify your GEMINI_API_KEY is correct and has the necessary permissions.'}`);
        }
        // If it's a "not found" 400, continue to next model
        continue;
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
  throw new Error(`❌ All Gemini models failed. Last error: ${finalErrorMessage}. Please check your API key and try again.`);
};

// Transform AI-generated questions to match the Question schema
function transformQuestions(aiQuestions, opts = {}) {
  if (!Array.isArray(aiQuestions)) {
    throw new Error("AI response must be an array of questions.");
  }
  
  return aiQuestions.map(q => {
    // Map question field to text (schema expects 'text')
    const questionText = q.text || q.question || "";
    if (!questionText) {
      throw new Error("Question must have either 'text' or 'question' field.");
    }
    
    // Normalize type: map AI types to schema enum values
    let type = (q.type || "").toLowerCase().trim();
    
    // Map various type formats to schema values
    const typeMap = {
      "mcq": "mcq",
      "multiple choice": "mcq",
      "multiplechoice": "mcq",
      "short answer": "short",
      "shortanswer": "short",
      "short": "short",
      "long answer": "long",
      "longanswer": "long",
      "long": "long",
      "essay": "long",
      "true/false": "truefalse",
      "truefalse": "truefalse",
      "true false": "truefalse",
      "fillblank": "fillup",
      "fill blank": "fillup",
      "fillup": "fillup",
      "fill-up": "fillup",
      "fill in the blank": "fillup"
    };
    
    type = typeMap[type] || "mcq"; // Default to mcq if unknown
    
    // Transform options: convert strings to objects with {text, isCorrect}
    let options = [];
    
    // For True/False questions, provide default options if missing
    if (type === "truefalse" && (!q.options || !Array.isArray(q.options) || q.options.length === 0)) {
      options = [
        { text: "True", isCorrect: false },
        { text: "False", isCorrect: false }
      ];
    } else if (Array.isArray(q.options) && q.options.length > 0) {
      options = q.options.map(opt => {
        // If it's already an object with text property
        if (typeof opt === 'object' && opt !== null && opt.text) {
          return {
            text: opt.text,
            isCorrect: opt.isCorrect || false
          };
        }
        // If it's a string, convert to object
        if (typeof opt === 'string') {
          return {
            text: opt,
            isCorrect: false // AI doesn't mark correct answers, set manually later
          };
        }
        // Fallback
        return {
          text: String(opt),
          isCorrect: false
        };
      });
    }
    
    // Check if answer matches any option and mark it as correct
    if (q.answer && options.length > 0) {
      const correctAnswer = String(q.answer).trim().toLowerCase();
      options.forEach(opt => {
        if (opt.text) {
          const optText = String(opt.text).trim().toLowerCase();
          // Match exact or partial (for cases like "True" matching "true")
          if (optText === correctAnswer || optText.includes(correctAnswer) || correctAnswer.includes(optText)) {
            opt.isCorrect = true;
          }
        }
      });
    }
    
    return {
      text: questionText,
      type: type,
      options: options,
      difficulty: q.difficulty || opts.difficulty || "medium",
      topic: q.topic || opts.topic || "",
      metadata: {
        originalType: q.type || type,
        answer: q.answer || null,
        ...q.metadata
      }
    };
  });
}

/* openai
const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content;

  try {
    const parsed = JSON.parse(text);

    return parsed.map((q) => ({
      text: q.question || "",
      type:
        (q.type || "").toLowerCase() === "mcq"
          ? "mcq"
          : (q.type || "").toLowerCase() === "short answer"
          ? "short"
          : (q.type || "").toLowerCase() === "long answer"
          ? "long"
          : (q.type || "").toLowerCase() === "true/false"
          ? "truefalse"
          : "mcq",

      options: Array.isArray(q.options)
        ? q.options.map((opt) => ({ text: opt, isCorrect: false }))
        : [],
    }));
  } catch (err) {
    console.log("OpenAI Returned:", text);
    throw new Error("OpenAI response is not valid JSON.");
  }
};
*/

const createQuestionsFromAI = async (notes, opts = {}) => {
  const generated = await generateQuestionsAI(notes, opts);
  // Transform AI questions to match the Question schema
  const transformed = transformQuestions(generated, opts);
  return await Question.insertMany(transformed);
};

const createTestWithAIQuestions = async (title, notes, opts = {}) => {
  const questions = await createQuestionsFromAI(notes, opts);

  const test = await Test.create({
    title,
    description: opts.description || "",
    questions: questions.map((q) => q._id),
    settings: opts.settings || {},
  });

  return { test, questions };
};

module.exports = {
  generateQuestionsAI,
  createQuestionsFromAI,
  createTestWithAIQuestions,
};