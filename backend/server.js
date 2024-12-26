const express = require("express");
const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");
const cors = require("cors");

let db;
const app = express();
const port=3000
app.use(express.json());
app.use(cors());

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, "students.db"), // Database file
      driver: sqlite3.Database,
    });

    // Ensure students table exists (added DateAdded field)
    await db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        email TEXT UNIQUE NOT NULL,
        course TEXT NOT NULL,
        DateAdded TEXT NOT NULL
      );
    `);

    app.listen(port, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Database error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBandServer();

// POST /api/students - Create a new student
app.post("/api/students", async (req, res) => {
  const { name, age, email, course } = req.body;

  if (!name || !age || !email || !course) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if email already exists
    const existingStudent = await db.get(
      "SELECT * FROM students WHERE email = ?",
      [email]
    );

    if (existingStudent) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Get the current date (DateAdded)
    const DateAdded = new Date().toISOString();

    // Insert new student with DateAdded
    const result = await db.run(
      "INSERT INTO students (name, age, email, course, DateAdded) VALUES (?, ?, ?, ?, ?)",
      [name, age, email, course, DateAdded]
    );

    res.json({
      id: result.lastID,
      name,
      age,
      email,
      course,
      DateAdded, // Send back DateAdded as part of the response
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      res.status(400).json({ error: "Email already exists" });
    } else {
      console.error("Error adding student:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

// GET /api/students - Retrieve all students
app.get("/api/students", async (req, res) => {
  try {
    const students = await db.all("SELECT * FROM students");
    res.json(students);
  } catch (error) {
    console.error("Error retrieving students:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/students/:id - Retrieve a single student by ID
app.get("/api/students/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const student = await db.get("SELECT * FROM students WHERE id = ?", [id]);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
    } else {
      res.json(student);
    }
  } catch (error) {
    console.error("Error retrieving student:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/students/:id - Delete a student by ID
app.delete("/api/students/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.run("DELETE FROM students WHERE id = ?", [id]);
    if (result.changes === 0) {
      res.status(404).json({ error: "Student not found" });
    } else {
      res.json({ message: "Student deleted successfully" });
    }
  } catch (error) {
    console.error("Error deleting student:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/students/:id - Update a student by ID
app.put("/api/students/:id", async (req, res) => {
  const { id } = req.params;
  const { name, age, email, course } = req.body;

  if (!name || !age || !email || !course) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if email already exists for another student
    const existingStudent = await db.get(
      "SELECT * FROM students WHERE email = ? AND id != ?",
      [email, id]
    );

    if (existingStudent) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Update student
    const result = await db.run(
      "UPDATE students SET name = ?, age = ?, email = ?, course = ? WHERE id = ?",
      [name, age, email, course, id]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "Student not found" });
    } else {
      res.json({ message: "Student updated successfully" });
    }
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      res.status(400).json({ error: "Email already exists" });
    } else {
      console.error("Error updating student:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});
