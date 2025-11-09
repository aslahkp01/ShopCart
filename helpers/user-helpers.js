const db = require("../config/connection");
const collection = require("../config/collections");
const bcrypt = require("bcrypt");
const { ObjectId, HostAddress } = require("mongodb");
const { response } = require("express");

module.exports = {
  // Signup
  doSignup: async (userData) => {
    const existingUser = await db
      .get()
      .collection(collection.USER_COLLECTION)
      .findOne({ email: userData.email });

    if (existingUser) {
      // ❌ Email already in use
      throw new Error("User already exists");
    }

    userData.password = await bcrypt.hash(userData.password, 10);
    const result = await db
      .get()
      .collection(collection.USER_COLLECTION)
      .insertOne(userData);

    return result.ops?.[0] || userData; // return inserted user
  },

  // Login
  doLogin: async (userData) => {
    const user = await db
      .get()
      .collection(collection.USER_COLLECTION)
      .findOne({ email: userData.email });
    if (user) {
      const status = await bcrypt.compare(userData.password, user.password);
      if (status) return { user, status: true };
    }
    return { status: false };
  },

  // Add to Cart
  addToCart: (proId, userId) => {
    let proObj = {
      item: new ObjectId(proId),
      quantity: 1,
    };
    return new Promise(async (resolve, reject) => {
      let userCart = await db
        .get()
        .collection(collection.CART_COLLECTION)
        .findOne({ user: new ObjectId(userId) });

      if (userCart) {
        const proExist = userCart.products.findIndex(
          (prod) => prod.item && prod.item.toString() === proId
        );

        if (proExist !== -1) {
          db.get()
            .collection(collection.CART_COLLECTION)
            .updateOne(
              {
                user: new ObjectId(userId),
                "products.item": new ObjectId(proId),
              },
              { $inc: { "products.$.quantity": 1 } }
            )
            .then(() => resolve());
        } else {
          db.get()
            .collection(collection.CART_COLLECTION)
            .updateOne(
              { user: new ObjectId(userId) },
              { $push: { products: proObj } }
            )
            .then(() => resolve());
        }
      } else {
        let cartObj = {
          user: new ObjectId(userId),
          products: [proObj],
        };
        await db
          .get()
          .collection(collection.CART_COLLECTION)
          .insertOne(cartObj);
        resolve();
      }
    });
  },

  // Get Cart Items with Product Details
  getCartProducts: async (userId) => {
    try {
      const cartItems = await db
        .get()
        .collection(collection.CART_COLLECTION)
        .aggregate([
          { $match: { user: new ObjectId(userId) } },
          { $unwind: "$products" },
          {
            $project: {
              item: "$products.item",
              quantity: "$products.quantity",
            },
          },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: "item",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ["$product", 0] },
            },
          },
          {
            $project: {
              cartId: "$_id",
              productId: "$item",
              quantity: 1,
              name: "$product.Name",
              price: "$product.Price",
              description: "$product.Description",
              image: "$product.image", // Keep as-is if image field is lowercase or not used
            },
          },
        ])
        .toArray();

      return cartItems;
    } catch (err) {
      console.error("❌ Error fetching cart products:", err);
      return [];
    }
  },

  // Get Cart Count
  // In userHelpers.js
  getCartCount: async (userId) => {
    try {
      const cart = await db
        .get()
        .collection(collection.CART_COLLECTION)
        .findOne({ user: new ObjectId(userId) });
      return cart?.products?.length || 0;
    } catch (err) {
      console.error("❌ Error in getCartCount:", err);
      return 0;
    }
  },

  // Change Quantity or Remove
  changeProductQuantity: (details) => {
    details.count = parseInt(details.count);
    details.quantity = parseInt(details.quantity);

    return new Promise(async (resolve, reject) => {
      if (details.count === -1 && details.quantity === 1) {
        // Remove the item
        await db
          .get()
          .collection(collection.CART_COLLECTION)
          .updateOne(
            { _id: new ObjectId(details.cart) },
            { $pull: { products: { item: new ObjectId(details.product) } } }
          );
        resolve({ removeProduct: true });
      } else {
        await db
          .get()
          .collection(collection.CART_COLLECTION)
          .updateOne(
            {
              _id: new ObjectId(details.cart),
              "products.item": new ObjectId(details.product),
            },
            { $inc: { "products.$.quantity": details.count } }
          );
        resolve({ quantity: details.quantity + details.count }); // ✅ Return new quantity
      }
    });
  },
  removeFromCart: async (cartId, productId) => {
    await db
      .get()
      .collection(collection.CART_COLLECTION)
      .updateOne(
        { _id: new ObjectId(cartId) },
        { $pull: { products: { item: new ObjectId(productId) } } }
      );
    return { status: true };
  },
  getTotalAmount: async (userId) => {
    try {
      const total = await db
        .get()
        .collection(collection.CART_COLLECTION)
        .aggregate([
          { $match: { user: new ObjectId(userId) } },
          { $unwind: "$products" },
          {
            $project: {
              item: "$products.item",
              quantity: "$products.quantity",
            },
          },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: "item",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ["$product", 0] },
            },
          },
          {
            $project: {
              cartId: "$_id",
              productId: "$item",
              quantity: 1,
              name: "$product.Name",
              price: {
                $toDouble: {
                  $replaceAll: {
                    input: "$product.Price",
                    find: ",",
                    replacement: "",
                  },
                },
              },
              description: "$product.Description",
              image: "$product.image",
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $multiply: ["$quantity", "$price"] } },
            },
          },
        ])
        .toArray();

      return total[0]?.total || 0;
    } catch (err) {
      console.error("❌ Error in getTotalAmount:", err);
      return 0;
    }
  },
