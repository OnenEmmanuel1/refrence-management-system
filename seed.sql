-- ReferTrack SQL Seeds
-- Seed Departments
INSERT INTO departments (id, name) VALUES
(1, 'Cardiology'),
(2, 'Pediatrics'),
(3, 'General Medicine')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Users (Passwords are all bcrypt hash of 'password123': $2b$10$tMhIu7M7B7F2XpY199b5mOrj7ZgU.GveE.Rqyv3bVb/0Uo9t1HjW2)
INSERT INTO users (id, name, email, password_hash, role, department_id) VALUES
(1, 'System Administrator', 'admin@refertrack.com', '$2b$10$tMhIu7M7B7F2XpY199b5mOrj7ZgU.GveE.Rqyv3bVb/0Uo9t1HjW2', 'admin', NULL),
(2, 'Dr. Alice Smith', 'alice.smith@refertrack.com', '$2b$10$tMhIu7M7B7F2XpY199b5mOrj7ZgU.GveE.Rqyv3bVb/0Uo9t1HjW2', 'doctor', 3),
(3, 'Dr. Bob Johnson', 'bob.johnson@refertrack.com', '$2b$10$tMhIu7M7B7F2XpY199b5mOrj7ZgU.GveE.Rqyv3bVb/0Uo9t1HjW2', 'doctor', 2),
(4, 'Carol Davis', 'carol.davis@refertrack.com', '$2b$10$tMhIu7M7B7F2XpY199b5mOrj7ZgU.GveE.Rqyv3bVb/0Uo9t1HjW2', 'receptionist', NULL),
(5, 'Dr. Charles Xavier', 'charles.xavier@refertrack.com', '$2b$10$tMhIu7M7B7F2XpY199b5mOrj7ZgU.GveE.Rqyv3bVb/0Uo9t1HjW2', 'specialist', 1),
(6, 'Dr. Diana Prince', 'diana.prince@refertrack.com', '$2b$10$tMhIu7M7B7F2XpY199b5mOrj7ZgU.GveE.Rqyv3bVb/0Uo9t1HjW2', 'specialist', 2)
ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), password_hash=VALUES(password_hash), role=VALUES(role), department_id=VALUES(department_id);

-- Seed Patients
INSERT INTO patients (id, name, dob, gender, contact_info) VALUES
(1, 'John Doe', '1985-05-15', 'Male', '+1234567890, john.doe@email.com'),
(2, 'Jane Doe', '1990-08-20', 'Female', '+0987654321, jane.doe@email.com'),
(3, 'Baby Timmy', '2021-12-10', 'Male', 'Parent: +1122334455, parent@email.com')
ON DUPLICATE KEY UPDATE name=VALUES(name), dob=VALUES(dob), gender=VALUES(gender), contact_info=VALUES(contact_info);

-- Seed References
INSERT INTO references_table (id, patient_id, created_by_user_id, source_department_id, destination_department_id, reason, current_status, created_at) VALUES
(1, 3, 2, 3, 2, 'Persistent cough and high fever for 3 days. Query pediatric asthma.', 'Pending', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 1, 2, 3, 1, 'Palpitations and chest tightness during exertion. ECG shows mild abnormality.', 'In Progress', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(3, 2, 3, 2, 1, 'Postpartum cardiomyopathy screening after borderline echocardiogram.', 'Resolved', DATE_SUB(NOW(), INTERVAL 5 DAY))
ON DUPLICATE KEY UPDATE patient_id=VALUES(patient_id), created_by_user_id=VALUES(created_by_user_id), source_department_id=VALUES(source_department_id), destination_department_id=VALUES(destination_department_id), reason=VALUES(reason), current_status=VALUES(current_status);

-- Seed Reference Status Logs
INSERT INTO reference_status_log (id, reference_id, status, changed_by_user_id, changed_at) VALUES
(1, 1, 'Pending', 2, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 2, 'Pending', 2, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(3, 2, 'In Progress', 5, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(4, 3, 'Pending', 3, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(5, 3, 'In Progress', 5, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(6, 3, 'Resolved', 5, DATE_SUB(NOW(), INTERVAL 2 DAY))
ON DUPLICATE KEY UPDATE reference_id=VALUES(reference_id), status=VALUES(status), changed_by_user_id=VALUES(changed_by_user_id), changed_at=VALUES(changed_at);

-- Seed In-App Notifications
INSERT INTO notifications (id, department_id, user_id, reference_id, message, is_read) VALUES
(1, 2, NULL, 1, 'New pediatric referral for Baby Timmy created by Dr. Alice Smith.', FALSE),
(2, 1, NULL, 2, 'New cardiology referral for John Doe created by Dr. Alice Smith.', FALSE),
(3, NULL, 3, 3, 'Your referral for Jane Doe has been marked as Resolved by Dr. Charles Xavier.', FALSE)
ON DUPLICATE KEY UPDATE department_id=VALUES(department_id), user_id=VALUES(user_id), reference_id=VALUES(reference_id), message=VALUES(message), is_read=VALUES(is_read);
