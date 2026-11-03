#include "DatabaseManager.h"
#include <iostream>

DatabaseManager::~DatabaseManager() {
    close();
}

bool DatabaseManager::connect(const std::string& path) {
    int result = sqlite3_open(path.c_str(), &db);

    if (result != SQLITE_OK) {
        std::cerr << "Database connection failed: "
                  << sqlite3_errmsg(db) << '\n';

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