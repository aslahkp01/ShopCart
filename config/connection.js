// config/connection.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const state = {
  db: null,
};

module.exports.connect = async function (done) {
  const url = process.env.MONGODB_URI; // Load from .env
  const dbName = 'shopping'; // database name (can be anything you like)

  if (!url) {
    console.error("❌ Missing MONGODB_URI in .env file");
    return done(new Error("Missing MongoDB URI"));
  }

  try {
    const client = await MongoClient.connect(url);
    state.db = client.db(dbName);
    console.log("✅ Connected to MongoDB Atlas");
    done();
  } catch (err) {
    console.error("❌ MongoDB Atlas connection failed:", err.message);
    done(err);
  }
};

module.exports.get = function () {
  return state.db;
};
