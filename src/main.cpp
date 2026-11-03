
#include <iostream>
#include <string>
#include <limits>
#include <sqlite3.h>

using namespace std;

sqlite3* db = nullptr;

// ---------------- DATABASE HELPERS ----------------

bool execute(const string& sql) {
    char* error = nullptr;
    int result = sqlite3_exec(db, sql.c_str(), nullptr, nullptr, &error);

    if (result != SQLITE_OK) {
        cerr << "Database error: " << (error ? error : "Unknown") << '\n';
        sqlite3_free(error);
        return false;
    }
    return true;
}

class Statement {
public:
    sqlite3_stmt* stmt = nullptr;

    Statement(const string& sql) {
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            cerr << "Query error: " << sqlite3_errmsg(db) << '\n';
        }
    }

    ~Statement() {
        if (stmt) sqlite3_finalize(stmt);
    }

    void text(int index, const string& value) {
        sqlite3_bind_text(stmt, index, value.c_str(), -1, SQLITE_TRANSIENT);
    }

    void number(int index, int value) {
        sqlite3_bind_int(stmt, index, value);
    }

    bool next() {
        return stmt && sqlite3_step(stmt) == SQLITE_ROW;
    }

    bool run() {
        return stmt && sqlite3_step(stmt) == SQLITE_DONE;
    }

    string getText(int column) {
        const unsigned char* value = sqlite3_column_text(stmt, column);
        return value ? reinterpret_cast<const char*>(value) : "";
    }

    int getNumber(int column) {
        return sqlite3_column_int(stmt, column);
    }
};

string input(const string& prompt) {
    cout << prompt;
    string value;
    getline(cin, value);
    return value;
}

int choice(const string& prompt) {
    cout << prompt;
    int value;

    if (!(cin >> value)) {
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return -1;
    }

    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    return value;
}

void pause() {
    cout << "\nPress Enter to continue...";
    cin.get();
}

void heading(const string& title) {
    cout << "\n========================================\n";
    cout << " " << title << '\n';
    cout << "========================================\n";
}

// ---------------- DATABASE INITIALIZATION ----------------

bool initializeDatabase() {
    const char* schema = R"(
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS houses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            house_number TEXT UNIQUE NOT NULL,
            occupied INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            house_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (house_id) REFERENCES houses(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            tenant_id INTEGER,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            response TEXT DEFAULT '',
            scheduled_at TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS leaving_notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            notice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            departure_date TEXT DEFAULT '',
            status TEXT DEFAULT 'Submitted',
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );
    )";

    if (!execute(schema)) return false;

    execute(
        "INSERT OR IGNORE INTO users(username,password,role) "
        "VALUES('owner','owner123','owner')"
    );

    execute(
        "INSERT OR IGNORE INTO users(username,password,role) "
        "VALUES('caretaker','care123','caretaker')"
    );

    return true;
}

// ---------------- HOUSE MANAGEMENT ----------------

void listHouses() {
    heading("HOUSE REGISTER");

    Statement query(
        "SELECT id,house_number,occupied FROM houses ORDER BY house_number"
    );

    while (query.next()) {
        cout << "ID: " << query.getNumber(0)
             << " | House: " << query.getText(1)
             << " | " << (query.getNumber(2) ? "Occupied" : "Vacant")
             << '\n';
    }
}


void addHouse() {
    heading("ADD HOUSE");

    string number = input("House number/name: ");

    if (number.empty()) {
        cout << "House number cannot be empty.\n";
        return;
    }

    Statement query("INSERT INTO houses(house_number) VALUES(?)");
    query.text(1, number);

    if (query.run())
        cout << "House added successfully.\n";
    else
        cout << "Could not add house. Check for duplicate house numbers.\n";
}


// ---------------- TENANT MANAGEMENT ----------------

