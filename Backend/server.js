const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const morgan = require("morgan");
const winston = require("winston");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("../Frontend"));

mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/student-management-app",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(async () => {
    console.log("Connected to MongoDB");
    // Import test data if database is empty
    await importTestData();
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Configure Winston Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

app.use(
  morgan(":method :url :status :response-time ms - :res[content-length]")
);

// Custom API Logger Middleware
const apiLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      params: req.params,
      query: req.query,
      body: req.method !== "GET" ? req.body : undefined,
    });
  });
  next();
};

app.use(apiLogger);

// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    body: req.method !== "GET" ? req.body : undefined,
  });

  res.status(500).json({ message: "Internal server error" });
});

const studentSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    course: {
      type: String,
      required: true,
    },
    enrollmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    grades: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Student = mongoose.model("Student", studentSchema);

const courseSchema = new mongoose.Schema(
    {
        courseName:{
            type: String,
            required: true,
            unique: true
        },
        description:{
            type: String,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        status:{
            type: String,
            enum:["active", "inactive"],
            default: "active"
        }
    },{
        timestamps: true
    }
);

const Course  = mongoose.model("Course", courseSchema);

// Import test data function
async function importTestData() {
  try {
    console.log('🔍 Checking if test data needs to be imported...');
    console.log('📁 Current directory:', __dirname);

    // Check if courses collection is empty
    const courseCount = await Course.countDocuments();
    const studentCount = await Student.countDocuments();

    console.log(`📊 Current data: ${courseCount} courses, ${studentCount} students`);

    if (courseCount === 0 && studentCount === 0) {
      console.log('📥 Database is empty, importing test data...');

      // Import courses
      const fs = require('fs');
      const path = require('path');

      const coursesPath = path.join(__dirname, '../testDataCourse.json');
      const studentsPath = path.join(__dirname, '../testdataStudent.json');

      console.log('📂 Courses file path:', coursesPath);
      console.log('📂 Students file path:', studentsPath);
      console.log('📂 Courses file exists:', fs.existsSync(coursesPath));
      console.log('📂 Students file exists:', fs.existsSync(studentsPath));

      if (fs.existsSync(coursesPath)) {
        console.log('📖 Reading courses file...');
        const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
        console.log(`📝 Inserting ${coursesData.length} courses...`);
        await Course.insertMany(coursesData);
        console.log(`✅ Imported ${coursesData.length} courses`);
      } else {
        console.log('❌ Courses file not found');
      }

      if (fs.existsSync(studentsPath)) {
        console.log('📖 Reading students file...');
        const studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));
        console.log(`📝 Inserting ${studentsData.length} students...`);
        await Student.insertMany(studentsData);
        console.log(`✅ Imported ${studentsData.length} students`);
      } else {
        console.log('❌ Students file not found');
      }

      console.log('🎉 Test data import completed successfully!');
    } else {
      console.log(`⏭️ Database already has data (${courseCount} courses, ${studentCount} students), skipping test data import`);
    }
  } catch (error) {
    console.error('❌ Error importing test data:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

//Course Routes

app.get('/api/courses', async (req, res) =>{
       try {
         const courses = await Course.find().sort({ courseName: 1 });
         logger.info(`Retrieved ${courses.length} courses successfully`);
         res.json(courses);
       } catch (error) {
         logger.error("Error fetching courses:", error);
         res.status(500).json({ message: error.message });
       }
})

app.post("/api/courses", async (req, res) => {
  try {
    const course = new Course(req.body);
    const savedCourse = await course.save();
    logger.info("New course created:", {
      courseId: savedCourse._id,
      courseName: savedCourse.courseName,
    });
    res.status(201).json(savedCourse);
  } catch (error) {
    logger.error("Error creating course:", error);
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/courses/:id", async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!course) {
      logger.warn("Course not found for update:", { courseId: req.params.id });
      return res.status(404).json({ message: "Course not found" });
    }
    logger.info("Course updated successfully:", {
      courseId: course._id,
      courseName: course.courseName,
    });
    res.json(course);
  } catch (error) {
    logger.error("Error updating course:", error);
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/courses/:id", async (req, res) => {
  try {
    const enrolledStudents = await Student.countDocuments({
      course: req.params.id,
    });
    if (enrolledStudents > 0) {
      logger.warn("Attempted to delete course with enrolled students:", {
        courseId: req.params.id,
        enrolledStudents,
      });
      return res
        .status(400)
        .json({ message: "Cannot delete course with enrolled students" });
    }

    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      logger.warn("Course not found for deletion:", {
        courseId: req.params.id,
      });
      return res.status(404).json({ message: "Course not found" });
    }
    logger.info("Course deleted successfully:", {
      courseId: course._id,
      courseName: course.courseName,
    });
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    logger.error("Error deleting course:", error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/courses/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    logger.error("Error fetching course:", error);
    res.status(500).json({ message: error.message });
  }
});

// Student Routes
app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    logger.info(`Retrieved ${students.length} students successfully`);
    res.json(students);
  } catch (error) {
    logger.error("Error fetching students:", error);
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const student = new Student(req.body);
    const savedStudent = await student.save();
    logger.info("New student created:", {
      studentId: savedStudent._id,
      studentName: savedStudent.studentName,
      course: savedStudent.course,
    });
    res.status(201).json(savedStudent);
  } catch (error) {
    logger.error("Error creating student:", error);
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!student) {
      logger.warn("Student not found for update:", {
        studentId: req.params.id,
      });
      return res.status(404).json({ message: "Student not found" });
    }
    logger.info("Student updated successfully:", {
      studentId: student._id,
      studentName: student.studentName,
      course: student.course,
    });
    res.json(student);
  } catch (error) {
    logger.error("Error updating student:", error);
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      logger.warn("Student not found for deletion:", {
        studentId: req.params.id,
      });
      return res.status(404).json({ message: "Student not found" });
    }
    logger.info("Student deleted successfully:", {
      studentId: student._id,
      studentName: student.studentName,
      course: student.course,
    });
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    logger.error("Error deleting student:", error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students/search", async (req, res) => {
  try {
    const searchTerm = req.query.q;
    logger.info("Student search initiated:", { searchTerm });

    const students = await Student.find({
      $or: [
        { studentName: { $regex: searchTerm, $options: "i" } },
        { course: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ],
    });

    logger.info("Student search completed:", {
      searchTerm,
      resultsCount: students.length,
    });
    res.json(students);
  } catch (error) {
    logger.error("Error searching students:", error);
    res.status(500).json({ message: error.message });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = await getDashboardStats();
        logger.info('Dashboard statistics retrieved successfully:', stats);
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: error.message });
    }
});

