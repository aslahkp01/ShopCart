var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const bodyParser = require("body-parser");
const userHelpers = require("./helpers/user-helpers");
const moment = require("moment");
var userRouter = require("./routes/user");
var adminRouter = require("./routes/admin");

var { engine } = require("express-handlebars");

var app = express();
var fileUpload = require("express-fileupload");
var db = require("./config/connection");
const session = require("express-session");


db.connect((err) => {
  if (err) {
    console.log("❌ Database Connection Error: " + err);
  } else {
    console.log("✅ Database Connected");

    // ✅ Start Express only after DB connects
    app.listen(3000, () => {
      console.log("🚀 Server is running on http://localhost:3000");
    });
  }
});

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
app.engine(
  "hbs",
  engine({
    extname: "hbs",
    defaultLayout: false,
    layoutDir: __dirname + "/views/layouts",
    partialsDir: __dirname + "/views/partials",
    helpers: {
      inc: function (value) {
        return parseInt(value) + 1;
      },
       eq: (a, b) => a == b,
    ne: (a, b) => a != b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    gte: (a, b) => a >= b,
    lte: (a, b) => a <= b,
      formatDate: function (date) {
        return moment(date).format("DD MMMM YYYY");
        // Example: 04-09-2025 02:30 PM
      }
    },
  })
);

app.use(logger("dev"));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(fileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({ secret: "Key", Cookie: { maxAge: 600000 } }));
app.use(express.static("public"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(async (req, res, next) => {
  if (req.session.user) {
    const count = await userHelpers.getCartCount(req.session.user._id);
    res.locals.cartCount = count;
    console.log("🛒 Cart Count:", count);
  } else {
    res.locals.cartCount = 0;
  }
  next();
});

// updated routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
