package com.ajv.collegeconnect.api

import com.ajv.collegeconnect.models.LoginRequest
import com.ajv.collegeconnect.models.LoginResponse
import com.ajv.collegeconnect.models.StudentDashboardResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface CollegeApi {

    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @GET("/api/student/dashboard")
    suspend fun getStudentDashboard(
        @Header("Authorization") token: String
    ): Response<StudentDashboardResponse>

}