void assignTenant() {
    heading("REGISTER AND ASSIGN TENANT");

    listHouses();

    int houseId = choice("\nEnter vacant house ID: ");

    Statement house("SELECT occupied FROM houses WHERE id=?");
    house.number(1, houseId);

    if (!house.next() || house.getNumber(0) != 0) {
        cout << "House does not exist or is already occupied.\n";
        return;
    }

    string name = input("Tenant name: ");
    string phone = input("Phone number: ");
    string username = input("Create tenant username: ");
    string password = input("Create tenant password: ");

    // Validate required details
    if (name.empty() || phone.empty() ||
        username.empty() || password.empty()) {
        cout << "All tenant details are required.\n";
        return;
    }

    // Prevent duplicate usernames, regardless of capitalization
    Statement existing(
        "SELECT id FROM users WHERE username=? COLLATE NOCASE"
    );
    existing.text(1, username);

    if (existing.next()) {
        cout << "That username is already taken.\n";
        return;
    }

    execute("BEGIN TRANSACTION");

    Statement tenant(
        "INSERT INTO tenants(house_id,name,phone) VALUES(?,?,?)"
    );
    tenant.number(1, houseId);
    tenant.text(2, name);
    tenant.text(3, phone);

    if (!tenant.run()) {
        execute("ROLLBACK");
        cout << "Tenant registration failed.\n";
        return;
    }

    int tenantId = static_cast<int>(sqlite3_last_insert_rowid(db));

    Statement user(
        "INSERT INTO users(username,password,role,tenant_id) "
        "VALUES(?,?,'tenant',?)"
    );
    user.text(1, username);
    user.text(2, password);
    user.number(3, tenantId);

    if (!user.run()) {
        execute("ROLLBACK");
        cout << "Account creation failed. Username may already exist.\n";
        return;
    }

    Statement update("UPDATE houses SET occupied=1 WHERE id=?");
    update.number(1, houseId);

    if (!update.run()) {
        execute("ROLLBACK");
        cout << "House assignment failed.\n";
        return;
    }

    execute("COMMIT");

    cout << "Tenant registered and assigned successfully!\n";
    cout << "Tenant account: " << username << '\n';
}

// ---------------- REQUEST MANAGEMENT ----------------

void viewRequests(int tenantId = -1) {
    heading("REQUESTS");

    string sql =
        "SELECT r.id,t.name,r.type,r.description,r.status,"
        "r.response,r.scheduled_at "
        "FROM requests r JOIN tenants t ON r.tenant_id=t.id";

    if (tenantId != -1)
        sql += " WHERE r.tenant_id=?";

    sql += " ORDER BY r.id DESC";

    Statement query(sql);

    if (tenantId != -1)
        query.number(1, tenantId);

    while (query.next()) {
        cout << "\nRequest #" << query.getNumber(0)
             << " | Tenant: " << query.getText(1)
             << "\nType: " << query.getText(2)
             << "\nDescription: " << query.getText(3)
             << "\nStatus: " << query.getText(4)
             << "\nCaretaker response: " << query.getText(5)
             << "\nScheduled: " << query.getText(6)
             << "\n----------------------------------------\n";
    }
}

void submitRequest(int tenantId) {
    heading("SUBMIT REQUEST");

    cout << "1. Complaint\n";
    cout << "2. Repair\n";
    cout << "3. Assistance\n";

    int typeChoice = choice("Select request type: ");

    string type;

    switch (typeChoice) {
        case 1: type = "Complaint"; break;
        case 2: type = "Repair"; break;
        case 3: type = "Assistance"; break;
        default:
            cout << "Invalid choice.\n";
            return;
    }

    string description = input("Describe your request: ");

    Statement query(
        "INSERT INTO requests(tenant_id,type,description) VALUES(?,?,?)"
    );

    query.number(1, tenantId);
    query.text(2, type);
    query.text(3, description);

    if (query.run())
        cout << "Request submitted successfully!\n";
}

void updateRequest() {
    heading("RESPOND TO REQUEST");

    viewRequests();

    int id = choice("\nEnter request ID to update: ");

    Statement check("SELECT id FROM requests WHERE id=?");
    check.number(1, id);

    if (!check.next()) {
        cout << "Request not found.\n";
        return;
    }

    string response = input("Caretaker response: ");
    string scheduled = input("Scheduled date/time (or leave blank): ");

    cout << "\n1. Pending\n2. In Progress\n3. Resolved\n";
    int statusChoice = choice("New status: ");

    string status;

    switch (statusChoice) {
        case 1: status = "Pending"; break;
        case 2: status = "In Progress"; break;
        case 3: status = "Resolved"; break;
        default:
            cout << "Invalid status.\n";
            return;
    }

    Statement update(
        "UPDATE requests SET response=?,scheduled_at=?,status=? WHERE id=?"
    );

    update.text(1, response);
    update.text(2, scheduled);
    update.text(3, status);
    update.number(4, id);

    if (update.run())
        cout << "Request updated successfully.\n";
}

// ---------------- FEEDBACK ----------------

void submitFeedback(int tenantId) {
    heading("SUBMIT FEEDBACK");

    string message = input("Your feedback: ");

    Statement query(
        "INSERT INTO feedback(tenant_id,message) VALUES(?,?)"
    );

    query.number(1, tenantId);
    query.text(2, message);

    if (query.run())
        cout << "Feedback submitted successfully.\n";
}

