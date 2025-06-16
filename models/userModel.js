// models/userModel.js
// For a production application, use a persistent database such as PostgreSQL or MongoDB,
// and consider using an ORM like Sequelize or an ODM like Mongoose.

let users = []; // Keep users array private to this module

const findUserById = (id) => {
  return users.find(user => user.id === id);
};

const findUserByUsername = (username) => {
  return users.find(user => user.username === username);
};

const addUser = (user) => {
  // Assumes 'user' object is complete with id, username, hashedPassword
  users.push(user);
  // console.log("User added in model, current users:", users); // For debugging
  return user;
};

module.exports = {
  findUserById,
  findUserByUsername,
  addUser,
  // For debugging or specific needs, you might export users, but it's better practice not to.
  // getUsers: () => users // Example of a getter if needed
};
