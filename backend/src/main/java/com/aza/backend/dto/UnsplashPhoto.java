package com.aza.backend.dto;

public record UnsplashPhoto(
        String id,
        String thumbUrl,
        String regularUrl,
        String photographerName,
        String photographerUrl,
        String downloadLocation
) {}