void viewFeedback() {
    heading("TENANT FEEDBACK");

    Statement query(
        "SELECT f.id,t.name,f.message,f.created_at "
        "FROM feedback f JOIN tenants t ON f.tenant_id=t.id "
        "ORDER BY f.id DESC"
    );

    while (query.next()) {
        cout << "\nFeedback #" << query.getNumber(0)
             << " | " << query.getText(1)
             << "\n" << query.getText(2)
             << "\nDate: " << query.getText(3) << '\n';
    }
}

// ---------------- LEAVING NOTICES ----------------

void submitLeavingNotice(int tenantId) {
    heading("SUBMIT LEAVING NOTICE");

    string reason = input("Reason for leaving: ");

    Statement query(
        "INSERT INTO leaving_notices(tenant_id,reason) VALUES(?,?)"
    );

    query.number(1, tenantId);
    query.text(2, reason);

    if (query.run())
        cout << "Leaving notice submitted successfully.\n";
}

void viewNotices() {
    heading("LEAVING NOTICES");

    Statement query(
        "SELECT n.id,t.name,h.house_number,n.reason,"
        "n.notice_date,n.departure_date,n.status "
        "FROM leaving_notices n "
        "JOIN tenants t ON n.tenant_id=t.id "
        "JOIN houses h ON t.house_id=h.id "
        "ORDER BY n.id DESC"
    );

    while (query.next()) {
        cout << "\nNotice #" << query.getNumber(0)
             << " | Tenant: " << query.getText(1)
             << " | House: " << query.getText(2)
             << "\nReason: " << query.getText(3)
             << "\nSubmitted: " << query.getText(4)
             << "\nDeparture date: " << query.getText(5)
             << "\nStatus: " << query.getText(6) << '\n';
    }
}

void completeDeparture() {
    heading("RECORD TENANT DEPARTURE");

    viewNotices();

    int id = choice("\nEnter leaving notice ID: ");

    Statement query(
        "SELECT tenant_id FROM leaving_notices WHERE id=?"
    );
    query.number(1, id);

    if (!query.next()) {
        cout << "Notice not found.\n";
        return;
    }

    int tenantId = query.getNumber(0);
    string date = input("Actual departure date (YYYY-MM-DD): ");

    execute("BEGIN TRANSACTION");

    Statement notice(
        "UPDATE leaving_notices SET status='Completed',"
        "departure_date=? WHERE id=?"
    );
    notice.text(1, date);
    notice.number(2, id);

    Statement tenant(
        "UPDATE tenants SET active=0 WHERE id=?"
    );
    tenant.number(1, tenantId);

    Statement account(
        "UPDATE users SET active=0 WHERE tenant_id=?"
    );
    account.number(1, tenantId);

    Statement house(
        "UPDATE houses SET occupied=0 "
        "WHERE id=(SELECT house_id FROM tenants WHERE id=?)"
    );
    house.number(1, tenantId);

    if (notice.run() && tenant.run() && account.run() && house.run()) {
        execute("COMMIT");
        cout << "Departure recorded. House is now vacant and tenant access is deactivated.\n";
    } else {
        execute("ROLLBACK");
        cout << "Departure update failed.\n";
    }
}

// ---------------- DASHBOARDS ----------------

void ownerDashboard() {
    heading("OWNER DASHBOARD");

    Statement houses(
        "SELECT COUNT(*),"
        "COALESCE(SUM(occupied),0),"
        "COUNT(*)-COALESCE(SUM(occupied),0) FROM houses"
    );

    if (houses.next()) {
        cout << "Total houses: " << houses.getNumber(0)
             << "\nOccupied: " << houses.getNumber(1)
             << "\nVacant: " << houses.getNumber(2) << '\n';
    }

    Statement tenants("SELECT COUNT(*) FROM tenants WHERE active=1");
    if (tenants.next())
        cout << "Active tenants: " << tenants.getNumber(0) << '\n';

    Statement requests(
        "SELECT COUNT(*) FROM requests WHERE status!='Resolved'"
    );
    if (requests.next())
        cout << "Unresolved requests: " << requests.getNumber(0) << '\n';

    Statement notices(
        "SELECT COUNT(*) FROM leaving_notices WHERE status='Submitted'"
    );
    if (notices.next())
        cout << "Pending leaving notices: " << notices.getNumber(0) << '\n';

    cout << "\nRecent property requests:\n";
    viewRequests();
}

