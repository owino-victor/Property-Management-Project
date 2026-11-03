#ifndef STATEMENT_H
#define STATEMENT_H

#include <sqlite3.h>
#include <string>

class Statement {
private:
    sqlite3_stmt* stmt = nullptr;

public:
    Statement(sqlite3* db, const std::string& sql);
    ~Statement();

    Statement(const Statement&) = delete;
    Statement& operator=(const Statement&) = delete;

    void text(int index, const std::string& value);
    void number(int index, int value);

    bool next();
    bool run();

    std::string getText(int column);
    int getNumber(int column);
};

#endif