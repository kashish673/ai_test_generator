// Simple script to list all registered users from MongoDB
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const connectDB = require('./src/config/db');

async function listUsers() {
  try {
    // Connect to MongoDB
    await connectDB(process.env.MONGO_URI);
    console.log('\n✅ Connected to MongoDB\n');

    // Get all users (excluding passwords)
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    if (users.length === 0) {
      console.log('📭 No users found in the database.\n');
      process.exit(0);
    }

    // Display users in a nice format
    console.log('📋 Registered Users:\n');
    console.log('═'.repeat(80));
    console.log(
      'Email'.padEnd(35) + 
      'Name'.padEnd(20) + 
      'Role'.padEnd(15) + 
      'Registered'
    );
    console.log('═'.repeat(80));

    users.forEach((user, index) => {
      const email = (user.email || 'N/A').padEnd(35);
      const name = (user.name || 'N/A').padEnd(20);
      const role = (user.role || 'student').padEnd(15);
      const date = user.createdAt 
        ? new Date(user.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A';
      
      console.log(`${email}${name}${role}${date}`);
    });

    console.log('═'.repeat(80));
    console.log(`\n📊 Total Users: ${users.length}\n`);

    // Summary by role
    const roleCounts = {};
    users.forEach(user => {
      const role = user.role || 'student';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    console.log('📈 Summary by Role:');
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role.charAt(0).toUpperCase() + role.slice(1)}: ${count}`);
    });
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listUsers();

