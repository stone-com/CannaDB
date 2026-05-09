require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;
    console.log('dbName', db.databaseName);

    const cols = await db.listCollections().toArray();
    console.log('collections', cols.map((c) => c.name));

    for (const c of cols) {
      const count = await db.collection(c.name).countDocuments();
      console.log(c.name, count);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('error', error);
    process.exit(1);
  }
})();
