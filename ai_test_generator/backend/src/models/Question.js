const mongoose = require("mongoose");
const OptionSchema = new mongoose.Schema(
  {
    text: String,
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false });

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String,
    enum: ["mcq", "short", "long", "truefalse", "fillup"],
    default: "mcq",
  },
  options: [OptionSchema],
  difficulty: { type: String, default: "medium" },
  topic: { type: String, default: "" },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});

/*
const processedQuestions = generated.map(q => {
  const type = q.type?.toLowerCase();
  if (!['mcq', 'short', 'long', 'truefalse'].includes(type)) {
    throw new Error(`Invalid question type: ${q.type}`);
  }

  // Transform options from array of strings to array of objects if needed
  let options = [];
  if (type === 'mcq' && Array.isArray(q.options)) {
    options = q.options.map(opt => {
      if (typeof opt === 'string') {
        // Assume none is correct from AI, you might want to mark correct manually later
        return { text: opt, isCorrect: false };
      }
      return opt; // if already in correct format
    });
  }

  return {
    text: q.text || q.question || "",
    type,
    options,
    difficulty: q.difficulty || 'medium',
    topic: q.topic || '',
    metadata: q.metadata || {},
  };
});
*/

module.exports = mongoose.model('Question', QuestionSchema);

