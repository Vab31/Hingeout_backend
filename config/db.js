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

// Cache the connection globally so Vercel serverless containers can reuse it
let cachedConnection = null;

const connectDB = async () => {
  // 1. If an active connection exists, reuse it immediately
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log("=> Using cached MongoDB connection");
    return cachedConnection;
  }

  // 2. If a connection promise is already running, wait for it instead of starting a new one
  if (cachedConnection) {
    await cachedConnection;
    return;
  }

  try {
    console.log("=> Initializing fresh MongoDB connection stream...");

    // Optimization options for serverless runtimes
    const options = {
      serverSelectionTimeoutMS: 5000, // Drop out after 5s instead of hanging for 10s if the cluster is busy
      socketTimeoutMS: 45000,
      family: 4,                      // Forces IPv4
    };
    // mongodb://db_ui:dbui@ac-l8cp115-shard-00-00.ezvcaaa.mongodb.net:27017,ac-l8cp115-shard-00-01.ezvcaaa.mongodb.net:27017,ac-l8cp115-shard-00-02.ezvcaaa.mongodb.net:27017/?ssl=true&replicaSet=atlas-5766q9-shard-0&authSource=admin&appName=Cluster0

    // Clean SRV Connection String (Replace the credentials here if needed)
    const srvUri = "mongodb+srv://db_ui:yozRKEDNDwdRJZEW@cluster0.ezvcaaa.mongodb.net/?appName=Cluster0";

    // Store the connection promise in our cache variable
    cachedConnection = mongoose.connect(process.env.MONGO_URI || srvUri, options);
    
    const conn = await cachedConnection;
    console.log("MongoDB Connected:", conn.connection.host);
    return conn;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    cachedConnection = null; // Clear out the broken cache so it retries fresh on the next API call
  }
};

module.exports = connectDB;