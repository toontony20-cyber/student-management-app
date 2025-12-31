const API_BASE_URL = "http://localhost:3000";
let students = [];
let courses = [];
let currentSection = "dashboard";
let editingId = null;
let editingCourseId = null;
let deleteType = ""; // 'student' or 'course'
let deleteId = null;

const studentTableBody = document.getElementById("studentTableBody");
const allStudentsTableBody = document.getElementById(
  "allStudentsTableBody"
);
const courseTableBody = document.getElementById("courseTableBody");
const studentModal = document.getElementById("studentModal");
const courseModal = document.getElementById("courseModal");
const studentForm = document.getElementById("studentForm");
const courseForm = document.getElementById("courseForm");
const searchInput = document.querySelector(".search-bar input");
const loadingSpinner = document.querySelector(".loading-spinner");

// Gradesheets elements
const studentSearchInput = document.getElementById("studentSearch");
const searchStudentBtn = document.getElementById("searchStudentBtn");
const gradesheetContainer = document.getElementById("gradesheetContainer");
const studentNameDisplay = document.getElementById("studentNameDisplay");
const updateGradesBtn = document.getElementById("updateGradesBtn");
const gradesTableBody = document.getElementById("gradesTableBody");

let currentStudentId = null;
let coursesMap = {}; // To store course names by ID

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", async () => {
  initializeEventListeners();
  initializeSettings();
  await checkAndLoadData();
});

// Initialize all event listeners
function initializeEventListeners() {
  // Form submissions
  studentForm.addEventListener("submit", handleFormSubmit);
  courseForm.addEventListener("submit", handleCourseFormSubmit);

  // Search functionality
  searchInput.addEventListener("input", handleSearch);

  // Gradesheets functionality
  searchStudentBtn.addEventListener("click", searchStudent);
  updateGradesBtn.addEventListener("click", updateGrades);
  studentSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchStudent();
    }
  });

  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const section = item.dataset.section;
      navigateToSection(section);
    });
  });

  // Modal outside click handlers
  window.onclick = (event) => {
    if (event.target === studentModal) closeModal();
    if (event.target === courseModal) closeCourseModal();
  };
}

// Initial data load and checks
async function checkAndLoadData() {
  showLoading();
  try {
    await loadCourses();

    // Check if we have any courses
    if (courses.length === 0) {
      showNotification(
        "Please add courses before managing students",
        "warning"
      );
      navigateToSection("courses");
      openCourseModal();
      return;
    }

    await Promise.all([loadStudents(), updateDashboardStats()]);
  } catch (error) {
    console.error("Error during initialization:", error);
    showNotification("Error initializing application", "error");
  } finally {
    hideLoading();
  }
}

// Navigation functions
function navigateToSection(section) {
  currentSection = section;

  // Update active nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.section === section) {
      item.classList.add("active");
    }
  });

  // Hide all sections
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });

  // Show selected section
  document.getElementById(`${section}Section`).classList.add("active");

  // Refresh data when switching sections
  if (section === "courses") {
    loadCourses();
  } else if (section === "students" || section === "dashboard") {
    loadStudents();
    updateDashboardStats();
  } else if (section === "reports") {
    loadPassingRatesReport();
  }
}

// API Functions
async function updateDashboardStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`);
    if (!response.ok) throw new Error("Failed to fetch dashboard stats");

    const stats = await response.json();

    // Debug: Log the debug info
    if (stats.debugInfo) {
      console.log("=== GRADUATES DEBUG INFO ===");
      stats.debugInfo.forEach(student => {
        console.log(`${student.name}: ${student.passingCount} passing grades, Graduate: ${student.isGraduate}`);
        console.log("Grades:", student.grades);
      });
      console.log(`Total graduates: ${stats.graduates}`);
      console.log("=== END DEBUG INFO ===");
    }

    // Update dashboard cards
    document.querySelector(".card:nth-child(1) .card-value").textContent =
      stats.totalStudents.toLocaleString();
    document.querySelector(".card:nth-child(2) .card-value").textContent =
      stats.activeCourses.toLocaleString();
    document.querySelector(".card:nth-child(3) .card-value").textContent =
      stats.graduates.toLocaleString();
    document.querySelector(
      ".card:nth-child(4) .card-value"
    ).textContent = `${stats.successRate}%`;
  } catch (error) {
    console.error("Error updating dashboard stats:", error);
    showNotification("Error updating statistics", "error");
  }
}

async function loadStudents() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/students`);
    if (!response.ok) throw new Error("Failed to fetch students");

    students = await response.json();
    renderStudentTables(students);
  } catch (error) {
    console.error("Error loading students:", error);
    showNotification("Error loading students", "error");
    students = [];
    renderStudentTables([]);
  }
}

