const express = require("express");
const { checkout } = require("../controllers/checkout.controller");
const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", protect(["buyer"]), checkout);

module.exports = router;
