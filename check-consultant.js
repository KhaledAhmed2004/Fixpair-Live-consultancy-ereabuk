const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27018/fixpair?replicaSet=rs0');
  
  const consultantId = '6a6b083ced1b5ab51944e72a';
  
  const db = mongoose.connection.useDb('fixpair');
  const Consultation = db.collection('consultations');
  
  const result = await Consultation.updateMany(
    {
      consultant: new mongoose.Types.ObjectId(consultantId),
      $or: [
        { status: 'ongoing' },
        { bookingType: 'instant', status: { $in: ['pending', 'accepted', 'confirmed'] } }
      ],
      updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // older than 24 hours
    },
    {
      $set: {
        status: 'cancelled',
        terminationReason: 'auto_cleanup',
        updatedAt: new Date()
      }
    }
  );
  
  console.log('Fixed stuck consultations. Modified count:', result.modifiedCount);
  
  await mongoose.disconnect();
}

fix().catch(console.error);