async function loadCourses() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses`);
    if (!response.ok) throw new Error("Failed to fetch courses");

    courses = await response.json();

    // Update courses map for gradesheets
    coursesMap = {};
    courses.forEach(course => {
      coursesMap[course._id] = course.courseName;
    });

    updateCourseDropdown(courses);
    renderCourseTable(courses);
    return courses;
  } catch (error) {
    console.error("Error loading courses:", error);
    showNotification("Error loading courses", "error");
    courses = [];
    renderCourseTable([]);
  }
}

// CRUD Operations for Students
async function createStudent(studentData) {
  const response = await fetch(`${API_BASE_URL}/api/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(studentData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create student");
  }

  return response.json();
}

async function updateStudent(id, studentData) {
  const response = await fetch(`${API_BASE_URL}/api/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(studentData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update student");
  }

  return response.json();
}

async function deleteStudent(id) {
  deleteType = "student";
  deleteId = id;
  document.getElementById("deleteConfirmationModal").style.display =
    "flex";
}

// CRUD Operations for Courses
async function createCourse(courseData) {
  const response = await fetch(`${API_BASE_URL}/api/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(courseData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create course");
  }

  return response.json();
}

async function updateCourse(id, courseData) {
  const response = await fetch(`${API_BASE_URL}/api/courses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(courseData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update course");
  }

  return response.json();
}

async function deleteCourse(id) {
  deleteType = "course";
  deleteId = id;
  document.getElementById("deleteConfirmationModal").style.display =
    "flex";
}

function closeDeleteModal() {
  document.getElementById("deleteConfirmationModal").style.display =
    "none";
  deleteType = "";
  deleteId = null;
}

async function confirmDelete() {
  showLoading();
  try {
    if (deleteType === "student") {
      const response = await fetch(
        `${API_BASE_URL}/api/students/${deleteId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete student");
      }

      showNotification("Student deleted successfully", "success");
      await loadStudents();
      await updateDashboardStats();
    } else if (deleteType === "course") {
      const response = await fetch(
        `${API_BASE_URL}/api/courses/${deleteId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete course");
      }

      showNotification("Course deleted successfully", "success");
      await loadCourses();
      await updateDashboardStats();
    }
  } catch (error) {
    console.error("Error during deletion:", error);
    showNotification(error.message || "Error during deletion", "error");
  } finally {
    hideLoading();
    closeDeleteModal();
  }
}

// Form Handling
async function handleFormSubmit(e) {
  e.preventDefault();
  showLoading();

  const studentData = {
    studentName: document.getElementById("studentName").value.trim(),
    email: document.getElementById("studentEmail").value.trim(),
    course: document.getElementById("studentCourse").value,
    enrollmentDate: document.getElementById("enrollmentDate").value,
    status: "active",
  };

  try {
    if (editingId) {
      await updateStudent(editingId, studentData);
      showNotification("Student updated successfully", "success");
    } else {
      await createStudent(studentData);
      showNotification("Student created successfully", "success");
    }
    closeModal();
    await loadStudents();
    await updateDashboardStats();
  } catch (error) {
    console.error("Error:", error);
    showNotification("Error saving student data", "error");
  } finally {
    hideLoading();
  }
}

async function handleCourseFormSubmit(e) {
  e.preventDefault();
  showLoading();

  const courseData = {
    courseName: document.getElementById("courseName").value.trim(),
    description: document
      .getElementById("courseDescription")
      .value.trim(),
    duration: parseInt(document.getElementById("courseDuration").value),
    status: document.getElementById("courseStatus").value,
  };

  try {
    if (editingCourseId) {
      await updateCourse(editingCourseId, courseData);
      showNotification("Course updated successfully", "success");
    } else {
      await createCourse(courseData);
      showNotification("Course created successfully", "success");
    }
    closeCourseModal();
    await loadCourses();
    await updateDashboardStats();
  } catch (error) {
    console.error("Error:", error);
    showNotification("Error saving course data", "error");
  } finally {
    hideLoading();
  }
}

// UI Rendering Functions
function renderStudentTables(studentsToRender) {
  const tables = [studentTableBody, allStudentsTableBody];

  tables.forEach((table) => {
    if (!table) return; // Skip if table doesn't exist

    table.innerHTML = "";

    if (studentsToRender.length === 0) {
      const colSpan = table
        .closest("table")
        .querySelectorAll("th").length;
      table.innerHTML = `
        <tr>
            <td colspan="${colSpan}" class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Students Found</h3>
                <p>Click "Add Student" to add your first student</p>
            </td>
        </tr>
    `;
      return;
    }

    studentsToRender.forEach((student) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${student._id}</td>
        <td>${escapeHtml(student.studentName)}</td>
        <td>${escapeHtml(student.courseName || student.course)}</td>
        <td>${formatDate(student.enrollmentDate)}</td>
        <td>
            <span class="status-badge status-${student.status}">
                ${capitalizeFirstLetter(student.status)}
            </span>
        </td>
        <td class="action-buttons">
            <button class="action-btn edit-btn" onclick="editStudent('${
              student._id
            }')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="action-btn delete-btn" onclick="deleteStudent('${
              student._id
            }')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </td>
    `;
      table.appendChild(row);
    });
  });
}

