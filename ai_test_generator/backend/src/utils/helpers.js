const crypto = require('crypto');

const generateRandomId = (length = 8) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

const paginate = (array, page = 1, limit = 10) => {
  const start = (page - 1) * limit;
  return array.slice(start, start + limit);
};

const removeNullFields = (obj) => {
  const clean = {};
  for (let key in obj) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      clean[key] = obj[key];
    }
  }
  return clean;
};

module.exports = {
  generateRandomId,
  paginate,
  removeNullFields
};
