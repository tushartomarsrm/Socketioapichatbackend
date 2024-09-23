const express = require("express");
const { Server } = require("socket.io");
const { createServer } = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const bodyParser = require('body-parser');
const secretKeyJWT = "asdasdsadasdasdasdsa";
const port = 3000;

const app = express();
app.use(bodyParser.json());
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

const userFilePath = path.join(__dirname, "users.txt");

// Utility function to read users from the file
const readUsersFromFile = () => {
  if (!fs.existsSync(userFilePath)) {
    return [];
  }
  const data = fs.readFileSync(userFilePath, "utf8");
  return data ? JSON.parse(data) : [];
};

// Utility function to write users to the file
const writeUsersToFile = (users) => {
  fs.writeFileSync(userFilePath, JSON.stringify(users, null, 2), "utf8");
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const users = readUsersFromFile();
  const existingUser = users.find(user => user.email === email);
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  users.push({ name, email, password });
  writeUsersToFile(users);

  const token = jwt.sign({ name, email }, secretKeyJWT);
  res.status(201).json({ message: "Signup successful", token });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = readUsersFromFile();
  const user = users.find(user => user.email === email && user.password === password);

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ name: user.name, email: user.email }, secretKeyJWT);
  res.json({ message: "Login successful", token });
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication Error"));
  try {
    const decoded = jwt.verify(token, secretKeyJWT);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error("Authentication Error"));
  }
});

io.on("connection", (socket) => {
  console.log(`User ${socket.user.name} connected with socket id ${socket.id}`);
  socket.broadcast.emit("receiveNotification", socket.user.name);

  socket.on("message", ({ message, room }) => {
    console.log({ room, message });
    socket.to(room).emit("receive-message", { message, name: socket.user.name });//in the room this is send to all the members except the one who triggers it
  });

  socket.on("messToAll", (message) => {
    console.log(message);
    socket.broadcast.emit("receive-message", { message, name: socket.user.name }); // Corrected line to broadcast to all
  });

  socket.on("join-room", (room) => {
    socket.join(room);
    console.log(`${socket.user.name} joined room ${room}`);
  });

  socket.on("private-message", ({ message, to }) => {
    socket.to(to).emit("receive-message", { message, name: socket.user.name });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.user.name} disconnected`, socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