// Helper function for dashboard stats
async function getDashboardStats() {
    const totalStudents = await Student.countDocuments();
    const activeStudents = await Student.countDocuments({ status: 'active' });
    const totalCourses = await Course.countDocuments();
    const activeCourses = await Course.countDocuments({ status: 'active' });

    // Get all students to count graduates (students who passed 3 or more courses)
    const allStudents = await Student.find();
    let graduates = 0;

    console.log(`Processing ${allStudents.length} students for graduates calculation`);

    for (const student of allStudents) {
        try {
            let passingCourses = 0;

            // Convert grades Map to array and count passing grades
            const gradesArray = Array.from(student.grades.entries());
            console.log(`Student ${student.studentName}: ${gradesArray.length} grades`);

            for (const [courseId, grade] of gradesArray) {
                if (grade && grade !== "F" && grade !== "none") {
                    passingCourses++;
                    console.log(`  ${courseId}: ${grade} (PASSING)`);
                } else {
                    console.log(`  ${courseId}: ${grade} (NOT PASSING)`);
                }
            }

            if (passingCourses >= 3) {
                graduates++;
                console.log(`  *** GRADUATE: ${student.studentName} with ${passingCourses} passing courses ***`);
            } else {
                console.log(`  Not graduate: ${student.studentName} with ${passingCourses} passing courses`);
            }
        } catch (error) {
            console.log(`Error processing student ${student.studentName}:`, error.message);
        }
    }

    const courseCounts = await Student.aggregate([
        { $group: { _id: '$course', count: { $sum: 1 } } }
    ]);

    console.log(`FINAL RESULT: graduates=${graduates}, successRate=${totalStudents > 0 ? Math.round((graduates / totalStudents) * 100) : 0}`);

    return {
        totalStudents,
        activeStudents,
        totalCourses,
        activeCourses,
        graduates,
        courseCounts,
        successRate: totalStudents > 0 ? Math.round((graduates / totalStudents) * 100) : 0
    };
}


