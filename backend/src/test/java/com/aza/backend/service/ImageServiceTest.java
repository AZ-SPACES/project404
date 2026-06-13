package com.aza.backend.service;

import com.aza.backend.entity.UploadedFile;
import com.aza.backend.repository.UploadedFileRepository;
import com.aza.backend.util.CloudinaryService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class ImageServiceTest {

    @Autowired ImageService imageService;

    @MockitoBean UploadedFileRepository uploadedFileRepository;
    @MockitoBean CloudinaryService cloudinaryService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final byte[] validPngBytes  = {(byte) 0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0};
    private final byte[] validJpegBytes = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0, 0, 0};
    private final byte[] invalidBytes   = {1, 2, 3, 4};

    @Test
    void testComputeSha256() {
        String hash = imageService.computeSha256("hello".getBytes());
        assertEquals("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", hash);
    }

    @Test
    void testProcessAndDeduplicateImage_NewFile() {
        String sha256 = imageService.computeSha256(validPngBytes);
        String folder = "aza/backgrounds/home";
        String expectedUrl = "https://cloudinary.com/test-url";

        when(uploadedFileRepository.findById(sha256)).thenReturn(Optional.empty());
        when(cloudinaryService.uploadBytes(validPngBytes, folder)).thenReturn(expectedUrl);

        String url = imageService.processAndDeduplicateImage(validPngBytes, folder);

        assertEquals(expectedUrl, url);
        verify(cloudinaryService).uploadBytes(validPngBytes, folder);

        ArgumentCaptor<UploadedFile> captor = ArgumentCaptor.forClass(UploadedFile.class);
        verify(uploadedFileRepository).save(captor.capture());
        assertEquals(sha256, captor.getValue().getSha256());
        assertEquals(expectedUrl, captor.getValue().getUrl());
        assertEquals(1, captor.getValue().getReferenceCount());
    }

    @Test
    void testProcessAndDeduplicateImage_ExistingFile() {
        String sha256 = imageService.computeSha256(validJpegBytes);
        String existingUrl = "https://cloudinary.com/cached-url";
        String folder = "aza/backgrounds/home";

        UploadedFile cached = UploadedFile.builder()
                .sha256(sha256).url(existingUrl).referenceCount(2).build();
        when(uploadedFileRepository.findById(sha256)).thenReturn(Optional.of(cached));

        String url = imageService.processAndDeduplicateImage(validJpegBytes, folder);

        assertEquals(existingUrl, url);
        verify(cloudinaryService, never()).uploadBytes(any(), anyString());

        ArgumentCaptor<UploadedFile> captor = ArgumentCaptor.forClass(UploadedFile.class);
        verify(uploadedFileRepository).save(captor.capture());
        assertEquals(3, captor.getValue().getReferenceCount());
    }

    @Test
    void testProcessAndDeduplicateImage_InvalidFormat() {
        Exception ex = assertThrows(RuntimeException.class,
                () -> imageService.processAndDeduplicateImage(invalidBytes, "folder"));
        assertTrue(ex.getMessage().contains("Invalid image format"));
    }

    @Test
    void testDecrementReferenceCount_MultipleReferences() {
        String url = "https://cloudinary.com/test-url";
        UploadedFile file = UploadedFile.builder()
                .sha256("some-hash").url(url).referenceCount(3).build();
        when(uploadedFileRepository.findByUrl(url)).thenReturn(Optional.of(file));

        imageService.decrementReferenceCount(url);

        verify(uploadedFileRepository).save(file);
        verify(uploadedFileRepository, never()).delete(any());
        assertEquals(2, file.getReferenceCount());
    }

    @Test
    void testDecrementReferenceCount_LastReference() {
        String url = "https://cloudinary.com/test-url";
        UploadedFile file = UploadedFile.builder()
                .sha256("some-hash").url(url).referenceCount(1).build();
        when(uploadedFileRepository.findByUrl(url)).thenReturn(Optional.of(file));

        imageService.decrementReferenceCount(url);

        verify(uploadedFileRepository).delete(file);
        verify(uploadedFileRepository, never()).save(any());
    }
}
