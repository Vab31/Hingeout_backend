// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(
//       "mongodb://db_ui:dbui@ac-l8cp115-shard-00-00.ezvcaaa.mongodb.net:27017,ac-l8cp115-shard-00-01.ezvcaaa.mongodb.net:27017,ac-l8cp115-shard-00-02.ezvcaaa.mongodb.net:27017/?ssl=true&replicaSet=atlas-5766q9-shard-0&authSource=admin&appName=Cluster0",
//       {
//         family: 4,
//       }
//     );

//     console.log("MongoDB Connected:", conn.connection.host);
//   } catch (err) {
//     console.log(err);
//   }
// };

// module.exports = connectDB;

const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://db_ui:yozRKEDNDwdRJZEW@cluster0.ezvcaaa.mongodb.net/?appName=Cluster0";

// Ensure cache persists across hot-reloads and container freezes in Vercel
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // 1. If we already have an established connection, reuse it instantly
  if (cached.conn) {
    return cached.conn;
  }

  // 2. If no connection promise exists, create a new one
  if (!cached.promise) {
    console.log("=> Initializing fresh MongoDB connection stream...");
    
    const options = {
      bufferCommands: false,         // CRITICAL: Tells Mongoose to throw an error immediately if connection is down instead of waiting 10s
      serverSelectionTimeoutMS: 5000, // Fail fast (5s) if MongoDB Atlas cluster is unresponsive
      socketTimeoutMS: 45000,
      family: 4,                      // Forces IPv4
    };

    cached.promise = mongoose.connect(MONGO_URI, options).then((mongooseInstance) => {
      console.log("=> MongoDB Connected successfully!");
      return mongooseInstance;
    });
  }

  // 3. Await the existing or newly created connection promise
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    cached.promise = null; // Reset the promise cache on failure so the next request can retry cleanly
    throw err;
  }

  return cached.conn;
};

module.exports = connectDB;