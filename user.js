// For a production application, use a persistent database such as PostgreSQL or MongoDB,
// and consider using an ORM like Sequelize or an ODM like Mongoose.

const users = [];

function findUserById(id) {
  return users.find(user => user.id === id);
}

function findUserByUsername(username) {
  return users.find(user => user.username === username);
}

module.exports = {
  users,
  findUserById,
  findUserByUsername
};
