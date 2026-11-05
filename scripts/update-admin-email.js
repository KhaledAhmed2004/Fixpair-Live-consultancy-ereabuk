const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function updateAdminEmail() {
  try {
    const targetEmail = process.env.SUPER_ADMIN_EMAIL || 'fixpair@outlook.com';
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to MongoDB.');

    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      role: String,
    }, { strict: false }));

    const result = await User.findOneAndUpdate(
      { role: 'SUPER_ADMIN' },
      { $set: { email: targetEmail } },
      { new: true }
    );

    if (result) {
      console.log(`Successfully updated SUPER_ADMIN email to: ${result.email}`);
    } else {
      console.log('No SUPER_ADMIN account found to update.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error updating admin email:', error);
    process.exit(1);
  }
}

updateAdminEmail();

