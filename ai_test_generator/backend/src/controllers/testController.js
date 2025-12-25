const testService = require('../services/testService');
const Test = require('../models/Test');
const Question = require('../models/Question');

// Transform database questions to frontend format
function transformQuestionsForFrontend(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }
  
  return questions.map(q => {
    const question = {
      question: q.text || q.question || "", // Use 'text' from DB as 'question' for frontend
      type: "", // Will be set below
      options: []
    };
    
    // Transform type from DB format to frontend format
    const dbType = (q.type || "").toLowerCase();
    const typeMap = {
      "mcq": "MCQ",
      "short": "Short Answer",
      "long": "Long Answer",
      "essay": "Long Answer",
      "truefalse": "True/False",
      "fillup": "Fill in the Blank",
      "fillblank": "Fill in the Blank"
    };
    question.type = typeMap[dbType] || "MCQ";
    
    // Transform options from objects to strings for frontend
    if (Array.isArray(q.options) && q.options.length > 0) {
      question.options = q.options.map(opt => {
        // If it's already a string, use it
        if (typeof opt === 'string') {
          return opt;
        }
        // If it's an object, use the text property
        if (typeof opt === 'object' && opt !== null && opt.text) {
          return opt.text;
        }
        return String(opt);
      });
    }
    
    // For True/False, ensure we have True and False options
    if (question.type === "True/False" && question.options.length === 0) {
      question.options = ["True", "False"];
    }
    
    return question;
  });
}

exports.generateTest = async (req, res) => {
  // req.body: { title, notes, count, difficulty, topic, description, questionTypes }
  const { title, notes, count, difficulty, topic, description, questionTypes } = req.body;
  
  // Validate that at least one question type is selected
  if (!questionTypes || !Array.isArray(questionTypes) || questionTypes.length === 0) {
    return res.status(400).json({ error: 'Please select at least one question type.' });
  }
  
  const opts = { 
    count, 
    difficulty, 
    topic, 
    description, 
    questionTypes,  // Pass selected question types
    settings: { timeLimitMin: req.body.timeLimitMin || 0 } 
  };
  const result = await testService.createTestWithAIQuestions(title, notes, opts);
  
  // Transform questions for frontend
  const transformedQuestions = transformQuestionsForFrontend(result.questions);
  
  res.status(201).json({ 
    test: result.test, 
    questions: transformedQuestions 
  });
};

exports.getTest = async (req, res) => {
  const test = await Test.findById(req.params.id).populate('questions');
  if (!test) return res.status(404).json({ error: 'Test not found' });
  
  // Transform questions for frontend
  const transformedQuestions = transformQuestionsForFrontend(test.questions);
  const testResponse = test.toObject();
  testResponse.questions = transformedQuestions;
  
  res.json(testResponse);
};

exports.listTests = async (req, res) => {
  const tests = await Test.find().populate('createdBy', 'email name').limit(50).sort({ createdAt: -1 });
  res.json(tests);
};

exports.addQuestion = async (req, res) => {
  // Create question manually
  const payload = req.body;
  const q = await Question.create(payload);
  // optionally attach to test
  if (req.query.testId) {
    const test = await Test.findById(req.query.testId);
    if (test) {
      test.questions.push(q._id);
      await test.save();
    }
  }
  res.status(201).json(q);
};