function updateCourseDropdown(courses) {
  const courseSelect = document.getElementById("studentCourse");
  courseSelect.innerHTML = '<option value="">Select Course</option>';

  courses
    .filter((course) => course.status === "active")
    .forEach((course) => {
      const option = document.createElement("option");
      option.value = course._id;
      option.textContent = course.courseName;
      courseSelect.appendChild(option);
    });
}

function renderCourseTable(coursesToRender) {
  courseTableBody.innerHTML = "";

  if (coursesToRender.length === 0) {
    courseTableBody.innerHTML = `
    <tr>
        <td colspan="6" class="empty-state">
            <i class="fas fa-book"></i>
            <h3>No Courses Found</h3>
            <p>Click "Add Course" to add your first course</p>
        </td>
    </tr>
`;
    return;
  }

  coursesToRender.forEach((course) => {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td>${course._id}</td>
    <td>${escapeHtml(course.courseName)}</td>
    <td>${escapeHtml(course.description)}</td>
    <td>${course.duration}</td>
    <td>
        <span class="status-badge status-${course.status}">
            ${capitalizeFirstLetter(course.status)}
        </span>
    </td>
    <td class="action-buttons">
        <button class="action-btn edit-btn" onclick="editCourse('${
          course._id
        }')">
            <i class="fas fa-edit"></i> Edit
        </button>
        <button class="action-btn delete-btn" onclick="deleteCourse('${
          course._id
        }')">
            <i class="fas fa-trash"></i> Delete
        </button>
    </td>
`;
    courseTableBody.appendChild(row);
  });
}

// Modal Operations
function openModal() {
  if (courses.length === 0) {
    showNotification(
      "Please add at least one course before adding students",
      "warning"
    );
    navigateToSection("courses");
    openCourseModal();
    return;
  }

  studentModal.style.display = "flex";
  editingId = null;
  studentForm.reset();
  document.getElementById("modalTitle").textContent = "Add New Student";
}

function closeModal() {
  studentModal.style.display = "none";
  editingId = null;
  studentForm.reset();
}

function openCourseModal() {
  courseModal.style.display = "flex";
  editingCourseId = null;
  courseForm.reset();
  document.getElementById("courseModalTitle").textContent =
    "Add New Course";
}

function closeCourseModal() {
  courseModal.style.display = "none";
  editingCourseId = null;
  courseForm.reset();
}

// Update the editStudent function
async function editStudent(id) {
  showLoading();
  try {
    const response = await fetch(`${API_BASE_URL}/api/students/${id}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch student");
    }

    const student = await response.json();

    editingId = id;
    document.getElementById("modalTitle").textContent = "Edit Student";
    document.getElementById("studentName").value = student.studentName;
    document.getElementById("studentEmail").value = student.email;
    document.getElementById("studentCourse").value = student.course;
    document.getElementById("enrollmentDate").value = formatDateForInput(
      student.enrollmentDate
    );

    studentModal.style.display = "flex";
  } catch (error) {
    console.error("Error loading student for edit:", error);
    showNotification(
      error.message || "Error loading student data",
      "error"
    );
  } finally {
    hideLoading();
  }
}

