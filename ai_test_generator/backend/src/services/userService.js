const User = require('../models/User');

const getUserById = async (id) => {
  return User.findById(id).select('-password');
};

const updateUser = async (id, data) => {
  return User.findByIdAndUpdate(id, data, { new: true }).select('-password');
};

const listAllUsers = async () => {
  return User.find().select('-password');
};

module.exports = {
  getUserById,
  updateUser,
  listAllUsers
};