placeOrder: async (orderData, products, total) => {
  try {
    const orderObj = {
      deliveryDetails: {
        name: orderData.name,
        email: orderData.email,
        mobile: orderData.mobile,
        address: orderData.address + ", " + orderData.city,
        pincode: orderData.pincode,
      },
      userId: new ObjectId(orderData.userId),
      paymentMethod: orderData.paymentMethod,
      products: products,
      totalAmount: total, // ✅ fixed
      status: orderData.paymentMethod === 'COD' ? 'Placed' : 'Pending',
      date: new Date(),
    };

    const orderResult = await db
      .get()
      .collection(collection.ORDER_COLLECTION)
      .insertOne(orderObj);

    // ✅ clear user cart after placing order
    await db
      .get()
      .collection(collection.CART_COLLECTION)
      .deleteOne({ user: new ObjectId(orderData.userId) });

    return orderResult.insertedId; // return the order ID
  } catch (err) {
    console.error("❌ Error in placeOrder:", err);
    throw err;
  }
},

  getCartProductList: (userId) => {
    return new Promise(async (resolve, reject) => {
      let cart = await db
        .get()
        .collection(collection.CART_COLLECTION)
        .findOne({ user: new ObjectId(userId) });
      console.log(cart);
      resolve(cart.products);
    });
  },
getUserOrders: async (userId) => {
  try {
    const orders = await db
      .get()
      .collection(collection.ORDER_COLLECTION)
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        { $sort: { date: -1 } },
        { $unwind: "$products" },
        {
          $lookup: {
            from: collection.PRODUCT_COLLECTION,
            localField: "products.item",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $project: {
            _id: 1,
            date: 1,
            status: 1,
            totalAmount: 1,
            product: {
              _id: "$product._id",
              Name: "$product.Name",
              Price: "$product.Price",
              image: "$product.image",
              quantity: "$products.quantity",
            },
          },
        },
        {
          $group: {
            _id: "$_id",
            date: { $first: "$date" },
            status: { $first: "$status" },
            totalAmount: { $first: "$totalAmount" },
            products: { $push: "$product" },
          },
        },
      ])
      .toArray();

    return orders;
  } catch (err) {
    console.error("❌ Error in getUserOrders:", err);
    return [];
  }
},

getUserOrders: async (userId) => {
  try {
    const orders = await db
      .get()
      .collection(collection.ORDER_COLLECTION)
      .aggregate([
        // 1️⃣ Match orders for this user
        { $match: { userId: new ObjectId(userId) } },

        // 2️⃣ Sort by date descending (latest orders first)
        { $sort: { date: -1 } },

        // 3️⃣ Lookup product details for each product in the order
        {
          $lookup: {
            from: collection.PRODUCT_COLLECTION,
            localField: "products.item",
            foreignField: "_id",
            as: "productDetails",
          },
        },

        // 4️⃣ Merge product quantity info into product details
        {
          $addFields: {
            products: {
              $map: {
                input: "$products",
                as: "p",
                in: {
                  $mergeObjects: [
                    "$$p",
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$productDetails",
                            as: "pd",
                            cond: { $eq: ["$$pd._id", "$$p.item"] },
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },

        // 5️⃣ Clean up temporary field
        { $project: { productDetails: 0 } },
      ])
      .toArray();

    return orders;
  } catch (err) {
    console.error("❌ Error in getUserOrders:", err);
    return [];
  }
},


};
