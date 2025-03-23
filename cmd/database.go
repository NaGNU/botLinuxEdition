package main

import (
	"database/sql"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
)

func openDatabase() (*sql.DB, error) {
	db, err := sql.Open("sqlite3", "database/database.db")
	if err != nil {
		return nil, fmt.Errorf("error while opening database: %v", err)
	}
	return db, nil
}

func createTables() {
	query := `
	CREATE TABLE IF NOT EXISTS warned (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INTEGER,
		chat_id INTEGER
	);

	CREATE TABLE IF NOT EXISTS banned (
		user_id INTEGER PRIMARY KEY,
		chat_id INTEGER,
		until DATE
	);

	CREATE TABLE IF NOT EXISTS muted (
		user_id INTEGER PRIMARY KEY,
		chat_id INTEGER,
		until DATE
	);
	`

	_, err := database.Exec(query)
	if err != nil {
		panic(fmt.Sprintf("Error creating tables: %v", err))
	}

	fmt.Println("Tables created successfully.")
}
