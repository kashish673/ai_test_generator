const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const Test = require('../models/Test');

exports.getAllUsers = async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  const deleted = await User.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: 'User not found' });

  // log action
  await ActivityLog.create({
    action: 'delete_user',
    performedBy: req.user.id,
    details: { userId: id, email: deleted.email }
  });

  res.json({ message: 'User deleted successfully' });
};

exports.viewActivityLogs = async (req, res) => {
  const logs = await ActivityLog.find()
    .populate('performedBy', 'name email role')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json(logs);
};

exports.deleteTest = async (req, res) => {
  const { id } = req.params;

  const deleted = await Test.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: 'Test not found' });

  await ActivityLog.create({
    action: 'delete_test',
    performedBy: req.user.id,
    details: { testId: id, title: deleted.title }
  });

  res.json({ message: 'Test deleted successfully' });
};
