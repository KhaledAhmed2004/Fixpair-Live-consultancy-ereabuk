const mongoose = require('mongoose');

// Update this connection string to match your production or local database URL
const MONGO_URI = 'mongodb://127.0.0.1:27018/fixpair?replicaSet=rs0'; 

async function migrateConsultancyTypes() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    
    const db = mongoose.connection.useDb('fixpair'); // Update DB name if different
    const Users = db.collection('users');
    const ConsultancyTypes = db.collection('consultancytypes');

    console.log('Fetching consultancy types...');
    const types = await ConsultancyTypes.find({}).toArray();
    
    const typeMap = {};
    for (const type of types) {
      typeMap[type.name.toLowerCase()] = type._id;
    }
    console.log('Consultancy Type Map:', typeMap);

    console.log('Fetching consultants with string consultancyType...');
    const consultants = await Users.find({ role: 'CONSULTANT' }).toArray();
    
    let updatedCount = 0;
    
    for (const user of consultants) {
      // Check if consultancyType is a string instead of an ObjectId
      if (typeof user.consultancyType === 'string') {
        const typeId = typeMap[user.consultancyType.toLowerCase()];
        
        if (typeId) {
          await Users.updateOne(
            { _id: user._id },
            { $set: { consultancyType: typeId } }
          );
          console.log(`Updated user ${user.name} (${user._id}) to typeId: ${typeId}`);
          updatedCount++;
        } else {
          console.warn(`Warning: User ${user.name} has unknown consultancyType string "${user.consultancyType}" that doesn't match any category name in the DB.`);
        }
      }
    }
    
    console.log(`Migration completed successfully! Modified ${updatedCount} users.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateConsultancyTypes();
