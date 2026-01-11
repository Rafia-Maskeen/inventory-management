const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const { runAssistantCommand } = require("../controllers/assistant.controller");

const router = express.Router();

router.post("/command", protect(["admin", "buyer"]), runAssistantCommand);

module.exports = router;
