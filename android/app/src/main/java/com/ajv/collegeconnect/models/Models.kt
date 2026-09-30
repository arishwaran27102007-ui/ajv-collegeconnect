package com.ajv.collegeconnect.models

data class LoginRequest(
    val loginId: String,
    val password: String,
    val role: String = "student"
)

data class LoginResponse(
    val token: String,
    val user: User
)

data class User(
    val id: Int,
    val loginId: String,
    val role: String,
    val fullName: String,
    val email: String,
    val department: String,
    val year: String,
    val section: String?,
    val cgpa: Double?,
    val overallPercentage: Double?,
    val attendance: Double?
)

data class StudentDashboardResponse(
    val profile: User,
    val academic: AcademicStats,
    val courses: List<CourseRecord>,
    val announcements: List<Announcement>
)

data class AcademicStats(
    val overallPercentage: Double,
    val cgpa: Double,
    val attendance: Double,
    val totalObtained: Double,
    val totalMax: Double
)

data class CourseRecord(
    val id: Int,
    val attendance: Double,
    val internalMark: Double,
    val externalMark: Double,
    val totalMark: Double,
    val percentage: Double,
    val grade: String,
    val gradePoint: Int,
    val course: Course
)

data class Course(
    val id: Int,
    val code: String,
    val name: String,
    val credits: Int,
    val department: String
)

data class Announcement(
    val title: String,
    val body: String
)
