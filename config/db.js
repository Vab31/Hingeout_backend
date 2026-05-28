const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      "mongodb://db_ui:dbui@ac-l8cp115-shard-00-00.ezvcaaa.mongodb.net:27017,ac-l8cp115-shard-00-01.ezvcaaa.mongodb.net:27017,ac-l8cp115-shard-00-02.ezvcaaa.mongodb.net:27017/?ssl=true&replicaSet=atlas-5766q9-shard-0&authSource=admin&appName=Cluster0",
      {
        family: 4,
      }
    );

    console.log("MongoDB Connected:", conn.connection.host);
  } catch (err) {
    console.log(err);
  }
};

module.exports = connectDB;