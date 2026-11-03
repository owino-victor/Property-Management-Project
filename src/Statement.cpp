#include "Statement.h"
#include <iostream>

Statement::Statement(sqlite3* db, const std::string& sql) {
    if (!db) {
        std::cerr << "Cannot prepare statement: database is not connected.\n";
        return;
    }

    if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
        std::cerr << "Query error: " << sqlite3_errmsg(db) << '\n';
    }
}

Statement::~Statement() {
    if (stmt) {
        sqlite3_finalize(stmt);
    }
}

void Statement::text(int index, const std::string& value) {
    if (stmt) {
        sqlite3_bind_text(stmt, index, value.c_str(), -1, SQLITE_TRANSIENT);
    }
}

void Statement::number(int index, int value) {
    if (stmt) {
        sqlite3_bind_int(stmt, index, value);
    }
}

bool Statement::next() {
    return stmt && sqlite3_step(stmt) == SQLITE_ROW;
}

bool Statement::run() {
    return stmt && sqlite3_step(stmt) == SQLITE_DONE;
}

std::string Statement::getText(int column) {
    if (!stmt) return "";

    const unsigned char* value = sqlite3_column_text(stmt, column);

    return value
        ? reinterpret_cast<const char*>(value)
        : "";
}

int Statement::getNumber(int column) {
    return stmt ? sqlite3_column_int(stmt, column) : 0;
}