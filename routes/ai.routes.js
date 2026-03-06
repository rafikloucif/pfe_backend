const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/optimise", async (req, res) => {

  try {

    const response = await axios.post(
      "http://localhost:8000/optimise-route",
      req.body
    );

    res.json(response.data);

  } catch (error) {

    res.status(500).json({
      message: "Python service error"
    });

  }

});

module.exports = router;