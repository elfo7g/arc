const { handleChapters } = require("../../server.js");

module.exports = (req, res) => {
  handleChapters(req, res);
};