// Update the editCourse function
async function editCourse(id) {
  showLoading();
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses/${id}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch course");
    }

    const course = await response.json();

    editingCourseId = id;
    document.getElementById("courseModalTitle").textContent =
      "Edit Course";
    document.getElementById("courseName").value = course.courseName;
    document.getElementById("courseDescription").value =
      course.description;
    document.getElementById("courseDuration").value = course.duration;
    document.getElementById("courseStatus").value = course.status;

    courseModal.style.display = "flex";
  } catch (error) {
    console.error("Error loading course for edit:", error);
    showNotification(
      error.message || "Error loading course data",
      "error"
    );
  } finally {
    hideLoading();
  }
}

// Search Functionality
let searchTimeout;
function handleSearch(e) {
  clearTimeout(searchTimeout);
  const searchTerm = e.target.value.trim();

  searchTimeout = setTimeout(async () => {
    if (searchTerm.length === 0) {
      await loadStudents();
      return;
    }

    showLoading();
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/students/search?q=${encodeURIComponent(
          searchTerm
        )}`
      );
      if (!response.ok) throw new Error("Search failed");

      const filteredStudents = await response.json();
      renderStudentTables(filteredStudents);
    } catch (error) {
      console.error("Error searching students:", error);
      showNotification("Error searching students", "error");
    } finally {
      hideLoading();
    }
  }, 300); // Debounce search requests
}

// Utility Functions
function formatDate(dateString) {
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatDateForInput(dateString) {
  return new Date(dateString).toISOString().split("T")[0];
}

function capitalizeFirstLetter(string) {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Loading Spinner Functions
function showLoading() {
  document.querySelector(".loading-spinner").classList.add("active");
}

function hideLoading() {
  document.querySelector(".loading-spinner").classList.remove("active");
}

// Notification System
function showNotification(message, type = "info") {
  // Remove any existing notifications
  const existingNotifications =
    document.querySelectorAll(".notification");
  existingNotifications.forEach((notification) => notification.remove());

  // Create new notification
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Add notification to the document
  document.body.appendChild(notification);

  // Remove notification after delay
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Error Handler
function handleError(error, defaultMessage = "An error occurred") {
  console.error(error);
  showNotification(error.message || defaultMessage, "error");
}

// Settings functionality
function initializeSettings() {
  // Load saved theme color
  loadSavedTheme();

  // Color picker event listeners
  document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => selectColor(option.dataset.color));
  });

  // Custom color picker
  document.getElementById('customColor').addEventListener('input', (e) => {
    selectColor(e.target.value);
  });

  // Reset button
  document.getElementById('resetColorBtn').addEventListener('click', resetToDefaultColor);
}

function selectColor(color) {
  // Update CSS variables
  updateThemeColor(color);

  // Save to localStorage
  localStorage.setItem('themeColor', color);

  // Update UI to show selected color
  updateSelectedColorUI(color);

  // Show notification
  showNotification('Theme color updated successfully!', 'success');
}

function updateThemeColor(color) {
  // Calculate secondary color (darker shade)
  const secondaryColor = darkenColor(color, 0.2);

  // Update CSS variables
  document.documentElement.style.setProperty('--primary-color', color);
  document.documentElement.style.setProperty('--secondary-color', secondaryColor);
}

function darkenColor(color, amount) {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Darken
  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

function loadSavedTheme() {
  const savedColor = localStorage.getItem('themeColor');
  if (savedColor) {
    updateThemeColor(savedColor);
    updateSelectedColorUI(savedColor);
  }
}

function updateSelectedColorUI(selectedColor) {
  // Remove selected class from all options
  document.querySelectorAll('.color-option').forEach(option => {
    option.classList.remove('selected');
  });

  // Find and select the matching color option
  const matchingOption = document.querySelector(`.color-option[data-color="${selectedColor}"]`);
  if (matchingOption) {
    matchingOption.classList.add('selected');
  }

  // Update custom color picker if it's a custom color
  const predefinedColors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#ea580c', '#be123c'];
  if (!predefinedColors.includes(selectedColor)) {
    document.getElementById('customColor').value = selectedColor;
  }
}

function resetToDefaultColor() {
  const defaultColor = '#2563eb';
  selectColor(defaultColor);
  localStorage.removeItem('themeColor');
  document.getElementById('customColor').value = '#000000'; // Reset custom picker
  showNotification('Theme color reset to default!', 'info');
}

// Gradesheets Functions
async function searchStudent() {
  const studentName = studentSearchInput.value.trim();
  if (!studentName) {
    showNotification("Please enter a student name", "warning");
    return;
  }

  showLoading();
  try {
    // Get all students and filter for partial name match
    const response = await fetch(`${API_BASE_URL}/api/students`);
    if (!response.ok) throw new Error("Search failed");

    const allStudents = await response.json();
    const students = allStudents.filter(student =>
      student.studentName.toLowerCase().includes(studentName.toLowerCase())
    );

    if (students.length === 0) {
      showNotification("No students found containing that text", "warning");
      gradesheetContainer.style.display = "none";
      return;
    }

    if (students.length > 1) {
      // Show student selection dropdown
      showStudentSelection(students);
      return;
    }

    // Only one student found - hide any existing dropdown
    const existingDropdown = document.getElementById("studentSelect");
    if (existingDropdown) {
      existingDropdown.style.display = "none";
    }

    const student = students[0];
    currentStudentId = student._id;
    await loadGradesheet(student._id);

  } catch (error) {
    console.error("Error searching student:", error);
    showNotification("Error searching for student", "error");
    gradesheetContainer.style.display = "none";
  } finally {
    hideLoading();
  }
}

async function loadGradesheet(studentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/grades`);
    if (!response.ok) throw new Error("Failed to load grades");

    const gradesData = await response.json();
    renderGradesheet(gradesData);

  } catch (error) {
    console.error("Error loading gradesheet:", error);
    showNotification("Error loading gradesheet", "error");
  }
}

