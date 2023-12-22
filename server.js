const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const md5 = require("md5");
const jwt = require ("jsonwebtoken");
const multer = require('multer');
const path = require('path');


const app = express();
app.use(express.json());
app.use(cors());

app.use("/public/images", express.static("public/images"));


// chirag
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "signup",
});

db.connect((err) => {
    if (err) {
        console.error("Error connecting to database:", err);
        return;
    }
    console.log("Connected to database");
});


app.get("/students", (req, res) => {
  const searchTerm = req.query.searchTerm;
  const searchValue = `%${searchTerm}%`;

  const limit = req.query.limit || 5;
  const page = req.query.page || 1;
  const offset = (page - 1) * limit;

 
  let sql = `SELECT student.*, students.city, students.state, image.images AS image FROM student LEFT JOIN students ON student.ID = students.ID LEFT JOIN image ON student.ID = image.ID`;



  if (searchTerm) {
    sql += ` WHERE student.Name LIKE '${searchValue}' OR student.Email LIKE '${searchValue}'`;
  }


  sql += ' ORDER BY student.ID';

  const countQuery = `SELECT COUNT(*) AS total_records FROM (${sql}) AS Second_Query`;
  db.query(countQuery, (err, countResult) => {
    if (err) {
      console.error("Error executing count query:", err);
      return res.json({ success: false, message: "User List" });
    }

    const totalRecords = countResult[0].total_records;

    const query = `${sql} LIMIT ${limit} OFFSET ${offset}`;
    db.query(query, (err, results) => {
      if (err) {
        console.error("Error executing SQL query:", err);
        return res.json({ success: false, message: "User List" });
      }

      console.log("Retrieved student data successfully");
      return res.json({ success: true, data: results, totalRecords });
    });
  });
});

app.get('/profile/:id', (req, res) => {
  const id = req.params.id;
  
  if (!id) {
    return res.status(400).json({ error: true, message: "Please provide an id" });
  }
  
  const employeeSql = "SELECT * FROM student WHERE id = ?";
  const studentSql = "SELECT student.*, students.city, students.state FROM student JOIN students ON student.id = students.id WHERE student.id = ?";
  
  db.query(employeeSql, [id], (errorEmp, empResults) => {
    if (errorEmp) {
      console.error('Employee query error:', errorEmp);
      return res.status(500).json({ error: "Error in employee SQL query" });
    }
    
    db.query(studentSql, [id], (errorStud, studResults) => {
      if (errorStud) {
        console.error('Student query error:', errorStud);
        return res.status(500).json({ error: "Error in student SQL query" });
      }
      
      if (empResults.length === 0 && studResults.length === 0) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      const empData = empResults[0] || {};
      const studData = studResults[0] || {};
      
      const data = {
        id: id,
        Name: empData.Name || studData.Name,
        gender: empData.gender || studData.gender,
        email: empData.email || studData.email,
        phonenumber: empData.phonenumber || studData.phonenumber,
        salary: empData.salary || studData.salary,
        state: studData.state,
        city: studData.city,
      };
      
      return res.json({
        error: false,
        data: data,
        message: 'Profile found.',
      });
    });
  });
});



const jwtSecretKey = 'abcd1234'; 

const verifyJwt = (req, res, next) => {
  const token = req.headers['access-token'];
  if (!token) {
    return res.json('Token required');
  } else {
    jwt.verify(token, jwtSecretKey, (err, decoded) => {
      if (err) {
        res.json('Not Authenticated');
      } else {
        req.role = decoded.role;
        req.id = decoded.id;
        next();
      }
    });
  }
};

app.get('/checkauth', verifyJwt, (req, res) => {
  if (req.role === 'admin') {
    return res.json({ message: 'Authenticated as admin' });
  } else if (req.role === 'employee') {
    return res.json({ message: 'Authenticated as employee' });
  } else {
    return res.json({ message: 'Role not recognized' });
  }
});


app.post('/logins', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const sql = 'SELECT * FROM student WHERE `email` = ? AND `password` = ?';
  db.query(sql, [email, password], (err, data) => {
    if (err) {
      return res.status(500).json({ error: true, message: 'Error While Login' });
    }

    if (data.length > 0) {
      const role = data[0].role;
      const id = data[0].ID;
      const token = jwt.sign({ role, id }, jwtSecretKey, { expiresIn: '180s' });

      return res.json({
        Login: true,
        token,
        data,
        message: 'Login Success',
      });
    } else {
      return res.status(401).json({ error: true, message: 'Login Failed' });
    }
  });
});

app.get('/logout', (req, res) => {
 return res.json({Status: "Success"})
})


