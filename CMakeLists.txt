
cmake_minimum_required(VERSION 3.20)

project(PropertyManagementSystem VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(SQLite3 REQUIRED)

add_executable(PropertyManagementSystem
    src/main.cpp
    src/DatabaseManager.cpp
)

target_include_directories(PropertyManagementSystem
    PRIVATE include
)

target_link_libraries(PropertyManagementSystem
    PRIVATE SQLite3::SQLite3
)