function renderGradesheet(gradesData) {
  studentNameDisplay.textContent = `Gradesheet for ${gradesData.studentName}`;
  gradesTableBody.innerHTML = "";

  // Grade options for the dropdown
  const gradeOptions = ["none", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];

  // Get active courses
  const activeCourses = courses.filter(course => course.status === "active");

  activeCourses.forEach(course => {
    const currentGrade = gradesData.grades[course._id] || "none";
    const row = document.createElement("tr");

    // Create grade select dropdown
    let selectOptions = gradeOptions.map(option => {
      const selected = option === currentGrade ? 'selected' : '';
      return `<option value="${option}" ${selected}>${option}</option>`;
    }).join('');

    row.innerHTML = `
      <td>${escapeHtml(course.courseName)}</td>
      <td>
        <select class="grade-select"
                data-course-id="${course._id}">
          ${selectOptions}
        </select>
      </td>
    `;
    gradesTableBody.appendChild(row);
  });

  gradesheetContainer.style.display = "block";
}

function showStudentSelection(students) {
  // Hide gradesheet container
  gradesheetContainer.style.display = "none";

  // Create or update student selection dropdown
  let studentSelect = document.getElementById("studentSelect");
  if (!studentSelect) {
    studentSelect = document.createElement("select");
    studentSelect.id = "studentSelect";
    studentSelect.className = "student-select";
    studentSelect.innerHTML = '<option value="">Select a student...</option>';

    // Insert after the search group
    const searchGroup = document.querySelector(".search-group");
    searchGroup.insertAdjacentElement("afterend", studentSelect);

    // Add event listener
    studentSelect.addEventListener("change", (e) => {
      const selectedStudentId = e.target.value;
      if (selectedStudentId) {
        currentStudentId = selectedStudentId;
        loadGradesheet(selectedStudentId);
        // Hide the dropdown after selection
        studentSelect.style.display = "none";
      }
    });
  } else {
    studentSelect.style.display = "block";
    studentSelect.innerHTML = '<option value="">Select a student...</option>';
  }

  // Populate dropdown with matching students
  students.forEach(student => {
    const option = document.createElement("option");
    option.value = student._id;
    option.textContent = `${student.studentName} (${student.email})`;
    studentSelect.appendChild(option);
  });

  showNotification(`${students.length} students found. Please select one.`, "info");
}

