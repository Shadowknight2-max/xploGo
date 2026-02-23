const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

const queries = [
    `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS trips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        place_name VARCHAR(255) NOT NULL,
        place_type VARCHAR(100),
        cost DECIMAL(10, 2),
        image VARCHAR(512),
        description TEXT,
        day INT DEFAULT 1,
        date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS trip_exports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_budget DECIMAL(10, 2),
        items_count INT,
        pdf_base64 LONGTEXT,
        exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
];

connection.connect(err => {
    if (err) {
        console.error('Error connecting to TiDB Cloud:', err);
        process.exit(1);
    }
    console.log('Connected to TiDB Cloud!');

    let completed = 0;
    queries.forEach(query => {
        connection.query(query, (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
            } else {
                console.log('Query successful');
            }
            completed++;
            if (completed === queries.length) {
                console.log('Database initialization complete.');
                connection.end();
            }
        });
    });
});
