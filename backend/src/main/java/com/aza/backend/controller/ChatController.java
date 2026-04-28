package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.chat.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chats")
@RequiredArgsConstructor
public class ChatController {
}