// Reports Functions
async function loadPassingRatesReport() {
  showLoading();
  try {
    const response = await fetch(`${API_BASE_URL}/api/reports/course-passing-rates`);
    if (!response.ok) throw new Error("Failed to load passing rates");

    const passingRates = await response.json();
    renderPassingRatesTable(passingRates);

  } catch (error) {
    console.error("Error loading passing rates:", error);
    showNotification("Error loading passing rates report", "error");
  } finally {
    hideLoading();
  }
}

function renderPassingRatesTable(passingRates) {
  const tableBody = document.getElementById("passingRatesTableBody");
  tableBody.innerHTML = "";

  if (passingRates.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <i class="fas fa-chart-bar"></i>
          <h3>No Data Available</h3>
          <p>No active courses found or no students enrolled</p>
        </td>
      </tr>
    `;
    return;
  }

  passingRates.forEach(rate => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(rate.courseName)}</td>
      <td>${rate.totalStudents}</td>
      <td>${rate.passingStudents}</td>
      <td>${rate.passingRate}%</td>
    `;
    tableBody.appendChild(row);
  });
}

async function updateGrades() {
  if (!currentStudentId) {
    showNotification("No student selected", "warning");
    return;
  }

  const grades = {};
  let hasUpdates = false;

  // Collect grades from select dropdowns
  document.querySelectorAll(".grade-select").forEach(select => {
    const courseId = select.dataset.courseId;
    const grade = select.value;

    if (grade && grade !== "none") {
      grades[courseId] = grade;
      hasUpdates = true;
    }
  });

  if (!hasUpdates) {
    showNotification("No grades to update", "warning");
    return;
  }

  showLoading();
  try {
    const response = await fetch(`${API_BASE_URL}/api/students/${currentStudentId}/grades`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grades }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update grades");
    }

    const result = await response.json();
    showNotification("Grades updated successfully", "success");

    // Reload the gradesheet to reflect changes
    await loadGradesheet(currentStudentId);

  } catch (error) {
    console.error("Error updating grades:", error);
    showNotification("Error updating grades", "error");
  } finally {
    hideLoading();
  }
}

// Update modal close handlers
window.onclick = (event) => {
  if (event.target === studentModal) closeModal();
  if (event.target === courseModal) closeCourseModal();
  if (event.target === document.getElementById("deleteConfirmationModal"))
    closeDeleteModal();
};
