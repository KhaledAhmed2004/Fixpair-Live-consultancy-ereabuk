import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const checkConsultant = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL as string);
    const Consultation = require('./src/app/modules/consultation/consultation.model').Consultation;
    const c = await Consultation.find({ consultant: '6a6b083ced1b5ab51944e72a' }).sort({createdAt: -1}).limit(5);
    console.log(JSON.stringify(c, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkConsultant();
