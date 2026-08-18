import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import '../../modules/consultancyType/consultancyType.model';

let replSet: MongoMemoryReplSet;

export async function startTestDb(): Promise<MongoMemoryReplSet> {
  // Start in-memory mongodb
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Ensure indexes are built
  await mongoose.model('User').init();
  await mongoose.model('ConsultancyType').init();
  
  // Seed basic consultancy types needed for tests
  await mongoose.model('ConsultancyType').create([
    { _id: new mongoose.Types.ObjectId('60d5ecb8b392d7211054a321'), name: 'advisor', status: 'active' },
    { _id: new mongoose.Types.ObjectId('60d5ecb8b392d7211054a322'), name: 'lawyer', status: 'active' },
    { _id: new mongoose.Types.ObjectId('60d5ecb8b392d7211054a323'), name: 'doctor', status: 'active' }
  ]);
  
  return replSet;
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
}
