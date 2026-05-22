package com.aza.backend.service;

import com.aza.backend.entity.UploadedFile;
import com.aza.backend.repository.UploadedFileRepository;
import com.aza.backend.util.CloudinaryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ImageServiceTest {

    private ImageService imageService;

    @Mock
    private UploadedFileRepository uploadedFileRepository;

    @Mock
    private CloudinaryService cloudinaryService;

    // A valid PNG header sequence (89 50 4E 47 ...)
    private final byte[] validPngBytes = new byte[]{(byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47, 0, 0, 0, 0};
    
    // A valid JPEG header sequence (FF D8 FF ...)
    private final byte[] validJpegBytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0, 0, 0};

    private final byte[] invalidBytes = new byte[]{1, 2, 3, 4};

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        imageService = new ImageService(uploadedFileRepository, cloudinaryService);
    }

    @Test
    void testComputeSha256() {
        String expectedHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"; // Hash of "hello"
        byte[] bytes = "hello".getBytes();
        String hash = imageService.computeSha256(bytes);
        assertEquals(expectedHash, hash);
    }

    @Test
    void testProcessAndDeduplicateImage_NewFile() {
        // Arrange
        String sha256 = imageService.computeSha256(validPngBytes);
        String expectedUrl = "https://cloudinary.com/test-url";
        String folder = "aza/backgrounds/home";

        when(uploadedFileRepository.findById(sha256)).thenReturn(Optional.empty());
        when(cloudinaryService.uploadBytes(validPngBytes, folder)).thenReturn(expectedUrl);

        // Act
        String url = imageService.processAndDeduplicateImage(validPngBytes, folder);

        // Assert
        assertEquals(expectedUrl, url);
        verify(cloudinaryService, times(1)).uploadBytes(validPngBytes, folder);
        
        ArgumentCaptor<UploadedFile> captor = ArgumentCaptor.forClass(UploadedFile.class);
        verify(uploadedFileRepository, times(1)).save(captor.capture());
        
        UploadedFile savedFile = captor.getValue();
        assertEquals(sha256, savedFile.getSha256());
        assertEquals(expectedUrl, savedFile.getUrl());
        assertEquals(1, savedFile.getReferenceCount());
    }

    @Test
    void testProcessAndDeduplicateImage_ExistingFile() {
        // Arrange
        String sha256 = imageService.computeSha256(validJpegBytes);
        String existingUrl = "https://cloudinary.com/cached-url";
        String folder = "aza/backgrounds/home";

        UploadedFile cachedFile = UploadedFile.builder()
                .sha256(sha256)
                .url(existingUrl)
                .referenceCount(2)
                .build();

        when(uploadedFileRepository.findById(sha256)).thenReturn(Optional.of(cachedFile));

        // Act
        String url = imageService.processAndDeduplicateImage(validJpegBytes, folder);

        // Assert
        assertEquals(existingUrl, url);
        verify(cloudinaryService, never()).uploadBytes(any(), anyString());
        
        ArgumentCaptor<UploadedFile> captor = ArgumentCaptor.forClass(UploadedFile.class);
        verify(uploadedFileRepository, times(1)).save(captor.capture());
        
        UploadedFile savedFile = captor.getValue();
        assertEquals(sha256, savedFile.getSha256());
        assertEquals(3, savedFile.getReferenceCount()); // Incremented
    }

    @Test
    void testProcessAndDeduplicateImage_InvalidFormat() {
        // Act & Assert
        Exception exception = assertThrows(RuntimeException.class, () -> {
            imageService.processAndDeduplicateImage(invalidBytes, "folder");
        });
        assertTrue(exception.getMessage().contains("Invalid image format"));
    }

    @Test
    void testDecrementReferenceCount_MultipleReferences() {
        // Arrange
        String url = "https://cloudinary.com/test-url";
        UploadedFile file = UploadedFile.builder()
                .sha256("some-hash")
                .url(url)
                .referenceCount(3)
                .build();

        when(uploadedFileRepository.findByUrl(url)).thenReturn(Optional.of(file));

        // Act
        imageService.decrementReferenceCount(url);

        // Assert
        verify(uploadedFileRepository, times(1)).save(file);
        verify(uploadedFileRepository, never()).delete(any());
        assertEquals(2, file.getReferenceCount());
    }

    @Test
    void testDecrementReferenceCount_LastReference() {
        // Arrange
        String url = "https://cloudinary.com/test-url";
        UploadedFile file = UploadedFile.builder()
                .sha256("some-hash")
                .url(url)
                .referenceCount(1)
                .build();

        when(uploadedFileRepository.findByUrl(url)).thenReturn(Optional.of(file));

        // Act
        imageService.decrementReferenceCount(url);

        // Assert
        verify(uploadedFileRepository, times(1)).delete(file);
        verify(uploadedFileRepository, never()).save(any());
    }

    @Test
    void testProcessExternalUrl_DownloadsAndProcesses() {
        // Arrange
        ImageService spyService = spy(imageService);
        String externalUrl = "http://example.com/test.png";
        String folder = "aza/backgrounds/home";
        String expectedCloudinaryUrl = "https://cloudinary.com/test-url";

        doReturn(validPngBytes).when(spyService).downloadImageBytes(externalUrl);
        doReturn(expectedCloudinaryUrl).when(spyService).processAndDeduplicateImage(validPngBytes, folder);

        // Act
        String resultUrl = spyService.processExternalUrl(externalUrl, folder);

        // Assert
        assertEquals(expectedCloudinaryUrl, resultUrl);
        verify(spyService, times(1)).downloadImageBytes(externalUrl);
        verify(spyService, times(1)).processAndDeduplicateImage(validPngBytes, folder);
    }
}
