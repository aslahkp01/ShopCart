var express = require("express");
var router = express.Router();
var productHelper = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');

const db = require('../config/connection'); // Your MongoDB connection file
const collection = require('../config/collections');
const { ObjectId } = require('mongodb');
const verifyLogin = (req, res, next) => {
  if (req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login');
  }
};

router.get("/", async (req, res) => {
  let user = req.session.user;
  let allProducts = await productHelper.getAllProducts();

  // Group products by category
  let categoriesMap = {};
  allProducts.forEach((product) => {
    if (!categoriesMap[product.Category]) {
      categoriesMap[product.Category] = [];
    }
    categoriesMap[product.Category].push(product);
  });

  // Convert to array for Handlebars
  let categories = Object.keys(categoriesMap).map((key) => ({
    name: key,
    products: categoriesMap[key],
  }));

  res.render("user/view-products", {
    layout: "user-layout",
    user,
    categories,
  });
});


router.get('/login', (req, res) => {
  if (req.session.loggedIn) {
    res.redirect('/');
  } else {
    res.setHeader('Cache-Control', 'no-store');
    res.render('user/login', {
      layout: 'user-layout',
      loginErr: req.session.loginErr
    });
    req.session.loginErr = false;
  }
});

router.get('/signup', (req, res) => {
  const error = req.session.signupErr;
  req.session.signupErr = null;
  res.render('user/signup', {
    layout: 'user-layout',
    signupErr: error,
  });
});


router.post('/signup', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    req.session.signupErr = 'All fields are required.';
    return res.redirect('/signup');
  }

  if (password !== confirmPassword) {
    req.session.signupErr = 'Passwords do not match.';
    return res.redirect('/signup');
  }

  try {
    const user = await userHelpers.doSignup(req.body); // May throw if user exists
    req.session.loggedIn = true;
    req.session.user = user;
    res.redirect('/');
  } catch (err) {
    req.session.signupErr = err.message || 'Signup failed.';
    res.redirect('/signup');
  }
});

router.post('/login', (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.loggedIn = true;
      req.session.user = response.user;
      res.redirect('/');
    } else {
      req.session.loginErr = "Invalid username or password";
      res.redirect('/login');
    }
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});



router.get("/orders", async (req, res) => {
  try {
    let orders = await userHelpers.getUserOrders(req.session.user._id);
    res.render("user/orders", {layout: 'user-layout', orders, user: req.session.user });
  } catch (err) {
    console.error("❌ Error loading orders:", err);
    res.status(500).send("Error loading orders");
  }
});

// ✅ Single Order Details Page
router.get("/orders/:id", async (req, res) => {
  try {
    let orderId = req.params.id;
    let products = await userHelpers.getOrderProducts(orderId);

    res.render("user/order-details", {
      layout: 'user-layout',
      products,
      orderId,
      user: req.session.user,
    });
  } catch (err) {
    console.error("❌ Error loading order details:", err);
    res.status(500).send("Error loading order details");
  }
});

router.get('/cart', verifyLogin, async (req, res) => {
  res.set('Cache-Control', 'no-store'); // 🔁 Force reload from server
  try {
    let cartItems = await userHelpers.getCartProducts(req.session.user._id);
    let total = await userHelpers.getTotalAmount(req.session.user._id);
    res.render('user/cart', {
      layout: 'user-layout',
      cartItems,
      total,
      user: req.session.user
    });
  } catch (err) {
    console.error("❌ Error fetching cart:", err);
    res.status(500).send("Error loading cart");
  }
});

router.get('/add-to-cart/:id', verifyLogin, (req, res) => {
  userHelpers.addToCart(req.params.id,req.session.user._id).then(()=>{
    res.redirect('/')
  })

})
router.post('/change-product-quantity', (req, res, next) => {
  userHelpers.changeProductQuantity(req.body).then((response) => {
    res.json(response); // ✅ send back updated quantity or removeProduct flag
  });
});
router.post('/remove-from-cart', async (req, res) => {
  try {
    const { cart, product } = req.body;
    if (!cart || !product) {
      return res.status(400).json({ status: false, message: 'Missing cart or product ID' });
    }

    const result = await userHelpers.removeFromCart(cart, product);
    res.json(result);

  } catch (error) {
    console.error('❌ Remove-from-cart ERROR:', error);
    res.status(500).json({ status: false, error: error.message });
  }
});

router.get('/profile', verifyLogin, async (req, res) => {
  const userId = req.session.user._id;

  try {
    const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });
    res.render('user/profile', {
      layout: 'user-layout',
      user
    });
  } catch (error) {
    console.error("❌ Error loading profile:", error);
    res.redirect('/');
  }
});
router.get('/settings', verifyLogin, (req, res) => {
  res.render('user/settings', {
    layout: 'user-layout',
    user: req.session.user,
  });
});
router.get('/place-order',verifyLogin,async(req,res)=>{
  let total=await userHelpers.getTotalAmount(req.session.user._id)
  res.render('user/place-order',{total,user:req.session.user,placeOrderPage: true})
})
router.post('/place-order', async (req, res) => {
  try {
    console.log("📦 Order request:", req.body);

    const userId = req.session.user._id;

    // ✅ Fetch products and total
    const products = await userHelpers.getCartProductList(userId);
    const total = await userHelpers.getTotalAmount(userId);

    // ✅ Place order
    const orderId = await userHelpers.placeOrder(req.body, products, total);

    if (req.body["paymentMethod"] === "COD") {
      // Send JSON only
      return res.json({ codSuccess: true, orderId });
    } else {
      return res.json({ onlinePayment: true, orderId });
    }

  } catch (err) {
    console.error("❌ Error placing order:", err);
    res.status(500).json({ status: false, message: "Order failed" });
  }
});




router.get('/order-success/:id', async (req, res) => {
  const orderId = req.params.id;

  const order = await db.get()
    .collection(collection.ORDER_COLLECTION)
    .findOne({ _id: new ObjectId(orderId) });

  if (!order) {
    return res.status(404).render("user/404");
  }

  res.render("user/order-success", {
    orderId: orderId.toString(),
    total: order.totalAmount,
    paymentMethod: order.paymentMethod,
    status: order.status
  });
});




module.exports = router;
