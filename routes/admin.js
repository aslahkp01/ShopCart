var express = require("express");
var router = express.Router();
var productHelper = require('../helpers/product-helpers');
const path = require('path');

/* GET admin dashboard listing. */
router.get("/", function (req, res, next) {
  productHelper.getAllProducts().then((products) => {
    res.render("admin/view-products", {
      layout: 'admin-layout',
      admin: true,
      products
    });
  });
});

router.get("/add-products", function (req, res, next) {
  res.render("admin/add-products", {
    layout: 'admin-layout'
  });
});

router.post("/add-products", function (req, res, next) {
  console.log(req.body);
  console.log(req.files.Image);

  productHelper.addProduct(req.body, (id) => {
    let image = req.files.Image;
    let imagePath = path.join(__dirname, '../public/product-images/', id + '.jpg');

    image.mv(imagePath, (err) => {
      if (!err) {
        res.redirect('/admin');
      } else {
        console.log('Image upload error:', err);
        res.status(500).send('Image upload failed');
      }
    });
  });
});

router.get('/delete-product/:id', (req, res) => {
  let proId = req.params.id;
  productHelper.deleteProduct(proId).then(() => {
    res.redirect('/admin/');
  });
});

router.get('/edit-product/:id', async (req, res) => {
  let product = await productHelper.getproductDetails(req.params.id);
  res.render('admin/edit-product', {
    layout: 'admin-layout',
    product
  });
});

router.post('/edit-product/:id', (req, res) => {
  let id = req.params.id;
  productHelper.updateProduct(id, req.body).then(() => {
    if (req.files?.Image) {
      let image = req.files.Image;
      image.mv('./public/product-images/' + id + '.jpg');
    }
    res.redirect('/admin');
  });
});
router.get('/search', (req, res) => {
  const query = req.query.q;
  productHelper.searchProducts(query).then((results) => {
    res.render('admin/view-products', {
       layout: 'admin-layout',
      admin: true,
      products: results
    });
  });
});


module.exports = router;