app.get('/dashboardData', (req, res) => {
  const dashboardData = {};

  const adminCountQuery = "SELECT COUNT(id) AS admin FROM users";
  const employeeCountQuery = "SELECT COUNT(id) AS employee FROM student";
  const totalSalaryQuery = "SELECT SUM(salary) AS sumOfSalary FROM student";

  db.query(adminCountQuery, (err, result) => {
    if (err) {
      console.error('Error in fetching admin count:', err);
      return res.status(500).json({ error: 'Error in fetching admin count' });
    }
    dashboardData.adminCount = result[0].admin;

    db.query(employeeCountQuery, (err, result) => {
      if (err) {
        console.error('Error in fetching employee count:', err);
        return res.status(500).json({ error: 'Error in fetching employee count' });
      }
      dashboardData.employeeCount = result[0].employee;

      db.query(totalSalaryQuery, (err, result) => {
        if (err) {
          console.error('Error in fetching total salary:', err);
          return res.status(500).json({ error: 'Error in fetching total salary' });
        }
        dashboardData.totalSalary = result[0].sumOfSalary;

        return res.json(dashboardData);
      });
    });
  });
});









app.post("/create", (req, res) => {
  const Name = req.body.Name;
  const email = req.body.email;
  const phonenumber = req.body.phonenumber;
  const gender = req.body.gender;
  const password = md5(req.body.password); 
  const salary = req.body.salary;
  const status = req.body.status;
  
  const checkQuery = "SELECT * FROM student WHERE email = ? OR phonenumber = ?";
  const values = [email, phonenumber];

  db.query(checkQuery, values, (err, result) => {
    if (err) {
      console.error("Error checking existing email or phone number:", err);
      return res.json({
        success: false,
        message: "Error checking existing email or phone number",
      });
    }

    if (result.length > 0) {
      if (result.find((row) => row.email === email)) {
        return res.json({
          success: false,
          message: "Email already exists",
        });
      }

      if (result.find((row) => row.phonenumber === phonenumber)) {
        return res.json({
          success: false,
          message: "Phone number already exists",
        });
      }
    }

    const sql = "INSERT INTO student SET ?";

    const userData = {
      Name: Name,
      gender: gender,
      email: email,
      phonenumber: phonenumber,
      password: password,
      salary:salary,
      status: status === 'active' ? 0 : 1,
    };

    db.query(sql, userData, (err, result) => {
      if (err) {
        console.error("Error creating student:", err);
        return res.json({ success: false, message: "Error creating student" });
      }

      console.log("Student created successfully");
      return res.json({ success: true, message: "Student created" });
    });
  });
});



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use(express.json());

app.put('/update/:id', upload.single('image'), (req, res) => {
  const id = req.params.id;
  const { email, phonenumber, city, state } = req.body;

  const image = req.file.path;

  const sql = 'UPDATE students SET Name = ?, email = ?, phonenumber = ?, salary = ?, gender = ? WHERE ID = ?';
  const values = [
    req.body.Name,
    req.body.email,
    req.body.phonenumber,
    req.body.salary,
    req.body.gender,
    id
  ];

  db.query(sql, values, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Error updating user' });
    }

    // Check if email or phone number already exists
    const checkQuery = 'SELECT * FROM students WHERE (email = ? OR phonenumber = ?) AND ID != ?';
    const checkValues = [email, phonenumber, id];

    db.query(checkQuery, checkValues, (checkErr, checkResult) => {
      if (checkErr) {
        console.error('Error checking existing email or phone number:', checkErr);
        return res.json({
          success: false,
          message: 'Error checking existing email or phone number',
        });
      }

      if (checkResult.length > 0) {
        if (checkResult.find((row) => row.email === email)) {
          return res.json({
            success: false,
            message: 'Email already exists',
          });
        }

        if (checkResult.find((row) => row.phonenumber === phonenumber)) {
          return res.json({
            success: false,
            message: 'Phone number already exists',
          });
        }
      }

      // Update or insert image record
      updateImage();
    });
  });

  function updateImage() {
    const checkQuery3 = 'SELECT * FROM image WHERE ID = ?';
    const checkValues3 = [id];

    db.query(checkQuery3, checkValues3, (checkErr, checkResult) => {
      if (checkErr) {
        console.error('Error checking existing record:', checkErr);
        return res.json({
          success: false,
          message: 'Error checking existing record',
        });
      }

      if (checkResult.length > 0) {
        // Update image record
        const updateQuery = 'UPDATE image SET images = ? WHERE ID = ?';
        const updateValues = [image, id];

        db.query(updateQuery, updateValues, (updateErr) => {
          if (updateErr) {
            console.error('Error executing UPDATE query:', updateErr);
            return res.status(500).json({ success: false, message: 'Error updating image' });
          } else {
            console.log('Image record updated successfully');
            return res.json({
              success: true,
              message: 'Record updated successfully',
            });
          }
        });
      } else {
        // Insert new image record
        const insertQuery = 'INSERT INTO image (ID, images) VALUES (?, ?)';
        const insertValues = [id, image];

        db.query(insertQuery, insertValues, (insertErr) => {
          if (insertErr) {
            console.error('Error executing INSERT query:', insertErr);
            return res.status(500).json({ success: false, message: 'Error inserting new image record' });
          } else {
            console.log('Image record inserted successfully');
            return res.json({
              success: true,
              message: 'Record updated successfully',
            });
          }
        });
      }
    });
  }
});


