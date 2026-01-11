const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dataPath = path.join(__dirname, "../data/users.json");

const readUsers = () =>
  JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const writeUsers = (data) =>
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

exports.register = async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role)
    return res.status(400).json({ message: "Missing fields" });

  const data = readUsers();

  if (data.users.find(u => u.email === email))
    return res.status(400).json({ message: "User exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  data.users.push({
    id: Date.now(),
    email,
    password: hashedPassword,
    role
  });

  writeUsers(data);
  res.json({ message: "User registered" });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const data = readUsers();

  const user = data.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ message: "Invalid login" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid login" });

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    token,
    role: user.role
  });
};
