const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { registerSchema, loginSchema } = require('../utils/validators');

const createToken = (user, secret, expiresIn) => {
  return jwt.sign({ id: user._id, role: user.role, email: user.email }, secret, { expiresIn });
};

exports.register = async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { name, email, password, role } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: 'Email already registered' });

  const user = await User.create({ 
    name, 
    email, 
    password, 
    role
  });

  res.status(201).json({ 
    user: { 
      id: user._id, 
      email: user.email, 
      name: user.name, 
      role: user.role
    }, 
    message: 'Registration successful!'
  });
};

exports.login = async (req, res) => {
  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

  const token = createToken(user, process.env.JWT_SECRET, process.env.JWT_EXPIRES_IN);
  res.json({ 
    token, 
    user: { 
      id: user._id, 
      email: user.email, 
      name: user.name, 
      role: user.role
    } 
  });
};
