#ifndef DATABASE_MANAGER_H
#define DATABASE_MANAGER_H

#include <sqlite3.h>
#include <string>

class DatabaseManager {
private:
    sqlite3* db = nullptr;

public:
    DatabaseManager() = default;
    ~DatabaseManager();

    bool connect(const std::string& path);
    void close();

    bool isConnected() const;
};

#endif