app.put('/updateprofile/:id', (req, res) => {
  const id = req.params.id;
  const { Name, email, phonenumber, salary, gender, city, state, status } = req.body; 
  

  const sql = 'UPDATE student SET Name = ?, email = ?, salary = ?, phonenumber = ?, gender = ?, status = ? WHERE ID = ?';
  const values = [Name, email, salary, phonenumber, gender,status === 'active' ? 0 : 1, id];

  db.query(sql, values, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Error updating user' });
    }


    const checkQuery = 'SELECT * FROM student WHERE (email = ? OR phonenumber = ?) AND ID != ?';
    const checkValues = [email, phonenumber, id];

    db.query(checkQuery, checkValues, (checkErr, checkResult) => {
      if (checkErr) {
        console.error('Error checking existing email or phone number:', checkErr);
        return res.json({
          success: false,
          message: 'Error checking existing email or phone number',
        });
      }

      if (checkResult.length > 0) {
        if (checkResult.find((row) => row.email === email)) {
          return res.json({
            success: false,
            message: 'Email already exists',
          });
        }

        if (checkResult.find((row) => row.phonenumber === phonenumber)) {
          return res.json({
            success: false,
            message: 'Phone number already exists',
          });
        }
      }


      const updateQuery = 'UPDATE students SET city = ?, state = ? WHERE ID = ?';
      const updateValues = [city, state, id];

      db.query(updateQuery, updateValues, (updateErr) => {
        if (updateErr) {
          console.error('Error executing UPDATE query:', updateErr);
          return res.status(500).json({ success: false, message: 'Error updating city and state' });
        } else {
          console.log('Record updated successfully');

          res.json({ success: true, message: 'Record updated successfully' });
        }
      });
    });
  });
});


app.post('/submitLeave', (req, res) => {
  const {  employee_name, leave_date, leave_reason } = req.body;
  const status = 'Pending';

  const query = 'INSERT INTO leave_requests ( employee_name, leave_date, leave_reason, status) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [ employee_name, leave_date, leave_reason, status], err => {
      if (err) {
          console.error('Error submitting leave request:', err);
          res.status(500).send('Error submitting leave request');
      } else {
          res.status(200).send('Leave request submitted');
      }
  });
});




app.get('/getLeaveRequests', (req, res) => {
  const query = 'SELECT * FROM leave_requests';
  db.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching leave requests:', err);
          res.status(500).send('Error fetching leave requests');
      } else {
          res.status(200).json(results);
      }
  });
});



app.put('/updateRequestStatus/:id', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const query = 'UPDATE leave_requests SET status = ? WHERE id = ?';

  db.query(query, [status, id], err => {
      if (err) {
          console.error('Error updating status:', err);
          res.status(500).json({ message: 'Error updating status' });
      } else {
          let alertMessage = '';
          if (status === 'Approved') {
              alertMessage = 'Leave request has been approved.';
          } else if (status === 'Rejected') {
              alertMessage = 'Leave request has been rejected.';
          }

          res.status(200).json({ message: 'Status updated successfully', alertMessage });
      }
  });
});

app.get('/getLeaveStatus/:id', (req, res) => {
  const id = req.params.id;
  const query = 'SELECT status FROM leave_requests WHERE id = ?';

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching updated status:', err);
      res.status(500).json({ message: 'Error fetching updated status' });
    } else {
      if (results.length > 0) {
        const status = results[0].status;
        res.status(200).json({ status });
      } else {
        res.status(404).json({ message: 'Leave request not found' });
      }
    }
  });
});










app.delete('/student/:id', (req, res) => {
  const id = req.params.id;

  const sql1 = 'DELETE FROM student WHERE ID = ?';
  db.query(sql1, id, (err, result1) => {
    if (err) {
      console.error('Error deleting from student table:', err);
      return res.status(500).json('Error');
    }

    const sql2 = 'DELETE FROM students WHERE ID = ?';
    db.query(sql2, id, (err, result2) => {
      if (err) {
        console.error('Error deleting from students table:', err);
        return res.status(500).json('Error');
      }

      const sql3 = 'DELETE FROM image WHERE ID = ?';
      db.query(sql3, id, (err, result3) => {
        if (err) {
          console.error('Error deleting from image table:', err);
          return res.status(500).json('Error');
        }

        return res.json('Record deleted successfully');
      });
    });
  });
});
    


app.listen(4000, () => {
    console.log("Server is listening on port 4000");
});
