const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string()
    .empty('')            // treat "" as undefined
    .default('student')   // default when missing or empty
    .valid('student','teacher','admin')
    .optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

module.exports = { registerSchema, loginSchema };
