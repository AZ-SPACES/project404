package com.aza.backend.config;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
public class GenerateHash {
    public static void main(String[] args) {
        System.out.println(new BCryptPasswordEncoder().encode("Password1!"));
    }
}