void viewTenants() {
    heading("TENANT REGISTER");

    Statement query(
        "SELECT t.id,t.name,t.phone,h.house_number,t.active "
        "FROM tenants t JOIN houses h ON t.house_id=h.id "
        "ORDER BY t.id DESC"
    );

    while (query.next()) {
        cout << "Tenant #" << query.getNumber(0)
             << " | " << query.getText(1)
             << " | " << query.getText(2)
             << " | House: " << query.getText(3)
             << " | " << (query.getNumber(4) ? "Active" : "Inactive")
             << '\n';
    }
}

// ---------------- LOGIN ----------------

bool login(string& role, int& tenantId) {
    heading("LOGIN");

    string username = input("Username: ");
    string password = input("Password: ");

    Statement query(
        "SELECT role,tenant_id FROM users "
        "WHERE username=? COLLATE NOCASE AND password=? AND active=1"
    );

    query.text(1, username);
    query.text(2, password);

    if (!query.next()) {
        cout << "Invalid username or password.\n";
        return false;
    }

    role = query.getText(0);
    tenantId = query.getNumber(1);

    cout << "\nLogin successful. Welcome!\n";
    return true;
}

// ---------------- MENUS ----------------

void caretakerMenu() {
    while (true) {
        heading("CARETAKER PORTAL");

        cout << "1. View houses\n";
        cout << "2. Add house\n";
        cout << "3. Register and assign tenant\n";
        cout << "4. View tenants\n";
        cout << "5. View requests\n";
        cout << "6. Respond to/update request\n";
        cout << "7. View feedback\n";
        cout << "8. View leaving notices\n";
        cout << "9. Record tenant departure\n";
        cout << "0. Logout\n";

        int c = choice("Select option: ");

        switch (c) {
            case 1: listHouses(); break;
            case 2: addHouse(); break;
            case 3: assignTenant(); break;
            case 4: viewTenants(); break;
            case 5: viewRequests(); break;
            case 6: updateRequest(); break;
            case 7: viewFeedback(); break;
            case 8: viewNotices(); break;
            case 9: completeDeparture(); break;
            case 0: return;
            default: cout << "Invalid option.\n";
        }

        pause();
    }
}

void tenantMenu(int tenantId) {
    while (true) {
        heading("TENANT PORTAL");

        cout << "1. Submit complaint/repair/assistance request\n";
        cout << "2. View my requests and responses\n";
        cout << "3. Submit feedback\n";
        cout << "4. Submit leaving notice\n";
        cout << "0. Logout\n";

        int c = choice("Select option: ");

        switch (c) {
            case 1: submitRequest(tenantId); break;
            case 2: viewRequests(tenantId); break;
            case 3: submitFeedback(tenantId); break;
            case 4: submitLeavingNotice(tenantId); break;
            case 0: return;
            default: cout << "Invalid option.\n";
        }

        pause();
    }
}

void ownerMenu() {
    while (true) {
        heading("OWNER PORTAL");

        cout << "1. Property dashboard\n";
        cout << "2. View houses\n";
        cout << "3. View tenants\n";
        cout << "4. View requests and caretaker responses\n";
        cout << "5. View feedback\n";
        cout << "6. View leaving notices\n";
        cout << "0. Logout\n";

        int c = choice("Select option: ");

        switch (c) {
            case 1: ownerDashboard(); break;
            case 2: listHouses(); break;
            case 3: viewTenants(); break;
            case 4: viewRequests(); break;
            case 5: viewFeedback(); break;
            case 6: viewNotices(); break;
            case 0: return;
            default: cout << "Invalid option.\n";
        }

        pause();
    }
}

// ---------------- MAIN ----------------

int main() {
    cout << "========================================\n";
    cout << "       PROPERTY MANAGEMENT SYSTEM\n";
    cout << "========================================\n";

    if (sqlite3_open("database/property_management.db", &db) != SQLITE_OK) {
        cerr << "Could not open database.\n";
        return 1;
    }

    if (!initializeDatabase()) {
        cerr << "Database initialization failed.\n";
        sqlite3_close(db);
        return 1;
    }

    cout << "Database ready.\n";

    bool running = true;

    while (running) {
        string role;
        int tenantId = 0;

        if (login(role, tenantId)) {
            if (role == "caretaker")
                caretakerMenu();
            else if (role == "owner")
                ownerMenu();
            else if (role == "tenant")
                tenantMenu(tenantId);
        }

        int again = choice("\n1. Login again\n0. Exit\nChoice: ");

        if (again != 1)
            running = false;
    }

    sqlite3_close(db);
    cout << "\nThank you for using the system!\n";

    return 0;
}
