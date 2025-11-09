var db = require('../config/connection');
var collection=require('../config/collections');
const { Admin } = require('mongodb');
const { ObjectId } = require('mongodb');
const { response } = require('express');


module.exports = {
  addProduct: (product, callback = () => {}) => {
    console.log(product);
    db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product).then((data) => {
        
      callback(data.insertedId);
    });
  },
  getAllProducts:()=>{
    return new Promise(async(resolve,reject)=>{
      let product= await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
      resolve(product)
    })
  },
 
  deleteProduct: (proId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION)
        .deleteOne({ _id: new ObjectId(proId) })
        .then((response) => {
          resolve(response);
        }).catch((err) => reject(err));
    });
  },
  getproductDetails:(proId)=>{
    return new Promise((resolve,reject)=>{
      db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id: new ObjectId(proId)}).then((product)=>{
        console.log(product)
        resolve(product)
      })
    })

  },updateProduct:(proId,proDetails)=>{
    return new Promise((resolve,reject)=>{
      db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:new ObjectId(proId)},{
        $set :{
          Name :proDetails.Name,
          Description :proDetails.Description,
          Category :proDetails.Category,
          Price :proDetails.Price,


        }
      }).then((response)=>{
        resolve()
      })
    })
  },
  searchProducts: (keyword) => {
    return new Promise(async (resolve, reject) => {
      const searchRegex = new RegExp(keyword, 'i'); // Case-insensitive search
      let results = await db
        .get()
        .collection(collection.PRODUCT_COLLECTION)
        .find({
          $or: [
            { Name: searchRegex },
            { Category: searchRegex },
            { Description: searchRegex }
          ]
        })
        .toArray();
      resolve(results);
    });
  }

};
