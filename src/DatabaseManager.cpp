#include "DatabaseManager.h"
#include <iostream>

DatabaseManager::~DatabaseManager() {
    close();
}

bool DatabaseManager::connect(const std::string& path) {
    int result = sqlite3_open(path.c_str(), &db);

    if (result != SQLITE_OK) {
        std::cerr << "Database connection failed: "
                  << (db ? sqlite3_errmsg(db) : "Unknown error")
                  << '\n';

        close();
        return false;
    }

    std::cout << "Database connected successfully!\n";
    return true;
}

void DatabaseManager::close() {
    if (db != nullptr) {
        sqlite3_close(db);
        db = nullptr;
    }
}

bool DatabaseManager::isConnected() const {
    return db != nullptr;
}

bool DatabaseManager::execute(const std::string& sql) const {
    if (!db) {
        std::cerr << "Database is not connected.\n";
        return false;
    }

    char* error = nullptr;

    int result = sqlite3_exec(
        db,
        sql.c_str(),
        nullptr,
        nullptr,
        &error
    );

    if (result != SQLITE_OK) {
        std::cerr << "Database error: "
                  << (error ? error : "Unknown error")
                  << '\n';

        sqlite3_free(error);
        return false;
    }

    return true;
}

sqlite3* DatabaseManager::connection() const {
    return db;
}

int DatabaseManager::lastInsertRowId() const {
    return db ? static_cast<int>(sqlite3_last_insert_rowid(db)) : 0;
}