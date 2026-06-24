const { handleTomorrowQuests } = require("../../server.js");

module.exports = (req, res) => {
  handleTomorrowQuests(req, res);
};
