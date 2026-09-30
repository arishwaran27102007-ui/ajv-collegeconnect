package com.ajv.collegeconnect

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.ajv.collegeconnect.ui.LoginScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var authToken by remember { mutableStateOf<String?>(null) }

                    if (authToken == null) {
                        LoginScreen(onLoginSuccess = { token ->
                            authToken = token
                        })
                    } else {
                        // Logged in state
                    }
                }
            }
        }
    }
}