// Basic health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Detailed health check endpoint with MongoDB connection status
app.get('/health/detailed', async (req, res) => {
    try {
        // Check MongoDB connection
        const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
        
        // Get system metrics
        const systemInfo = {
            memory: {
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                unit: 'MB'
            },
            uptime: {
                seconds: Math.round(process.uptime()),
                formatted: formatUptime(process.uptime())
            },
            nodeVersion: process.version,
            platform: process.platform
        };

        // Response object
        const healthCheck = {
            status: 'UP',
            timestamp: new Date(),
            database: {
                status: dbStatus,
                name: 'MongoDB',
                host: mongoose.connection.host
            },
            system: systemInfo,
            environment: process.env.NODE_ENV || 'development'
        };

        res.status(200).json(healthCheck);
    } catch (error) {
        res.status(500).json({
            status: 'DOWN',
            timestamp: new Date(),
            error: error.message
        });
    }
});

//Get single student by ID
app.get('/api/students/:id', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        logger.error('Error fetching student:', error);
        res.status(500).json({ message: error.message });
    }
});

// Course Passing Rates Report
app.get('/api/reports/course-passing-rates', async (req, res) => {
    try {
        // Get all active courses
        const activeCourses = await Course.find({ status: 'active' });

        // Get all students
        const allStudents = await Student.find();

        const passingRates = [];

        for (const course of activeCourses) {
            // Find all students enrolled in this course
            const courseStudents = allStudents.filter(student => student.course === course._id.toString());

            if (courseStudents.length === 0) {
                passingRates.push({
                    courseId: course._id,
                    courseName: course.courseName,
                    totalStudents: 0,
                    passingStudents: 0,
                    passingRate: 0.0
                });
                continue;
            }

            // Count students who passed (grade is not "F")
            let passingStudents = 0;
            courseStudents.forEach(student => {
                const grade = student.grades.get(course._id);
                if (grade && grade !== "F" && grade !== "none") {
                    passingStudents++;
                }
            });

            // Calculate passing rate and round to 1 decimal place
            const passingRate = courseStudents.length > 0
                ? Math.round((passingStudents / courseStudents.length) * 100 * 10) / 10
                : 0.0;

            passingRates.push({
                courseId: course._id,
                courseName: course.courseName,
                totalStudents: courseStudents.length,
                passingStudents: passingStudents,
                passingRate: passingRate
            });
        }

        // Sort by course name
        passingRates.sort((a, b) => a.courseName.localeCompare(b.courseName));

        logger.info('Course passing rates calculated successfully');
        res.json(passingRates);

    } catch (error) {
        logger.error('Error calculating course passing rates:', error);
        res.status(500).json({ message: error.message });
    }
});

// Gradesheet Routes
app.get('/api/students/:id/grades', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get all courses to show grades for each course
        const courses = await Course.find({ status: 'active' });
        const grades = {};

        courses.forEach(course => {
            grades[course._id] = student.grades.get(course._id) || 'none';
        });

        logger.info('Grades retrieved for student:', {
            studentId: student._id,
            studentName: student.studentName,
            coursesCount: courses.length
        });

        res.json({
            studentId: student._id,
            studentName: student.studentName,
            grades: grades
        });
    } catch (error) {
        logger.error('Error fetching grades:', error);
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/students/:id/grades', async (req, res) => {
    try {
        const { grades } = req.body;

        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Update only non-empty grades
        Object.keys(grades).forEach(courseId => {
            const grade = grades[courseId].trim();
            if (grade && grade !== 'none') {
                student.grades.set(courseId, grade);
            }
        });

        await student.save();

        logger.info('Grades updated for student:', {
            studentId: student._id,
            studentName: student.studentName,
            updatedGrades: Object.keys(grades).length
        });

        res.json({
            message: 'Grades updated successfully',
            studentId: student._id,
            studentName: student.studentName
        });
    } catch (error) {
        logger.error('Error updating grades:', error);
        res.status(500).json({ message: error.message });
    }
});

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ');
}


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
