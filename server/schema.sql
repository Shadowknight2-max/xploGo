-- XploGo Database Schema (Updated for Large IDs)

CREATE DATABASE IF NOT EXISTS xplogo;
USE xplogo;

-- Users Table
-- Using BIGINT to accommodate large 13-digit frontend timestamps/IDs
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    place_name VARCHAR(100),
    place_type VARCHAR(50),
    cost DECIMAL(10, 2),
    image VARCHAR(255),
    description TEXT,
    day VARCHAR(50),
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trip Exports Table (Snapshots of exported PDFs)
CREATE TABLE IF NOT EXISTS trip_exports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    total_budget DECIMAL(10, 2),
    items_count INT,
    pdf_base64 LONGTEXT, -- Stores the document snapshot for retrieval
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
