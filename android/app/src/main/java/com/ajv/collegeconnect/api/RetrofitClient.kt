package com.ajv.collegeconnect.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {
    // Note: Use 10.0.2.2 to connect to localhost from the Android Emulator
    private const val BASE_URL = "http://10.0.2.2:5000"

    private val retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val api: CollegeApi by lazy {
        retrofit.create(CollegeApi::class.java)
    }
}
